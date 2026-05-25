"""FastAPI router for LLM provider configuration management."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import ProviderConfig

from .gateway import ProviderError, ProviderTimeoutError, gateway
from .schemas import ProviderConfigCreate, ProviderConfigResponse, ProviderTestResponse

router = APIRouter(prefix="/providers", tags=["providers"])


# ---------------------------------------------------------------------------
# GET /providers — list all
# ---------------------------------------------------------------------------


@router.get("", response_model=list[ProviderConfigResponse])
async def list_providers(
    db: AsyncSession = Depends(get_db),
) -> list[ProviderConfig]:
    """Return every configured provider (api_key excluded by schema)."""
    result = await db.execute(select(ProviderConfig))
    return list(result.scalars().all())


# ---------------------------------------------------------------------------
# PUT /providers/{role} — upsert
# ---------------------------------------------------------------------------


@router.put("/{role}", response_model=ProviderConfigResponse)
async def upsert_provider(
    role: str,
    body: ProviderConfigCreate,
    db: AsyncSession = Depends(get_db),
) -> ProviderConfig:
    """Create or update the provider config for a given *role*."""
    result = await db.execute(
        select(ProviderConfig).where(ProviderConfig.role == role)
    )
    cfg = result.scalar_one_or_none()

    if cfg is None:
        cfg = ProviderConfig(
            id=ProviderConfig.new_id(),
            role=role,
            provider_type=body.provider_type,
            base_url=body.base_url,
            model=body.model,
            api_key=body.api_key,
            max_tokens=body.max_tokens,
        )
        db.add(cfg)
    else:
        cfg.provider_type = body.provider_type
        cfg.base_url = body.base_url
        cfg.model = body.model
        cfg.api_key = body.api_key
        cfg.max_tokens = body.max_tokens

    await db.flush()
    await db.refresh(cfg)
    return cfg


# ---------------------------------------------------------------------------
# DELETE /providers/{role}
# ---------------------------------------------------------------------------


@router.delete("/{role}", status_code=204)
async def delete_provider(
    role: str,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Remove the provider config for a given *role*."""
    result = await db.execute(
        select(ProviderConfig).where(ProviderConfig.role == role)
    )
    cfg = result.scalar_one_or_none()
    if cfg is None:
        raise HTTPException(status_code=404, detail=f"Provider role '{role}' not found")
    await db.delete(cfg)
    await db.flush()


# ---------------------------------------------------------------------------
# POST /providers/{role}/test
# ---------------------------------------------------------------------------


@router.post("/{role}/test", response_model=ProviderTestResponse)
async def test_provider(role: str) -> ProviderTestResponse:
    """Send a quick test prompt to the provider configured for *role*."""
    try:
        reply = await gateway.complete(
            messages=[
                {"role": "user", "content": "Say hello in one word"},
            ],
            model_role=role,
            response_format="text",
            max_tokens=20,
        )
        return ProviderTestResponse(status="ok", response=reply.strip())
    except ProviderTimeoutError as exc:
        raise HTTPException(status_code=504, detail=str(exc)) from exc
    except ProviderError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
