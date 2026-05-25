"""FastAPI routers for LLM provider registry, agent settings, and usage logs."""

from __future__ import annotations

import time

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
    gateway,
)
from app.domains.providers.schemas import (
    AgentSettings,
    AgentSettingsResponse,
    ModelDiscoveryResponse,
    ProviderCreate,
    ProviderResponse,
    ProviderTestResponse,
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

# ---------------------------------------------------------------------------
# Sub-routers
# ---------------------------------------------------------------------------

providers_router = APIRouter(prefix="/providers", tags=["providers"])
agents_router = APIRouter(prefix="/agents", tags=["agents"])
usage_router = APIRouter(prefix="/usage", tags=["usage"])

# ---------------------------------------------------------------------------
# Provider registry endpoints
# ---------------------------------------------------------------------------


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

    # ---- Probe: GET {base_url}/v1/models ---------------------------------
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            headers: dict[str, str] = {}
            if api_key:
                headers["Authorization"] = f"Bearer {api_key}"
            probe = await client.get(
                f"{provider.base_url.rstrip('/')}/v1/models",
                headers=headers,
            )
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
    except httpx.TimeoutException:
        latency_ms = int((time.perf_counter() - start) * 1000)
        raise HTTPException(status_code=504, detail="Connection timeout") from None
    except httpx.ConnectError:
        latency_ms = int((time.perf_counter() - start) * 1000)
        raise HTTPException(status_code=502, detail="Connection error") from None
    except HTTPException:
        raise
    except Exception:
        pass  # Fall through to completion test

    # ---- Fallback: minimal acompletion ------------------------------------
    try:
        import litellm

        model_str = f"{provider.provider_type}/{provider.model}"
        api_base = provider.base_url if provider.base_url else None

        start2 = time.perf_counter()
        await litellm.acompletion(
            model=model_str,
            messages=[{"role": "user", "content": "hi"}],
            api_key=api_key,
            api_base=api_base,
            max_tokens=1,
            num_retries=0,
            timeout=10,
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
        raise HTTPException(status_code=502, detail="Provider error") from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Provider error: {exc}") from exc


@providers_router.get("/{provider_id}/models", response_model=ModelDiscoveryResponse)
async def discover_models(
    provider_id: str,
    db: AsyncSession = Depends(get_db),
) -> ModelDiscoveryResponse:
    """Discover available models for a provider.

    1. Try the provider's /v1/models endpoint.
    2. Fall back to litellm's model list filtered by provider type.
    """
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
        async with httpx.AsyncClient(timeout=10.0) as client:
            headers: dict[str, str] = {}
            if api_key:
                headers["Authorization"] = f"Bearer {api_key}"
            resp = await client.get(
                f"{provider.base_url.rstrip('/')}/v1/models",
                headers=headers,
            )
            if resp.status_code == 200:
                data = resp.json()
                models = [
                    {"id": m.get("id", ""), "name": m.get("id", "")}
                    for m in data.get("data", [])
                ]
                return ModelDiscoveryResponse(models=models)
    except Exception:
        pass

    # 2. Fallback to litellm
    try:
        from litellm.utils import get_valid_models

        all_models = get_valid_models()
        prefix = provider.provider_type
        filtered = [m for m in all_models if m.startswith(prefix)]
        models = [{"id": m, "name": m} for m in filtered]
        return ModelDiscoveryResponse(models=models)
    except Exception:
        pass

    return ModelDiscoveryResponse(models=[])


# ---------------------------------------------------------------------------
# Agent settings endpoints
# ---------------------------------------------------------------------------


@agents_router.get("", response_model=list[AgentSettingsResponse])
async def list_agents(
    db: AsyncSession = Depends(get_db),
) -> list[AgentSettingsResponse]:
    """Return all configured agents."""
    agents = await list_agents_svc(db)
    return agents


@agents_router.put("/{role}", response_model=AgentSettingsResponse)
async def update_agent_settings(
    role: str,
    body: AgentSettings,
    db: AsyncSession = Depends(get_db),
) -> AgentSettingsResponse:
    """Update an agent's provider fallback chain and settings overrides."""
    try:
        agent = await update_agent_settings_svc(db, role, body)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if agent is None:
        raise HTTPException(
            status_code=404, detail=f"Agent role '{role}' not found"
        )
    return agent


@agents_router.post("/{role}/test", response_model=ProviderTestResponse)
async def test_agent_provider(role: str) -> ProviderTestResponse:
    """Test an agent's primary provider via the gateway."""
    try:
        reply = await gateway.complete(
            messages=[{"role": "user", "content": "Say hello in one word"}],
            model_role=role,
            response_format="text",
            max_tokens=20,
        )
        return ProviderTestResponse(status="success", response=reply.strip())
    except ProviderTimeoutError as exc:
        raise HTTPException(status_code=504, detail=str(exc)) from exc
    except ProviderAuthenticationError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    except ProviderError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# Usage log endpoints
# ---------------------------------------------------------------------------


@usage_router.get("", response_model=list[UsageLogResponse])
async def list_usage_logs(
    agent_role: str | None = Query(None),
    provider_id: str | None = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
) -> list[UsageLogResponse]:
    """Return usage logs, optionally filtered by agent role and/or provider."""
    logs = await list_usage_logs_svc(
        db, agent_role=agent_role, provider_id=provider_id, limit=limit
    )
    return logs


# ---------------------------------------------------------------------------
# Aggregate router exported to main.py
# ---------------------------------------------------------------------------

router = APIRouter()
router.include_router(providers_router)
router.include_router(agents_router)
router.include_router(usage_router)
