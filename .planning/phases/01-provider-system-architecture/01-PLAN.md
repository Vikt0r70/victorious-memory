# Phase 1: Provider System & Architecture — Plan

**Phase:** 01-provider-system-architecture  
**Plan:** 01  
**Type:** execute  
**Mode:** mvp  
**Requirements:** PROV-01, PROV-02, PROV-03, PROV-04, PROV-05, PROV-06, PROV-07, PROV-08  
**Created:** 2026-05-25  
**Target File:** `.planning/phases/01-provider-system-architecture/01-PLAN.md`

---

## Goal

Integrate LiteLLM as the provider abstraction layer and build a complete provider management system with usage logging and fallback chains.

---

## Requirements

| ID | Description | Decision Ref |
|----|-------------|--------------|
| **PROV-01** | Unified provider registry — a dedicated tab/section in settings where providers are configured once | D-01, D-03, D-07 |
| **PROV-02** | Agent provider selection — each agent (extraction, edge-detection, consolidation) selects from the registered providers via dropdown | D-02, D-05 |
| **PROV-03** | Dynamic model list — available models are fetched from provider's /v1/models endpoint, not manually typed | D-10, D-11 |
| **PROV-04** | Provider type auto-detection — correct API schema and JSON payload built per provider type (OpenAI, Anthropic, OpenRouter, custom-compatible) | D-09, D-27 |
| **PROV-05** | Role field is read-only per agent — extraction/edge-detection/consolidation roles are fixed, not editable by user | D-05 |
| **PROV-06** | Usage logging — track every LLM call with provider, model, tokens, timing, and status | D-13, D-14 |
| **PROV-07** | Fallback chains — support up to 4 providers per role with priority-based failover via simple try/except loop | D-15, D-16, D-17 |
| **PROV-08** | Pre-configured provider templates — OpenAI, Anthropic, OpenCode, OpenRouter, Groq, Ollama, Custom | D-03 |

---

## Success Criteria

1. LiteLLM installed as pip dependency (`litellm` in `pyproject.toml`)
2. `ProviderGateway` calls `litellm.acompletion()` directly with DB config — no custom adapters
3. New "Providers" tab in settings with CRUD for provider configs
4. Pre-configured provider list: OpenAI, Anthropic, OpenCode, OpenRouter, Groq, Ollama, Custom
5. Agent settings show provider dropdown — roles fixed (read-only)
6. LiteLLM handles all provider schemas internally
7. Dynamic model lists via LiteLLM's model discovery
8. Usage logging table stores every call with tokens, timing, status
9. Fallback chains support up to 4 providers per role with drag-and-drop priority
10. Provider test returns meaningful error when API key is missing/invalid

---

## Architecture Overview

This phase replaces the monolithic role-based `provider_configs` table with a two-table design (`providers` registry + `agents` with JSONB override), migrates the custom httpx gateway to a LiteLLM partial wrapper, adds Fernet encryption for API keys at rest, and implements per-role fallback chains.

### Before vs After

| Component | Before | After |
|-----------|--------|-------|
| Provider storage | Single `provider_configs` table (role-based, plaintext keys) | `providers` registry + `agents` config (encrypted keys, JSONB override) |
| LLM routing | Custom httpx per provider (OpenAI + Anthropic only) | `litellm.acompletion()` with per-request `api_base`/`api_key` |
| Exception handling | Custom mapping from httpx errors | LiteLLM unified exception types → internal hierarchy |
| API key storage | Plaintext in DB | Fernet-encrypted at rest |
| Fallback | None | Per-role ordered chain of up to 4 providers |
| Usage tracking | None | Every call logged to `usage_logs` table |
| Model discovery | Hardcoded | Dynamic via `/v1/models` probe + LiteLLM static list |

### Key Files Changed

```
apps/api/
├── pyproject.toml                    # +litellm, +cryptography
├── alembic/                          # NEW — initialized
│   ├── alembic.ini
│   ├── env.py
│   └── versions/
│       └── p1_initial_provider_system.py  # NEW — drop old, create new, seed
├── app/
│   ├── config.py                     # +PROVIDER_KEY_ENCRYPTION_KEY
│   ├── models.py                     # -ProviderConfig, +Provider, +Agent, +UsageLog
│   ├── main.py                       # mount agents router, update provider router
│   ├── worker.py                     # update gateway calls (backward compatible)
│   └── domains/
│       └── providers/
│           ├── __init__.py
│           ├── gateway.py            # REWRITE — LiteLLM + fallback + logging
│           ├── service.py            # NEW — CRUD + chain resolution
│           ├── router.py             # REWRITE — registry + agents + test + models
│           ├── schemas.py            # REWRITE — strict Pydantic with response_model=
│           ├── exceptions.py         # NEW — ProviderError hierarchy
│           ├── templates.py          # NEW — PROVIDER_TEMPLATES dict
│           └── encryption.py         # NEW — Fernet wrapper

apps/web/
├── lib/api.ts                        # +providersApi, +agentsApi, +usageApi
└── app/settings/page.tsx             # REDESIGN — Provider Registry + Agent Routing
```

---

## Task Breakdown

### Task 1: Install Dependencies & Configure Environment

**Goal:** Add LiteLLM and cryptography to the project, update config to support encryption key management, and document new environment variables.

**Files:**
- `apps/api/pyproject.toml`
- `apps/api/app/config.py`
- `.env.example`
- `.gitignore`

**Dependencies:** None (can run in parallel with Task 2)

**Steps:**
1. Add `"litellm>=1.86.0"` and `"cryptography>=48.0"` to `dependencies` in `pyproject.toml`
2. Add `provider_key_encryption_key: str = ""` to `Settings` class in `config.py` per D-20
3. Update `.env.example` with `PROVIDER_KEY_ENCRYPTION_KEY=` comment explaining it's for Fernet encryption of API keys
4. Add `.encryption_key` to `.gitignore` per D-21 (auto-generated key file must never be committed)
5. Run `cd apps/api && pip install -e ".[dev]"` to install new dependencies
6. Verify imports work: `python -c "import litellm; from cryptography.fernet import Fernet; print('OK')"`

**Verification:**
- `python -c "import litellm; print(litellm.__version__)"` returns version >= 1.86.0
- `python -c "from cryptography.fernet import Fernet; print('OK')"` succeeds
- `grep -q "litellm" apps/api/pyproject.toml`
- `grep -q "cryptography" apps/api/pyproject.toml`
- `grep -q ".encryption_key" .gitignore`

---

### Task 2: Initialize Alembic & Create Database Migration

**Goal:** Set up Alembic for database migrations and create the initial migration that drops `provider_configs`, creates the new `providers` + `agents` + `usage_logs` tables, and seeds the 3 fixed agent roles.

**Files:**
- `apps/api/alembic.ini` (NEW)
- `apps/api/alembic/env.py` (NEW)
- `apps/api/alembic/script.py.mako` (NEW)
- `apps/api/alembic/versions/p1_initial_provider_system.py` (NEW)
- `apps/api/app/database.py` (modify — add `target_metadata` reference if needed)

**Dependencies:** None (can run in parallel with Task 1)

**Steps:**
1. Run `cd apps/api && alembic init alembic` to create Alembic directory structure
2. Configure `alembic.ini`:
   - Set `script_location = alembic`
   - Set `sqlalchemy.url = postgresql+asyncpg://victorious:victorious@localhost:5432/victorious`
   - Set `file_template = %%(rev)s_%%(slug)s`
3. Configure `alembic/env.py` for async PostgreSQL:
   - Import `asyncpg`
   - Set `target_metadata = Base.metadata` from `app.database`
   - Use `asyncpg` in `run_migrations_online()` with `connectable = create_async_engine(...)`
4. Create migration `alembic revision -m "provider_system"` — this generates the file, then hand-edit it
5. Edit the migration file to include:
   - `op.drop_table("provider_configs", if_exists=True)` — drop old table per D-06
   - Create `providers` table with columns: `id` (text PK), `name`, `provider_type`, `base_url`, `api_key_encrypted`, `model`, `max_tokens`, `is_enabled`, `created_at`, `updated_at` per D-01, D-04
   - Create `agents` table with columns: `id` (text PK), `role` (unique), `fallback_provider_ids` (JSONB array), `settings_override` (JSONB), `created_at`, `updated_at` per D-01, D-16
   - Create `usage_logs` table with columns per D-14: `id` (Integer autoincrement PK), `provider_id`, `agent_role`, `model`, `prompt_tokens`, `completion_tokens`, `total_tokens`, `latency_ms`, `status`, `fallback_position`, `error_message`, `created_at`
   - Seed 3 agent roles using `op.bulk_insert()` with ad-hoc `sqlalchemy.table()` definitions per RESEARCH.md Pitfall 5 (don't import ORM models in migration)
6. Run `alembic upgrade head` to apply migration
7. Verify in psql: `\dt` shows `providers`, `agents`, `usage_logs`; `provider_configs` is gone

**Verification:**
- `alembic current` shows the revision ID
- `psql -d victorious -c "\dt"` lists `providers`, `agents`, `usage_logs`; no `provider_configs`
- `psql -d victorious -c "SELECT role FROM agents"` returns `extraction`, `edge_detection`, `consolidation`

---

### Task 3: Add Encryption Utilities

**Goal:** Create a Fernet-based encryption module for API key at-rest encryption, with env-var loading and auto-generation fallback.

**Files:**
- `apps/api/app/domains/providers/encryption.py` (NEW)

**Dependencies:** Task 1 (config.py must have `provider_key_encryption_key`)

**Steps:**
1. Create `encryption.py` with `KeyEncryption` class per RESEARCH.md Pattern 2:
   - `__init__(self, key: str | None = None)` — if key is None, load from `settings.provider_key_encryption_key`; if that's empty, check for `.encryption_key` file; if no file, generate key with `Fernet.generate_key()` and write to `.encryption_key`
   - `encrypt(self, plaintext: str) -> str` — returns base64-encoded ciphertext
   - `decrypt(self, ciphertext: str) -> str` — returns plaintext, raises `InvalidToken` on bad key
2. Add module-level singleton: `key_encryption = KeyEncryption()`
3. Add `encrypt_api_key(plain: str) -> str` and `decrypt_api_key(ciphertext: str) -> str` convenience functions
4. Test roundtrip: `python -c "from app.domains.providers.encryption import encrypt_api_key, decrypt_api_key; c = encrypt_api_key('sk-test'); print(decrypt_api_key(c) == 'sk-test')"` from `apps/api/` directory

**Verification:**
- `pytest tests/test_crypto.py -x` passes (Wave 0 test — create it if it doesn't exist)
- Encrypt/decrypt roundtrip works for test key
- `InvalidToken` raised when decrypting with wrong key
- `.encryption_key` file exists if env var was missing

---

### Task 4: Update SQLAlchemy Models

**Goal:** Replace `ProviderConfig` with `Provider`, `Agent`, and `UsageLog` models in `models.py`, following existing SQLAlchemy 2.0 patterns.

**Files:**
- `apps/api/app/models.py`

**Dependencies:** Task 2 (migration must exist to understand schema, but code can be written in parallel since migration is source of truth)

**Steps:**
1. Remove `ProviderConfig` class entirely
2. Add `Provider` class per PATTERNS.md Model Pattern:
   - `id: Mapped[str] = mapped_column(Text, primary_key=True)` with `new_id()` using `"prov"` prefix
   - `name`, `provider_type`, `base_url`, `api_key_encrypted`, `model`, `max_tokens`, `is_enabled`
   - `created_at`, `updated_at` with `server_default=func.now()` and `onupdate=func.now()`
   - `__table_args__` with `Index("idx_providers_type", "provider_type")`
3. Add `Agent` class:
   - `id: Mapped[str]` with `"agent"` prefix
   - `role: Mapped[str]` unique, not nullable
   - `fallback_provider_ids: Mapped[list[str]] = mapped_column(JSONB, server_default="[]", default=list)` per D-16
   - `settings_override: Mapped[dict] = mapped_column(JSONB, server_default="{}", default=dict)` per D-08
   - Timestamps as above
4. Add `UsageLog` class:
   - `id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)` per decision (append-only audit data)
   - `provider_id: Mapped[str]` with `ForeignKey("providers.id")`
   - All fields from D-14: `agent_role`, `model`, `prompt_tokens`, `completion_tokens`, `total_tokens`, `latency_ms`, `status`, `fallback_position`, `error_message`
   - `created_at` with `server_default=func.now()` (no `updated_at` — append-only)
5. Verify file imports and syntax: `cd apps/api && python -c "from app.models import Provider, Agent, UsageLog; print('OK')"`

**Verification:**
- `python -c "from app.models import Provider, Agent, UsageLog; print('OK')"` succeeds
- `python -c "from app.models import ProviderConfig"` raises `ImportError`
- `grep -c "class ProviderConfig" apps/api/app/models.py` == 0
- `grep -c "class Provider" apps/api/app/models.py` >= 1
- `grep -c "class Agent" apps/api/app/models.py` >= 1
- `grep -c "class UsageLog" apps/api/app/models.py` >= 1

---

### Task 5: Create Provider Templates

**Goal:** Hardcode the 7 pre-configured provider templates as a Python dict, accessible to both backend (seed data) and frontend (display names).

**Files:**
- `apps/api/app/domains/providers/templates.py` (NEW)

**Dependencies:** None

**Steps:**
1. Create `templates.py` with `PROVIDER_TEMPLATES: dict[str, dict]` per D-03:
   - Keys: `"openai"`, `"anthropic"`, `"opencode"`, `"openrouter"`, `"groq"`, `"ollama"`, `"custom"`
   - Each value: `{"name": str, "provider_type": str, "base_url": str, "default_model": str, "description": str}`
   - Example:
     ```python
     "openai": {
         "name": "OpenAI",
         "provider_type": "openai",
         "base_url": "https://api.openai.com/v1",
         "default_model": "gpt-4o",
         "description": "Official OpenAI API",
     }
     ```
   - For Ollama: `base_url: "http://localhost:11434/v1"`, `default_model: "llama3"`
   - For Custom: `base_url: "", default_model: ""` (empty — user fills in)
2. Export `PROVIDER_TYPES = list(PROVIDER_TEMPLATES.keys())` for schema validation
3. Add `get_template(provider_type: str) -> dict | None` helper

**Verification:**
- `python -c "from app.domains.providers.templates import PROVIDER_TEMPLATES; print(len(PROVIDER_TEMPLATES))"` == 7
- `python -c "from app.domains.providers.templates import get_template; print(get_template('openai')['name'])"` == "OpenAI"
- All 7 provider types are present

---

### Task 6: Rewrite Provider Schemas

**Goal:** Replace existing schemas with strict Pydantic models using `response_model=` everywhere, excluding `api_key` from responses, and validating provider types via `Literal`.

**Files:**
- `apps/api/app/domains/providers/schemas.py` (REPLACE)

**Dependencies:** Task 5 (needs `PROVIDER_TYPES` for Literal validation)

**Steps:**
1. Define `ProviderType = Literal["openai", "anthropic", "opencode", "openrouter", "groq", "ollama", "custom"]` per D-27
2. Create `ProviderCreate` request schema:
   - `name`, `provider_type: ProviderType`, `base_url`, `api_key: str = ""`, `model`, `max_tokens: int = 2000`, `is_enabled: bool = True`
3. Create `ProviderResponse` response schema (no `api_key` field per D-28):
   - All provider fields except `api_key_encrypted`, plus `created_at`, `updated_at`
   - `model_config = {"from_attributes": True}`
4. Create `AgentSettings` schema:
   - `role: str`, `primary_provider_id: str | None = None`, `fallback_provider_ids: list[str] = []`, `settings_override: dict = {}`
5. Create `AgentSettingsResponse` schema (same fields, for responses)
6. Create `ProviderTestResponse` schema:
   - `status: str`, `response: str = ""`, `error: str | None = None`, `latency_ms: int | None = None`
7. Create `UsageLogResponse` schema:
   - All fields from `UsageLog` model except internal IDs, with `model_config = {"from_attributes": True}`
8. Create `ModelDiscoveryResponse` schema:
   - `models: list[dict[str, str]]` — each with `id` and `name`

**Verification:**
- `python -c "from app.domains.providers.schemas import ProviderResponse; print('api_key' not in ProviderResponse.model_fields)"` == True
- `python -c "from app.domains.providers.schemas import ProviderCreate; p = ProviderCreate(provider_type='invalid')"` raises `ValidationError`
- All schemas have `model_config = {"from_attributes": True}` where applicable

---

### Task 7: Build Provider Service

**Goal:** Implement CRUD operations for the provider registry, agent configuration, fallback chain resolution, and usage log queries.

**Files:**
- `apps/api/app/domains/providers/service.py` (NEW)

**Dependencies:** Task 3 (encryption), Task 4 (models), Task 5 (templates), Task 6 (schemas)

**Steps:**
1. Import `Provider`, `Agent`, `UsageLog` from `app.models`
2. Import `encrypt_api_key`, `decrypt_api_key` from `.encryption`
3. Import `PROVIDER_TEMPLATES` from `.templates`
4. Implement provider CRUD:
   - `list_providers(db: AsyncSession) -> tuple[list[Provider], int]` — paginated list
   - `get_provider(db: AsyncSession, provider_id: str) -> Provider | None`
   - `create_provider(db: AsyncSession, data: ProviderCreate) -> Provider` — encrypt `api_key` before storing
   - `update_provider(db: AsyncSession, provider_id: str, data: ProviderCreate) -> Provider | None` — re-encrypt key if changed
   - `delete_provider(db: AsyncSession, provider_id: str) -> bool`
5. Implement agent config:
   - `list_agents(db: AsyncSession) -> list[Agent]`
   - `get_agent_by_role(db: AsyncSession, role: str) -> Agent | None`
   - `update_agent_settings(db: AsyncSession, role: str, data: AgentSettings) -> Agent | None` — validates `fallback_provider_ids` length <= 4 per D-15
6. Implement fallback chain resolution per D-17:
   - `resolve_provider_chain(db: AsyncSession, agent_role: str) -> list[Provider]` — loads agent, resolves `fallback_provider_ids` to ordered `Provider` objects, filters `is_enabled=True`
7. Implement usage log queries:
   - `list_usage_logs(db: AsyncSession, agent_role: str | None = None, provider_id: str | None = None, limit: int = 100) -> list[UsageLog]`
   - `create_usage_log(db: AsyncSession, ...)` — internal helper called by gateway
8. Add `seed_default_agents(db: AsyncSession)` — idempotent seed of 3 agent roles if table is empty

**Verification:**
- `pytest tests/test_provider_service.py -x` passes (create test file with mock DB session)
- `create_provider` stores encrypted key (verify: `grep -v "^#" apps/api/app/domains/providers/service.py | grep -c "encrypt_api_key"` >= 1)
- `resolve_provider_chain` returns max 4 providers (verify with test)
- Service returns `None` for not-found, `False` for failed deletes (matches existing pattern)

---

### Task 8: Rewrite Provider Gateway

**Goal:** Replace the custom httpx gateway with a LiteLLM partial wrapper that handles config resolution, encryption/decryption, usage logging, and fallback orchestration.

**Files:**
- `apps/api/app/domains/providers/gateway.py` (REPLACE)
- `apps/api/app/domains/providers/exceptions.py` (NEW)

**Dependencies:** Task 3 (encryption), Task 4 (models), Task 7 (service)

**Steps:**
1. Create `exceptions.py` with exception hierarchy per D-29, D-30:
   - `ProviderError(Exception)` — base, with `retryable: bool = False` attribute
   - `ProviderTimeoutError(ProviderError)` — `retryable = True`
   - `ProviderAuthenticationError(ProviderError)` — `retryable = False`
   - `ProviderRateLimitError(ProviderError)` — `retryable = True`
2. In `gateway.py`, implement `ProviderGateway` class per 01-AI-SPEC.md Section 4:
   - `__init__()`: sets up module state, imports `litellm`, sets `litellm.num_retries = 0` per D-12
   - `complete(agent_role: str, messages: list[dict], temperature=0.1, max_tokens=4096, response_format=None) -> litellm.ModelResponse`:
     1. Call `resolve_provider_chain(db, agent_role)` to get ordered provider list
     2. For each provider in chain:
        - Decrypt API key via `decrypt_api_key()`
        - Format model string: `f"{provider.provider_type}/{provider.model}"` per D-10
        - Call `await litellm.acompletion(model=..., messages=..., api_key=..., api_base=..., num_retries=0, timeout=30, ...)`
        - On success: log usage via `_log_usage()` and return response
        - On `AuthenticationError`: log failure, raise `ProviderAuthenticationError` (fail fast, don't retry per guardrail)
        - On `RateLimitError`, `APITimeoutError`, `APIConnectionError`, `ServiceUnavailableError`: log failure, continue to next provider
        - On `APIError` (5xx): log failure, continue to next provider
        - On `BadRequestError`, `NotFoundError`: raise as non-retryable `ProviderError`
     3. If all providers exhausted: raise `ProviderError` with last error
   - `_log_usage(...)`: writes to `usage_logs` table with all fields per D-14
   - `_resolve_chain(agent_role: str)`: delegates to `resolve_provider_chain()` from service
3. Keep module-level singleton: `gateway = ProviderGateway()`
4. Maintain backward compatibility: `complete()` signature accepts `model_role` parameter (map to `agent_role` internally) so existing worker.py and agent.py code doesn't break immediately

**Verification:**
- `pytest tests/test_gateway.py -x` passes with mocked `litellm.acompletion`
- Mock test verifies `num_retries=0` is passed on every call
- Mock test verifies model string format is `provider_type/model`
- Mock test verifies fallback chain tries next provider on `RateLimitError`
- Mock test verifies `AuthenticationError` fails fast (doesn't try next provider)
- `grep -v "^#" apps/api/app/domains/providers/gateway.py | grep -c "litellm.acompletion"` >= 1
- `grep -v "^#" apps/api/app/domains/providers/gateway.py | grep -c "num_retries=0"` >= 1

---

### Task 9: Update Provider Router

**Goal:** Replace the role-based provider router with a full registry router plus new agents router, implementing CRUD, test endpoint, model discovery, and usage log endpoint.

**Files:**
- `apps/api/app/domains/providers/router.py` (REPLACE)
- `apps/api/app/domains/providers/__init__.py` (modify if needed)

**Dependencies:** Task 6 (schemas), Task 7 (service), Task 8 (gateway)

**Steps:**
1. Create provider registry endpoints (`APIRouter(prefix="/providers")`):
   - `GET /providers` — `list_providers()` → returns `ListResponse[ProviderResponse]`
   - `POST /providers` — `create_provider()` → `ProviderResponse`
   - `PUT /providers/{provider_id}` — `update_provider()` → `ProviderResponse`
   - `DELETE /providers/{provider_id}` — `delete_provider()` → `204`
   - `POST /providers/{provider_id}/test` — test endpoint per D-18:
     1. Load provider config
     2. Try `$0` probe: `GET {base_url}/v1/models` via httpx with decrypted key
     3. If probe fails, try minimal `acompletion()` with `max_tokens=1`
     4. Return `ProviderTestResponse` with distinct status codes: `200` success, `401` bad key, `502` connection error, `504` timeout per D-19
   - `GET /providers/{provider_id}/models` — model discovery per D-11:
     1. Try provider's `/v1/models` endpoint first
     2. Fall back to `litellm.utils.get_valid_models()` filtered by provider type
     3. Return `ModelDiscoveryResponse`
2. Create agents router (`APIRouter(prefix="/agents")`):
   - `GET /agents` — `list_agents()` → `ListResponse[AgentSettingsResponse]`
   - `PUT /agents/{role}` — `update_agent_settings()` → `AgentSettingsResponse`
   - `POST /agents/{role}/test` — test agent's primary provider via gateway
3. Create usage log router (or add to providers router):
   - `GET /usage` — `list_usage_logs()` → `ListResponse[UsageLogResponse]` with query params for `agent_role`, `provider_id`, `limit`
4. All endpoints use `response_model=` per D-26
5. All endpoints use `HTTPException(status_code=..., detail=...)` consistently per PATTERNS.md Anti-Pattern 3
6. Response schemas never include `api_key` per D-28

**Verification:**
- `curl http://localhost:8080/api/providers` returns JSON list (200)
- `curl http://localhost:8080/api/agents` returns 3 fixed roles (200)
- `curl -X POST http://localhost:8080/api/providers -d '{"name":"Test","provider_type":"openai","base_url":"https://api.openai.com/v1","model":"gpt-4o"}'` returns provider without `api_key` (201)
- Provider test endpoint returns 401 for missing/invalid key
- All endpoints have `response_model=` (grep check)

---

### Task 10: Update Main.py & Worker.py Integration

**Goal:** Wire the new routers into the FastAPI app and ensure the worker continues to function with the new gateway API.

**Files:**
- `apps/api/app/main.py`
- `apps/api/app/worker.py`
- `apps/api/app/domains/extraction/agent.py` (verify compatibility)

**Dependencies:** Task 8 (gateway), Task 9 (router)

**Steps:**
1. In `main.py`:
   - Import new provider router: `from app.domains.providers.router import router as providers_router`
   - Import agents router if separate: `from app.domains.providers.router import agents_router`
   - Import usage router if separate
   - Keep existing `app.include_router(providers_router, prefix="/api")` (prefix already in router)
   - Add `app.include_router(agents_router, prefix="/api")` if separate
   - Add startup event to seed default agents if table empty (call `seed_default_agents`)
2. In `worker.py`:
   - Verify `gateway.complete(model_role="extraction")` still works — gateway should accept `model_role` as alias for `agent_role` for backward compatibility
   - No changes needed if gateway maintains backward compatibility
3. In `agent.py`:
   - Verify `gateway.complete(model_role=...)` calls still function
   - No changes needed if backward compatible
4. Run `python -c "from app.main import app; print('OK')"` to verify no import errors
5. Start API: `cd apps/api && uvicorn app.main:app --reload` and verify it boots without errors

**Verification:**
- `python -c "from app.main import app; print('OK')"` succeeds
- `curl http://localhost:8080/api/system/info` returns system info (confirms app boots)
- Worker starts without import errors when app boots
- Existing extraction pipeline can call `gateway.complete(model_role="extraction")` without error

---

### Task 11: Update Frontend API Client

**Goal:** Extend the frontend API client with new endpoints for provider registry, agent settings, and usage logs.

**Files:**
- `apps/web/lib/api.ts`

**Dependencies:** Task 9 (backend routers must exist)

**Steps:**
1. Update `providersApi` object:
   - `list: () => request<any>("/providers")`
   - `create: (data: any) => request<any>("/providers", { method: "POST", body: JSON.stringify(data) })`
   - `update: (id: string, data: any) => request<any>(`/providers/${id}`, { method: "PUT", body: JSON.stringify(data) })`
   - `delete: (id: string) => request<void>(`/providers/${id}`, { method: "DELETE" })`
   - `test: (id: string) => request<any>(`/providers/${id}/test", { method: "POST" })`
   - `listModels: (id: string) => request<any>(`/providers/${id}/models")`
2. Update `agentsApi` object (new):
   - `list: () => request<any>("/agents")`
   - `update: (role: string, data: any) => request<any>(`/agents/${role}`, { method: "PUT", body: JSON.stringify(data) })`
   - `test: (role: string) => request<any>(`/agents/${role}/test", { method: "POST" })`
3. Add `usageApi` object (new):
   - `list: (params?: Record<string, string>) => request<any>(`/usage?${new URLSearchParams(params)}"))`
4. Remove old `providersApi.upsert` and `providersApi.test(role)` signatures (replace with new ones above)
5. Verify TypeScript compiles: `cd apps/web && npm run build` (or at least `npx tsc --noEmit`)

**Verification:**
- `npx tsc --noEmit` in `apps/web/` passes without type errors
- All new API methods are exported and callable
- No references to old `providersApi.upsert` remain

---

### Task 12: Redesign Settings Page

**Goal:** Replace the current settings "Providers" tab with a full Provider Registry + Agent Routing UI, supporting CRUD, fallback chain configuration, provider testing, and usage log viewing.

**Files:**
- `apps/web/app/settings/page.tsx` (MODIFY)
- `apps/web/components/modals/ProviderConfigModal.tsx` (MODIFY)

**Dependencies:** Task 11 (frontend API client)

**Steps:**
1. Restructure tabs per D-23:
   - New tab order: `"Provider Registry", "Agent Routing", "Extraction", "Auto-Approve", "Lifecycle", "Plugin", "Data"`
   - Or keep existing but replace "Providers" tab content with new registry + routing sections
2. Implement "Provider Registry" section (top of Providers tab):
   - Display existing providers as cards with: name, type, model, enabled toggle
   - "Add from Template" button — opens modal with 7 template options (PROV-08)
   - "Add Custom" button — empty form for manual entry
   - Each card has Edit (pencil) and Delete (trash) buttons
   - "Test Connection" button per provider — calls `providersApi.test(id)` and shows result
3. Implement "Agent Routing" section (bottom of Providers tab):
   - Display 3 fixed rows: `extraction`, `edge_detection`, `consolidation` (PROV-05 — read-only roles)
   - Each row has:
     - Primary provider dropdown (select from live provider list per PROV-02)
     - "Add Fallback" button — adds another dropdown (max 4 per D-15)
     - Drag handles to reorder fallback priority (PROV-07)
     - "Test" button to test the agent's primary provider
   - Fallback chain saves automatically on change (or explicit "Save Routing" button)
4. Update `ProviderConfigModal.tsx`:
   - Support both "from template" and "custom" modes
   - Fields: name, provider type (dropdown with 7 options), base URL, model, API key, max tokens, enabled toggle
   - Provider type change auto-fills base_url and default_model from template (PROV-04)
   - "Test Connection" button inside modal
   - Save button creates/updates provider
5. Add "Usage Logs" subsection (optional, can be minimal table):
   - Table showing recent calls: agent, provider, model, tokens, latency, status
   - Filter by agent role
6. Follow all existing frontend patterns from PATTERNS.md:
   - Tailwind MD3 dark palette colors
   - `useState`/`useEffect` for state
   - `material-symbols-outlined` for icons
   - Toggle switch component for enabled state
   - Modal overlay pattern
7. Verify the page loads without errors: open `http://localhost:3000/settings` in browser

**Verification:**
- `npm run build` in `apps/web/` succeeds
- Settings page loads at `http://localhost:3000/settings`
- "Provider Registry" section visible with provider cards
- "Add from Template" button opens modal with 7 options
- Agent Routing section shows 3 fixed roles with dropdowns
- Fallback chain allows adding up to 4 providers
- Provider test button shows success/error status

---

### Task 13: Write Tests

**Goal:** Create comprehensive unit and integration tests for the new provider system components.

**Files:**
- `apps/api/tests/test_crypto.py` (NEW)
- `apps/api/tests/test_provider_service.py` (NEW)
- `apps/api/tests/test_gateway.py` (NEW)
- `apps/api/tests/test_fallback.py` (NEW)
- `apps/api/tests/test_provider_test_endpoint.py` (NEW)
- `apps/api/tests/conftest.py` (modify if exists)

**Dependencies:** Tasks 3, 7, 8 (components being tested)

**Steps:**
1. `test_crypto.py`:
   - Test Fernet encrypt/decrypt roundtrip
   - Test `InvalidToken` on bad key
   - Test auto-generation of `.encryption_key` file
2. `test_provider_service.py`:
   - Test create_provider encrypts key
   - Test update_provider re-encrypts changed key
   - Test resolve_provider_chain returns correct order
   - Test resolve_provider_chain max 4 providers
   - Test delete_provider returns False for missing ID
3. `test_gateway.py`:
   - Mock `litellm.acompletion` to return fake `ModelResponse`
   - Test gateway calls `acompletion` with correct model string format
   - Test `num_retries=0` is always passed
   - Test usage log is written on success
   - Test exception mapping: LiteLLM `AuthenticationError` → `ProviderAuthenticationError`
4. `test_fallback.py`:
   - Mock primary provider failing with `RateLimitError`, secondary succeeding
   - Verify fallback_position=1 logged
   - Test all 4 fallback positions can be used
   - Test auth error fails fast (doesn't try fallbacks)
5. `test_provider_test_endpoint.py`:
   - Mock `$0` probe success (200 from `/v1/models`)
   - Mock `$0` probe failure + completion success
   - Test 401 returned for auth error
   - Test 502 returned for connection error
6. Update `conftest.py` if needed:
   - Add `async_db_session` fixture
   - Add `mock_litellm` fixture

**Verification:**
- `cd apps/api && pytest tests/test_crypto.py tests/test_provider_service.py tests/test_gateway.py tests/test_fallback.py tests/test_provider_test_endpoint.py -x -q` passes all
- Each test file has >= 3 test cases
- `pytest` run completes in < 30 seconds

---

### Task 14: Run End-to-End Verification

**Goal:** Verify all success criteria are met through automated and manual testing.

**Files:** None (verification only)

**Dependencies:** All previous tasks (1-13)

**Steps:**
1. Start the full stack:
   - `docker compose up -d` (PostgreSQL)
   - `cd apps/api && uvicorn app.main:app --host 0.0.0.0 --port 8080`
   - `cd apps/web && npm run dev`
2. Run backend test suite:
   - `cd apps/api && pytest tests/ -v` — all tests pass
3. Verify database schema:
   - `\dt` shows `providers`, `agents`, `usage_logs`
   - `\d providers` shows encrypted key column
   - `\d agents` shows JSONB columns
4. Verify API endpoints via curl/httpie:
   - `GET /api/providers` — returns list
   - `POST /api/providers` — creates provider
   - `GET /api/agents` — returns 3 roles
   - `PUT /api/agents/extraction` — updates fallback chain
   - `POST /api/providers/{id}/test` — returns meaningful error for missing key
   - `GET /api/providers/{id}/models` — returns model list
   - `GET /api/usage` — returns logs
5. Verify frontend:
   - Open `http://localhost:3000/settings`
   - Confirm Provider Registry section visible
   - Confirm Agent Routing section with 3 fixed roles
   - Add a provider from template
   - Configure fallback chain
   - Run provider test
6. Verify extraction pipeline still works:
   - Trigger an ingestion via plugin or curl
   - Confirm extraction job completes successfully
   - Check `usage_logs` table has entries
7. Run `python tests/test_e2e_phase1.py` if it exists, or create a minimal E2E test

**Verification:**
- All 10 success criteria from ROADMAP are demonstrably true
- `pytest tests/ -v` passes with 0 failures
- Frontend `npm run build` succeeds
- Manual check: settings page shows provider registry + agent routing
- Manual check: usage_logs table has rows after an extraction

---

## Dependencies & Order

### Wave 1: Foundation (parallel)
- **Task 1**: Install Dependencies & Configure Environment
- **Task 2**: Initialize Alembic & Create Database Migration

### Wave 2: Backend Core (sequential within wave, parallel with Wave 1 completion)
- **Task 3**: Add Encryption Utilities (needs Task 1)
- **Task 4**: Update SQLAlchemy Models (can start after Task 2 migration is defined)
- **Task 5**: Create Provider Templates (no deps)
- **Task 6**: Rewrite Provider Schemas (needs Task 5)
- **Task 7**: Build Provider Service (needs Tasks 3, 4, 5, 6)
- **Task 8**: Rewrite Provider Gateway (needs Tasks 3, 4, 7)

### Wave 3: Backend API
- **Task 9**: Update Provider Router (needs Tasks 6, 7, 8)
- **Task 10**: Update Main.py & Worker.py (needs Tasks 8, 9)

### Wave 4: Frontend
- **Task 11**: Update Frontend API Client (needs Task 9)
- **Task 12**: Redesign Settings Page (needs Task 11)

### Wave 5: Verification
- **Task 13**: Write Tests (needs Tasks 3, 7, 8)
- **Task 14**: Run End-to-End Verification (needs ALL previous tasks)

### Dependency Graph

```
Wave 1:
  Task 1 ──┐
           ├──→ Wave 2
  Task 2 ──┘

Wave 2:
  Task 3 ──→ Task 7 ──→ Task 8 ──→ Wave 3
  Task 4 ──→ ─┘
  Task 5 ──→ Task 6 ──→ Task 7

Wave 3:
  Task 8 ──→ Task 9 ──→ Task 10 ──→ Wave 4

Wave 4:
  Task 10 ──→ Task 11 ──→ Task 12 ──→ Wave 5

Wave 5:
  Tasks 1-12 ──→ Task 13 ──→ Task 14
```

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **LiteLLM model string format errors** | Medium | High | Always format as `f"{provider_type}/{model}"` (D-10). Add test verifying format. Monitor for `AuthenticationError` on correct keys. |
| **Fernet key loss makes encrypted keys unreadable** | Low | High | Support `PROVIDER_KEY_ENCRYPTION_KEY` env var (D-20). Auto-generate `.encryption_key` only as fallback. Document backup requirement. |
| **Alembic migration fails on existing database** | Medium | High | Initialize Alembic, run `alembic stamp head` after baseline, then apply provider migration. Test on fresh DB first, then existing. |
| **Old gateway code path breaks extraction pipeline** | Medium | High | Maintain backward-compatible `complete(model_role=...)` signature. Test extraction pipeline after gateway rewrite. |
| **Frontend API changes break existing settings page** | Medium | Medium | Update frontend in same phase. Keep old `providersApi.list()` working. Test all settings tabs. |
| **LiteLLM dependency increases Docker image size** | Low | Medium | `litellm` ~20MB. Acceptable tradeoff. Monitor image size in CI. |
| **Dynamic model discovery fails for some providers** | Medium | Low | Fall back to LiteLLM static list (D-11). UI allows manual model entry as override. |
| **Fallback chain causes cost cascade** | Low | High | Implement cost cap guardrail per 01-AI-SPEC.md. Log every fallback attempt with position. Review usage_logs regularly. |
| **Encryption performance in async loop** | Low | Low | Fernet <1ms per key. Acceptable for single-key decrypt per completion. Document for future batch optimization. |
| **JSON mode silent degradation** | Medium | High | Never use `drop_params=True`. Let LiteLLM raise `UnsupportedParamsError` for providers without JSON mode. Catch and map to `ProviderError`. |

---

## Rollback Plan

If anything goes wrong during implementation, use this rollback strategy:

### Database Rollback
1. `cd apps/api && alembic downgrade -1` — reverts migration, restores `provider_configs` table structure
   - **Note:** Data in `provider_configs` was not migrated (old table is dropped without data migration per D-06). This is acceptable because the old table had role-based configs that can be re-entered via the new UI.
2. If downgrade fails, manually restore from backup or recreate `provider_configs` table with original schema.

### Code Rollback
1. All changes are in git. Create a branch before starting: `git checkout -b phase-1-provider-system`
2. If rollback needed: `git checkout main` (or original branch) to revert all file changes
3. Specific file restoration:
   - Gateway: restore from git history `git checkout HEAD -- apps/api/app/domains/providers/gateway.py`
   - Router: restore from git history `git checkout HEAD -- apps/api/app/domains/providers/router.py`
   - Models: restore from git history `git checkout HEAD -- apps/api/app/models.py`

### Service Rollback
1. Stop API: `pkill -f uvicorn`
2. Revert to main branch
3. Restart API: `cd apps/api && uvicorn app.main:app`

### Data Preservation
- **Memories, exchanges, projects** — unaffected (separate tables)
- **Provider configs** — will need reconfiguration (expected; old table dropped per D-06)
- **Usage logs** — will be lost on downgrade (acceptable for rollback scenario)

---

## Verification Steps

### Success Criterion 1: LiteLLM Installed
**Verify:** `python -c "import litellm; print(litellm.__version__)"` returns `>=1.86.0`  
**Check:** `grep "litellm" apps/api/pyproject.toml`

### Success Criterion 2: Gateway Uses LiteLLM
**Verify:** `grep -c "litellm.acompletion" apps/api/app/domains/providers/gateway.py` >= 1  
**Verify:** `grep -c "_openai_complete\|_anthropic_complete" apps/api/app/domains/providers/gateway.py` == 0 (no old custom adapters)  
**Check:** Review `gateway.py` — no httpx post calls to `/chat/completions` or `/v1/messages`

### Success Criterion 3: New "Providers" Tab
**Verify:** Open `http://localhost:3000/settings` — "Provider Registry" section visible  
**Check:** `apps/web/app/settings/page.tsx` contains "Provider Registry" heading

### Success Criterion 4: Pre-configured Provider List
**Verify:** Click "Add from Template" — modal shows 7 options: OpenAI, Anthropic, OpenCode, OpenRouter, Groq, Ollama, Custom  
**Check:** `python -c "from app.domains.providers.templates import PROVIDER_TEMPLATES; print(len(PROVIDER_TEMPLATES))"` == 7

### Success Criterion 5: Agent Settings with Fixed Roles
**Verify:** Agent Routing section shows exactly 3 rows: extraction, edge_detection, consolidation  
**Verify:** Role names are not editable (read-only)  
**Check:** `curl /api/agents` returns exactly these 3 roles

### Success Criterion 6: LiteLLM Handles Provider Schemas
**Verify:** `grep -c "if provider_type == 'anthropic'" apps/api/app/domains/providers/gateway.py` == 0 (no custom schema branching)  
**Verify:** LiteLLM `acompletion()` is called with generic params for all providers

### Success Criterion 7: Dynamic Model Lists
**Verify:** `GET /api/providers/{id}/models` returns JSON list of models  
**Verify:** Model dropdown in settings UI is populated from API, not hardcoded  
**Check:** Provider with valid API key returns non-empty model list

### Success Criterion 8: Usage Logging Table
**Verify:** `\d usage_logs` in psql shows table with all required columns  
**Verify:** After an extraction, `SELECT COUNT(*) FROM usage_logs` > 0  
**Check:** Log entry has: provider_id, agent_role, model, prompt_tokens, completion_tokens, total_tokens, latency_ms, status

### Success Criterion 9: Fallback Chains
**Verify:** `PUT /api/agents/extraction` with `{"fallback_provider_ids": ["prov_1", "prov_2", "prov_3", "prov_4"]}` succeeds  
**Verify:** `PUT /api/agents/extraction` with 5 providers returns validation error  
**Verify:** UI allows drag-and-drop reordering of fallback providers  
**Check:** Gateway test confirms fallback chain tries providers in order

### Success Criterion 10: Provider Test Returns Meaningful Errors
**Verify:** `POST /api/providers/{id}/test` with missing API key returns `401` status  
**Verify:** `POST /api/providers/{id}/test` with invalid base_url returns `502` status  
**Verify:** Response body contains clear error message (not raw exception traceback)  
**Check:** Frontend test button shows "Authentication failed" or "Connection error" text

---

## Decision Traceability

| Decision | Tasks Implementing It |
|----------|----------------------|
| D-01 (two-table design) | Task 2, Task 4 |
| D-02 (runtime merge) | Task 7, Task 8 |
| D-03 (templates) | Task 5 |
| D-04 (Fernet encryption) | Task 1, Task 3 |
| D-05 (fixed roles) | Task 2, Task 9, Task 12 |
| D-06 (drop provider_configs) | Task 2, Task 4 |
| D-07 (no built-in protection) | Task 7 |
| D-08 (passthrough override) | Task 4, Task 6, Task 7 |
| D-09 (partial wrapper) | Task 8 |
| D-10 (model mapping) | Task 8 |
| D-11 (model discovery) | Task 9 |
| D-12 (disable retries) | Task 8 |
| D-13 (manual logging) | Task 7, Task 8 |
| D-14 (full detail schema) | Task 2, Task 4, Task 6 |
| D-15 (per-role priority) | Task 7, Task 9, Task 12 |
| D-16 (fallback_provider_ids JSONB) | Task 2, Task 4 |
| D-17 (simple for loop) | Task 8 |
| D-18 (two-phase test) | Task 9 |
| D-19 (distinct errors) | Task 9 |
| D-20 (env var preferred) | Task 1, Task 3 |
| D-21 (auto-fallback file) | Task 1, Task 3 |
| D-22 (VPS ready) | Task 1 |
| D-23 (single page sections) | Task 12 |
| D-24 (unified state) | Task 12 |
| D-25 (single migration) | Task 2 |
| D-26 (strict Pydantic) | Task 6, Task 9 |
| D-27 (Literal validation) | Task 6 |
| D-28 (exclude api_key) | Task 6, Task 7 |
| D-29 (hybrid exception hierarchy) | Task 8 |
| D-30 (gateway as adapter) | Task 8 |
| D-31 (worker-level retries) | Task 10 |
| D-32 (gateway stateless) | Task 8 |

---

## Output

When this plan is fully executed, create `.planning/phases/01-provider-system-architecture/01-01-SUMMARY.md` documenting:
- What was built
- Files created/modified
- Key decisions implemented
- Test results
- Any deviations from plan with rationale

---

*Plan created: 2026-05-25*  
*Next step: Execute via `/gsd-execute-phase 01-provider-system-architecture`*
