"""Provider domain service — CRUD, fallback chains, usage logs, and seeding."""

from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import select
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
    result = await db.execute(select(Provider))
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
    """Update an existing provider.  Re-encrypts the API key when it changes."""
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
    """Delete a provider by ID.  Returns ``True`` when a row was removed."""
    result = await db.execute(select(Provider).where(Provider.id == provider_id))
    provider: Provider | None = result.scalar_one_or_none()
    if provider is None:
        return False

    await db.delete(provider)
    await db.flush()
    return True


# ---------------------------------------------------------------------------
# Agent config
# ---------------------------------------------------------------------------


async def list_agents(db: AsyncSession) -> list[Agent]:
    """Return all configured agents."""
    result = await db.execute(select(Agent))
    return list(result.scalars().all())


async def get_agent_by_role(db: AsyncSession, role: str) -> Agent | None:
    """Fetch a single agent by its unique role name."""
    result = await db.execute(select(Agent).where(Agent.role == role))
    return result.scalar_one_or_none()


async def update_agent_settings(
    db: AsyncSession, role: str, data: AgentSettings
) -> Agent | None:
    """Update an agent's settings, validating fallback chain length."""
    if len(data.fallback_provider_ids) > 4:
        raise ValueError("Fallback chain may contain at most 4 providers")

    result = await db.execute(select(Agent).where(Agent.role == role))
    agent: Agent | None = result.scalar_one_or_none()
    if agent is None:
        return None

    agent.fallback_provider_ids = list(data.fallback_provider_ids)
    agent.settings_override = dict(data.settings_override)
    await db.flush()
    await db.refresh(agent)
    return agent


# ---------------------------------------------------------------------------
# Fallback chain resolution
# ---------------------------------------------------------------------------


async def resolve_provider_chain(
    db: AsyncSession, agent_role: str
) -> list[Provider]:
    """Resolve an agent's fallback chain to an ordered list of enabled providers."""
    agent = await get_agent_by_role(db, agent_role)
    if agent is None:
        return []

    if not agent.fallback_provider_ids:
        return []

    # Fetch providers in the order defined by the agent's fallback list.
    result = await db.execute(
        select(Provider).where(
            Provider.id.in_(agent.fallback_provider_ids),
            Provider.is_enabled.is_(True),
        )
    )
    providers: dict[str, Provider] = {p.id: p for p in result.scalars().all()}

    # Preserve the order defined by fallback_provider_ids.
    return [providers[pid] for pid in agent.fallback_provider_ids if pid in providers]


# ---------------------------------------------------------------------------
# Usage log queries
# ---------------------------------------------------------------------------


async def list_usage_logs(
    db: AsyncSession,
    agent_role: str | None = None,
    provider_id: str | None = None,
    limit: int = 100,
) -> list[UsageLog]:
    """Return usage logs, optionally filtered by agent role and/or provider."""
    stmt = select(UsageLog)

    if agent_role is not None:
        stmt = stmt.where(UsageLog.agent_role == agent_role)
    if provider_id is not None:
        stmt = stmt.where(UsageLog.provider_id == provider_id)

    stmt = stmt.order_by(UsageLog.created_at.desc()).limit(limit)
    result = await db.execute(stmt)
    return list(result.scalars().all())


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
    """Idempotently seed the three default agent roles if the table is empty."""
    result = await db.execute(select(Agent))
    if result.scalars().first() is not None:
        logger.debug("Agents table already seeded — skipping")
        return

    default_roles = ["planner", "researcher", "executor"]
    for role in default_roles:
        agent = Agent(
            id=Agent.new_id(),
            role=role,
            fallback_provider_ids=[],
            settings_override={},
        )
        db.add(agent)

    await db.flush()
    logger.info("Seeded default agents: %s", ", ".join(default_roles))
