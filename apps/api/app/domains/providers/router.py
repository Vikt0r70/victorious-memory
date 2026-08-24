"""FastAPI routers for LLM provider registry, agent settings, and usage logs."""

from __future__ import annotations

import time
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from litellm.exceptions import (
    APIConnectionError,
    APIError,
    AuthenticationError,
    ServiceUnavailableError,
    Timeout,
)
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.domains.providers.encryption import decrypt_api_key
from app.domains.providers.gateway import (
    ProviderAuthenticationError,
    ProviderError,
    ProviderTimeoutError,
    format_litellm_model,
    gateway,
)
from app.domains.providers.schemas import (
    AgentSettings,
    AgentSettingsResponse,
    ModelDiscoveryResponse,
    ProviderCreate,
    ProviderResponse,
    ProviderTestResponse,
    TemplateItemResponse,
    TransientTestRequest,
    UsageLogResponse,
)
from app.domains.providers.service import (
    create_provider as create_provider_svc,
    delete_provider as delete_provider_svc,
    get_provider as get_provider_svc,
    list_agents as list_agents_svc,
    list_providers as list_providers_svc,
    list_usage_logs as list_usage_logs_svc,
    update_agent_settings as update_agent_settings_svc,
    update_provider as update_provider_svc,
)
from app.domains.providers.templates import list_templates

# ---------------------------------------------------------------------------
# Sub-routers
# ---------------------------------------------------------------------------

providers_router = APIRouter(prefix="/providers", tags=["providers"])
router = providers_router  # Alias for backward compatibility with main.py
agents_router = APIRouter(prefix="/agents", tags=["agents"])
usage_router = APIRouter(prefix="/usage", tags=["usage"])

# ---------------------------------------------------------------------------
# Provider registry endpoints
# ---------------------------------------------------------------------------


@providers_router.get("/templates", response_model=list[TemplateItemResponse])
async def get_provider_templates() -> list[dict[str, Any]]:
    """Return pre-configured provider templates."""
    return list_templates()


@providers_router.post("/test-connection", response_model=ProviderTestResponse)
async def test_connection_transient(
    body: TransientTestRequest,
) -> ProviderTestResponse:
    """Test a provider configuration before saving to database."""
    start = time.perf_counter()
    api_key = body.api_key.strip() if body.api_key else ""
    base_url = body.base_url.rstrip("/") if body.base_url else ""

    # 1. Try probing /v1/models if base_url is present
    if base_url:
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                headers: dict[str, str] = {}
                if api_key:
                    headers["Authorization"] = f"Bearer {api_key}"
                
                probe_url = f"{base_url}/models" if base_url.endswith("/v1") else f"{base_url}/v1/models"
                probe = await client.get(probe_url, headers=headers)
                latency_ms = int((time.perf_counter() - start) * 1000)
                if probe.status_code == 200:
                    return ProviderTestResponse(
                        status="success",
                        response="Connected & verified (/models endpoint reached)",
                        latency_ms=latency_ms,
                    )
                if probe.status_code == 401:
                    return ProviderTestResponse(
                        status="error",
                        error="Authentication failed: Invalid API key (401)",
                        latency_ms=latency_ms,
                    )
        except Exception:
            pass  # Fall through to minimal completion test

    # 2. Minimal acompletion test with LiteLLM
    try:
        import litellm

        model_str = format_litellm_model(body.provider_type, body.model)
        start2 = time.perf_counter()
        await litellm.acompletion(
            model=model_str,
            messages=[{"role": "user", "content": "ping"}],
            api_key=api_key if api_key else None,
            api_base=base_url if base_url else None,
            max_tokens=1,
            num_retries=0,
            timeout=12,
        )
        latency_ms = int((time.perf_counter() - start2) * 1000)
        return ProviderTestResponse(
            status="success",
            response="Connected & verified (Test completion successful)",
            latency_ms=latency_ms,
        )
    except AuthenticationError as exc:
        latency_ms = int((time.perf_counter() - start) * 1000)
        return ProviderTestResponse(
            status="error",
            error=f"Authentication failed: {exc}",
            latency_ms=latency_ms,
        )
    except (Timeout, APIConnectionError) as exc:
        latency_ms = int((time.perf_counter() - start) * 1000)
        return ProviderTestResponse(
            status="error",
            error=f"Connection timeout or unreachable host: {exc}",
            latency_ms=latency_ms,
        )
    except Exception as exc:
        latency_ms = int((time.perf_counter() - start) * 1000)
        return ProviderTestResponse(
            status="error",
            error=f"Connection failed: {exc}",
            latency_ms=latency_ms,
        )


@providers_router.get("", response_model=list[ProviderResponse])
async def list_providers(
    db: AsyncSession = Depends(get_db),
) -> list[ProviderResponse]:
    """Return every configured provider (api_key excluded by schema)."""
    providers, _ = await list_providers_svc(db)
    return providers


@providers_router.post("", response_model=ProviderResponse)
async def create_provider(
    body: ProviderCreate,
    db: AsyncSession = Depends(get_db),
) -> ProviderResponse:
    """Create a new provider configuration."""
    provider = await create_provider_svc(db, body)
    return provider


@providers_router.put("/{provider_id}", response_model=ProviderResponse)
async def update_provider(
    provider_id: str,
    body: ProviderCreate,
    db: AsyncSession = Depends(get_db),
) -> ProviderResponse:
    """Update an existing provider configuration."""
    provider = await update_provider_svc(db, provider_id, body)
    if provider is None:
        raise HTTPException(
            status_code=404, detail=f"Provider '{provider_id}' not found"
        )
    return provider


@providers_router.delete("/{provider_id}", status_code=204, response_model=None)
async def delete_provider(
    provider_id: str,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Remove a provider configuration."""
    deleted = await delete_provider_svc(db, provider_id)
    if not deleted:
        raise HTTPException(
            status_code=404, detail=f"Provider '{provider_id}' not found"
        )


@providers_router.post("/{provider_id}/test", response_model=ProviderTestResponse)
async def test_provider(
    provider_id: str,
    db: AsyncSession = Depends(get_db),
) -> ProviderTestResponse:
    """Test a provider by probing its /v1/models endpoint or sending a minimal completion."""
    provider = await get_provider_svc(db, provider_id)
    if provider is None:
        raise HTTPException(
            status_code=404, detail=f"Provider '{provider_id}' not found"
        )

    start = time.perf_counter()
    api_key = (
        decrypt_api_key(provider.api_key_encrypted)
        if provider.api_key_encrypted
        else ""
    )
    base_url = provider.base_url.rstrip("/") if provider.base_url else ""

    # ---- Probe: GET {base_url}/v1/models ---------------------------------
    if base_url:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                headers: dict[str, str] = {}
                if api_key:
                    headers["Authorization"] = f"Bearer {api_key}"
                probe_url = f"{base_url}/models" if base_url.endswith("/v1") else f"{base_url}/v1/models"
                probe = await client.get(probe_url, headers=headers)
                latency_ms = int((time.perf_counter() - start) * 1000)
                if probe.status_code == 200:
                    return ProviderTestResponse(
                        status="success",
                        response="Probe successful",
                        latency_ms=latency_ms,
                    )
                if probe.status_code == 401:
                    raise HTTPException(
                        status_code=401,
                        detail="Invalid API key",
                    )
        except HTTPException:
            raise
        except Exception:
            pass  # Fall through to completion test

    # ---- Fallback: minimal acompletion ------------------------------------
    try:
        import litellm

        model_str = format_litellm_model(provider.provider_type, provider.model)
        start2 = time.perf_counter()
        await litellm.acompletion(
            model=model_str,
            messages=[{"role": "user", "content": "hi"}],
            api_key=api_key if api_key else None,
            api_base=base_url if base_url else None,
            max_tokens=1,
            num_retries=0,
            timeout=12,
        )
        latency_ms = int((time.perf_counter() - start2) * 1000)
        return ProviderTestResponse(
            status="success",
            response="Completion successful",
            latency_ms=latency_ms,
        )
    except AuthenticationError as exc:
        raise HTTPException(status_code=401, detail="Authentication failed") from exc
    except (Timeout, APIConnectionError) as exc:
        raise HTTPException(status_code=504, detail="Connection timeout") from exc
    except (APIError, ServiceUnavailableError) as exc:
        raise HTTPException(status_code=502, detail=f"Provider error: {exc}") from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Provider error: {exc}") from exc


@providers_router.get("/{provider_id}/models", response_model=ModelDiscoveryResponse)
async def discover_models(
    provider_id: str,
    db: AsyncSession = Depends(get_db),
) -> ModelDiscoveryResponse:
    """Discover available models for a provider."""
    provider = await get_provider_svc(db, provider_id)
    if provider is None:
        raise HTTPException(
            status_code=404, detail=f"Provider '{provider_id}' not found"
        )

    # 1. Try provider endpoint
    try:
        api_key = (
            decrypt_api_key(provider.api_key_encrypted)
            if provider.api_key_encrypted
            else ""
        )
        base_url = provider.base_url.rstrip("/") if provider.base_url else ""
        if base_url:
            async with httpx.AsyncClient(timeout=10.0) as client:
                headers: dict[str, str] = {}
                if api_key:
                    headers["Authorization"] = f"Bearer {api_key}"
                probe_url = f"{base_url}/models" if base_url.endswith("/v1") else f"{base_url}/v1/models"
                resp = await client.get(probe_url, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    raw_models = data.get("data", [])
                    models = []
                    for m in raw_models:
                        mid = m.get("id") if isinstance(m, dict) else str(m)
                        if mid:
                            models.append({"id": mid, "name": mid})
                    if models:
                        return ModelDiscoveryResponse(models=models)
    except Exception:
        pass

    # 2. Fall back to LiteLLM known models
    try:
        import litellm

        all_models = getattr(litellm, "models_by_provider", {})
        provider_type = provider.provider_type
        if provider_type in all_models:
            models = [{"id": m, "name": m} for m in all_models[provider_type]]
            return ModelDiscoveryResponse(models=models)
    except Exception:
        pass

    # 3. Fall back to the provider's currently configured model
    return ModelDiscoveryResponse(models=[{"id": provider.model, "name": provider.model}])


# ---------------------------------------------------------------------------
# Agent settings endpoints
# ---------------------------------------------------------------------------


@agents_router.get("", response_model=list[AgentSettingsResponse])
async def list_agents(
    db: AsyncSession = Depends(get_db),
) -> list[AgentSettingsResponse]:
    """Return settings for every configured agent role."""
    agents = await list_agents_svc(db)
    return agents


@agents_router.put("/{role}", response_model=AgentSettingsResponse)
async def update_agent(
    role: str,
    body: AgentSettings,
    db: AsyncSession = Depends(get_db),
) -> AgentSettingsResponse:
    """Update settings for a specific agent role."""
    agent = await update_agent_settings_svc(db, role, body)
    if agent is None:
        raise HTTPException(status_code=404, detail=f"Agent role '{role}' not found")
    return agent


@agents_router.post("/{role}/test", response_model=ProviderTestResponse)
async def test_agent(
    role: str,
    db: AsyncSession = Depends(get_db),
) -> ProviderTestResponse:
    """Send a test completion through the agent's configured fallback chain."""
    start = time.perf_counter()
    try:
        response = await gateway.complete(
            messages=[{"role": "user", "content": "Reply with 'ok'"}],
            model_role=role,
            response_format="text",
            max_tokens=10,
        )
        latency_ms = int((time.perf_counter() - start) * 1000)
        return ProviderTestResponse(
            status="success",
            response=response,
            latency_ms=latency_ms,
        )
    except ProviderError as exc:
        latency_ms = int((time.perf_counter() - start) * 1000)
        return ProviderTestResponse(
            status="error",
            error=str(exc),
            latency_ms=latency_ms,
        )


# ---------------------------------------------------------------------------
# Usage log endpoints
# ---------------------------------------------------------------------------


@usage_router.get("", response_model=list[UsageLogResponse])
async def get_usage_logs(
    agent_role: str | None = Query(None),
    provider_id: str | None = Query(None),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
) -> list[UsageLogResponse]:
    """Return recent LLM usage logs with provider names attached."""
    logs = await list_usage_logs_svc(
        db, agent_role=agent_role, provider_id=provider_id, limit=limit
    )
    return logs
