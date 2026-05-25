"""Unit tests for provider fallback chain behaviour inside ProviderGateway."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from litellm.exceptions import AuthenticationError, RateLimitError
from litellm.types.utils import Choices, ModelResponse, Usage

from app.domains.providers.exceptions import ProviderAuthenticationError, ProviderError
from app.domains.providers.gateway import ProviderGateway
from app.models import Provider


def _make_provider(provider_id: str, name: str, provider_type: str = "openai", model: str = "gpt-4o") -> Provider:
    return Provider(
        id=provider_id,
        name=name,
        provider_type=provider_type,
        base_url="https://example.com/v1",
        api_key_encrypted="enc",
        model=model,
    )


def _fake_response(content: str = "ok") -> ModelResponse:
    choice = Choices(
        finish_reason="stop",
        index=0,
        message={"role": "assistant", "content": content},
    )
    return ModelResponse(
        id="r1",
        choices=[choice],
        model="gpt-4o",
        usage=Usage(prompt_tokens=1, completion_tokens=1, total_tokens=2),
    )


def _mock_async_session():
    """Return a mock async session context manager."""
    mock_session = MagicMock()
    mock_session.add = MagicMock()
    mock_session.flush = AsyncMock()
    mock_session.refresh = AsyncMock()
    mock_session.commit = AsyncMock()
    mock_session_ctx = MagicMock()
    mock_session_ctx.__aenter__ = AsyncMock(return_value=mock_session)
    mock_session_ctx.__aexit__ = AsyncMock(return_value=False)
    return mock_session_ctx


class TestFallbackChain:
    """Tests for multi-provider fallback logic."""

    @pytest.mark.asyncio
    async def test_primary_fails_secondary_succeeds(self):
        """When the primary hits RateLimitError, the secondary should be tried and succeed."""
        gateway = ProviderGateway()
        primary = _make_provider("p1", "Primary")
        secondary = _make_provider("p2", "Secondary")

        with patch.object(gateway, "_resolve_chain", new_callable=AsyncMock, return_value=[primary, secondary]):
            with patch("app.domains.providers.gateway.litellm.acompletion", new_callable=AsyncMock) as mock_acomp:
                mock_acomp.side_effect = [
                    RateLimitError("Rate limited", llm_provider="openai", model="gpt-4o"),
                    _fake_response("secondary-ok"),
                ]
                with patch("app.domains.providers.gateway.async_session", return_value=_mock_async_session()):
                    with patch("app.domains.providers.gateway.decrypt_api_key", return_value="plain-key"):
                        with patch("app.domains.providers.gateway.create_usage_log", new_callable=AsyncMock) as mock_log:
                            response = await gateway._complete_model("planner", messages=[{"role": "user", "content": "hi"}])

        assert response.choices[0].message.content == "secondary-ok"
        assert mock_acomp.await_count == 2

        # Verify fallback_position=1 was logged for the successful secondary call
        log_calls = [c.kwargs for c in mock_log.call_args_list]
        success_calls = [c for c in log_calls if c.get("status") == "success"]
        assert len(success_calls) == 1
        assert success_calls[0]["fallback_position"] == 1

    @pytest.mark.asyncio
    async def test_all_four_fallback_positions_can_be_used(self):
        """A chain with 4 providers should try each one in sequence."""
        gateway = ProviderGateway()
        providers = [
            _make_provider(f"p{i}", f"Prov{i}")
            for i in range(1, 5)
        ]

        with patch.object(gateway, "_resolve_chain", new_callable=AsyncMock, return_value=providers):
            with patch("app.domains.providers.gateway.litellm.acompletion", new_callable=AsyncMock) as mock_acomp:
                # First 3 fail with rate limit, 4th succeeds
                mock_acomp.side_effect = [
                    RateLimitError(f"RL{i}", llm_provider="openai", model="gpt-4o")
                    for i in range(3)
                ] + [_fake_response("p4-ok")]

                with patch("app.domains.providers.gateway.async_session", return_value=_mock_async_session()):
                    with patch("app.domains.providers.gateway.decrypt_api_key", return_value="plain-key"):
                        with patch("app.domains.providers.gateway.create_usage_log", new_callable=AsyncMock) as mock_log:
                            response = await gateway._complete_model("planner", messages=[{"role": "user", "content": "hi"}])

        assert response.choices[0].message.content == "p4-ok"
        assert mock_acomp.await_count == 4

        log_calls = [c.kwargs for c in mock_log.call_args_list]
        success_calls = [c for c in log_calls if c.get("status") == "success"]
        assert len(success_calls) == 1
        assert success_calls[0]["fallback_position"] == 3

    @pytest.mark.asyncio
    async def test_auth_error_fails_fast_no_fallback(self):
        """AuthenticationError must NOT trigger fallback — it should fail immediately."""
        gateway = ProviderGateway()
        primary = _make_provider("p1", "Primary")
        secondary = _make_provider("p2", "Secondary")

        with patch.object(gateway, "_resolve_chain", new_callable=AsyncMock, return_value=[primary, secondary]):
            with patch("app.domains.providers.gateway.litellm.acompletion", new_callable=AsyncMock) as mock_acomp:
                mock_acomp.side_effect = AuthenticationError(
                    "Bad key", llm_provider="openai", model="gpt-4o"
                )
                with patch("app.domains.providers.gateway.async_session", return_value=_mock_async_session()):
                    with patch("app.domains.providers.gateway.decrypt_api_key", return_value="plain-key"):
                        with pytest.raises(ProviderAuthenticationError):
                            await gateway._complete_model("planner", messages=[{"role": "user", "content": "hi"}])

        # Only 1 call — no fallback attempted
        assert mock_acomp.await_count == 1

    @pytest.mark.asyncio
    async def test_all_providers_exhausted_raises_provider_error(self):
        """When every provider in the chain fails, ProviderError is raised."""
        gateway = ProviderGateway()
        providers = [
            _make_provider("p1", "Primary"),
            _make_provider("p2", "Secondary"),
        ]

        with patch.object(gateway, "_resolve_chain", new_callable=AsyncMock, return_value=providers):
            with patch("app.domains.providers.gateway.litellm.acompletion", new_callable=AsyncMock) as mock_acomp:
                mock_acomp.side_effect = [
                    RateLimitError("RL1", llm_provider="openai", model="gpt-4o"),
                    RateLimitError("RL2", llm_provider="openai", model="gpt-4o"),
                ]
                with patch("app.domains.providers.gateway.async_session", return_value=_mock_async_session()):
                    with patch("app.domains.providers.gateway.decrypt_api_key", return_value="plain-key"):
                        with pytest.raises(ProviderError, match="All providers exhausted"):
                            await gateway._complete_model("planner", messages=[{"role": "user", "content": "hi"}])

        assert mock_acomp.await_count == 2
