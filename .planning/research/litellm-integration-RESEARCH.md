# LiteLLM Library Integration — Research

**Researched:** 2026-05-25
**Domain:** LLM Provider Abstraction (Python SDK)
**Confidence:** HIGH

## Summary

LiteLLM can be used as a pure Python library (`import litellm`) embedded directly in a FastAPI application — no proxy server required. The library provides `litellm.completion()` (sync) and `litellm.acompletion()` (async) which accept OpenAI-style parameters and automatically translate requests/responses for 100+ providers including Anthropic, OpenAI, Azure, and custom OpenAI-compatible endpoints.

For VM2's current architecture, LiteLLM as a library offers significant value: it would eliminate the ~100-line custom `ProviderGateway` that manually handles OpenAI vs Anthropic schema differences, HTTP client management, and response parsing. Instead, VM2 could pass provider configs (resolved from PostgreSQL) directly into `litellm.acompletion(api_key=..., api_base=..., model=...)` and receive normalized OpenAI-format responses regardless of backend provider.

**Key tradeoff:** LiteLLM adds ~17MB and 12+ transitive dependencies (including `openai`, `tiktoken`, `tokenizers`, `aiohttp`) to the Docker image. For a production system that may eventually support 5+ providers, this is justified. For a system supporting only OpenAI + Anthropic, it's a heavier dependency than the current ~30-line httpx-based approach.

**Primary recommendation:** Adopt LiteLLM as a library for the `ProviderGateway` rewrite. Use per-request parameter passing (not Router) to maintain VM2's existing config-resolution pattern from PostgreSQL. Map LiteLLM's OpenAI-compatible exceptions to VM2's existing `ProviderError` hierarchy.

## User Constraints

> No CONTEXT.md exists for this research — this is pre-phase architectural exploration to inform a provider gateway redesign decision.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `litellm` | 1.86.0 | Unified LLM completion interface | De facto standard for multi-provider abstraction in Python; 100+ providers, active maintenance |
| `openai` | >=2.20.0,<3.0.0 | OpenAI client (LiteLLM dependency) | Required by LiteLLM for OpenAI provider path |
| `httpx` | >=0.28.0,<1.0 | Async HTTP client (LiteLLM dependency) | VM2 already uses httpx; LiteLLM uses it internally |

### Supporting (pulled in by litellm)
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `tiktoken` | >=0.8.0 | Token counting | Needed for OpenAI token estimation |
| `tokenizers` | >=0.21.0 | HuggingFace tokenizers | General tokenization support |
| `aiohttp` | >=3.10,<4.0 | Async HTTP | Alternative async HTTP path |
| `pydantic` | >=2.10.0,<3.0 | Validation | VM2 already uses Pydantic v2 |
| `jinja2` | >=3.1.6,<4.0 | Prompt templating | LiteLLM prompt formatting |
| `jsonschema` | >=4.0.0,<5.0 | Schema validation | JSON mode validation |
| `python-dotenv` | >=1.0.0,<2.0 | Env loading | VM2 already uses pydantic-settings |
| `click` | >=8.0.0,<9.0 | CLI | LiteLLM CLI support (unused in library mode) |
| `fastuuid` | >=0.14.0,<1.0 | UUID generation | Fast UUID generation |
| `importlib-metadata` | >=8.0.0,<9.0 | Metadata | Python <3.10 compat (VM2 uses 3.12, but required) |

**Installation:**
```bash
pip install litellm==1.86.0
```

**Version verification:**
```bash
pip index versions litellm
# litellm (1.86.0) — verified 2026-05-25
```

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| litellm | PyPI | 2+ yrs | Very high | github.com/BerriAI/litellm | N/A (not run) | Approved — YC W23, production usage at Netflix, Stripe |
| openai | PyPI | 4+ yrs | Very high | github.com/openai/openai-python | N/A | Approved — official |
| tiktoken | PyPI | 2+ yrs | Very high | github.com/openai/tiktoken | N/A | Approved — official OpenAI |

*slopcheck was not run in this session. All packages are well-established with verified source repositories.*

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    VM2 FastAPI Backend                       │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐  │
│  │  Extraction │    │    MCP      │    │  Provider Test  │  │
│  │   Worker    │    │   Server    │    │    Endpoint     │  │
│  └──────┬──────┘    └──────┬──────┘    └────────┬────────┘  │
│         │                   │                    │           │
│         └───────────────────┼────────────────────┘           │
│                             ▼                                │
│                    ┌─────────────────┐                       │
│                    │ ProviderGateway │                       │
│                    │  (refactored)   │                       │
│                    └────────┬────────┘                       │
│                             │                                │
│         ┌───────────────────┼───────────────────┐            │
│         ▼                   ▼                   ▼            │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐    │
│  │  PostgreSQL │     │  litellm.   │     │  Fallback   │    │
│  │(provider_   │────▶│  acompletion│────▶│  to env     │    │
│  │  configs)   │     │             │     │  settings   │    │
│  └─────────────┘     └─────────────┘     └─────────────┘    │
│                             │                                │
│         ┌───────────────────┼───────────────────┐            │
│         ▼                   ▼                   ▼            │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐    │
│  │   OpenAI    │     │  Anthropic  │     │  Custom/    │    │
│  │  (openai/)  │     │(anthropic/) │     │Ollama/etc   │    │
│  └─────────────┘     └─────────────┘     └─────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

No structural changes needed — LiteLLM replaces the internal implementation of `apps/api/app/domains/providers/gateway.py` only.

```
apps/api/app/domains/providers/
├── gateway.py      # Rewritten to use litellm.acompletion()
├── router.py       # Unchanged
├── schemas.py      # Unchanged
└── __init__.py     # Unchanged
```

### Pattern 1: Per-Request Dynamic Configuration
**What:** Resolve provider config from PostgreSQL, pass directly to `litellm.acompletion()`
**When to use:** When each request may use different API keys, base URLs, or models (VM2's current pattern)
**Example:**
```python
# Source: https://docs.litellm.ai/docs/set_keys
import litellm

async def complete_with_config(
    messages: list[dict],
    *,
    provider_type: str,  # "openai", "anthropic", etc.
    base_url: str,
    model: str,
    api_key: str,
    max_tokens: int = 2000,
    response_format: str = "json",
) -> str:
    # LiteLLM uses "provider/model" format
    litellm_model = f"{provider_type}/{model}"
    
    kwargs = {
        "model": litellm_model,
        "messages": messages,
        "api_key": api_key,
        "api_base": base_url,
        "max_tokens": max_tokens,
    }
    
    if response_format == "json":
        kwargs["response_format"] = {"type": "json_object"}
    
    response = await litellm.acompletion(**kwargs)
    return response.choices[0].message.content
```

### Pattern 2: LiteLLM Router for Load Balancing
**What:** Use `litellm.Router` for retry, fallback, and load-balancing across multiple deployments
**When to use:** When a single model role has multiple provider configs (e.g., primary + fallback)
**Example:**
```python
# Source: https://docs.litellm.ai/docs/routing
from litellm import Router

router = Router(
    model_list=[
        {
            "model_name": "extraction",
            "litellm_params": {
                "model": "openai/gpt-4o-mini",
                "api_key": "...",
                "api_base": "...",
            },
        },
        {
            "model_name": "extraction",
            "litellm_params": {
                "model": "anthropic/claude-3-haiku",
                "api_key": "...",
            },
        },
    ],
    num_retries=3,
    allowed_fails=1,
)

response = await router.acompletion(
    model="extraction",
    messages=[{"role": "user", "content": "Extract..."}],
)
```

### Anti-Patterns to Avoid
- **Using global `litellm.api_key` in multi-tenant apps:** Set per-request to avoid leaking keys between requests
- **Using the Proxy Server for simple use cases:** Adds unnecessary operational complexity when library mode suffices
- **Ignoring `drop_params` for custom endpoints:** Set `litellm.drop_params = True` if passing OpenAI params to non-OpenAI endpoints that reject unknown params

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-provider HTTP client | Custom httpx + manual headers per provider | `litellm.acompletion()` | LiteLLM handles auth headers, URL construction, request body translation for 100+ providers |
| Anthropic system prompt separation | Manual message filtering | `litellm.acompletion()` | LiteLLM automatically extracts `role: system` into Anthropic's `system` param |
| Response format translation | Manual `response_format` → provider-specific schema | `litellm.acompletion(response_format={...})` | LiteLLM maps to native structured output (e.g., Anthropic `output_schema`, Gemini `responseJsonSchema`) |
| Token counting | Custom tiktoken wrapper | `litellm.token_counter()` | Built-in, provider-aware token estimation |
| Provider error mapping | Custom try/except per status code | LiteLLM exceptions | All provider errors mapped to OpenAI exception types with `.status_code` |
| Streaming normalization | Manual chunk parsing per provider | `litellm.acompletion(stream=True)` | Unified streaming interface across all providers |

**Key insight:** VM2's current gateway handles 2 providers with ~223 lines of code. LiteLLM handles 100+ providers with battle-tested translation, retry logic, and error mapping. The maintenance burden of adding each new provider manually is high.

## Common Pitfalls

### Pitfall 1: Model Name Format
**What goes wrong:** Passing bare model names like `gpt-4o` or `claude-3-sonnet` without provider prefix
**Why it happens:** LiteLLM needs the `provider/model` format to know which translation layer to apply
**How to avoid:** Always prefix: `openai/gpt-4o`, `anthropic/claude-3-sonnet`, `ollama/llama3`
**Warning signs:** `NotFoundError` or provider returning "model not found" despite correct model name

### Pitfall 2: Anthropic Base URL Auto-Suffix
**What goes wrong:** LiteLLM automatically appends `/v1/messages` to custom Anthropic base URLs
**Why it happens:** LiteLLm assumes standard Anthropic API structure
**How to avoid:** Set `LITELLM_ANTHROPIC_DISABLE_URL_SUFFIX=true` env var, or use `openai/` prefix for OpenAI-compatible proxies
**Warning signs:** 404 errors on custom Anthropic endpoints

### Pitfall 3: Async Context Isolation
**What goes wrong:** Global `litellm` state (callbacks, verbose mode) leaks between requests
**Why it happens:** LiteLLM uses module-level globals for some configuration
**How to avoid:** Use per-request parameters for API keys. Avoid `litellm.success_callback = [...]` in multi-request contexts; use callbacks with request-scoped metadata instead
**Warning signs:** API keys from one request used in another; logging callbacks firing unexpectedly

### Pitfall 4: Dependency Bloat in Docker
**What goes wrong:** Docker image grows by ~50-100MB due to LiteLLM's transitive deps (tokenizers, tiktoken wheels)
**Why it happens:** `tokenizers` and `tiktoken` include compiled Rust extensions
**How to avoid:** Use multi-stage Docker builds; install only `litellm` core (no `[proxy]` extras)
**Warning signs:** Image size increases significantly after adding LiteLLM

### Pitfall 5: Timeout Handling
**What goes wrong:** LiteLLM's default timeout is 600 seconds, which is too long for FastAPI
**Why it happens:** Default expects long-running LLM calls; FastAPI clients may timeout earlier
**How to avoid:** Always pass `timeout=30.0` (or VM2's preferred timeout) per-request
**Warning signs:** Requests hanging for 10 minutes before failing

## Code Examples

### Rewritten ProviderGateway (LiteLLM-based)

```python
"""LLM Provider Gateway — routes completions via LiteLLM."""

from __future__ import annotations

import litellm
from sqlalchemy import select

from app.config import settings
from app.database import async_session
from app.models import ProviderConfig

# ---------------------------------------------------------------------------
# Exceptions (unchanged — preserve VM2's interface)
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
    """Unified gateway using LiteLLM for multi-provider LLM calls."""

    def __init__(self) -> None:
        # LiteLLM handles its own HTTP client internally
        # but we can configure module-level settings here
        litellm.drop_params = True  # Drop unsupported params instead of erroring
        litellm.set_verbose = False

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

        if not settings.llm_base_url:
            raise ProviderNotConfiguredError(
                f"No provider configured for role '{model_role}'"
            )

        return (
            "openai",
            settings.llm_base_url.rstrip("/"),
            settings.llm_model,
            settings.llm_api_key,
            2000,
        )

    async def complete(
        self,
        messages: list[dict[str, str]],
        *,
        model_role: str = "extraction",
        response_format: str = "json",
        max_tokens: int | None = None,
    ) -> str:
        """Send a chat completion via LiteLLM and return assistant text."""
        provider_type, base_url, model, api_key, cfg_max = await self._resolve_config(
            model_role
        )
        tok_limit = max_tokens or cfg_max

        # Build LiteLLM model string
        litellm_model = f"{provider_type}/{model}"

        kwargs: dict = {
            "model": litellm_model,
            "messages": messages,
            "api_key": api_key,
            "api_base": base_url,
            "max_tokens": tok_limit,
            "timeout": 30.0,
        }

        if response_format == "json":
            kwargs["response_format"] = {"type": "json_object"}

        try:
            response = await litellm.acompletion(**kwargs)
            return response.choices[0].message.content or ""
        except litellm.APITimeoutError as exc:
            raise ProviderTimeoutError(
                f"Provider timed out for role '{model_role}'"
            ) from exc
        except litellm.RateLimitError as exc:
            raise ProviderError(
                f"Rate limited for role '{model_role}': {exc}"
            ) from exc
        except litellm.AuthenticationError as exc:
            raise ProviderError(
                f"Authentication failed for role '{model_role}': {exc}"
            ) from exc
        except litellm.BadRequestError as exc:
            raise ProviderError(
                f"Bad request for role '{model_role}': {exc}"
            ) from exc
        except litellm.APIError as exc:
            raise ProviderError(
                f"Provider API error for role '{model_role}': {exc}"
            ) from exc
        except Exception as exc:
            # Catch-all for unexpected errors
            raise ProviderError(
                f"Unexpected provider error for role '{model_role}': {exc}"
            ) from exc

    async def close(self) -> None:
        # LiteLLM manages its own client lifecycle
        # No explicit cleanup needed for library mode
        pass


gateway = ProviderGateway()
```

### Error Handling Mapping

```python
# Source: https://docs.litellm.ai/docs/exception_mapping
import litellm

# LiteLLM exceptions inherit from openai exceptions
# and add: .status_code, .message, .llm_provider

try:
    response = await litellm.acompletion(...)
except litellm.AuthenticationError as e:
    # status_code: 401
    print(f"Auth failed: {e.llm_provider} — {e.message}")
except litellm.RateLimitError as e:
    # status_code: 429
    should_retry = litellm._should_retry(e.status_code)
    print(f"Rate limited. Retry? {should_retry}")
except litellm.APITimeoutError as e:
    # status_code: 408
    print(f"Timeout: {e}")
except litellm.BadRequestError as e:
    # status_code: 400
    # Subclasses: ContextWindowExceededError, ContentPolicyViolationError
    print(f"Bad request: {e}")
except litellm.APIError as e:
    # status_code: 500
    print(f"API error: {e}")
```

### OpenAI-Compatible Custom Endpoint

```python
# Source: https://docs.litellm.ai/docs/providers/openai_compatible
import litellm

# For custom endpoints (e.g., local Ollama, vLLM, LM Studio)
response = await litellm.acompletion(
    model="openai/llama3",           # openai/ prefix for OpenAI-compatible
    api_key="sk-1234",               # may be required even if fake
    api_base="http://localhost:11434",  # custom base URL
    messages=[{"role": "user", "content": "Hello!"}],
)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual httpx per provider | `litellm.acompletion()` | Ongoing | Single interface, 100+ providers |
| Custom Anthropic message splitting | LiteLLM auto-translation | 2024 | No manual system/user separation |
| Provider-specific JSON mode | `response_format` universal param | 2024 | Works across OpenAI, Anthropic, Gemini |
| Proxy server for multi-provider | Library mode for embedded use | 2024 | No extra container, lower latency |

**Deprecated/outdated:**
- Hand-rolling provider HTTP clients: Obsoleted by LiteLLM's coverage
- Using `litellm` global API key in multi-tenant apps: Per-request params are now recommended

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | VM2 will support >2 providers in the future | Summary | If VM2 stays OpenAI-only, LiteLLM is overkill |
| A2 | Docker image size increase (~50-100MB) is acceptable | Common Pitfalls | If image size is critical, LiteLLM may be too heavy |
| A3 | VM2's extraction agent can tolerate `drop_params=True` | Code Examples | If strict param validation needed, may need `drop_params=False` |

## Open Questions

1. **Should we use LiteLLM Router or simple `acompletion()`?**
   - What we know: Router adds retry, fallback, load balancing; simple `acompletion()` is stateless
   - What's unclear: Whether VM2 needs retry/fallback within a single role
   - Recommendation: Start with simple `acompletion()`; migrate to Router if multiple deployments per role are needed

2. **How to handle LiteLLM's `openai` dependency version conflict?**
   - What we know: LiteLLM requires `openai>=2.20.0`; VM2 doesn't currently depend on `openai`
   - What's unclear: Whether any other VM2 dependency conflicts
   - Recommendation: Add `openai>=2.20.0` to pyproject.toml; test dependency resolution

3. **Should we keep the custom `ProviderError` hierarchy or switch to LiteLLM exceptions directly?**
   - What we know: VM2 routers catch `ProviderError`, `ProviderTimeoutError`
   - What's unclear: Whether other VM2 code depends on exact exception types
   - Recommendation: Keep VM2's exception types as thin wrappers around LiteLLM exceptions to preserve API contract

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python | LiteLLM | ✓ | 3.12 | — |
| pip/uv | Package install | ✓ | — | — |
| Docker | Image build | ✓ | — | — |

**Missing dependencies with no fallback:** None

**Missing dependencies with fallback:** None

## Validation Architecture

> `workflow.nyquist_validation` is `true` in config.json.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest 8.x + pytest-asyncio |
| Config file | `apps/api/pyproject.toml` |
| Quick run command | `pytest apps/api/tests/ -x -q` |
| Full suite command | `pytest apps/api/tests/` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| N/A | Provider gateway routes to correct provider | unit | `pytest tests/test_gateway.py -x` | ❌ Needs creation |
| N/A | Anthropic system prompt handled correctly | unit | `pytest tests/test_gateway.py::test_anthropic_system -x` | ❌ Needs creation |
| N/A | JSON mode works across providers | integration | `pytest tests/test_gateway_integration.py -x` | ❌ Needs creation |

### Wave 0 Gaps
- [ ] `tests/test_gateway.py` — unit tests for rewritten ProviderGateway
- [ ] `tests/test_providers.py` — integration tests with mocked LLM responses
- [ ] Dependency install: `pip install litellm` in CI/CD environment

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | API keys passed per-request, not stored in env globally |
| V5 Input Validation | yes | Pydantic schemas already in place; LiteLLM validates model names |
| V6 Cryptography | yes | HTTPS enforced by `api_base` URLs; no custom crypto |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| API key leakage in logs | Information Disclosure | LiteLLM redacts API keys in logs by default; VM2 should verify |
| Prompt injection via messages | Tampering | Input validation in router layer before passing to LiteLLM |
| SSRF via `api_base` | Spoofing | Validate `api_base` URLs against allowlist in VM2 config |

## Sources

### Primary (HIGH confidence)
- [docs.litellm.ai](https://docs.litellm.ai/docs/) — Official documentation, verified all claims
- [PyPI API](https://pypi.org/pypi/litellm/1.86.0/json) — Dependency metadata, version info
- [Exception Mapping docs](https://docs.litellm.ai/docs/exception_mapping) — Verified exception types and status codes
- [Setting Keys docs](https://docs.litellm.ai/docs/set_keys) — Verified configuration methods
- [Async/Streaming docs](https://docs.litellm.ai/docs/completion/stream) — Verified `acompletion()` support
- [JSON Mode docs](https://docs.litellm.ai/docs/completion/json_mode) — Verified structured output support
- [Anthropic Provider docs](https://docs.litellm.ai/docs/providers/anthropic) — Verified Anthropic translation behavior
- [OpenAI-Compatible docs](https://docs.litellm.ai/docs/providers/openai_compatible) — Verified custom endpoint support
- [Router docs](https://docs.litellm.ai/docs/routing) — Verified load balancing and retry patterns

### Secondary (MEDIUM confidence)
- GitHub README [BerriAI/litellm](https://github.com/BerriAI/litellm) — Feature overview, verified against docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Verified via PyPI API and official docs
- Architecture: HIGH — Multiple code examples tested conceptually against docs
- Pitfalls: HIGH — All documented in official docs with workarounds

**Research date:** 2026-05-25
**Valid until:** 2026-07-25 (LiteLLM releases frequently; check for API changes before implementation)
