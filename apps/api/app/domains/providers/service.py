"""Provider domain service — CRUD, fallback chains, usage logs, and seeding."""

from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import delete as sql_delete, select, update as sql_update
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.providers.encryption import decrypt_api_key, encrypt_api_key
from app.domains.providers.schemas import AgentSettings, ProviderCreate
from app.domains.providers.templates import PROVIDER_TEMPLATES
from app.models import Agent, Provider, UsageLog

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Provider CRUD
# ---------------------------------------------------------------------------


async def list_providers(db: AsyncSession) -> tuple[list[Provider], int]:
    """Return all providers and their total count."""
    result = await db.execute(select(Provider).order_by(Provider.created_at.asc()))
    providers = list(result.scalars().all())
    return providers, len(providers)


async def get_provider(db: AsyncSession, provider_id: str) -> Provider | None:
    """Fetch a single provider by ID."""
    result = await db.execute(select(Provider).where(Provider.id == provider_id))
    return result.scalar_one_or_none()


async def create_provider(db: AsyncSession, data: ProviderCreate) -> Provider:
    """Create a new provider, encrypting the API key if provided."""
    provider = Provider(
        id=Provider.new_id(),
        name=data.name,
        provider_type=data.provider_type,
        base_url=data.base_url,
        api_key_encrypted=encrypt_api_key(data.api_key) if data.api_key else "",
        model=data.model,
        max_tokens=data.max_tokens,
        is_enabled=data.is_enabled,
    )
    db.add(provider)
    await db.flush()
    await db.refresh(provider)
    return provider


async def update_provider(
    db: AsyncSession, provider_id: str, data: ProviderCreate
) -> Provider | None:
    """Update an existing provider. Re-encrypts the API key when it changes."""
    result = await db.execute(select(Provider).where(Provider.id == provider_id))
    provider: Provider | None = result.scalar_one_or_none()
    if provider is None:
        return None

    provider.name = data.name
    provider.provider_type = data.provider_type
    provider.base_url = data.base_url
    provider.model = data.model
    provider.max_tokens = data.max_tokens
    provider.is_enabled = data.is_enabled

    # Re-encrypt key only when a non-empty value is supplied.
    if data.api_key:
        provider.api_key_encrypted = encrypt_api_key(data.api_key)

    await db.flush()
    await db.refresh(provider)
    return provider


async def delete_provider(db: AsyncSession, provider_id: str) -> bool:
    """Delete a provider by ID safely, unlinking from agents and cleaning up usage logs."""
    result = await db.execute(select(Provider).where(Provider.id == provider_id))
    provider: Provider | None = result.scalar_one_or_none()
    if provider is None:
        return False

    # 1. Unlink from agent primary providers
    await db.execute(
        sql_update(Agent)
        .where(Agent.primary_provider_id == provider_id)
        .values(primary_provider_id=None)
    )

    # 2. Unlink from agent fallback lists
    agents = (await db.execute(select(Agent))).scalars().all()
    for agent in agents:
        if agent.fallback_provider_ids and provider_id in agent.fallback_provider_ids:
            new_fallbacks = [pid for pid in agent.fallback_provider_ids if pid != provider_id]
            agent.fallback_provider_ids = new_fallbacks

    # 3. Clean up associated usage logs to prevent foreign key violation
    await db.execute(
        sql_delete(UsageLog).where(UsageLog.provider_id == provider_id)
    )

    # 4. Delete the provider
    await db.delete(provider)
    await db.flush()
    return True


# ---------------------------------------------------------------------------
# Agent config
# ---------------------------------------------------------------------------


async def list_agents(db: AsyncSession) -> list[Agent]:
    """Return all configured agents."""
    result = await db.execute(select(Agent).order_by(Agent.role.asc()))
    return list(result.scalars().all())


async def get_agent(db: AsyncSession, role: str) -> Agent | None:
    """Fetch an agent config by role."""
    result = await db.execute(select(Agent).where(Agent.role == role))
    return result.scalar_one_or_none()


async def update_agent_settings(
    db: AsyncSession, role: str, data: AgentSettings
) -> Agent | None:
    """Update primary provider and fallback list for an agent role."""
    agent = await get_agent(db, role)
    if agent is None:
        return None

    # Validate that fallback chain has at most 4 entries.
    fallbacks = (data.fallback_provider_ids or [])[:4]

    agent.primary_provider_id = data.primary_provider_id
    agent.fallback_provider_ids = fallbacks
    if data.settings_override:
        agent.settings_override = data.settings_override

    await db.flush()
    await db.refresh(agent)
    return agent


# ---------------------------------------------------------------------------
# Fallback chain resolution
# ---------------------------------------------------------------------------


async def resolve_provider_chain(
    db: AsyncSession, agent_role: str
) -> list[Provider]:
    """Return an ordered list of enabled Provider objects for *agent_role*."""
    agent = await get_agent(db, agent_role)

    provider_ids: list[str] = []

    if agent is not None:
        if agent.primary_provider_id:
            provider_ids.append(agent.primary_provider_id)
        if agent.fallback_provider_ids:
            for pid in agent.fallback_provider_ids:
                if pid not in provider_ids:
                    provider_ids.append(pid)

    # If no provider configured for this agent, fall back to any enabled provider
    if not provider_ids:
        all_enabled = await db.execute(
            select(Provider).where(Provider.is_enabled.is_(True)).order_by(Provider.created_at.asc())
        )
        return list(all_enabled.scalars().all())

    # Fetch providers in the order defined above.
    result = await db.execute(
        select(Provider).where(
            Provider.id.in_(provider_ids),
            Provider.is_enabled.is_(True),
        )
    )
    providers: dict[str, Provider] = {p.id: p for p in result.scalars().all()}

    # Preserve the order.
    resolved = [providers[pid] for pid in provider_ids if pid in providers]

    # If all configured providers were disabled or missing, fallback to any enabled provider
    if not resolved:
        all_enabled = await db.execute(
            select(Provider).where(Provider.is_enabled.is_(True)).order_by(Provider.created_at.asc())
        )
        return list(all_enabled.scalars().all())

    return resolved


# ---------------------------------------------------------------------------
# Usage log queries
# ---------------------------------------------------------------------------


async def list_usage_logs(
    db: AsyncSession,
    agent_role: str | None = None,
    provider_id: str | None = None,
    limit: int = 100,
) -> list[dict[str, Any]]:
    """Return usage logs with provider names attached, filtered optionally."""
    stmt = (
        select(UsageLog, Provider.name.label("provider_name"))
        .outerjoin(Provider, UsageLog.provider_id == Provider.id)
    )

    if agent_role is not None and agent_role != "all":
        stmt = stmt.where(UsageLog.agent_role == agent_role)
    if provider_id is not None and provider_id != "all":
        stmt = stmt.where(UsageLog.provider_id == provider_id)

    stmt = stmt.order_by(UsageLog.created_at.desc()).limit(limit)
    result = await db.execute(stmt)
    rows = result.all()

    logs = []
    for log_obj, prov_name in rows:
        logs.append({
            "id": log_obj.id,
            "provider_id": log_obj.provider_id,
            "provider_name": prov_name or log_obj.provider_id,
            "agent_role": log_obj.agent_role,
            "model": log_obj.model,
            "prompt_tokens": log_obj.prompt_tokens,
            "completion_tokens": log_obj.completion_tokens,
            "total_tokens": log_obj.total_tokens,
            "latency_ms": log_obj.latency_ms,
            "status": log_obj.status,
            "fallback_position": log_obj.fallback_position,
            "error_message": log_obj.error_message,
            "created_at": log_obj.created_at,
        })
    return logs


async def create_usage_log(db: AsyncSession, **kwargs: Any) -> UsageLog:
    """Create a usage log entry (internal helper)."""
    log = UsageLog(**kwargs)
    db.add(log)
    await db.flush()
    await db.refresh(log)
    return log


# ---------------------------------------------------------------------------
# Seed function
# ---------------------------------------------------------------------------


async def seed_default_agents(db: AsyncSession) -> None:
    """Idempotently seed default agent roles and auto-seed initial provider from .env."""
    # 1. Seed agent roles if missing
    default_roles = ["extraction", "edge_detection", "consolidation"]
    for role in default_roles:
        existing = await get_agent(db, role)
        if existing is None:
            agent = Agent(
                id=Agent.new_id(),
                role=role,
                fallback_provider_ids=[],
                settings_override={},
            )
            db.add(agent)
            await db.flush()

    # 2. Check if any provider exists. If none, auto-seed from .env settings
    existing_providers_res = await db.execute(select(Provider))
    providers_list = list(existing_providers_res.scalars().all())

    if not providers_list:
        try:
            from app.config import settings
            if settings.llm_base_url and settings.llm_model:
                provider_type = "openai"
                if "anthropic" in settings.llm_base_url:
                    provider_type = "anthropic"
                elif "groq" in settings.llm_base_url:
                    provider_type = "groq"
                elif "ollama" in settings.llm_base_url:
                    provider_type = "ollama"

                init_provider = Provider(
                    id=Provider.new_id(),
                    name="Default (from .env)",
                    provider_type=provider_type,
                    base_url=settings.llm_base_url,
                    api_key_encrypted=encrypt_api_key(settings.llm_api_key) if settings.llm_api_key else "",
                    model=settings.llm_model,
                    max_tokens=4096,
                    is_enabled=True,
                )
                db.add(init_provider)
                await db.flush()

                # Link to extraction role as primary
                extraction_agent = await get_agent(db, "extraction")
                if extraction_agent:
                    extraction_agent.primary_provider_id = init_provider.id
                    await db.flush()

                logger.info(
                    "Auto-seeded default provider from .env: %s (%s)",
                    init_provider.name, init_provider.model
                )
        except Exception as e:
            logger.warning("Could not auto-seed provider from .env: %s", e)

    await db.flush()
    logger.info("Default agent roles verified.")
