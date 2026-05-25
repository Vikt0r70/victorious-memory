"""LLM Provider Gateway — routes completions to configured providers via LiteLLM."""

from __future__ import annotations

import time
from typing import Any

import litellm
from litellm.exceptions import (
    APIConnectionError,
    APIError,
    AuthenticationError,
    BadRequestError,
    NotFoundError,
    RateLimitError,
    ServiceUnavailableError,
    Timeout,
)
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session
from app.domains.providers.encryption import decrypt_api_key
from app.domains.providers.exceptions import (
    ProviderAuthenticationError,
    ProviderError,
    ProviderRateLimitError,
    ProviderTimeoutError,
)
from app.domains.providers.service import create_usage_log, resolve_provider_chain
from app.models import Provider

# Re-export exceptions for backward compatibility.
__all__ = [
    "ProviderGateway",
    "ProviderError",
    "ProviderTimeoutError",
    "ProviderAuthenticationError",
    "ProviderRateLimitError",
    "ProviderNotConfiguredError",
    "gateway",
]

# Keep old exception name as an alias for backward compatibility.
ProviderNotConfiguredError = ProviderError


class ProviderGateway:
    """Unified gateway for sending LLM completions through LiteLLM with fallback chains."""

    def __init__(self) -> None:
        # Ensure LiteLLM does not retry internally — we handle fallback chains ourselves.
        litellm.num_retries = 0

    # ------------------------------------------------------------------
    # Chain resolution
    # ------------------------------------------------------------------

    async def _resolve_chain(self, agent_role: str) -> list[Provider]:
        """Return the ordered list of providers for *agent_role*."""
        async with async_session() as db:
            return await resolve_provider_chain(db, agent_role)

    # ------------------------------------------------------------------
    # Usage logging
    # ------------------------------------------------------------------

    async def _log_usage(
        self,
        *,
        db: AsyncSession,
        provider: Provider,
        agent_role: str,
        response: Any | None,
        fallback_position: int,
        status: str,
        latency_ms: int = 0,
        error_message: str | None = None,
    ) -> None:
        """Write a usage log entry for a provider call."""
        usage = getattr(response, "usage", None) if response else None
        prompt_tokens = getattr(usage, "prompt_tokens", 0) if usage else 0
        completion_tokens = getattr(usage, "completion_tokens", 0) if usage else 0
        total_tokens = getattr(usage, "total_tokens", 0) if usage else 0

        await create_usage_log(
            db=db,
            provider_id=provider.id,
            agent_role=agent_role,
            model=provider.model,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
            latency_ms=latency_ms,
            status=status,
            fallback_position=fallback_position,
            error_message=error_message,
        )
        await db.commit()

    # ------------------------------------------------------------------
    # Model completion (new API)
    # ------------------------------------------------------------------

    async def _complete_model(
        self,
        agent_role: str,
        messages: list[dict[str, Any]],
        temperature: float = 0.1,
        max_tokens: int = 4096,
        response_format: dict[str, Any] | None = None,
    ) -> litellm.ModelResponse:
        """Send a chat completion through LiteLLM with provider fallback chain."""
        providers = await self._resolve_chain(agent_role)

        if not providers:
            raise ProviderError(
                f"No providers configured for role '{agent_role}'"
            )

        last_error: Exception | None = None

        for position, provider in enumerate(providers):
            try:
                api_key = (
                    decrypt_api_key(provider.api_key_encrypted)
                    if provider.api_key_encrypted
                    else ""
                )
                model_str = f"{provider.provider_type}/{provider.model}"
                api_base = provider.base_url if provider.base_url else None

                start = time.perf_counter()
                response = await litellm.acompletion(
                    model=model_str,
                    messages=messages,
                    api_key=api_key,
                    api_base=api_base,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    response_format=response_format,
                    num_retries=0,
                    timeout=30,
                )
                latency_ms = int((time.perf_counter() - start) * 1000)

                async with async_session() as db:
                    await self._log_usage(
                        db=db,
                        provider=provider,
                        agent_role=agent_role,
                        response=response,
                        fallback_position=position,
                        status="success",
                        latency_ms=latency_ms,
                    )
                return response
            except AuthenticationError as exc:
                async with async_session() as db:
                    await self._log_usage(
                        db=db,
                        provider=provider,
                        agent_role=agent_role,
                        response=None,
                        fallback_position=position,
                        status="error",
                        error_message=str(exc),
                    )
                raise ProviderAuthenticationError(
                    f"Authentication failed for provider {provider.name}: {exc}"
                ) from exc
            except (
                RateLimitError,
                Timeout,
                APIConnectionError,
                ServiceUnavailableError,
            ) as exc:
                async with async_session() as db:
                    await self._log_usage(
                        db=db,
                        provider=provider,
                        agent_role=agent_role,
                        response=None,
                        fallback_position=position,
                        status="error",
                        error_message=str(exc),
                    )
                last_error = exc
                continue
            except APIError as exc:
                # Covers 5xx and other provider API errors.
                async with async_session() as db:
                    await self._log_usage(
                        db=db,
                        provider=provider,
                        agent_role=agent_role,
                        response=None,
                        fallback_position=position,
                        status="error",
                        error_message=str(exc),
                    )
                last_error = exc
                continue
            except (BadRequestError, NotFoundError) as exc:
                async with async_session() as db:
                    await self._log_usage(
                        db=db,
                        provider=provider,
                        agent_role=agent_role,
                        response=None,
                        fallback_position=position,
                        status="error",
                        error_message=str(exc),
                    )
                raise ProviderError(
                    f"Non-retryable error from provider {provider.name}: {exc}"
                ) from exc
            except Exception as exc:
                # Catch-all for unexpected errors — log and try next provider.
                async with async_session() as db:
                    await self._log_usage(
                        db=db,
                        provider=provider,
                        agent_role=agent_role,
                        response=None,
                        fallback_position=position,
                        status="error",
                        error_message=str(exc),
                    )
                last_error = exc
                continue

        raise ProviderError(
            f"All providers exhausted for role '{agent_role}'. "
            f"Last error: {last_error}"
        )

    # ------------------------------------------------------------------
    # Backward-compatible completion (returns str)
    # ------------------------------------------------------------------

    async def complete(
        self,
        messages: list[dict[str, Any]],
        *,
        model_role: str = "extraction",
        response_format: str = "json",
        max_tokens: int | None = None,
    ) -> str:
        """Send a chat completion and return the assistant's text.

        Parameters
        ----------
        messages:
            OpenAI-style message list.
        model_role:
            Logical role name used to look up provider config.
        response_format:
            ``"json"`` → asks the provider for JSON output, ``"text"`` for plain.
        max_tokens:
            Override the configured max_tokens if given.
        """
        fmt: dict[str, Any] | None = (
            {"type": "json_object"} if response_format == "json" else None
        )
        response = await self._complete_model(
            agent_role=model_role,
            messages=messages,
            temperature=0.1,
            max_tokens=max_tokens or 4096,
            response_format=fmt,
        )
        content = response.choices[0].message.content
        return content or ""

    # ------------------------------------------------------------------
    # Old close() stub for compatibility
    # ------------------------------------------------------------------

    async def close(self) -> None:
        """No-op — kept for backward compatibility."""
        pass


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------

gateway = ProviderGateway()
