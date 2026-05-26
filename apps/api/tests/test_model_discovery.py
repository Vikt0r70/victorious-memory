"""Tests for the provider model discovery endpoint (PROV-03)."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import Response as HttpxResponse

from app.models import Provider


def _scalar_one_or_none(mock_obj):
    result = MagicMock()
    result.scalar_one_or_none = MagicMock(return_value=mock_obj)
    return result


class TestModelDiscoveryEndpoint:
    """Tests for GET /providers/{id}/models."""

    provider: Provider | None = None

    @pytest.fixture(autouse=True)
    def _setup_provider(self, mock_db):
        self.provider = Provider(
            id="prov_123",
            name="TestProv",
            provider_type="openai",
            base_url="https://api.openai.com/v1",
            api_key_encrypted="enc-key",
            model="gpt-4o",
        )
        mock_db.execute = AsyncMock(return_value=_scalar_one_or_none(self.provider))

    def test_returns_models_from_provider_api(self, client, mock_db):
        """When provider's /v1/models returns a list, it should be passed through."""
        models_payload = {
            "data": [
                {"id": "gpt-4o", "object": "model"},
                {"id": "gpt-4", "object": "model"},
            ]
        }
        with patch("app.domains.providers.router.decrypt_api_key", return_value="plain-key"):
            with patch("httpx.AsyncClient") as mock_client_cls:
                mock_client = MagicMock()
                mock_client.__aenter__ = AsyncMock(return_value=mock_client)
                mock_client.__aexit__ = AsyncMock(return_value=False)
                mock_client.get = AsyncMock(return_value=HttpxResponse(200, json=models_payload))
                mock_client_cls.return_value = mock_client

                resp = client.get("/api/providers/prov_123/models")

        assert resp.status_code == 200
        data = resp.json()
        assert "models" in data
        assert len(data["models"]) == 2
        assert data["models"][0]["id"] == "gpt-4o"

    def test_falls_back_to_litellm_static_list(self, client, mock_db):
        """When provider API fails, fall back to LiteLLM static model list."""
        with patch("app.domains.providers.router.decrypt_api_key", return_value="plain-key"):
            with patch("httpx.AsyncClient") as mock_client_cls:
                mock_client = MagicMock()
                mock_client.__aenter__ = AsyncMock(return_value=mock_client)
                mock_client.__aexit__ = AsyncMock(return_value=False)
                mock_client.get = AsyncMock(return_value=HttpxResponse(500))
                mock_client_cls.return_value = mock_client

                with patch("app.domains.providers.router.get_valid_models", return_value=["openai/gpt-4o", "openai/gpt-4"]):
                    resp = client.get("/api/providers/prov_123/models")

        assert resp.status_code == 200
        data = resp.json()
        assert len(data["models"]) == 2
        # Should be formatted as {id, name} dicts
        assert data["models"][0]["id"] == "openai/gpt-4o"

    def test_returns_404_for_missing_provider(self, client, mock_db):
        """When provider_id does not exist, endpoint should return 404."""
        mock_db.execute = AsyncMock(return_value=_scalar_one_or_none(None))
        resp = client.get("/api/providers/nonexistent/models")
        assert resp.status_code == 404
