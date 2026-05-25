"""Unit tests for the LLM Provider Gateway."""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from litellm.exceptions import AuthenticationError
from litellm.types.utils import Choices, ModelResponse, Usage

from app.domains.providers.exceptions import ProviderAuthenticationError
from app.domains.providers.gateway import ProviderGateway
from app.models import Provider


@pytest.fixture
def gateway():
    return ProviderGateway()


def _make_provider(
    provider_id: str = "prov_1",
    name: str = "Test",
    provider_type: str = "openai",
    model: str = "gpt-4o",
    api_key_encrypted: str = "enc-key",
    base_url: str = "https://api.openai.com/v1",
    is_enabled: bool = True,
) -> Provider:
    return Provider(
        id=provider_id,
        name=name,
        provider_type=provider_type,
        base_url=base_url,
        api_key_encrypted=api_key_encrypted,
        model=model,
        is_enabled=is_enabled,
    )


def _fake_model_response() -> ModelResponse:
    """Build a minimal fake LiteLLM ModelResponse."""
    choice = Choices(
        finish_reason="stop",
        index=0,
        message={"role": "assistant", "content": "hello"},
    )
    return ModelResponse(
        id="resp_1",
        choices=[choice],
        model="gpt-4o",
        usage=Usage(prompt_tokens=5, completion_tokens=2, total_tokens=7),
    )


def _mock_async_session():
    """Return a patch target for async_session that yields a well-formed mock DB."""
    mock_session = MagicMock()
    mock_session.add = MagicMock()
    mock_session.flush = AsyncMock()
    mock_session.refresh = AsyncMock()
    mock_session.commit = AsyncMock()
    mock_session_ctx = MagicMock()
    mock_session_ctx.__aenter__ = AsyncMock(return_value=mock_session)
    mock_session_ctx.__aexit__ = AsyncMock(return_value=False)
    return mock_session_ctx


class TestGatewayCompletion:
    """Tests for ProviderGateway._complete_model."""

    @pytest.mark.asyncio
    async def test_calls_acompletion_with_correct_model_string(self, gateway):
        """Gateway must call litellm.acompletion with 'provider_type/model' format."""
        provider = _make_provider(provider_type="openai", model="gpt-4o")
        fake_response = _fake_model_response()

        with patch.object(gateway, "_resolve_chain", new_callable=AsyncMock, return_value=[provider]):
            with patch("app.domains.providers.gateway.litellm.acompletion", new_callable=AsyncMock, return_value=fake_response) as mock_acomp:
                with patch("app.domains.providers.gateway.async_session", return_value=_mock_async_session()):
                    with patch("app.domains.providers.gateway.decrypt_api_key", return_value="plain-key"):
                        response = await gateway._complete_model("planner", messages=[{"role": "user", "content": "hi"}])

        assert response == fake_response
        mock_acomp.assert_awaited_once()
        call_kwargs = mock_acomp.call_args.kwargs
        assert call_kwargs["model"] == "openai/gpt-4o"

    @pytest.mark.asyncio
    async def test_passes_num_retries_zero(self, gateway):
        """num_retries=0 must always be passed to acompletion."""
        provider = _make_provider()
        fake_response = _fake_model_response()

        with patch.object(gateway, "_resolve_chain", new_callable=AsyncMock, return_value=[provider]):
            with patch("app.domains.providers.gateway.litellm.acompletion", new_callable=AsyncMock, return_value=fake_response) as mock_acomp:
                with patch("app.domains.providers.gateway.async_session", return_value=_mock_async_session()):
                    with patch("app.domains.providers.gateway.decrypt_api_key", return_value="plain-key"):
                        await gateway._complete_model("planner", messages=[{"role": "user", "content": "hi"}])

        call_kwargs = mock_acomp.call_args.kwargs
        assert call_kwargs.get("num_retries") == 0

    @pytest.mark.asyncio
    async def test_writes_usage_log_on_success(self, gateway):
        """A successful completion must write a usage log entry."""
        provider = _make_provider()
        fake_response = _fake_model_response()

        with patch.object(gateway, "_resolve_chain", new_callable=AsyncMock, return_value=[provider]):
            with patch("app.domains.providers.gateway.litellm.acompletion", new_callable=AsyncMock, return_value=fake_response):
                with patch("app.domains.providers.gateway.async_session", return_value=_mock_async_session()):
                    with patch("app.domains.providers.gateway.decrypt_api_key", return_value="plain-key"):
                        with patch("app.domains.providers.gateway.create_usage_log", new_callable=AsyncMock) as mock_log:
                            await gateway._complete_model("planner", messages=[{"role": "user", "content": "hi"}])

        mock_log.assert_awaited_once()
        log_kwargs = mock_log.call_args.kwargs
        assert log_kwargs["provider_id"] == provider.id
        assert log_kwargs["agent_role"] == "planner"
        assert log_kwargs["status"] == "success"
        assert log_kwargs["fallback_position"] == 0

    @pytest.mark.asyncio
    async def test_maps_authentication_error_to_provider_auth_error(self, gateway):
        """LiteLLM AuthenticationError must be mapped to ProviderAuthenticationError."""
        provider = _make_provider()
        exc = AuthenticationError("Invalid API key", llm_provider="openai", model="gpt-4o")

        with patch.object(gateway, "_resolve_chain", new_callable=AsyncMock, return_value=[provider]):
            with patch("app.domains.providers.gateway.litellm.acompletion", new_callable=AsyncMock, side_effect=exc):
                with patch("app.domains.providers.gateway.async_session", return_value=_mock_async_session()):
                    with patch("app.domains.providers.gateway.decrypt_api_key", return_value="plain-key"):
                        with pytest.raises(ProviderAuthenticationError):
                            await gateway._complete_model("planner", messages=[{"role": "user", "content": "hi"}])

    @pytest.mark.asyncio
    async def test_api_base_omitted_when_empty(self, gateway):
        """If provider.base_url is empty, api_base should not be passed (or be None)."""
        provider = _make_provider(base_url="")
        fake_response = _fake_model_response()

        with patch.object(gateway, "_resolve_chain", new_callable=AsyncMock, return_value=[provider]):
            with patch("app.domains.providers.gateway.litellm.acompletion", new_callable=AsyncMock, return_value=fake_response) as mock_acomp:
                with patch("app.domains.providers.gateway.async_session", return_value=_mock_async_session()):
                    with patch("app.domains.providers.gateway.decrypt_api_key", return_value="plain-key"):
                        await gateway._complete_model("planner", messages=[{"role": "user", "content": "hi"}])

        call_kwargs = mock_acomp.call_args.kwargs
        assert call_kwargs.get("api_base") is None


class TestGatewayBackwardCompat:
    """Tests for the backward-compatible complete() method."""

    @pytest.mark.asyncio
    async def test_complete_returns_string_content(self, gateway):
        """complete() must return the assistant's message content as a string."""
        fake_response = _fake_model_response()

        with patch.object(gateway, "_complete_model", new_callable=AsyncMock, return_value=fake_response):
            result = await gateway.complete(messages=[{"role": "user", "content": "hi"}], model_role="planner")

        assert result == "hello"
