"""LLM Provider Gateway — routes completions to configured providers."""

from __future__ import annotations

import httpx
from sqlalchemy import select

from app.config import settings
from app.database import async_session
from app.models import ProviderConfig


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------


class ProviderError(Exception):
    """General provider failure."""


class ProviderTimeoutError(ProviderError):
    """The provider did not respond in time."""


class ProviderNotConfiguredError(ProviderError):
    """No provider configured for the requested role."""


# ---------------------------------------------------------------------------
# Gateway
# ---------------------------------------------------------------------------


class ProviderGateway:
    """Unified gateway for sending LLM completions.

    Resolution order for a given *model_role*:
    1. Look up ``provider_configs`` DB table for a row matching the role.
    2. Fall back to ``settings.llm_base_url / llm_model / llm_api_key``.
    """

    def __init__(self) -> None:
        self._http = httpx.AsyncClient(timeout=30.0)

    # ------------------------------------------------------------------
    # Config resolution
    # ------------------------------------------------------------------

    async def _resolve_config(
        self, model_role: str
    ) -> tuple[str, str, str, str, int]:
        """Return ``(provider_type, base_url, model, api_key, max_tokens)``."""
        async with async_session() as session:
            stmt = select(ProviderConfig).where(ProviderConfig.role == model_role)
            result = await session.execute(stmt)
            cfg = result.scalar_one_or_none()

        if cfg is not None:
            return (
                cfg.provider_type,
                cfg.base_url.rstrip("/"),
                cfg.model,
                cfg.api_key,
                cfg.max_tokens,
            )

        # Fallback to global settings
        if not settings.llm_base_url:
            raise ProviderNotConfiguredError(
                f"No provider configured for role '{model_role}' and no "
                "default LLM base URL set."
            )

        return (
            "openai",
            settings.llm_base_url.rstrip("/"),
            settings.llm_model,
            settings.llm_api_key,
            2000,
        )

    # ------------------------------------------------------------------
    # Completion
    # ------------------------------------------------------------------

    async def complete(
        self,
        messages: list[dict[str, str]],
        *,
        model_role: str = "extraction",
        response_format: str = "json",
        max_tokens: int | None = None,
    ) -> str:
        """Send a chat completion and return the assistant's text.

        Parameters
        ----------
        messages:
            OpenAI-style message list: ``[{"role": ..., "content": ...}]``
        model_role:
            Logical role name used to look up provider config.
        response_format:
            ``"json"`` → asks the provider for JSON output, ``"text"`` for plain.
        max_tokens:
            Override the configured max_tokens if given.
        """
        provider_type, base_url, model, api_key, cfg_max = await self._resolve_config(
            model_role
        )
        tok_limit = max_tokens or cfg_max

        try:
            if provider_type == "anthropic":
                return await self._anthropic_complete(
                    base_url, model, api_key, messages, tok_limit
                )
            return await self._openai_complete(
                base_url, model, api_key, messages, tok_limit, response_format
            )
        except httpx.TimeoutException as exc:
            raise ProviderTimeoutError(
                f"Provider timed out for role '{model_role}'"
            ) from exc
        except httpx.HTTPStatusError as exc:
            raise ProviderError(
                f"Provider returned {exc.response.status_code}: "
                f"{exc.response.text}"
            ) from exc
        except httpx.RequestError as exc:
            raise ProviderError(
                f"Provider unreachable: {exc}"
            ) from exc

    # ------------------------------------------------------------------
    # OpenAI-compatible path
    # ------------------------------------------------------------------

    async def _openai_complete(
        self,
        base_url: str,
        model: str,
        api_key: str,
        messages: list[dict[str, str]],
        max_tokens: int,
        response_format: str,
    ) -> str:
        headers: dict[str, str] = {}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

        body: dict = {
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens,
        }
        if response_format == "json":
            body["response_format"] = {"type": "json_object"}

        resp = await self._http.post(
            f"{base_url}/chat/completions",
            json=body,
            headers=headers,
        )
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"]

    # ------------------------------------------------------------------
    # Anthropic path
    # ------------------------------------------------------------------

    async def _anthropic_complete(
        self,
        base_url: str,
        model: str,
        api_key: str,
        messages: list[dict[str, str]],
        max_tokens: int,
    ) -> str:
        headers: dict[str, str] = {
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }

        # Anthropic separates system prompt from messages
        system_text = ""
        anthropic_msgs: list[dict[str, str]] = []
        for msg in messages:
            if msg["role"] == "system":
                system_text = msg["content"]
            else:
                anthropic_msgs.append(msg)

        body: dict = {
            "model": model,
            "max_tokens": max_tokens,
            "messages": anthropic_msgs,
        }
        if system_text:
            body["system"] = system_text

        resp = await self._http.post(
            f"{base_url}/v1/messages",
            json=body,
            headers=headers,
        )
        resp.raise_for_status()
        data = resp.json()
        # Anthropic returns content as a list of blocks
        content_blocks = data.get("content", [])
        return content_blocks[0]["text"] if content_blocks else ""

    async def close(self) -> None:
        await self._http.aclose()


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------

gateway = ProviderGateway()
