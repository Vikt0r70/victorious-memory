---
phase: 01-provider-system-architecture
status: gaps_found
created: 2026-05-26
verifier: gsd-verifier
score: 4/8 must-haves verified
overrides_applied: 0
overrides: []
gaps:
  - truth: "PROV-03: Dynamic model list — available models fetched from provider's /v1/models endpoint, not manually typed"
    status: failed
    reason: "Backend GET /providers/{id}/models endpoint exists and probes /v1/models with LiteLLM fallback, but frontend ProviderConfigModal.tsx uses a plain <input> for model (line 294). The providersApi.listModels(id) method in api.ts exists but is never called anywhere in the UI. Users still manually type model names."
    artifacts:
      - path: "apps/web/components/modals/ProviderConfigModal.tsx"
        issue: "Model field is a plain text input; no API-driven dropdown"
      - path: "apps/web/lib/api.ts"
        issue: "listModels method exists but is orphaned (never invoked)"
    missing:
      - "Wire model discovery API into ProviderConfigModal as a dropdown"
      - "Call providersApi.listModels when provider type or base_url changes"

  - truth: "PROV-04: Provider type auto-detection — correct API schema and JSON payload built per provider type"
    status: failed
    reason: "Backend gateway.py correctly formats model string as provider_type/model for LiteLLM. BUT frontend sends invalid provider_type values that fail backend Pydantic Literal validation. ProviderConfigModal.tsx uses 'openai_compatible' and 'deepseek' which are NOT in backend ProviderType Literal ['openai','anthropic','opencode','openrouter','groq','ollama','custom']. Creating a provider through the UI modal results in a 422 validation error. Additionally, frontend sends 'enabled' field while backend schema expects 'is_enabled', so toggle state is ignored."
    artifacts:
      - path: "apps/web/components/modals/ProviderConfigModal.tsx"
        issue: "PROVIDER_TYPES includes 'openai_compatible' and 'deepseek' instead of 'openai' and 'opencode'; payload sends 'enabled' not 'is_enabled'"
      - path: "apps/web/app/settings/page.tsx"
        issue: "handleToggleProvider sends {enabled: ...} which backend ignores; toggle does not persist"
    missing:
      - "Align frontend PROVIDER_TYPES with backend ProviderType Literal exactly"
      - "Change 'enabled' to 'is_enabled' in all frontend provider payloads"

  - truth: "PROV-05: Role field is read-only per agent — extraction/edge-detection/consolidation roles are fixed"
    status: failed
    reason: "Migration correctly seeds extraction, edge_detection, consolidation. Frontend AGENT_ROLES constant correctly shows 3 fixed read-only roles. BUT service.py seed_default_agents() seeds 'planner', 'researcher', 'executor' — the wrong roles. main.py calls seed_default_agents() on every startup. On a fresh database (or if agents table is ever empty), the app inserts incorrect roles instead of the required ones."
    artifacts:
      - path: "apps/api/app/domains/providers/service.py"
        issue: "seed_default_agents() seeds wrong roles: planner, researcher, executor"
    missing:
      - "Fix seed_default_agents() to seed extraction, edge_detection, consolidation"

  - truth: "PROV-07: Fallback chains — support up to 4 providers per role with priority-based failover"
    status: failed
    reason: "Backend correctly supports up to 4 fallbacks (service.py validates > 4 raises ValueError; tests verify 4 positions). Gateway correctly tries chain in order. BUT frontend page.tsx line 193 enforces 'if (current.length >= 3) return a;' which prevents adding a 4th fallback in the UI. The UI only supports up to 3 fallbacks + 1 primary = 4 total, but the requirement is 'up to 4 providers per role' which could mean 4 fallbacks, or at minimum the UI should allow what the API allows. The UI restricts below backend capability."
    artifacts:
      - path: "apps/web/app/settings/page.tsx"
        issue: "handleAddFallback caps fallback chain at 3 instead of 4"
    missing:
      - "Change '>= 3' to '>= 4' (or '> 4') in handleAddFallback to match backend limit"

deferred: []
human_verification:
  - test: "Open the settings page, click 'Add from Template', verify 7 templates appear with correct names (OpenAI, Anthropic, OpenCode, OpenRouter, Groq, Ollama, Custom)"
    expected: "Modal shows exactly these 7 templates with correct provider_type values"
    why_human: "Frontend template list is hardcoded and differs from backend; only visual inspection confirms what's displayed"
  - test: "Create a provider via the frontend modal, select 'OpenAI' template, fill in API key, save, then click the toggle to disable it"
    expected: "Provider is created successfully and toggle persists disabled state after refresh"
    why_human: "Frontend/backend schema mismatch on 'enabled' vs 'is_enabled' may cause silent failures or 422 errors that automated checks might miss depending on Pydantic extra settings"
  - test: "Configure Agent Routing: select a primary provider for Extraction, add 3 fallbacks, save, refresh page"
    expected: "All 4 providers are persisted and displayed correctly after reload"
    why_human: "Frontend saves primary_provider_id separately but backend doesn't persist it; visual confirmation needed that the saved state reloads correctly (it likely won't)"
---

# Phase 1: Provider System & Architecture Verification Report

**Phase Goal:** Integrate LiteLLM as the provider abstraction layer and build a complete provider management system with usage logging and fallback chains.

**Verified:** 2026-05-26T12:00:00Z

**Status:** `gaps_found`

**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | **PROV-01**: Unified provider registry exists with CRUD | VERIFIED | `providers` table, `/api/providers` endpoints, frontend Provider Registry section with add/edit/delete/test |
| 2 | **PROV-02**: Agent provider selection via dropdown | VERIFIED | Frontend Agent Routing section with primary provider dropdown per role; `/api/agents` endpoints exist |
| 3 | **PROV-03**: Dynamic model list fetched from /v1/models, not manually typed | FAILED | Backend `/providers/{id}/models` exists; frontend uses plain `<input>` for model, never calls `listModels()` |
| 4 | **PROV-04**: Provider type auto-detection builds correct schema per type | FAILED | Backend `gateway.py` correctly formats `provider_type/model` for LiteLLM; frontend sends invalid types (`openai_compatible`, `deepseek`) that fail backend `ProviderType` Literal validation |
| 5 | **PROV-05**: Role field is read-only; fixed roles extraction/edge_detection/consolidation | FAILED | Migration seeds correct roles; frontend hardcodes correct roles; BUT `seed_default_agents()` in `service.py` seeds wrong roles (`planner`, `researcher`, `executor`) called on every startup |
| 6 | **PROV-06**: Usage logging tracks every LLM call with tokens, timing, status | VERIFIED | `UsageLog` model, `_log_usage()` in gateway, `/api/usage` endpoint, frontend usage logs table with filter by agent |
| 7 | **PROV-07**: Fallback chains support up to 4 providers per role | FAILED | Backend validates max 4 and tests verify; frontend `page.tsx` caps at 3 fallbacks (`current.length >= 3`) |
| 8 | **PROV-08**: Pre-configured provider templates: OpenAI, Anthropic, OpenCode, OpenRouter, Groq, Ollama, Custom | VERIFIED (backend) / FAILED (frontend) | Backend `templates.py` has exactly 7 correct templates; frontend `ProviderConfigModal.tsx` has different set (missing OpenCode, has DeepSeek, `openai_compatible` instead of `openai`) |

**Score:** 4/8 truths verified (PROV-01, PROV-02, PROV-06 are fully verified; PROV-08 backend verified but frontend fails)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/api/pyproject.toml` | litellm>=1.86.0, cryptography>=48.0 | VERIFIED | Both dependencies present |
| `apps/api/app/config.py` | `provider_key_encryption_key` setting | VERIFIED | Line 20 |
| `apps/api/alembic/versions/27eb17c6c35d_provider_system.py` | Migration creating providers, agents, usage_logs; seeding 3 roles | VERIFIED | Correct schema and seeds extraction, edge_detection, consolidation |
| `apps/api/app/models.py` | Provider, Agent, UsageLog models | VERIFIED | All present with correct fields |
| `apps/api/app/domains/providers/encryption.py` | Fernet encrypt/decrypt | VERIFIED | KeyEncryption class with auto-generation fallback |
| `apps/api/app/domains/providers/templates.py` | 7 provider templates | VERIFIED | 7 correct templates |
| `apps/api/app/domains/providers/schemas.py` | Strict Pydantic, no api_key in response, ProviderType Literal | VERIFIED | All present |
| `apps/api/app/domains/providers/service.py` | CRUD, chain resolution, usage log creation, seeding | PARTIAL | CRUD and chain resolution correct; seed_default_agents has WRONG roles |
| `apps/api/app/domains/providers/gateway.py` | LiteLLM acompletion, fallback chain, usage logging | VERIFIED | Correct implementation with backward-compatible `complete()` |
| `apps/api/app/domains/providers/router.py` | Registry + agents + usage + test + model discovery endpoints | VERIFIED | All endpoints present with response_model |
| `apps/api/app/main.py` | Routers mounted, seed called on startup | VERIFIED | All routers mounted; seed_default_agents called (but seeds wrong roles) |
| `apps/web/lib/api.ts` | providersApi, agentsApi, usageApi | VERIFIED | All methods present |
| `apps/web/app/settings/page.tsx` | Provider Registry + Agent Routing + Usage Logs UI | PARTIAL | UI exists but fallback cap is 3 not 4; toggle sends wrong field name |
| `apps/web/components/modals/ProviderConfigModal.tsx` | Template picker + custom form | PARTIAL | Template list does NOT match backend; model is plain text input; sends `enabled` not `is_enabled` |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `gateway._complete_model()` | `litellm.acompletion()` | direct call with `model=provider_type/model` | WIRED | Line 133 |
| `gateway._complete_model()` | `resolve_provider_chain()` | `await self._resolve_chain(agent_role)` | WIRED | Line 113 |
| `gateway._complete_model()` | `_log_usage()` | called on success and every failure | WIRED | Lines 147, 159, etc. |
| `router.py /providers/{id}/test` | `httpx GET /v1/models` | probe with decrypted key | WIRED | Lines 127-134 |
| `router.py /providers/{id}/models` | `litellm.utils.get_valid_models()` | fallback after probe fails | WIRED | Lines 234-240 |
| `page.tsx` | `providersApi.listModels()` | **NOT WIRED** | NOT_WIRED | `listModels` exists in api.ts but never called in UI |
| `page.tsx handleToggleProvider` | `providersApi.update()` | sends `{enabled: bool}` | PARTIAL | Backend ignores `enabled`; expects `is_enabled` |
| `page.tsx handleSaveRouting` | `agentsApi.update()` | sends `primary_provider_id` | PARTIAL | Backend schema accepts it but `update_agent_settings()` in service.py does NOT persist it to DB |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `page.tsx` usage logs table | `usageLogs` | `usageApi.list()` | Yes (from DB) | FLOWING |
| `page.tsx` providers list | `providers` | `providersApi.list()` | Yes (from DB) | FLOWING |
| `page.tsx` agents list | `agents` | `agentsApi.list()` | Yes (from DB) | FLOWING |
| `page.tsx` agent primary provider | `primary_provider_id` | `agentsApi.update()` → `agentsApi.list()` | **HOLLOW** | Backend `Agent` model has NO `primary_provider_id` column; frontend saves it but service.py discards it. On reload, primary dropdown appears empty. |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| LiteLLM installed | `python -c "import litellm; print(litellm.__version__)"` | 1.86.0+ | PASS |
| Cryptography installed | `python -c "from cryptography.fernet import Fernet; print('OK')"` | OK | PASS |
| Backend unit tests | `pytest tests/test_crypto.py tests/test_provider_service.py tests/test_gateway.py tests/test_fallback.py tests/test_provider_test_endpoint.py -x -q` | 30 passed | PASS |
| TypeScript compilation | `cd apps/web && npx tsc --noEmit` | no errors | PASS |
| Provider type validation rejects invalid type | `python -c "from app.domains.providers.schemas import ProviderCreate; ProviderCreate(name='T', provider_type='openai_compatible', base_url='http://x', model='m')"` | ValidationError | PASS |

---

### Probe Execution

| Probe | Command | Result | Status |
|-------|---------|--------|--------|
| `scripts/*/tests/probe-*.sh` | — | No conventional probes found | SKIP |
| `tests/test_e2e_phase1.py` | `python tests/test_e2e_phase1.py` | Makes HTTP requests at module import time; invalid API calls (PUT /providers/extraction with old role-based schema) | FAILED — test is broken for new API |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PROV-01 | 01-PLAN.md | Unified provider registry | SATISFIED | providers table, CRUD endpoints, frontend registry section |
| PROV-02 | 01-PLAN.md | Agent provider selection | SATISFIED | Agent routing UI with dropdowns, /agents endpoints |
| PROV-03 | 01-PLAN.md | Dynamic model list | BLOCKED | Backend endpoint exists but frontend never uses it; manual text input remains |
| PROV-04 | 01-PLAN.md | Provider type auto-detection | BLOCKED | Backend correct; frontend sends invalid provider_type values causing 422 errors |
| PROV-05 | 01-PLAN.md | Role field is read-only | BLOCKED | Migration correct but seed_default_agents() seeds wrong roles; startup event inserts incorrect data |
| PROV-06 | 01-PLAN.md | Usage logging | SATISFIED | UsageLog model, logging on every gateway call, UI table with filter |
| PROV-07 | 01-PLAN.md | Fallback chains | BLOCKED | Backend supports 4; frontend caps at 3; primary_provider_id not persisted |
| PROV-08 | 01-PLAN.md | Pre-configured provider templates | PARTIAL | Backend 7 templates correct; frontend templates are wrong (missing OpenCode, has DeepSeek) |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/api/app/domains/providers/service.py` | 202 | `seed_default_agents` seeds wrong roles (`planner`, `researcher`, `executor`) vs migration (`extraction`, `edge_detection`, `consolidation`) | BLOCKER | Fresh DB startup inserts incorrect agent roles |
| `apps/web/components/modals/ProviderConfigModal.tsx` | 7 | `PROVIDER_TYPES` includes `openai_compatible`, `deepseek` not in backend `ProviderType` Literal | BLOCKER | Provider creation via UI fails Pydantic validation |
| `apps/web/components/modals/ProviderConfigModal.tsx` | 136 | Payload sends `enabled` instead of `is_enabled` | BLOCKER | Provider enabled state not persisted; toggle non-functional |
| `apps/web/app/settings/page.tsx` | 161 | `handleToggleProvider` sends `{enabled: !provider.enabled}` only, missing required schema fields | BLOCKER | Toggle update likely fails due to missing required fields in `ProviderCreate` |
| `apps/web/app/settings/page.tsx` | 193 | `handleAddFallback` caps at `>= 3` instead of `>= 4` | WARNING | UI restricts fallback chain to 3 when backend allows 4 |
| `apps/api/app/domains/providers/service.py` | 121 | `update_agent_settings` ignores `primary_provider_id` from schema | WARNING | Frontend primary provider selection not persisted; lost on reload |
| `apps/api/app/main.py` | 84 | Deprecated `@app.on_event("startup")` used alongside lifespan | INFO | Deprecation warning only; functional |
| `apps/api/tests/test_e2e_phase1.py` | 41 | Uses old role-based provider endpoint `/providers/extraction` with invalid schema | WARNING | E2E test is obsolete and broken for new API |

---

### Human Verification Required

1. **Template Modal Content**
   - **Test:** Open settings, click "Add from Template", verify 7 templates with correct names and types
   - **Expected:** OpenAI, Anthropic, OpenCode, OpenRouter, Groq, Ollama, Custom
   - **Why human:** Frontend hardcodes different template list; visual confirmation needed

2. **Provider Create + Toggle Persistence**
   - **Test:** Create provider via modal, toggle disable, refresh page
   - **Expected:** Provider created and disabled state persists
   - **Why human:** Schema mismatch may cause silent failures or 422 errors

3. **Agent Routing Save & Reload**
   - **Test:** Select primary provider + 3 fallbacks for Extraction, save, refresh
   - **Expected:** All selections reappear correctly
   - **Why human:** `primary_provider_id` is not persisted by backend; visual confirmation needed

---

### Gaps Summary

Phase 1 backend is substantially well-implemented: LiteLLM integration, database migration, encryption, gateway with fallback chains, usage logging, and Pydantic schemas are all correct and tested (30 unit tests pass). However, **the frontend is not properly wired to the backend**, resulting in 4 blocked requirements:

1. **PROV-03 (Dynamic model list)**: The model discovery endpoint exists but is orphaned — the frontend never calls it.
2. **PROV-04 (Provider type auto-detection)**: Frontend template/type definitions diverge from backend Literal validation. The UI sends provider types that the backend rejects, making provider creation through the frontend broken.
3. **PROV-05 (Fixed read-only roles)**: The `seed_default_agents()` startup function contradicts the migration by seeding `planner/researcher/executor` instead of `extraction/edge_detection/consolidation`. On a fresh database, wrong roles are inserted.
4. **PROV-07 (Fallback chains up to 4)**: The frontend caps fallbacks at 3 instead of 4, and does not persist the primary provider selection because the backend service ignores `primary_provider_id`.

Additionally, the `enabled` vs `is_enabled` field name mismatch across the frontend means provider enabled/disabled state cannot be set or toggled through the UI.

---

_Verified: 2026-05-26_
_Verifier: gsd-verifier_
