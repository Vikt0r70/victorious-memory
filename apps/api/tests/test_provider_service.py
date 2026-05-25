"""Unit tests for the provider domain service layer."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy.engine.result import ScalarResult

from app.domains.providers.schemas import AgentSettings, ProviderCreate
from app.domains.providers.service import (
    create_provider,
    delete_provider,
    resolve_provider_chain,
    seed_default_agents,
    update_agent_settings,
    update_provider,
)
from app.models import Agent, Provider


def _scalar_one_or_none(mock_obj):
    """Helper to build a ScalarResult that returns mock_obj for scalar_one_or_none."""
    result = MagicMock()
    result.scalar_one_or_none = MagicMock(return_value=mock_obj)
    result.scalars = MagicMock(return_value=MagicMock(all=MagicMock(return_value=[mock_obj] if mock_obj else [])))
    return result


def _scalar_result_list(items):
    """Helper to build a ScalarResult that returns a list of items."""
    result = MagicMock()
    result.scalar_one_or_none = MagicMock(return_value=None)
    result.scalars = MagicMock(return_value=MagicMock(all=MagicMock(return_value=items)))
    return result


class TestCreateProvider:
    """Tests for create_provider."""

    @pytest.mark.asyncio
    async def test_create_provider_encrypts_api_key(self, mock_db):
        """create_provider should encrypt the api_key field before storage."""
        data = ProviderCreate(
            name="OpenAI",
            provider_type="openai",
            base_url="https://api.openai.com/v1",
            api_key="sk-test-key",
            model="gpt-4o",
        )
        mock_db.execute = AsyncMock(return_value=_scalar_result_list([]))

        with patch("app.domains.providers.service.encrypt_api_key", return_value="encrypted-blob") as mock_encrypt:
            provider = await create_provider(mock_db, data)

        mock_encrypt.assert_called_once_with("sk-test-key")
        assert provider.api_key_encrypted == "encrypted-blob"
        mock_db.add.assert_called_once()
        mock_db.flush.assert_awaited_once()


class TestUpdateProvider:
    """Tests for update_provider."""

    @pytest.mark.asyncio
    async def test_update_provider_reencrypts_changed_key(self, mock_db):
        """update_provider should re-encrypt the API key when a new one is supplied."""
        existing = Provider(
            id="prov_123",
            name="Old",
            provider_type="openai",
            base_url="https://api.openai.com/v1",
            api_key_encrypted="old-ciphertext",
            model="gpt-3",
        )
        mock_db.execute = AsyncMock(return_value=_scalar_one_or_none(existing))

        data = ProviderCreate(
            name="New",
            provider_type="openai",
            base_url="https://api.openai.com/v1",
            api_key="sk-new-key",
            model="gpt-4o",
        )

        with patch("app.domains.providers.service.encrypt_api_key", return_value="new-ciphertext") as mock_encrypt:
            updated = await update_provider(mock_db, "prov_123", data)

        mock_encrypt.assert_called_once_with("sk-new-key")
        assert updated.api_key_encrypted == "new-ciphertext"
        mock_db.flush.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_update_provider_skips_encryption_when_key_empty(self, mock_db):
        """update_provider should not touch api_key_encrypted when api_key is empty."""
        existing = Provider(
            id="prov_123",
            name="Old",
            provider_type="openai",
            base_url="https://api.openai.com/v1",
            api_key_encrypted="old-ciphertext",
            model="gpt-3",
        )
        mock_db.execute = AsyncMock(return_value=_scalar_one_or_none(existing))

        data = ProviderCreate(
            name="New",
            provider_type="openai",
            base_url="https://api.openai.com/v1",
            api_key="",
            model="gpt-4o",
        )

        with patch("app.domains.providers.service.encrypt_api_key") as mock_encrypt:
            updated = await update_provider(mock_db, "prov_123", data)

        mock_encrypt.assert_not_called()
        assert updated.api_key_encrypted == "old-ciphertext"


class TestResolveProviderChain:
    """Tests for resolve_provider_chain."""

    @pytest.mark.asyncio
    async def test_resolve_returns_correct_order(self, mock_db):
        """The chain must preserve the order defined by fallback_provider_ids."""
        prov_a = Provider(id="prov_a", name="A", provider_type="openai", base_url="u", model="m")
        prov_b = Provider(id="prov_b", name="B", provider_type="anthropic", base_url="u", model="m")
        prov_c = Provider(id="prov_c", name="C", provider_type="groq", base_url="u", model="m")

        agent = Agent(id="agent_1", role="planner", fallback_provider_ids=["prov_b", "prov_a", "prov_c"])

        # First execute returns the agent; second returns the providers
        mock_db.execute = AsyncMock(side_effect=[
            _scalar_one_or_none(agent),
            _scalar_result_list([prov_b, prov_a, prov_c]),
        ])

        chain = await resolve_provider_chain(mock_db, "planner")
        ids = [p.id for p in chain]
        assert ids == ["prov_b", "prov_a", "prov_c"]

    @pytest.mark.asyncio
    async def test_resolve_omits_disabled_providers(self, mock_db):
        """Disabled providers should be omitted from the chain."""
        prov_a = Provider(id="prov_a", name="A", provider_type="openai", base_url="u", model="m", is_enabled=True)

        agent = Agent(id="agent_1", role="executor", fallback_provider_ids=["prov_a", "prov_b"])

        # The real query filters out disabled providers, so only prov_a is returned
        mock_db.execute = AsyncMock(side_effect=[
            _scalar_one_or_none(agent),
            _scalar_result_list([prov_a]),
        ])

        chain = await resolve_provider_chain(mock_db, "executor")
        ids = [p.id for p in chain]
        assert ids == ["prov_a"]

    @pytest.mark.asyncio
    async def test_resolve_empty_when_no_agent(self, mock_db):
        """When the agent role doesn't exist, return an empty list."""
        mock_db.execute = AsyncMock(return_value=_scalar_one_or_none(None))
        chain = await resolve_provider_chain(mock_db, "nonexistent")
        assert chain == []


class TestUpdateAgentSettings:
    """Tests for update_agent_settings."""

    @pytest.mark.asyncio
    async def test_rejects_more_than_four_fallback_providers(self, mock_db):
        """A fallback chain longer than 4 providers must raise ValueError."""
        data = AgentSettings(
            role="planner",
            fallback_provider_ids=["p1", "p2", "p3", "p4", "p5"],
        )
        with pytest.raises(ValueError, match="at most 4"):
            await update_agent_settings(mock_db, "planner", data)

    @pytest.mark.asyncio
    async def test_accepts_exactly_four_fallback_providers(self, mock_db):
        """A fallback chain of exactly 4 providers should be accepted."""
        agent = Agent(id="a1", role="planner", fallback_provider_ids=[])
        mock_db.execute = AsyncMock(return_value=_scalar_one_or_none(agent))

        data = AgentSettings(
            role="planner",
            fallback_provider_ids=["p1", "p2", "p3", "p4"],
        )
        updated = await update_agent_settings(mock_db, "planner", data)
        assert updated.fallback_provider_ids == ["p1", "p2", "p3", "p4"]


class TestDeleteProvider:
    """Tests for delete_provider."""

    @pytest.mark.asyncio
    async def test_delete_returns_false_for_missing_id(self, mock_db):
        """Deleting a non-existent provider should return False."""
        mock_db.execute = AsyncMock(return_value=_scalar_one_or_none(None))
        result = await delete_provider(mock_db, "prov_missing")
        assert result is False
        mock_db.delete.assert_not_called()

    @pytest.mark.asyncio
    async def test_delete_returns_true_and_removes_row(self, mock_db):
        """Deleting an existing provider should return True and call delete."""
        existing = Provider(id="prov_1", name="X", provider_type="openai", base_url="u", model="m")
        mock_db.execute = AsyncMock(return_value=_scalar_one_or_none(existing))
        result = await delete_provider(mock_db, "prov_1")
        assert result is True
        mock_db.delete.assert_called_once()
        mock_db.flush.assert_awaited_once()


class TestUpdateAgentSettingsPrimaryProvider:
    """Tests for update_agent_settings with primary_provider_id."""

    @pytest.mark.asyncio
    async def test_persists_primary_provider_id(self, mock_db):
        """update_agent_settings should persist primary_provider_id on the agent."""
        agent = Agent(id="a1", role="extraction", fallback_provider_ids=[], primary_provider_id=None)
        mock_db.execute = AsyncMock(return_value=_scalar_one_or_none(agent))

        data = AgentSettings(
            role="extraction",
            primary_provider_id="prov_abc123",
            fallback_provider_ids=["prov_x", "prov_y"],
        )
        updated = await update_agent_settings(mock_db, "extraction", data)
        assert updated.primary_provider_id == "prov_abc123"
        assert updated.fallback_provider_ids == ["prov_x", "prov_y"]

    @pytest.mark.asyncio
    async def test_clears_primary_provider_id_when_none(self, mock_db):
        """Setting primary_provider_id=None should clear it."""
        agent = Agent(id="a1", role="extraction", fallback_provider_ids=[], primary_provider_id="prov_old")
        mock_db.execute = AsyncMock(return_value=_scalar_one_or_none(agent))

        data = AgentSettings(
            role="extraction",
            primary_provider_id=None,
            fallback_provider_ids=[],
        )
        updated = await update_agent_settings(mock_db, "extraction", data)
        assert updated.primary_provider_id is None


class TestSeedDefaultAgents:
    """Tests for seed_default_agents."""

    @pytest.mark.asyncio
    async def test_seeds_three_correct_roles(self, mock_db):
        """seed_default_agents should create extraction, edge_detection, consolidation."""
        # The seed function calls result.scalars().first() to check for
        # existing agents. Return a mock where scalars().first() is None.
        empty_result = MagicMock()
        empty_scalars = MagicMock()
        empty_scalars.first = MagicMock(return_value=None)
        empty_result.scalars = MagicMock(return_value=empty_scalars)
        # second call: scalar_one_or_none used for per-role check? No, it just
        # iterates roles. The only execute call in seed is the first check.
        mock_db.execute = AsyncMock(return_value=empty_result)

        # We'll track what agents are added via db.add
        added_agents: list[Agent] = []

        def capture_add(obj):
            if isinstance(obj, Agent):
                added_agents.append(obj)

        mock_db.add = MagicMock(side_effect=capture_add)

        await seed_default_agents(mock_db)
        roles = sorted([a.role for a in added_agents])
        assert roles == ["consolidation", "edge_detection", "extraction"]
        assert len(added_agents) == 3

    @pytest.mark.asyncio
    async def test_skips_when_agents_exist(self, mock_db):
        """seed_default_agents should not create duplicates if agents already exist."""
        existing_agent = Agent(id="a1", role="extraction")
        mock_db.execute = AsyncMock(return_value=_scalar_one_or_none(existing_agent))

        mock_db.add = MagicMock()
        await seed_default_agents(mock_db)
        mock_db.add.assert_not_called()


class TestResolveProviderChainPrimary:
    """Tests for resolve_provider_chain with primary_provider_id."""

    @pytest.mark.asyncio
    async def test_prepends_primary_before_fallbacks(self, mock_db):
        """When primary_provider_id is set, it should appear first in the chain."""
        prov_primary = Provider(id="prov_p", name="Primary", provider_type="openai", base_url="u", model="m")
        prov_fb1 = Provider(id="prov_f1", name="FB1", provider_type="openai", base_url="u", model="m")

        agent = Agent(
            id="a1", role="extraction",
            primary_provider_id="prov_p",
            fallback_provider_ids=["prov_f1"],
        )

        mock_db.execute = AsyncMock(side_effect=[
            _scalar_one_or_none(agent),
            _scalar_result_list([prov_primary, prov_fb1]),
        ])

        chain = await resolve_provider_chain(mock_db, "extraction")
        ids = [p.id for p in chain]
        assert ids == ["prov_p", "prov_f1"]

    @pytest.mark.asyncio
    async def test_deduplicates_primary_from_fallbacks(self, mock_db):
        """Primary should not appear twice even if listed in fallback_provider_ids."""
        prov_p = Provider(id="prov_p", name="Primary", provider_type="openai", base_url="u", model="m")

        agent = Agent(
            id="a1", role="extraction",
            primary_provider_id="prov_p",
            fallback_provider_ids=["prov_p", "prov_f1"],
        )

        mock_db.execute = AsyncMock(side_effect=[
            _scalar_one_or_none(agent),
            _scalar_result_list([prov_p]),
        ])

        chain = await resolve_provider_chain(mock_db, "extraction")
        ids = [p.id for p in chain]
        # should appear once, at the front
        assert ids == ["prov_p"]

    @pytest.mark.asyncio
    async def test_fallback_only_when_no_primary(self, mock_db):
        """When primary_provider_id is None, chain uses fallback list only."""
        prov_a = Provider(id="prov_a", name="A", provider_type="openai", base_url="u", model="m")
        prov_b = Provider(id="prov_b", name="B", provider_type="anthropic", base_url="u", model="m")

        agent = Agent(
            id="a1", role="extraction",
            primary_provider_id=None,
            fallback_provider_ids=["prov_a", "prov_b"],
        )

        mock_db.execute = AsyncMock(side_effect=[
            _scalar_one_or_none(agent),
            _scalar_result_list([prov_a, prov_b]),
        ])

        chain = await resolve_provider_chain(mock_db, "extraction")
        ids = [p.id for p in chain]
        assert ids == ["prov_a", "prov_b"]
