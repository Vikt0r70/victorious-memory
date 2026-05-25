"""Unit tests for the provider test endpoint (/providers/{id}/test)."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from httpx import Response as HttpxResponse
from litellm.exceptions import AuthenticationError

from app.domains.providers.encryption import decrypt_api_key
from app.models import Provider


def _scalar_one_or_none(mock_obj):
    result = MagicMock()
    result.scalar_one_or_none = MagicMock(return_value=mock_obj)
    return result


class TestProviderTestEndpoint:
    """Tests for POST /providers/{provider_id}/test."""

    @pytest.fixture(autouse=True)
    def _setup_provider(self, mock_db):
        """Pre-configure mock_db to return a provider for provider-id lookups."""
        self.provider = Provider(
            id="prov_123",
            name="TestProv",
            provider_type="openai",
            base_url="https://api.openai.com/v1",
            api_key_encrypted="enc-key",
            model="gpt-4o",
        )
        mock_db.execute = AsyncMock(return_value=_scalar_one_or_none(self.provider))

    def test_probe_success_returns_200(self, client, mock_db):
        """When the probe GET /v1/models returns 200, endpoint should return success."""
        with patch("app.domains.providers.router.decrypt_api_key", return_value="plain-key"):
            with patch("httpx.AsyncClient") as mock_client_cls:
                mock_client = MagicMock()
                mock_client.__aenter__ = AsyncMock(return_value=mock_client)
                mock_client.__aexit__ = AsyncMock(return_value=False)
                mock_client.get = AsyncMock(return_value=HttpxResponse(200, json={"data": []}))
                mock_client_cls.return_value = mock_client

                resp = client.post("/api/providers/prov_123/test")

        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "success"
        assert data["response"] == "Probe successful"

    def test_probe_failure_then_completion_success(self, client, mock_db):
        """When probe fails but completion succeeds, endpoint should return success."""
        with patch("app.domains.providers.router.decrypt_api_key", return_value="plain-key"):
            with patch("httpx.AsyncClient") as mock_client_cls:
                mock_client = MagicMock()
                mock_client.__aenter__ = AsyncMock(return_value=mock_client)
                mock_client.__aexit__ = AsyncMock(return_value=False)
                # Probe fails with 500
                mock_client.get = AsyncMock(return_value=HttpxResponse(500))
                mock_client_cls.return_value = mock_client

                with patch("litellm.acompletion", new_callable=AsyncMock) as mock_acomp:
                    mock_acomp.return_value = MagicMock()
                    resp = client.post("/api/providers/prov_123/test")

        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "success"
        assert data["response"] == "Completion successful"

    def test_probe_401_returns_401(self, client, mock_db):
        """When probe returns 401, endpoint should return 401."""
        with patch("app.domains.providers.router.decrypt_api_key", return_value="plain-key"):
            with patch("httpx.AsyncClient") as mock_client_cls:
                mock_client = MagicMock()
                mock_client.__aenter__ = AsyncMock(return_value=mock_client)
                mock_client.__aexit__ = AsyncMock(return_value=False)
                mock_client.get = AsyncMock(return_value=HttpxResponse(401))
                mock_client_cls.return_value = mock_client

                resp = client.post("/api/providers/prov_123/test")

        assert resp.status_code == 401
        assert resp.json()["detail"] == "Invalid API key"

    def test_completion_auth_error_returns_401(self, client, mock_db):
        """When completion raises AuthenticationError, endpoint should return 401."""
        with patch("app.domains.providers.router.decrypt_api_key", return_value="plain-key"):
            with patch("httpx.AsyncClient") as mock_client_cls:
                mock_client = MagicMock()
                mock_client.__aenter__ = AsyncMock(return_value=mock_client)
                mock_client.__aexit__ = AsyncMock(return_value=False)
                # Probe fails with 500 so we fall through to completion
                mock_client.get = AsyncMock(return_value=HttpxResponse(500))
                mock_client_cls.return_value = mock_client

                with patch("litellm.acompletion", new_callable=AsyncMock) as mock_acomp:
                    mock_acomp.side_effect = AuthenticationError(
                        "Bad key", llm_provider="openai", model="gpt-4o"
                    )
                    resp = client.post("/api/providers/prov_123/test")

        assert resp.status_code == 401
        assert resp.json()["detail"] == "Authentication failed"

    def test_connection_error_returns_502(self, client, mock_db):
        """When httpx.ConnectError is raised during probe, endpoint should return 502."""
        with patch("app.domains.providers.router.decrypt_api_key", return_value="plain-key"):
            with patch("httpx.AsyncClient") as mock_client_cls:
                mock_client = MagicMock()
                mock_client.__aenter__ = AsyncMock(return_value=mock_client)
                mock_client.__aexit__ = AsyncMock(return_value=False)
                mock_client.get = AsyncMock(side_effect=Exception("Connection failed"))
                mock_client_cls.return_value = mock_client

                with patch("litellm.acompletion", new_callable=AsyncMock) as mock_acomp:
                    mock_acomp.side_effect = Exception("Connection failed")
                    resp = client.post("/api/providers/prov_123/test")

        assert resp.status_code == 502

    def test_missing_provider_returns_404(self, client, mock_db):
        """When provider_id does not exist, endpoint should return 404."""
        mock_db.execute = AsyncMock(return_value=_scalar_one_or_none(None))
        resp = client.post("/api/providers/nonexistent/test")
        assert resp.status_code == 404
