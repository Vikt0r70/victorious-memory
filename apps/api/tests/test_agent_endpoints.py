"""Tests for agent settings endpoints (PROV-02, PROV-05, PROV-07)."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models import Agent


def _scalar_one_or_none(mock_obj):
    result = MagicMock()
    result.scalar_one_or_none = MagicMock(return_value=mock_obj)
    return result


def _scalar_result_list(items):
    result = MagicMock()
    result.scalar_one_or_none = MagicMock(return_value=None)
    result.scalars = MagicMock(return_value=MagicMock(all=MagicMock(return_value=items)))
    return result


class TestAgentEndpoints:
    """Tests for GET /agents and PUT /agents/{role}."""

    def test_list_agents_returns_three_fixed_roles(self, client, mock_db):
        """GET /agents must return exactly the 3 fixed roles."""
        agents = [
            Agent(id="a1", role="extraction", fallback_provider_ids=[]),
            Agent(id="a2", role="edge_detection", fallback_provider_ids=[]),
            Agent(id="a3", role="consolidation", fallback_provider_ids=[]),
        ]
        mock_db.execute = AsyncMock(return_value=_scalar_result_list(agents))

        resp = client.get("/api/agents")
        assert resp.status_code == 200
        data = resp.json()
        roles = {a["role"] for a in data["items"]}
        assert roles == {"extraction", "edge_detection", "consolidation"}

    def test_update_agent_settings_persists_fallback_chain(self, client, mock_db):
        """PUT /agents/{role} must persist fallback_provider_ids."""
        agent = Agent(id="a1", role="extraction", fallback_provider_ids=[])
        mock_db.execute = AsyncMock(return_value=_scalar_one_or_none(agent))

        payload = {
            "role": "extraction",
            "primary_provider_id": "prov_1",
            "fallback_provider_ids": ["prov_1", "prov_2", "prov_3", "prov_4"],
        }
        resp = client.put("/api/agents/extraction", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["fallback_provider_ids"] == ["prov_1", "prov_2", "prov_3", "prov_4"]
        assert data["primary_provider_id"] == "prov_1"

    def test_update_agent_rejects_more_than_four_fallbacks(self, client, mock_db):
        """PUT /agents/{role} with >4 fallbacks must return 400."""
        agent = Agent(id="a1", role="extraction", fallback_provider_ids=[])
        mock_db.execute = AsyncMock(return_value=_scalar_one_or_none(agent))

        payload = {
            "role": "extraction",
            "fallback_provider_ids": ["p1", "p2", "p3", "p4", "p5"],
        }
        resp = client.put("/api/agents/extraction", json=payload)
        assert resp.status_code == 400

    def test_update_agent_returns_404_for_missing_role(self, client, mock_db):
        """PUT /agents/{role} for a non-existent role must return 404."""
        mock_db.execute = AsyncMock(return_value=_scalar_one_or_none(None))

        payload = {"role": "nonexistent", "fallback_provider_ids": []}
        resp = client.put("/api/agents/nonexistent", json=payload)
        assert resp.status_code == 404

    def test_agent_roles_are_read_only(self, client, mock_db):
        """Role field must not be modifiable via the API."""
        agent = Agent(id="a1", role="extraction", fallback_provider_ids=[])
        mock_db.execute = AsyncMock(return_value=_scalar_one_or_none(agent))

        # Even if client sends a different role in payload, the URL role wins
        payload = {"role": "hacker", "fallback_provider_ids": []}
        resp = client.put("/api/agents/extraction", json=payload)
        # Should succeed but preserve the original role
        assert resp.status_code == 200
        data = resp.json()
        assert data["role"] == "extraction"
