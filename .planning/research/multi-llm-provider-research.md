# Multi-LLM Provider Architecture Research Report

**Project:** Victorious Memory V2 Provider Gateway Redesign
**Date:** 2025-05-25
**Researcher:** gsd-domain-researcher

---

## Executive Summary

This research examines how production open-source projects and SDKs handle multiple LLM provider abstraction. The goal is to inform redesign of Victorious Memory V2's provider gateway (`apps/api/app/domains/providers/gateway.py`) to better support OpenAI, Anthropic, OpenRouter, and custom endpoints.

**Current State Analysis:** VM2 has a functional but minimal gateway with hardcoded `openai`/`anthropic` branches, role-based DB config resolution, basic timeout handling, and a simple test endpoint. It lacks provider registries, model discovery, structured error taxonomy, and health monitoring.

**Key Finding:** The most successful projects (LiteLLM, Vercel AI SDK, LibreChat) converge on a **registry + adapter pattern** — providers register once with normalized configuration, and the system resolves models via string IDs with per-provider adapters handling API schema translation.

---

## 1. Provider Abstraction Patterns

### 1.1 The Registry + Adapter Pattern (Vercel AI SDK, LiteLLM)

**Architecture:**
```
Provider Registry
├── "openai:gpt-4o" → OpenAIAdapter(base_url, api_key)
├── "anthropic:claude-sonnet" → AnthropicAdapter(base_url, api_key)
├── "custom:my-model" → OpenAICompatibleAdapter(base_url, api_key)
└── "openrouter:meta-llama/70b" → OpenRouterAdapter(base_url, api_key)
```

**Vercel AI SDK (TypeScript) — Provider Registry:**
- Uses `createProviderRegistry()` to register providers with namespace prefixes
- Model resolution: `registry.languageModel('openai:gpt-5.1')`
- Custom separator support (default `:`)
- Allows model aliases: `opus` → `anthropic/claude-opus-4.1`
- Middleware system for default settings injection

**Code Pattern:**
```typescript
export const registry = createProviderRegistry({
  openai,
  anthropic,
  custom: createOpenAICompatible({
    name: 'provider-name',
    apiKey: process.env.CUSTOM_API_KEY,
    baseURL: 'https://api.custom.com/v1',
  }),
});

// Usage
const model = registry.languageModel('anthropic:claude-sonnet');
```

**LiteLLM (Python) — Unified `completion()` Interface:**
- Single `completion(model="anthropic/claude-3-sonnet", messages=[...])` function
- 100+ providers supported via internal adapter map
- Provider specified as prefix in model string: `provider/model-name`
- Handles API key routing, request translation, response normalization automatically

**Code Pattern:**
```python
import litellm

# All providers use same interface
response = litellm.completion(
    model="anthropic/claude-3-sonnet-20240229",
    messages=[{"role": "user", "content": "Hello"}]
)

# OpenRouter
response = litellm.completion(
    model="openrouter/meta-llama/llama-3-70b-instruct",
    messages=[{"role": "user", "content": "Hello"}]
)
```

### 1.2 The YAML Config + Endpoint Pattern (LibreChat, OpenWebUI)

**LibreChat `librechat.yaml`:**
- Central YAML file defines all endpoints
- Each endpoint has: `name`, `apiKey`, `baseURL`, `models`, `dropParams`, `addParams`
- Supports env variable interpolation: `${OPENROUTER_KEY}`
- "Known endpoints" get automatic icon/title support
- Validation on startup — fails fast with exit code 1 on invalid config

**Example Configuration:**
```yaml
version: 1.3.5
cache: true
endpoints:
  custom:
    - name: "OpenRouter"
      apiKey: "${OPENROUTER_KEY}"
      baseURL: "https://openrouter.ai/api/v1"
      models:
        default: ["meta-llama/llama-3-70b-instruct"]
        fetch: true  # Auto-discover models from API
      dropParams: ["stop"]
      addParams:
        max_tokens: 2048
```

**OpenWebUI — Pipelines Architecture:**
- Uses "Pipelines" (Python functions) as middleware layer
- Can proxy through LiteLLM for multi-provider support
- Admin panel UI for adding connections (OpenAI API section)
- Function-based extensibility for custom providers

### 1.3 The Factory Pattern (LangChain, Application Code)

**LangChain LLM Factory:**
- `ChatOpenAI`, `ChatAnthropic`, `ChatGoogle` as separate classes
- Factory function creates appropriate instance based on provider enum
- Common interface via `BaseChatModel` abstract class

**Code Pattern:**
```python
from langchain.chat_models import ChatOpenAI, ChatAnthropic
from enum import Enum

class LLMProvider(Enum):
    OPENAI = "openai"
    ANTHROPIC = "anthropic"

def create_llm(provider: LLMProvider, model: str, **kwargs):
    if provider == LLMProvider.OPENAI:
        return ChatOpenAI(model=model, **kwargs)
    elif provider == LLMProvider.ANTHROPIC:
        return ChatAnthropic(model=model, **kwargs)
    raise ValueError(f"Unknown provider: {provider}")
```

### 1.4 Victorious Memory V2 — Current Pattern

**Current Approach:** Role-based resolution with hardcoded provider types
```python
class ProviderGateway:
    async def complete(self, messages, *, model_role="extraction"):
        provider_type, base_url, model, api_key, max_tokens = await self._resolve_config(model_role)
        if provider_type == "anthropic":
            return await self._anthropic_complete(...)
        return await self._openai_complete(...)
```

**Gaps Identified:**
- Only two hardcoded provider types (`openai`, `anthropic`)
- No support for OpenRouter, custom endpoints, or new providers without code changes
- No model discovery/fetching
- System prompt handling is manual and fragile (Anthropic separates system from messages)
- No provider registration mechanism

---

## 2. Configuration Management

### 2.1 Configuration Storage Patterns

| Project | Storage | Schema | Key Management |
|---------|---------|--------|----------------|
| **LiteLLM Proxy** | `config.yaml` + env vars | `model_list[]` with `litellm_params` | `os.environ/VAR_NAME` interpolation |
| **LibreChat** | `librechat.yaml` + `.env` | `endpoints.custom[]` with per-endpoint config | `${ENV_VAR}` interpolation, supports `user_provided` |
| **Vercel AI SDK** | Code registry + env vars | TypeScript provider objects | `process.env.*` in code |
| **OpenWebUI** | Database + Admin UI | Connections table in DB | Encrypted in DB, UI-managed |
| **VM2 Current** | PostgreSQL `provider_configs` table | `role`, `provider_type`, `base_url`, `model`, `api_key` | Plaintext in DB, API-managed |

### 2.2 LiteLLM Configuration Model

LiteLLM uses the most sophisticated config schema:

```yaml
model_list:
  - model_name: "gpt-4o"  # Alias used by consumers
    litellm_params:
      model: "openai/gpt-4o"  # Provider-prefixed model ID
      api_key: "os.environ/OPENAI_API_KEY"
      api_base: "https://custom.openai.api.com"
      timeout: 30
      stream_timeout: 10
      max_retries: 3
      rpm: 100  # Rate limit
    model_info:
      mode: chat  # chat | embedding | image_generation | completion
      health_check_max_tokens: 5
      health_check_timeout: 60
```

**Key Features:**
- **Model aliases:** Consumer uses `gpt-4o`, system resolves to `openai/gpt-4o`
- **Environment interpolation:** `os.environ/VAR_NAME` syntax
- **Per-model timeouts:** `timeout` (total), `stream_timeout` (first token)
- **Rate limits:** `rpm`, `tpm` for routing decisions
- **Health check config:** Per-model health check parameters

### 2.3 LibreChat Configuration Model

```yaml
endpoints:
  custom:
    - name: "Mistral"
      apiKey: "${MISTRAL_API_KEY}"
      baseURL: "https://api.mistral.ai/v1"
      models:
        default: ["mistral-tiny", "mistral-small"]
        fetch: true  # Auto-discover from /models endpoint
      dropParams: ["stop", "user"]
      addParams:
        safe_prompt: true
      headers:
        x-api-key: "${ENVIRONMENT_VARIABLE}"
```

**Key Features:**
- **Parameter filtering:** `dropParams` removes unsupported params
- **Parameter injection:** `addParams` adds provider-specific options
- **Custom headers:** Dynamic env var + user field substitution
- **Model fetching:** `fetch: true` auto-populates from provider's `/models`

### 2.4 Victorious Memory V2 — Recommended Evolution

**Current Schema:**
```python
class ProviderConfig(Base):
    role: str  # "extraction", "chat", etc.
    provider_type: str  # "openai", "anthropic"
    base_url: str
    model: str
    api_key: str
    max_tokens: int
```

**Recommended Schema (informed by research):**
```python
class ProviderConfig(Base):
    role: str  # Logical role: "extraction", "chat", "embedding"
    provider_type: str  # "openai", "anthropic", "openrouter", "generic_openai"
    base_url: str
    model: str  # Model ID at provider
    api_key: str
    
    # Advanced options (JSONB for flexibility)
    options: dict = {
        "max_tokens": 2000,
        "timeout": 30,
        "max_retries": 3,
        "drop_params": [],
        "add_params": {},
        "headers": {},
    }
    
    # Model discovery
    models_fetched: list[str]  # Last known available models
    models_fetch_enabled: bool
    
    # Health monitoring
    last_health_check: datetime
    health_status: str  # "healthy", "unhealthy", "unknown"
```

---

## 3. Error Handling

### 3.1 Error Taxonomy

**LiteLLM Error Hierarchy (most comprehensive):**
```
LiteLLMError (base)
├── AuthenticationError (401) — Invalid API key
├── BadRequestError (400) — Malformed request
├── RateLimitError (429) — Too many requests
├── ServiceUnavailableError (503) — Provider down
├── Timeout (timeout) — Request exceeded timeout
├── APIConnectionError — Network failure
├── APIError (5xx) — Provider server error
├── BudgetExceededError — Spend limit reached
└── ContentPolicyViolation — Safety filter triggered
```

**Vercel AI SDK Error Types:**
- `AI_APICallError` — Generic API failure with status code
- `AI_RetryError` — Max retries exceeded
- `AI_InvalidPromptError` — Prompt validation failure
- Provider-specific error wrapping

**LangChain Error Pattern:**
- Raises provider exceptions directly (often unstructured)
- Retry logic via `max_retries` parameter
- Less structured than LiteLLM

### 3.2 Timeout Handling Strategies

**LiteLLM (most sophisticated):**
```yaml
# Global timeout
router_settings:
  timeout: 30  # seconds for entire call

# Per-model timeout
model_list:
  - model_name: gpt-4
    litellm_params:
      timeout: 300  # 5 minutes
      stream_timeout: 30  # time to first token
      max_retries: 5
```

**Key Insight:** LiteLLM distinguishes:
- **`timeout`**: Total call duration ceiling
- **`stream_timeout`**: Time to first token (catches "hanging" providers)
- **`max_retries`**: Automatic retry on transient failures

**VM2 Current:** Single `timeout=30.0` on httpx client, no retry logic at gateway level (worker has retry logic separately).

### 3.3 Fallback and Retry Patterns

**LiteLLM Router Pattern:**
```python
from litellm import Router

router = Router(
    model_list=[...],
    routing_strategy="least-busy",  # or "simple-shuffle"
    fallback_list=[{
        "gpt-4": ["claude-sonnet", "gpt-3.5-turbo"]
    }],
    timeout=30,
    num_retries=3,
    retry_after=1  # seconds between retries
)
```

**Vercel AI SDK — Global Provider Fallback:**
```typescript
// Can set global provider for plain model IDs
globalThis.AI_SDK_DEFAULT_PROVIDER = openai;

// Fallback chain via middleware
wrapLanguageModel({
  model: gateway('openai/gpt-4o'),
  middleware: fallbackMiddleware({
    models: [
      gateway('openai/gpt-4o'),
      gateway('anthropic/claude-sonnet'),
    ]
  })
});
```

### 3.4 Victorious Memory V2 — Recommended Error Handling

**Current State:**
```python
class ProviderError(Exception): ...
class ProviderTimeoutError(ProviderError): ...
class ProviderNotConfiguredError(ProviderError): ...
```

**Recommended Evolution:**
```python
class ProviderError(Exception):
    """Base with structured context."""
    def __init__(self, message, *, provider_type=None, model_role=None, 
                 status_code=None, is_retryable=False):
        super().__init__(message)
        self.provider_type = provider_type
        self.model_role = model_role
        self.status_code = status_code
        self.is_retryable = is_retryable

class ProviderTimeoutError(ProviderError):
    """Request exceeded timeout."""
    def __init__(self, *args, **kwargs):
        super().__init__(*args, is_retryable=True, **kwargs)

class ProviderRateLimitError(ProviderError):
    """Rate limited by provider."""
    def __init__(self, *args, retry_after=None, **kwargs):
        super().__init__(*args, is_retryable=True, **kwargs)
        self.retry_after = retry_after

class ProviderAuthError(ProviderError):
    """Invalid API key or credentials."""
    def __init__(self, *args, **kwargs):
        super().__init__(*args, is_retryable=False, **kwargs)
```

---

## 4. Test/Validation Flows

### 4.1 LiteLLM Health Check System (Most Comprehensive)

**Endpoint Hierarchy:**
| Endpoint | Use Case |
|----------|----------|
| `/health/liveliness` | Container liveness probes |
| `/health/readiness` | Load balancer health checks |
| `/health` | Model health monitoring (makes actual API calls) |
| `/health/services` | Service debugging (datadog, langfuse, etc.) |

**`/health` Behavior:**
- Makes actual LLM API call to each configured model
- Default prompt: `"test from litellm"`
- Default max_tokens: 5 (cost-conscious)
- Returns:
```json
{
  "healthy_endpoints": [
    {"model": "azure/gpt-35-turbo", "api_base": "https://..."}
  ],
  "unhealthy_endpoints": [
    {"model": "azure/gpt-35-turbo", "api_base": "https://..."}
  ]
}
```

**Background Health Checks:**
```yaml
general_settings:
  background_health_checks: True
  health_check_interval: 300  # seconds
```

**Per-Model Health Check Config:**
```yaml
model_list:
  - model_name: gpt-4o
    litellm_params:
      model: openai/gpt-4o
      api_key: os.environ/OPENAI_API_KEY
    model_info:
      health_check_timeout: 10
      health_check_max_tokens: 5
      health_check_reasoning_effort: none
      disable_background_health_check: false
```

### 4.2 LibreChat Validation

**Startup Validation:**
- `librechat.yaml` validated on server start
- Invalid config → exit code 1 with specific error message
- `CONFIG_BYPASS_VALIDATION=true` for emergency override (not recommended)
- Online YAML validator tool provided

**Runtime Test:**
- Model selector dropdown shows configured endpoints
- If `fetch: true`, models auto-populated from provider `/models` endpoint
- Failed fetches fall back to `models.default` list

### 4.3 Vercel AI SDK Testing

- `mock_timeout=True` parameter for testing retry/fallback logic
- Provider test via direct API call with minimal prompt
- No built-in health check endpoint (SDK, not proxy)

### 4.4 Victorious Memory V2 — Current Test Flow

```python
@router.post("/{role}/test")
async def test_provider(role: str):
    reply = await gateway.complete(
        messages=[{"role": "user", "content": "Say hello in one word"}],
        model_role=role,
        response_format="text",
        max_tokens=20,
    )
    return ProviderTestResponse(status="ok", response=reply.strip())
```

**Gaps:**
- No health status tracking/persistence
- No background health monitoring
- No structured error categorization in response
- No cost-conscious test (20 tokens is reasonable but not configurable)

### 4.5 Recommended Test Flow for VM2

```python
class ProviderHealthStatus(str, Enum):
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"
    UNKNOWN = "unknown"

class ProviderHealthRecord(Base):
    provider_role: str
    status: ProviderHealthStatus
    last_checked: datetime
    response_time_ms: int
    error_message: str | None
    consecutive_failures: int
```

**Test Endpoint Evolution:**
```python
@router.post("/{role}/test")
async def test_provider(role: str):
    start = time.monotonic()
    try:
        reply = await gateway.complete(
            messages=[{"role": "user", "content": "Say hello in one word"}],
            model_role=role,
            response_format="text",
            max_tokens=10,  # Cost-conscious
            timeout=15,  # Shorter timeout for health checks
        )
        response_time = (time.monotonic() - start) * 1000
        await _record_health(role, "healthy", response_time)
        return ProviderTestResponse(
            status="ok", 
            response=reply.strip(),
            response_time_ms=int(response_time)
        )
    except ProviderTimeoutError:
        await _record_health(role, "degraded", None, "timeout")
        raise HTTPException(504, "Provider timed out")
    except ProviderAuthError:
        await _record_health(role, "unhealthy", None, "auth_error")
        raise HTTPException(401, "Invalid API key")
    except ProviderError as e:
        await _record_health(role, "unhealthy", None, str(e))
        raise HTTPException(502, str(e))
```

---

## 5. Provider Registries

### 5.1 The "Register Once, Use Everywhere" Pattern

**Vercel AI SDK — Provider Registry:**
```typescript
// registry.ts — register once
export const registry = createProviderRegistry({
  openai,
  anthropic,
  custom: createOpenAICompatible({...}),
}, { separator: ':' });

// Use everywhere
const model = registry.languageModel('openai:gpt-5.1');
const embedding = registry.embeddingModel('openai:text-embedding-3-small');
```

**LiteLLM — Global Registration via Config:**
```yaml
# config.yaml — register all models
model_list:
  - model_name: gpt-4o
    litellm_params:
      model: openai/gpt-4o
      api_key: os.environ/OPENAI_API_KEY
  - model_name: claude-sonnet
    litellm_params:
      model: anthropic/claude-sonnet-4
      api_key: os.environ/ANTHROPIC_API_KEY

# Use everywhere via proxy
curl http://localhost:4000/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "gpt-4o", "messages": [...]}'
```

**OpenWebUI + LiteLLM Integration:**
- OpenWebUI can point to LiteLLM proxy as its single "OpenAI API" endpoint
- LiteLLM handles all provider routing transparently
- OpenWebUI users see all models in dropdown without per-provider configuration

### 5.2 Model Discovery Patterns

**LibreChat — Fetch from Provider:**
```yaml
models:
  default: ["mistral-tiny", "mistral-small"]  # Fallback
  fetch: true  # GET /models from baseURL
```

**LiteLLM — Wildcard Routes:**
```yaml
model_list:
  - model_name: openai/*
    litellm_params:
      model: openai/*
      api_key: os.environ/OPENAI_API_KEY
    model_info:
      health_check_model: openai/gpt-4o-mini
```

**OpenRouter — Unified Model List:**
- OpenRouter provides `/api/v1/models` endpoint
- Returns all available models with pricing and context window
- Consumers cache this list and present in UI

### 5.3 Victorious Memory V2 — Recommended Registry Design

**Concept: Role + Provider Registry**

Since VM2 uses role-based configuration ("extraction", "chat", etc.), the registry should map roles to providers while supporting provider-type extensibility:

```python
class ProviderRegistry:
    """Register provider adapters once, resolve by role."""
    
    def __init__(self):
        self._adapters: dict[str, ProviderAdapter] = {}
        self._register_default_adapters()
    
    def _register_default_adapters(self):
        self.register("openai", OpenAIAdapter())
        self.register("anthropic", AnthropicAdapter())
        self.register("openrouter", OpenRouterAdapter())  # OpenAI-compatible
        self.register("generic_openai", OpenAICompatibleAdapter())
    
    def register(self, provider_type: str, adapter: ProviderAdapter):
        self._adapters[provider_type] = adapter
    
    async def complete(self, messages, *, model_role: str, **kwargs):
        config = await self._resolve_config(model_role)
        adapter = self._adapters.get(config.provider_type)
        if not adapter:
            raise ProviderNotConfiguredError(f"Unknown provider type: {config.provider_type}")
        return await adapter.complete(config, messages, **kwargs)
```

**Provider Adapter Interface:**
```python
class ProviderAdapter(Protocol):
    async def complete(self, config: ProviderConfig, messages: list[dict], **kwargs) -> str:
        ...
    
    async def test_connection(self, config: ProviderConfig) -> ProviderTestResult:
        ...
    
    async def list_models(self, config: ProviderConfig) -> list[str]:
        """Optional: fetch available models from provider."""
        ...
    
    def normalize_messages(self, messages: list[dict]) -> dict:
        """Translate to provider-specific format."""
        ...
```

---

## 6. Design Patterns Summary

### 6.1 Patterns to Adopt

| Pattern | Source | Benefit for VM2 |
|---------|--------|-----------------|
| **Provider Registry** | Vercel AI SDK, LiteLLM | Add new providers without code changes |
| **Model Aliases** | Vercel AI SDK | User-friendly names mapped to provider IDs |
| **Adapter Pattern** | LiteLLM internals | Clean separation of API schema translation |
| **Structured Errors** | LiteLLM | Retry decisions, monitoring, user-facing messages |
| **Health Check Endpoint** | LiteLLM Proxy | Proactive provider degradation detection |
| **Config Interpolation** | LibreChat | API keys in env vars, not DB |
| **Parameter Filtering** | LibreChat | Handle incompatible provider params |

### 6.2 Anti-Patterns to Avoid

| Anti-Pattern | Where Seen | Problem |
|--------------|-----------|---------|
| **Hardcoded Provider Switch** | VM2 current | Adding provider requires code change |
| **If-Elif Chains** | Naive implementations | Unmaintainable as providers grow |
| **Storing API Keys in Config Files** | Some LibreChat setups | Security risk, rotation pain |
| **No Timeout Distinction** | VM2 current | Can't detect "hanging" vs "slow" providers |
| **Silent Failures** | Embedding in VM2 | Zero vectors on failure masks problems |
| **No Health Tracking** | VM2 current | Don't know provider is down until user request fails |

### 6.3 Suggested VM2 Architecture Evolution

```
┌─────────────────────────────────────────┐
│          ProviderGateway (refactored)    │
├─────────────────────────────────────────┤
│  Registry                                │
│  ├── "openai" → OpenAIAdapter            │
│  ├── "anthropic" → AnthropicAdapter      │
│  ├── "openrouter" → OpenRouterAdapter    │
│  └── "generic_openai" → GenericAdapter   │
├─────────────────────────────────────────┤
│  Config Resolution                       │
│  1. DB lookup by role                    │
│  2. Env fallback (llm_base_url, etc.)    │
│  3. Validate config completeness         │
├─────────────────────────────────────────┤
│  Error Handling                          │
│  ├── Structured exceptions               │
│  ├── Retryable vs non-retryable          │
│  └── Health status updates               │
├─────────────────────────────────────────┤
│  Health Monitoring                       │
│  ├── POST /providers/{role}/test         │
│  ├── Background health checks (optional) │
│  └── Health status persistence           │
└─────────────────────────────────────────┘
```

---

## 7. Research Sources

1. **LibreChat Documentation** — `librechat.yaml` configuration, custom endpoints, validation
   - https://www.librechat.ai/docs/configuration/librechat_yaml
   - https://www.librechat.ai/docs/configuration/librechat_yaml/object_structure/custom_endpoint

2. **Vercel AI SDK Documentation** — Provider registry, custom providers, middleware
   - https://ai-sdk.dev/docs/ai-sdk-core/provider-management

3. **LiteLLM Documentation** — Provider abstraction, proxy health checks, timeouts
   - https://docs.litellm.ai/docs/providers
   - https://docs.litellm.ai/docs/proxy/health
   - https://docs.litellm.ai/docs/proxy/timeout

4. **OpenWebUI Documentation** — Pipelines architecture, extensibility
   - https://docs.openwebui.com/features/extensibility/pipelines/

5. **LangChain Documentation** — Chat model integrations, factory patterns
   - https://docs.langchain.com/oss/python/integrations/chat/anthropic

6. **Victorious Memory V2 Codebase** — Current gateway, models, router
   - `apps/api/app/domains/providers/gateway.py`
   - `apps/api/app/domains/providers/router.py`
   - `apps/api/app/domains/providers/schemas.py`
   - `apps/api/app/models.py:ProviderConfig`

---

## Appendix: Comparative Matrix

| Feature | LiteLLM | Vercel AI SDK | LibreChat | OpenWebUI | VM2 Current |
|---------|---------|---------------|-----------|-----------|-------------|
| Provider Count | 100+ | 15+ core | 20+ | Via LiteLLM | 2 |
| Registry Pattern | Config YAML | Code registry | YAML config | LiteLLM proxy | DB table |
| Model Aliases | Yes | Yes | Yes | Yes | No |
| Auto Model Fetch | Yes | No | Yes | No | No |
| Health Checks | Comprehensive | None | Implicit | None | Basic test endpoint |
| Timeout Config | Per-model | Per-call | No | No | Global only |
| Retry Logic | Built-in | Via middleware | No | No | Worker-level only |
| Fallback Routing | Yes | Via middleware | No | No | No |
| Error Taxonomy | Rich | Basic | Basic | Basic | Minimal |
| Config Validation | Runtime | TypeScript | Startup fail-fast | UI | DB constraints |
| API Key Storage | Env interpolation | Env vars | Env + user_provided | DB encrypted | DB plaintext |

---

*End of Research Report*
