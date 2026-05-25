# AI Design Contract — Phase 1: Provider System & Architecture

**Framework:** LiteLLM (provider layer) + LangChain (downstream extraction/RAG)  
**System Type:** Hybrid (Structured Data Extraction + RAG)  
**Model Provider:** Model-agnostic  
**Alternative Considered:** LlamaIndex (best-in-class RAG retrieval, weaker on structured extraction)  
**Eval Concerns:** Schema compliance, extraction accuracy, context faithfulness, retrieval precision/recall  
**Created:** 2026-05-25  
**Status:** Draft

---

## 1. Project Overview

### Phase Context
Phase 1 delivers a unified provider management system that replaces the current role-based provider configs with a registry of providers, integrates LiteLLM for multi-provider support, adds comprehensive usage logging, and implements per-role fallback chains.

### System Classification
- **Industry Vertical:** Developer tooling / AI memory system
- **User Population:** Software developers using OpenCode IDE
- **Stakes Level:** Medium (internal tooling, productivity impact)
- **Output Consequence:** Incorrect provider routing or model selection degrades memory extraction quality and wastes API tokens

<!-- SECTION 1b — Domain Context: populated by gsd-domain-researcher -->
## 1b. Domain Context

**Industry Vertical:** Developer tooling / AI memory system  
**User Population:** Software developers using OpenCode IDE (single-user, localhost-first deployment)  
**Stakes Level:** Medium — productivity impact on daily coding workflows; direct API cost exposure to the developer  
**Output Consequence:** Incorrect provider routing or model selection degrades memory extraction quality (lost or malformed memories), wastes API tokens (direct cost to user), and breaks context injection into the IDE (assistant loses relevant prior knowledge)

### What Domain Experts Evaluate Against

```
Dimension: Token Cost Efficiency
Good: Fallback chains prioritize cost-effective providers; usage logs accurately track spend per role; no redundant LLM calls for identical conversations
Bad: Fallback chain cascades into expensive models without cost consideration; missing usage logs make spend invisible; duplicate calls for same conversation due to cache misses
Stakes: High
Source: Developer tooling economics — developers directly bear API costs; unmonitored spend erodes trust and adoption
```

```
Dimension: Schema Compliance in Extraction
Good: Every extraction call returns valid JSON matching the Pydantic schema; invalid output triggers at most 2 retries before surfacing error; native JSON mode used when available
Bad: Model returns unstructured prose instead of JSON; infinite retry loops on validation failure; silent dropping of response_format param due to misconfigured drop_params
Stakes: Critical
Source: Production structured-extraction systems — schema failures break downstream pipelines entirely (Mem0 ECAI 2025 benchmarks show structured extraction is the dominant accuracy driver)
```

```
Dimension: Provider Routing Accuracy
Good: Each agent role maps to providers that support required capabilities (JSON mode, adequate context window, low-temperature stability); local models only used for roles where accuracy tradeoff is acceptable
Bad: Extraction routed to provider without JSON mode support; edge detection sent to model with tiny context window; consolidation assigned to high-temperature creative model
Stakes: High
Source: AI-SPEC Section 4 role-specific model requirements; practitioner knowledge that not all providers expose identical capabilities despite LiteLLM normalization
```

```
Dimension: Fallback Chain Resilience
Good: Failover completes within latency budget (<10s p99); each fallback provider is pre-tested and known-working; auth errors fail fast without burning through the entire chain
Bad: Chain includes untested providers; timeout on each provider accumulates to >30s total; auth error retries on same key across all providers
Stakes: High
Source: Gateway architecture decisions D-15 through D-19; production SRE best practices for cascading failure prevention
```

```
Dimension: Context Injection Reliability
Good: Retrieved memories are injected into system prompt without truncation of critical schema instructions; retrieval latency <1s; empty retrieval gracefully degrades (no context injected, no error)
Bad: System prompt dropped due to context window overflow; retrieval failure causes IDE session to hang; stale or irrelevant memories injected due to poor RAG precision
Stakes: Medium
Source: PROJECT.md performance targets; context window management best practices (Section 4b.4)
```

### Known Failure Modes in This Domain

1. **Fallback chain cost cascade** — Misconfigured fallback chain routes through premium models (e.g., GPT-4 → GPT-4o → Claude Opus) on every transient failure, ballooning costs silently because usage logs only capture successful calls at the final fallback position. The developer sees a $50 bill with no visibility into which role or provider consumed the tokens.

2. **JSON mode silent degradation** — LiteLLM's `drop_params=True` (or provider misconfiguration) silently removes `response_format={"type": "json_object"}` for providers that don't support it. The model returns unstructured text, Pydantic validation fails, and the worker retries the entire job — wasting 3× the tokens and potentially losing the memory entirely after max retries.

3. **Context window overflow in extraction** — Long conversation histories exceed the model's context window. LiteLLM raises `ContextWindowExceededError` (or doesn't, for Ollama per the exception mapping gap documented in Section 3). The gateway lacks proper truncation, the system prompt gets dropped, the model returns invalid JSON, and the extraction job fails permanently — the conversation is never memorized.

4. **Encryption key drift in multi-environment deployments** — Auto-generated `.encryption_key` file differs across developer machines and VPS. Encrypted API keys become unreadable after environment switch, causing auth errors that appear as "bad API key" when the key itself is fine. The user rotates the API key unnecessarily, wasting time and breaking other integrations.

### Regulatory / Compliance Context

None identified for this deployment context. The system is single-user, localhost-only developer tooling with no PII processing of third-party data. API key encryption (Fernet, D-20–D-22) addresses security hygiene, not regulatory compliance. GDPR/CCPA do not apply as the user is processing their own conversation data on their own machine.

### Domain Expert Roles for Evaluation

| Role | Responsibility in Eval |
|------|----------------------|
| Senior Software Engineer (end user) | Reference dataset labeling for extraction accuracy; rubric calibration for "useful memory" vs noise; production sampling for context injection quality |
| DevOps / SRE Practitioner | Provider reliability and fallback chain evaluation; cost monitoring validation; latency benchmark review |
| Product Owner / Tech Lead | Workflow integration review — does provider configuration UX match developer mental models?; edge case review for settings UI and error messaging |

### Research Sources
- Mem0 research paper (ECAI 2025, arXiv:2504.19413) — structured memory extraction benchmarks and production gaps
- Evidently AI "A complete guide to RAG evaluation" — retrieval and generation quality metrics
- Victorious Memory V2 project documentation (PROJECT.md, REQUIREMENTS.md, 01-CONTEXT.md)
- LiteLLM documentation — exception mapping coverage gaps, provider-specific parameter support

---

## 2. Framework Selection

### Primary: LiteLLM (provider layer) + LangChain (downstream extraction/RAG)

**Rationale:** LiteLLM is purpose-built for provider abstraction — it offers the simplest API surface (`litellm.acompletion()`) while supporting 100+ providers, making it the ideal model-agnostic gateway without custom adapter overhead. For the downstream memory extraction and RAG system, LangChain is the best fit because it is the only framework scoring well on both "Structured Data Extraction" and "RAG / Knowledge Q&A" in the decision matrix, is model-agnostic, supports Python + TypeScript, and provides the broadest ecosystem for a small team with evolving requirements.

### Alternative: LlamaIndex

**Reason:** If RAG retrieval quality becomes the dominant concern and extraction needs remain simple, LlamaIndex offers best-in-class document retrieval but is weaker on structured data extraction compared to LangChain.

### Hard Constraints Applied
- No vendor lock-in
- Must support local/self-hosted models (Ollama)
- No new infrastructure (use existing PostgreSQL)

### Existing Ecosystem
FastAPI, SQLAlchemy 2.0, asyncpg, Pydantic 2.9+, sentence-transformers, Next.js 16, React 19, TypeScript 5 — no existing LangChain, LlamaIndex, CrewAI, or other AI framework dependencies.

---

## 3. Framework Quick Reference

<!-- Populated by gsd-ai-researcher — DO NOT OVERWRITE -->

### Installation

```bash
# LiteLLM — provider abstraction gateway
uv add litellm

# LangChain — structured extraction and RAG downstream
uv add langchain langchain-community langchain-core

# Optional: provider-specific packages (only install the ones you use)
uv add langchain-openai langchain-anthropic langchain-ollama
```

### Key Imports

```python
# ─── LiteLLM (provider layer) ───
import litellm
from litellm import acompletion, completion
from litellm.exceptions import (
    AuthenticationError,
    RateLimitError,
    APIError,
    APITimeoutError,
    ContextWindowExceededError,
    BadRequestError,
)

# ─── LangChain (downstream extraction / RAG) ───
from langchain_core.output_parsers import PydanticOutputParser, JsonOutputParser
from langchain_core.prompts import ChatPromptTemplate, SystemMessagePromptTemplate, HumanMessagePromptTemplate
from langchain_core.runnables import RunnableLambda, RunnablePassthrough
from langchain.chat_models import init_chat_model  # model-agnostic init
```

### Entry Point Pattern

The gateway entry point wraps `litellm.acompletion()` with merged provider config, usage logging, and fallback orchestration. This is the exact pattern the new `ProviderGateway` will use.

```python
import time
import litellm
from litellm import acompletion

class ProviderGateway:
    """Unified gateway: resolve config → call LiteLLM → log usage → fallback on failure."""

    async def complete(
        self,
        agent_role: str,
        messages: list[dict],
        temperature: float = 0.1,
        max_tokens: int = 4096,
        response_format: dict | None = None,
    ) -> litellm.ModelResponse:
        # 1. Resolve provider config from DB (primary + fallback chain)
        providers = await self._resolve_chain(agent_role)

        for position, provider in enumerate(providers):
            model_id = f"{provider.provider_type}/{provider.model}"
            start = time.perf_counter()
            try:
                # 2. Call LiteLLM with merged config
                response = await acompletion(
                    model=model_id,
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    api_key=provider.api_key,
                    api_base=provider.base_url,
                    response_format=response_format,
                    num_retries=0,          # D-12: disable internal retries
                    timeout=30,
                )
                # 3. Log usage synchronously after success
                await self._log_usage(
                    agent_role=agent_role,
                    provider_id=provider.id,
                    model=model_id,
                    prompt_tokens=response.usage.prompt_tokens,
                    completion_tokens=response.usage.completion_tokens,
                    latency_ms=int((time.perf_counter() - start) * 1000),
                    status="success",
                    fallback_position=position,
                )
                return response

            except litellm.AuthenticationError as e:
                await self._log_failure(..., status="401_auth_error", error=str(e))
                raise ProviderAuthenticationError(str(e)) from e

            except litellm.APITimeoutError as e:
                await self._log_failure(..., status="504_timeout", error=str(e))
                if position == len(providers) - 1:
                    raise ProviderTimeoutError(str(e)) from e
                continue  # try next fallback

            except litellm.APIError as e:
                await self._log_failure(..., status="502_api_error", error=str(e))
                if position == len(providers) - 1:
                    raise ProviderError(str(e)) from e
                continue  # try next fallback
```

### Core Abstractions

| Abstraction | Purpose | When to Use |
|-------------|---------|-------------|
| `acompletion()` / `completion()` | Single unified async/sync entry point for 100+ providers | Every LLM call in the gateway layer. Prefer `acompletion()` in FastAPI handlers. |
| `litellm.ModelResponse` | OpenAI-compatible response object with `.choices`, `.usage`, `.response_ms` | Parsing output, extracting token counts, finish reasons. Access both dict-style and attribute-style. |
| Exception mapping (`AuthenticationError`, `RateLimitError`, `ContextWindowExceededError`) | All provider errors mapped to OpenAI exception types | Catch in gateway and remap to internal `ProviderError` hierarchy. Enables portable error handling. |
| `ChatPromptTemplate` | Reusable prompt assembly with System + Human message roles | Building extraction prompts in the downstream LangChain layer. Inject few-shot examples dynamically. |
| `PydanticOutputParser` / `.with_structured_output()` | Enforce schema compliance on LLM output | Structured data extraction (memory candidates). Use `with_structured_output()` for native provider support; fall back to `PydanticOutputParser` + manual retry. |

### Known Pitfalls

1. **LiteLLM `num_retries` must be disabled (`num_retries=0`)** — LiteLLM has built-in retry logic that conflicts with the worker-level exponential backoff (D-12). If left enabled, retry storms multiply: LiteLLM retries × worker retries = up to 9 attempts instead of 3.

2. **Exception mapping is provider-dependent and incomplete** — Not all providers raise every mapped exception. For example, Ollama does not raise `ContextWindowExceededError` (empty cells in the mapping table). Always have a base `except litellm.APIError` catch block as a safety net, and check `e.llm_provider` to branch on provider-specific handling.

3. **`drop_params=True` silently removes unsupported params** — LiteLLM defaults to raising `UnsupportedParamsError` if a param isn't supported by the target provider. Setting `drop_params=True` silently drops them instead. This is dangerous for production: if you pass `response_format` to a provider that doesn't support JSON mode, it will be dropped and you'll get unstructured text. Only use `drop_params` for prototyping.

4. **LangChain abstraction overhead for simple calls** — LangChain's chain/runnable abstractions add latency and complexity for straightforward single-call extraction. In this architecture, LiteLLM handles the gateway call directly; only use LangChain downstream for multi-step RAG chains or when you need its prompt templating + structured output utilities. Don't wrap LiteLLM inside a LangChain LLM adapter unless you need LangChain-specific features (retrievers, memory).

5. **Model ID format `provider/model` is strict** — LiteLLM requires `f"{provider_type}/{model}"` (e.g., `openai/gpt-4o`, `anthropic/claude-sonnet-4-6`, `ollama/llama3`). Omitting the provider prefix or using the wrong slug causes `NotFoundError`. Maintain a canonical mapping from your `providers.type` enum to LiteLLM provider slugs.

### Folder Structure

```
apps/api/app/domains/providers/
├── __init__.py
├── gateway.py          # ProviderGateway — wraps litellm.acompletion()
├── service.py           # CRUD + config resolution for providers & agents
├── router.py            # FastAPI endpoints (registry, test, agent settings)
├── schemas.py           # Pydantic request/response models
├── exceptions.py        # ProviderError, ProviderTimeoutError, ProviderAuthenticationError, ProviderRateLimitError
├── templates.py         # Hardcoded PROVIDER_TEMPLATES dict (D-03)
└── encryption.py        # Fernet wrapper for API key at-rest encryption (D-20–D-22)
```

### Sources

- LiteLLM Quickstart — https://docs.litellm.ai/docs/
- LiteLLM Input Params (`acompletion` signature, `num_retries`, `fallbacks`) — https://docs.litellm.ai/docs/completion/input
- LiteLLM Exception Mapping (status codes, provider coverage matrix) — https://docs.litellm.ai/docs/exception_mapping
- LiteLLM Output Format (`ModelResponse`, `.usage`, `.response_ms`) — https://docs.litellm.ai/docs/completion/output
- LiteLLM Routing & Fallbacks — https://docs.litellm.ai/docs/routing-load-balancing
- LangChain Structured Output (`ProviderStrategy`, `ToolStrategy`, `handle_errors`) — https://python.langchain.com/docs/how_to/structured_output/
- LangChain Overview (model-agnostic init, `create_agent`) — https://python.langchain.com/docs/introduction/

---

## 4. Implementation Guidance

<!-- Populated by gsd-ai-researcher — DO NOT OVERWRITE -->

### Recommended Model & Parameters

| Role | Model | Temperature | Max Tokens | Rationale |
|------|-------|-------------|------------|-----------|
| **Extraction** (primary) | `openai/gpt-4o` or `anthropic/claude-sonnet-4-6` | 0.1 | 4096 | Low temperature for deterministic schema compliance. These models have the highest structured-output accuracy. |
| **Edge Detection** | Same as extraction | 0.1 | 2048 | Shorter output (relationship labels), same low-temperature discipline. |
| **Consolidation** | Same as extraction | 0.2 | 4096 | Slightly higher for summarization tasks, but still constrained. |
| **Classification / Routing** (future) | `openai/gpt-4o-mini` | 0.0 | 256 | Cheap, fast, deterministic for simple routing decisions. |
| **Local / Offline** | `ollama/llama3` or `ollama/mistral` | 0.3 | 4096 | Fallback when no cloud API key is configured. Expect lower extraction accuracy. |

> **Why `max_tokens` is mandatory:** Never leave `max_tokens` unbounded in production. Unbounded completions can consume excessive tokens on malformed prompts, run up costs, and hit context-window limits unpredictably. Set it explicitly per role based on expected output size.

### Core Pattern

The gateway core pattern is a **partial wrapper around LiteLLM**: LiteLLM handles the actual HTTP call and response normalization; our code handles config resolution, encryption/decryption, usage logging, and fallback orchestration.

```python
"""apps/api/app/domains/providers/gateway.py — Core Pattern"""
from __future__ import annotations

import time
import logging
from typing import Any

import litellm
from litellm import acompletion

from app.domains.providers.exceptions import (
    ProviderError,
    ProviderTimeoutError,
    ProviderAuthenticationError,
    ProviderRateLimitError,
)

logger = logging.getLogger(__name__)

# D-12: Disable LiteLLM's internal retries to avoid retry storms
litellm.num_retries = 0


class ProviderGateway:
    """Model-agnostic LLM gateway with fallback chains and usage logging."""

    def __init__(self) -> None:
        self._encryption = None  # lazy init

    # ─── Public API ───

    async def complete(
        self,
        agent_role: str,
        messages: list[dict[str, str]],
        temperature: float = 0.1,
        max_tokens: int = 4096,
        response_format: dict[str, Any] | None = None,
    ) -> litellm.ModelResponse:
        """Send a completion request through the provider chain for *agent_role*."""
        chain = await self._resolve_chain(agent_role)
        last_error: Exception | None = None

        for position, provider in enumerate(chain):
            model = f"{provider.provider_type}/{provider.model}"
            start = time.perf_counter()

            try:
                response = await acompletion(
                    model=model,
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    api_key=await self._decrypt(provider.api_key),
                    api_base=provider.base_url or None,
                    response_format=response_format,
                    num_retries=0,      # enforced at call site
                    timeout=30,
                )

                await self._log_usage(
                    agent_role=agent_role,
                    provider_id=provider.id,
                    model=model,
                    prompt_tokens=response.usage.prompt_tokens,
                    completion_tokens=response.usage.completion_tokens,
                    latency_ms=int((time.perf_counter() - start) * 1000),
                    status="success",
                    fallback_position=position,
                )
                return response

            except litellm.AuthenticationError as e:
                last_error = ProviderAuthenticationError(
                    f"Provider {provider.id}: bad API key"
                ) from e
                logger.warning("Provider %s auth error: %s", provider.id, e)
                # Don't retry auth errors — they'll fail on every fallback with the same key
                raise last_error

            except litellm.RateLimitError as e:
                last_error = ProviderRateLimitError(
                    f"Provider {provider.id}: rate limited"
                ) from e
                logger.warning("Provider %s rate limit: %s", provider.id, e)
                # Rate limits are transient — try next fallback
                continue

            except litellm.APITimeoutError as e:
                last_error = ProviderTimeoutError(
                    f"Provider {provider.id}: timeout"
                ) from e
                logger.warning("Provider %s timeout: %s", provider.id, e)
                continue

            except litellm.APIError as e:
                last_error = ProviderError(
                    f"Provider {provider.id}: API error {getattr(e, 'status_code', 'unknown')}"
                ) from e
                logger.warning("Provider %s API error: %s", provider.id, e)
                continue

        # All fallbacks exhausted
        raise last_error or ProviderError("All providers in fallback chain failed")

    # ─── Internal Helpers ───

    async def _resolve_chain(self, agent_role: str) -> list[ProviderConfig]:
        """Return ordered list of providers for this role (primary + fallbacks)."""
        # Fetches from DB: agents.fallback_provider_ids JSONB
        ...

    async def _decrypt(self, ciphertext: str) -> str:
        ...

    async def _log_usage(self, **kwargs: Any) -> None:
        ...
```

### Tool Use Configuration

This phase does **not** use LangChain agents or tool-calling loops. Tool use is limited to:

1. **LiteLLM `tools` / `tool_choice` params** — For future phases if we need function calling (e.g., querying the memory database during extraction). Both params are passed straight through `acompletion()` and translated by LiteLLM per provider.
2. **LangChain `ToolStrategy` / `ProviderStrategy`** — Used downstream in the extraction pipeline for structured output (see Section 4b.1). The extraction agent calls `gateway.complete()` with a system prompt that instructs JSON output; the returned text is then parsed by `PydanticOutputParser` or validated against a Pydantic model.

> No active tool loop is needed for Phase 1. The extraction pipeline is a single-shot structured completion.

### State Management Approach

- **Gateway is stateless** — No in-memory caches or connection pools. Each call resolves provider config fresh from the DB (cached at the SQLAlchemy session level via `AsyncSession`).
- **Agent settings live in DB** — The `agents` table stores `primary_provider_id` and `fallback_provider_ids` JSONB. No runtime state files.
- **Usage logs are append-only** — Each call writes one row to `usage_logs`. This is the only mutable state the gateway produces.
- **Encryption key is env-driven** — `PROVIDER_KEY_ENCRYPTION_KEY` from `.env`; auto-generated `.encryption_key` file only as fallback (D-20–D-22).

### Context Window Strategy

1. **Token counting before the call** — Use `litellm.token_counter(model=..., messages=...)` to estimate prompt tokens. If the count exceeds 80% of the model's context window, truncate or summarize before calling.
2. **LiteLLM `context_window_fallback_dict`** — Map models to their larger-window equivalents:
   ```python
   context_window_fallback_dict = {
       "openai/gpt-4o": "openai/gpt-4o",  # same model, but triggers fallback chain if ContextWindowExceededError
       "ollama/llama3": "ollama/llama3:70b",
   }
   ```
   Pass this to `acompletion()` as a kwarg; LiteLLM automatically retries with the fallback model on `ContextWindowExceededError`.
3. **Truncation strategy for extraction** — If conversation history exceeds the budget, truncate from the middle (keep system prompt + most recent exchanges, drop oldest). Never drop the system prompt.
4. **Hard limit enforcement** — Set `max_tokens` to leave headroom: `max_tokens = context_window - prompt_tokens - 256`. This prevents `ContextWindowExceededError` on well-formed prompts.

---

## 4b. AI Systems Best Practices

<!-- Populated by gsd-ai-researcher — DO NOT OVERWRITE -->

### 4b.1 Structured Outputs with Pydantic

**Goal:** Every extraction call must return data that validates against a Pydantic model. Invalid output triggers a retry with explicit error feedback.

**Example Pydantic Model for Memory Extraction:**

```python
from pydantic import BaseModel, Field
from typing import Literal

class MemoryCandidate(BaseModel):
    """A candidate memory extracted from a developer conversation."""
    content: str = Field(description="Concise factual statement. 1-2 sentences.")
    memory_type: Literal["decision", "preference", "constraint", "pattern", "reference"]
    confidence: float = Field(ge=0.0, le=1.0, description="Extraction confidence 0-1")
    tags: list[str] = Field(default_factory=list, description="Relevant topic tags")

class ExtractionResult(BaseModel):
    """Top-level wrapper returned by the extraction LLM call."""
    candidates: list[MemoryCandidate] = Field(default_factory=list)
    summary: str = Field(description="One-line summary of what was discussed")
```

**Framework Integration — Two-Layer Approach:**

1. **Gateway Layer (LiteLLM):** Use `response_format={"type": "json_object"}` to force JSON output. LiteLLM translates this param for providers that support native JSON mode (OpenAI, Anthropic, Groq) and raises `UnsupportedParamsError` for those that don't.
   ```python
   response = await gateway.complete(
       agent_role="extraction",
       messages=[...],
       response_format={"type": "json_object"},
   )
   raw_json = response.choices[0].message.content
   ```

2. **Validation Layer (Pydantic):** Parse the raw JSON and validate against the schema. If validation fails, retry with the error message injected into the conversation.
   ```python
   import json
   from pydantic import ValidationError

   MAX_RETRIES = 2
   for attempt in range(MAX_RETRIES + 1):
       try:
           data = json.loads(raw_json)
           result = ExtractionResult.model_validate(data)
           break
       except (json.JSONDecodeError, ValidationError) as e:
           if attempt == MAX_RETRIES:
               raise ExtractionError(f"Structured output failed after {MAX_RETRIES} retries: {e}")
           # Retry: inject the validation error as a user message
           messages.append({"role": "user", "content": f"Fix your JSON output. Error: {e}"})
           response = await gateway.complete(agent_role="extraction", messages=messages)
           raw_json = response.choices[0].message.content
   ```

> **Why not LangChain `with_structured_output()` here?** The gateway is intentionally framework-agnostic and uses LiteLLM directly. Adding LangChain's model wrappers inside the gateway would couple it to LangChain's model initialization and add unnecessary latency. Use LangChain structured output utilities in downstream RAG chains (Phase 2+) where you already have LangChain retrievers and chains in play.

**Retry Discipline:**
- **Max 2 retries** for schema validation failures. Beyond that, log the failure and surface an `ExtractionError` to the worker, which will retry the entire job with exponential backoff.
- **Log every retry** — include `attempt`, `error_type`, and `error_message` in the `usage_logs` metadata column (or application logs) for offline analysis.
- **Never infinite-loop** — always cap retries. A model that cannot produce valid JSON after 2 corrections will not succeed on the 10th.

### 4b.2 Async-First Design

**Principle:** The entire provider layer is async because FastAPI and the background worker both run on an asyncio event loop.

**Correct Pattern:**
```python
# In a FastAPI endpoint or async worker function:
response = await gateway.complete(agent_role="extraction", messages=messages)
```

**The One Common Mistake:**
- **Never call `asyncio.run()` or `asyncio.get_event_loop().run_until_complete()` inside an already-running event loop.** FastAPI's `Depends(get_db)` and the worker's `_process_job()` are already async. Calling `asyncio.run()` raises `RuntimeError: asyncio.run() cannot be called from a running event loop`. If you absolutely must call a sync function from async, use `asyncio.to_thread()` (Python 3.9+) to run it in a thread pool.

**Sync Embedding Exception:**
- `sentence-transformers` is synchronous and CPU-bound. The current codebase runs it directly in the event loop (`_model.encode(text)`). For single-text encoding this is acceptable (<50ms), but for batch operations wrap it:
  ```python
  import asyncio
  embedding = await asyncio.to_thread(_model.encode, text)
  ```

**Stream vs. Await:**
- **Await** for structured extraction — you need the full response to validate against Pydantic.
- **Stream** only for UX-facing endpoints (e.g., chat preview in the dashboard). Phase 1 has no streaming requirements; all gateway calls use `await` on `acompletion()`.

### 4b.3 Prompt Engineering Discipline

**System vs. User Prompt Separation:**
- **System prompt** — Defines the persona, output format, and constraints. Keep it stable per agent role. Store system prompts as module-level constants (e.g., `EXTRACTION_SYSTEM_PROMPT`) so they are version-controlled and reviewable.
- **User prompt** — Contains the dynamic input (conversation text, retrieved context). Never put system instructions in the user message; models weight system prompts differently and some providers (Anthropic) require strict separation.

```python
messages = [
    {"role": "system", "content": EXTRACTION_SYSTEM_PROMPT},
    {"role": "user", "content": f"Extract memories from this conversation:\n\n{conversation_text}"},
]
```

**Few-Shot Examples:**
- **Inline** — Include 2-3 examples directly in the system prompt for roles with stable output schemas (extraction, edge detection). This is deterministic and fast.
- **Dynamic retrieval** — For RAG-based prompts (future phase), retrieve relevant few-shot examples from the memory store and inject them into the user message. Use this when the domain is broad and static examples don't cover all cases.

**Max Tokens Discipline:**
- Always set `max_tokens` explicitly. Never rely on provider defaults.
- Size it to the expected output: extraction ~2048, consolidation ~4096, classification ~256.
- Leaving `max_tokens` unbounded risks runaway completions on ambiguous prompts and makes cost prediction impossible.

### 4b.4 Context Window Management

**Hybrid System Strategy (Structured Extraction + RAG):**

1. **Pre-flight token counting:**
   ```python
   from litellm import token_counter
   prompt_tokens = token_counter(model=model, messages=messages)
   ```
   Do this before every call. If `prompt_tokens + max_tokens > context_window`, take action.

2. **Truncation hierarchy** (apply in order):
   - a. **Truncate retrieved context** — If RAG context is present, drop the lowest-ranked chunks first.
   - b. **Summarize conversation history** — Keep the last N exchanges verbatim; summarize older ones into a single "Previously..." paragraph.
   - c. **Drop few-shot examples** — If examples are inline, reduce from 3 to 1 or remove entirely (the system prompt format description is usually sufficient).
   - d. **Never drop the system prompt** — It contains the output schema. Dropping it causes unstructured output and validation failures.

3. **LiteLLM context window fallback:**
   Pass `context_window_fallback_dict` to `acompletion()` so LiteLLM automatically switches to a larger-window model on `ContextWindowExceededError`:
   ```python
   await acompletion(
       model="openai/gpt-4o",
       messages=messages,
       context_window_fallback_dict={"openai/gpt-4o": "openai/gpt-4o-128k"},
   )
   ```
   Note: This is a LiteLLM-specific fallback, separate from the per-role provider fallback chain.

4. **Headroom rule:**
   Reserve 10% of the context window as safety margin. If the model has 128k context, treat 115k as the effective limit. This accounts for tokenizer differences between estimation and actual provider tokenization.

### 4b.5 Cost and Latency Budget

**Per-Call Cost Estimate (at expected volume):**

| Role | Model | Avg Input | Avg Output | Cost/Call | Daily (100 calls) |
|------|-------|-----------|------------|-----------|-------------------|
| Extraction | `gpt-4o` | 4k tokens | 1k tokens | ~$0.015 | ~$1.50 |
| Edge Detection | `gpt-4o` | 2k tokens | 256 tokens | ~$0.008 | ~$0.80 |
| Consolidation | `gpt-4o` | 6k tokens | 1k tokens | ~$0.022 | ~$2.20 |

> Totals are approximate at OpenAI pricing (~$2.50/1M input, ~$10/1M output). Actual costs vary by provider. Usage logs (PROV-06) provide real cost tracking.

**Latency Budget:**
- **p50 target:** <2s for extraction, <1s for edge detection.
- **p99 target:** <10s (accounts for cold-start or fallback chain traversal).
- **Timeout:** Hard 30s on `acompletion()` calls. Anything longer indicates a provider outage.

**Cost Optimization Strategies:**

1. **Cheaper models for sub-tasks:**
   - Use `gpt-4o-mini` for classification, routing, and simple filtering (10x cheaper than `gpt-4o`).
   - Use `ollama/llama3` for local development when API costs are a concern (zero marginal cost, higher latency).

2. **Exact-match + semantic caching:**
   - **Exact-match cache:** Cache extraction results keyed by conversation content hash. If the same conversation is re-ingested (e.g., retry after worker crash), return the cached result without an LLM call.
   - **Semantic cache:** Not needed for Phase 1. Conversations are unique; caching is only effective for identical retries or duplicate ingestion.

3. **Batching:**
   - If the worker processes multiple jobs concurrently, ensure `acompletion()` calls are independent async tasks (`asyncio.gather()`), not sequential awaits. This keeps throughput high without increasing per-call latency.

4. **Monitor and alert:**
   - Alert if daily spend exceeds 5× the baseline ($15/day at 100 calls/role). Sudden spikes indicate runaway loops, unbounded `max_tokens`, or fallback chains hitting expensive models.

---

## 5. Evaluation Strategy

### Eval Dimensions

| Dimension | Rubric | Measurement | Priority |
|-----------|--------|-------------|----------|
| **Schema Compliance** | PASS: Every extraction call returns valid JSON that validates against `ExtractionResult` Pydantic model on first or second attempt. FAIL: Model returns unstructured prose, infinite retry loop, or silent dropping of `response_format` due to `drop_params=True`. | Code (Pydantic validation) + LLM Judge (output structure quality) | Critical |
| **Provider Routing Accuracy** | PASS: Each agent role maps to a provider that supports required capabilities (JSON mode, adequate context window, low-temperature stability). Local models only used for roles where accuracy tradeoff is acceptable. FAIL: Extraction routed to provider without JSON mode support; edge detection sent to model with tiny context window; consolidation assigned to high-temperature creative model. | Code (capability matrix check) + Human (role-provider fitness review) | Critical |
| **Fallback Chain Resilience** | PASS: Failover completes within latency budget (<10s p99); each fallback provider is pre-tested and known-working; auth errors fail fast without burning through the entire chain. FAIL: Chain includes untested providers; timeout on each provider accumulates to >30s total; auth error retries on same key across all providers. | Code (latency timers, fallback position logs) + Human (chain design review) | High |
| **Token Cost Efficiency** | PASS: Fallback chains prioritize cost-effective providers; usage logs accurately track spend per role; no redundant LLM calls for identical conversations. FAIL: Fallback chain cascades into expensive models without cost consideration; missing usage logs make spend invisible; duplicate calls for same conversation due to cache misses. | Code (usage log aggregation, cost per role metric) | High |
| **Context Window Management** | PASS: Prompt tokens + max_tokens stays within 90% of model context window; truncation preserves system prompt; `ContextWindowExceededError` triggers graceful fallback or error. FAIL: System prompt dropped due to overflow; retrieval failure causes IDE session to hang; unbounded `max_tokens` causes runaway completions. | Code (token_counter pre-flight, hard limit enforcement) | High |
| **Safety & Error Hygiene** | PASS: No API keys or decrypted credentials leak in logs or error messages; auth errors return generic "configuration error" to client; encryption key mismatch is detected and reported clearly. FAIL: API key printed in traceback; raw LiteLLM exception exposed to end user; encryption key drift causes silent auth failures. | Code (regex scan for key patterns in logs) + Human (security review) | Critical |
| **Task Completion (End-to-End)** | PASS: A conversation ingested through the plugin results in at least one approved memory within 60 seconds under normal conditions. FAIL: Conversation accepted but no extraction job created; job stuck in queue due to provider unavailability; memory created but never surfaces in context injection. | Code (E2E test: ingest → extract → approve → search) | Critical |

### Eval Tooling

No existing eval or tracing tools were detected in the codebase. Opinionated defaults applied:

| Concern | Tool | Rationale |
|---------|------|-----------|
| Tracing / observability | **Arize Phoenix** | Open-source, self-hostable, framework-agnostic via OpenTelemetry. Ideal for localhost-first deployment with no external platform account. |
| RAG eval metrics | **RAGAS** | Faithfulness, answer relevance, context precision/recall — needed for downstream RAG validation even though Phase 1 focuses on provider layer. |
| Prompt regression / CI | **Promptfoo** | CLI-first, no platform account required. Perfect for validating extraction prompts and provider configurations in CI. |

**Phoenix Setup (localhost):**

```bash
# Install tracing dependencies
uv add arize-phoenix opentelemetry-sdk opentelemetry-instrumentation-asyncpg

# Launch Phoenix UI
python -m phoenix.server.main serve  # http://localhost:6006
```

```python
# Instrument the provider gateway
import phoenix as px
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

provider = TracerProvider()
trace.set_tracer_provider(provider)

# Auto-instrument FastAPI + asyncpg
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.asyncpg import AsyncPGInstrumentor

FastAPIInstrumentor().instrument_app(app)
AsyncPGInstrumentor().instrument()

# Manual span for each gateway completion
tracer = trace.get_tracer(__name__)

async def complete(...) -> litellm.ModelResponse:
    with tracer.start_as_current_span("gateway.complete") as span:
        span.set_attribute("agent_role", agent_role)
        span.set_attribute("model", model)
        span.set_attribute("fallback_position", fallback_position)
        # ... rest of completion logic
```

**Promptfoo Setup (CI):**

```bash
# Install globally or in project
npm install -g promptfoo

# Create promptfoo config
promptfoo init
```

```yaml
# promptfooconfig.yaml — provider validation tests
prompts:
  - "Extract memories from this conversation: {{conversation}}"
providers:
  - id: "openai:gpt-4o"
    config:
      temperature: 0.1
      max_tokens: 4096
      response_format:
        type: json_object
  - id: "ollama:llama3"
    config:
      temperature: 0.3
      max_tokens: 4096
tests:
  - vars:
      conversation: "User: I prefer dark mode. Assistant: Noted."
    assert:
      - type: is-json
      - type: javascript
        value: "JSON.parse(output).candidates.length > 0"
  - vars:
      conversation: "User: The API timeout is 30 seconds. Assistant: I'll remember that."
    assert:
      - type: is-json
      - type: javascript
        value: "JSON.parse(output).candidates[0].memory_type === 'constraint'"
```

### Reference Dataset

**Size:** 15 examples minimum (10 for provider layer, 5 for downstream extraction validation).

**Composition:**

| Category | Count | Description |
|----------|-------|-------------|
| Critical success paths | 5 | Normal provider routing, fallback success, schema-valid extraction, cost-logged call, context window within limits |
| Known failure modes | 4 | Auth error (fail fast), rate limit (fallback triggered), context window exceeded (truncation or error), JSON mode silent degradation |
| Edge cases | 3 | Empty conversation, very long conversation (>100k tokens), multi-provider fallback chain (all 4 positions used) |
| Adversarial / security | 3 | Malformed API key injection attempt, oversized `max_tokens` request, encryption key mismatch scenario |

**Labeling Approach:**
- **Code-based labels** (automated): Token counts, latency, fallback position, HTTP status codes, schema validation boolean — no human needed.
- **LLM Judge** (calibrated): Extraction quality — "did the returned JSON contain meaningful memory candidates?" Calibrate against 5 human-reviewed examples before trusting.
- **Human review**: Edge cases involving provider selection fitness ("was Ollama an acceptable fallback for extraction?"), security-sensitive scenarios.

**Creation Timeline:**
- Start during implementation (Week 1): Build 5 critical-path examples as you implement the gateway.
- Expand during integration (Week 2): Add failure-mode examples as you test fallback chains and error handling.
- Finalize before deployment (Week 3): Add adversarial cases and run full dataset against all metrics.

### CI/CD Integration

```bash
# Run provider layer evals in CI
# 1. Unit tests (schema validation, routing logic)
pytest apps/api/app/domains/providers/tests/ -v --tb=short

# 2. Prompt regression tests via Promptfoo
promptfoo eval --config promptfooconfig.yaml --max-concurrency 4

# 3. RAGAS metrics on reference dataset (if RAG chain implemented)
python -m scripts.eval_ragas --dataset tests/data/reference_dataset.jsonl

# 4. Security scan: ensure no API keys in logs
python -m scripts.scan_logs_for_keys --path apps/api/logs/

# Full eval suite (run before PR merge)
make eval
# ^ Runs all of the above in sequence; fails on any non-zero exit code.
```

---

## 6. Guardrails

### Classification Rationale

For each critical failure mode from Section 1b, we ask: *"If this behavior goes wrong, would it be catastrophic for the business (or the developer's wallet)?"*

| Failure Mode | Catastrophic? | Classification | Reasoning |
|--------------|---------------|----------------|-----------|
| Fallback chain cost cascade | **Yes** — silent $50+ bills | Online guardrail | Must block before expensive chain completes |
| JSON mode silent degradation | **Yes** — breaks entire extraction pipeline | Online guardrail | Must detect and abort before invalid output propagates |
| Context window overflow | **Yes** — permanent job failure, conversation lost | Online guardrail | Must pre-validate before call to prevent unrecoverable error |
| Encryption key drift | No — recoverable with env var override | Offline flywheel | Detected during health checks, not per-request |

### Online Guardrails (Real-Time)

| Guardrail | Trigger | Action | Latency Impact |
|-----------|---------|--------|----------------|
| **Cost Cap Check** | Before each `acompletion()` call: estimated cost > $0.05 for extraction or > $0.10 for consolidation | Block call, log violation, return `ProviderError("Cost cap exceeded")` | ~1ms (lookup cached cost per model) |
| **JSON Mode Capability Verify** | `response_format={"type": "json_object"}` is present but provider in chain does not support native JSON mode | Skip that provider in fallback chain (don't even call it), log skip reason | ~0ms (checked during chain resolution, before any network call) |
| **Context Window Pre-Flight** | `litellm.token_counter()` shows `prompt_tokens + max_tokens > 0.9 * context_window` | Truncate conversation history (middle-out), re-count; if still over, return `ProviderError("Context window exceeded")` | ~5-10ms (token count is local, truncation is string ops) |
| **Auth Error Fast-Fail** | `AuthenticationError` caught from LiteLLM | Immediately raise `ProviderAuthenticationError` — do NOT try next fallback (same key likely invalid for all providers in chain) | ~0ms (no extra calls) |
| **Max Tokens Hard Limit** | `max_tokens` parameter > 8192 for any role | Clamp to role-specific maximum (extraction: 4096, edge_detection: 2048, consolidation: 4096), log clamp event | ~0ms (parameter validation) |

### Offline Flywheel (Batch Analysis)

| Signal | Sampling Rate | Owner | Action |
|--------|--------------|-------|--------|
| **Daily cost trend** | 100% of usage_logs aggregated daily | DevOps / SRE | Alert if daily spend > 5× baseline ($15/day at 100 calls/role); investigate spike root cause (runaway loop, unbounded max_tokens, expensive fallback chain) |
| **Fallback chain efficiency** | 100% of calls with `fallback_position > 0` | Tech Lead | Weekly review: which roles trigger fallbacks most? Are primary providers reliable enough? Should chain order change? |
| **Schema failure pattern** | 100% of extraction jobs that fail with `ExtractionError` | Senior Software Engineer | Weekly review: which provider+model combinations fail schema validation most? Update role-model mapping or add provider-specific prompt tuning |
| **Latency drift** | 10% random sample of all successful calls | DevOps / SRE | Monthly benchmark: p50, p95, p99 latency per role per provider; detect provider degradation before it triggers fallbacks |
| **Encryption key health** | 100% of auth errors where key decryption succeeds but provider rejects | DevOps / SRE | Quarterly audit: check for key drift across environments; verify `.encryption_key` file matches env var on all deployments |
| **Context truncation frequency** | 100% of calls where truncation guardrail activated | Senior Software Engineer | Monthly review: are conversations getting longer? Should context_window fallback_dict be updated? Tune truncation strategy |

---

## 7. Production Monitoring

### Tracing Tool

**Primary: Arize Phoenix** (open-source, localhost + VPS compatible)

Phoenix is selected because:
- No external platform account required — critical for a single-user, localhost-first developer tool
- OpenTelemetry-native instrumentation works with FastAPI, asyncpg, and custom spans
- Self-hostable on the same VPS as the API if needed later
- RAG trace visualization is best-in-class for when Phase 2 RAG improvements land

**Alternative (if Phoenix proves unstable):** Langfuse — also open-source and self-hostable, with strong prompt management features. Switching cost is low because both use OpenTelemetry.

**Instrumentation Points:**
1. **Gateway span** (`gateway.complete`) — one per LLM call, attributes: `agent_role`, `model`, `provider_id`, `fallback_position`, `latency_ms`, `status`
2. **Database span** — auto-instrumented via `AsyncPGInstrumentor`, captures all provider registry queries
3. **FastAPI span** — auto-instrumented via `FastAPIInstrumentor`, captures endpoint latency and error rates
4. **Worker span** (`worker.process_job`) — one per extraction job, links to the gateway span inside it

### Key Metrics & Alert Thresholds

| Metric | Threshold | Alert Channel | Severity |
|--------|-----------|---------------|----------|
| **Gateway p50 latency** | > 2s for extraction, > 1s for edge_detection | Phoenix dashboard + log warning | Warning |
| **Gateway p99 latency** | > 10s any role | Phoenix dashboard + log error | Critical |
| **Fallback rate** | > 20% of calls trigger fallback (fallback_position > 0) | Daily aggregated log + dashboard | Warning |
| **Schema failure rate** | > 5% of extraction jobs fail with `ExtractionError` | Real-time log error + dashboard | Critical |
| **Daily cost per role** | > $15/day (5× baseline at 100 calls/role) | Daily aggregated log + dashboard | Warning |
| **Auth error rate** | > 1% of calls return 401 | Real-time log error + dashboard | Critical |
| **Context window exceeded rate** | > 2% of calls hit truncation guardrail | Daily aggregated log | Warning |
| **Worker queue depth** | > 50 unprocessed jobs | Dashboard + log warning | Warning |
| **Provider test failure** | Any provider test endpoint returns 401/502 for > 5 minutes | Real-time log error | Critical |

### Sampling Strategy

**Smart sampling — weight toward signals of concern:**

| Interaction Type | Sampling Rate | Rationale |
|------------------|--------------|-----------|
| **All failures** | 100% | Every error (auth, timeout, API error, schema failure, context window exceeded) is traced in full |
| **Fallback-triggered calls** | 100% | Must understand why primary provider failed |
| **First call after provider config change** | 100% | Validate new config immediately |
| **Normal successful calls** | 10% random | Baseline latency and cost tracking without overwhelming storage |
| **Extraction jobs producing approved memories** | 50% | Quality signal for downstream rubric calibration |
| **Extraction jobs producing rejected memories** | 100% | Understand why validator rejected — feeds prompt improvement |

**Storage budget:**
- Phoenix stores traces in-memory by default (SQLite or file-based). At ~10KB per trace and 1000 traces/day, this is <10MB/day — negligible for a developer workstation.
- For VPS deployment, configure Phoenix with PostgreSQL backend: `PHOENIX_SQL_DATABASE_URL=postgresql+asyncpg://...`
- Retention: 30 days for detailed traces, aggregated metrics kept indefinitely in `usage_logs` table.

**Signal-Metric Divergence Watch:**
- If **fallback rate** is low but **daily cost** is high → investigate: are successful calls using expensive models? (Cost cascade without fallback triggering)
- If **schema failure rate** is low but **worker queue depth** is high → investigate: are jobs failing silently and not being marked as failed? (Retry loop without error surfacing)
- If **p99 latency** is acceptable but **user complaints** about slow responses increase → investigate: are we measuring gateway latency only, not end-to-end (plugin → API → worker → extraction → memory creation)? Add end-to-end span.

---

## Checklist

- [x] Framework selected with rationale (Section 2)
- [x] Domain context researched (Section 1b)
- [x] Framework docs researched (Sections 3, 4)
- [x] AI systems best practices documented (Section 4b)
- [x] Evaluation strategy designed (Sections 5, 6, 7)
- [x] Guardrails defined (Section 6)
- [x] Production monitoring specified (Section 7)
- [x] AI-SPEC.md validated and committed
