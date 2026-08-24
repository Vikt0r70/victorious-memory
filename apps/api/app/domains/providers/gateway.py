"""LLM Provider Gateway — routes completions to configured providers via LiteLLM."""

from __future__ import annotations

import logging
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

from app.config import settings
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

logger = logging.getLogger(__name__)

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

# Ensure LiteLLM does not retry internally — we handle fallback chains ourselves.
litellm.num_retries = 0

LITELLM_PREFIX: dict[str, str] = {
    "openai": "openai",
    "anthropic": "anthropic",
    "groq": "groq",
    "ollama": "ollama",
    "openrouter": "openai",   # OpenRouter endpoints are OpenAI-compatible
    "opencode": "openai",     # OpenCode proxy is OpenAI-compatible
    "custom": "openai",       # Custom endpoints are OpenAI-compatible
}


def format_litellm_model(provider_type: str, model: str) -> str:
    """Format model identifier for LiteLLM routing."""
    prefix = LITELLM_PREFIX.get(provider_type, "openai")
    
    # If the model string already specifies a provider prefix matching LiteLLM format, keep it
    if "/" in model:
        # e.g., openrouter/anthropic/claude-3-5-sonnet or openai/gpt-4o
        first_part = model.split("/")[0].lower()
        if first_part in ("openai", "anthropic", "groq", "ollama", "openrouter", "azure", "gemini", "bedrock"):
            return model

    if prefix == "openai":
        return f"openai/{model}"
    elif prefix == "anthropic":
        return f"anthropic/{model}"
    elif prefix == "groq":
        return f"groq/{model}"
    elif prefix == "ollama":
        return f"ollama/{model}"
    return f"{prefix}/{model}"


class ProviderGateway:
    """Unified gateway for sending LLM completions through LiteLLM with fallback chains."""

    def __init__(self) -> None:
        pass

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
        total_tokens = getattr(usage, "total_tokens", 0) if usage else (prompt_tokens + completion_tokens)

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
        timeout: float | None = None,
    ) -> litellm.ModelResponse:
        """Send a chat completion through LiteLLM with provider fallback chain."""
        providers = await self._resolve_chain(agent_role)

        if not providers:
            raise ProviderError(
                f"No providers configured for role '{agent_role}'"
            )

        effective_timeout = timeout or settings.llm_timeout_seconds
        last_error: Exception | None = None

        for position, provider in enumerate(providers):
            try:
                api_key = (
                    decrypt_api_key(provider.api_key_encrypted)
                    if provider.api_key_encrypted
                    else ""
                )
                model_str = format_litellm_model(provider.provider_type, provider.model)
                api_base = provider.base_url.rstrip("/") if provider.base_url else None

                # Anthropic doesn't support openai-style response_format={"type": "json_object"}
                actual_response_format = response_format
                if provider.provider_type == "anthropic":
                    actual_response_format = None

                start = time.perf_counter()
                response = await litellm.acompletion(
                    model=model_str,
                    messages=messages,
                    api_key=api_key if api_key else None,
                    api_base=api_base,
                    temperature=temperature,
                    max_tokens=max_tokens or provider.max_tokens or 4096,
                    response_format=actual_response_format,
                    num_retries=0,
                    timeout=effective_timeout,
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
                logger.warning(
                    "Authentication failed for provider %s (role %s, pos %d): %s",
                    provider.name, agent_role, position, exc
                )
                async with async_session() as db:
                    await self._log_usage(
                        db=db,
                        provider=provider,
                        agent_role=agent_role,
                        response=None,
                        fallback_position=position,
                        status="error",
                        error_message=f"Auth error: {exc}",
                    )
                last_error = exc
                continue
            except (
                RateLimitError,
                Timeout,
                APIConnectionError,
                ServiceUnavailableError,
            ) as exc:
                logger.warning(
                    "Transient error on provider %s (role %s, pos %d): %s",
                    provider.name, agent_role, position, exc
                )
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
                logger.warning(
                    "APIError from provider %s (role %s, pos %d): %s",
                    provider.name, agent_role, position, exc
                )
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
                logger.warning(
                    "BadRequest/NotFound from provider %s (role %s, pos %d): %s",
                    provider.name, agent_role, position, exc
                )
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
            except Exception as exc:
                logger.error(
                    "Unexpected error from provider %s (role %s, pos %d): %s",
                    provider.name, agent_role, position, exc
                )
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
        timeout: float | None = None,
    ) -> str:
        """Send a chat completion to the provider configured for *model_role*."""
        rf_dict = (
            {"type": "json_object"} if response_format == "json" else None
        )
        response = await self._complete_model(
            agent_role=model_role,
            messages=messages,
            response_format=rf_dict,
            max_tokens=max_tokens or 4096,
            timeout=timeout,
        )
        choices = getattr(response, "choices", None)
        if choices and len(choices) > 0:
            first_choice = choices[0]
            message = getattr(first_choice, "message", None)
            content = getattr(message, "content", "")
            return content or ""
        return ""


# Global singleton instance.
gateway = ProviderGateway()
