# Phase 2: Provider Test Fix & Pipeline Check - Context

**Gathered:** 2026-05-25
**Status:** Ready for planning

## Phase Boundary

Fix the broken provider test endpoint (PROV-06) and verify the ingestion pipeline works end-to-end (SYS-02, PLG-01). The provider test currently returns OK 200 even without an API key — it must return a 4xx/5xx error when configuration is missing or invalid. The pipeline verification must confirm that plugin-captured exchanges reach the API, create database rows, and spawn extraction jobs.

**Architecture decision:** VM2 will adopt LiteLLM as the provider abstraction layer. Phase 2 begins the transition by integrating LiteLLM into the `ProviderGateway` — replacing custom OpenAI/Anthropic schema handling with `litellm.acompletion()`. This decision was reached after researching mature projects (LiteLLM, Vercel AI SDK, LibreChat) and determining that building custom provider infrastructure is unnecessary when LiteLLM handles 100+ providers, schema translation, and model discovery natively.

**Requirements covered:** PROV-06, SYS-02, PLG-01

**Success criteria from ROADMAP.md:**
1. Provider test returns 4xx/5xx error when API key is missing or invalid
2. Plugin captures a real exchange and POSTs to /api/ingest
3. Exchange rows and extraction jobs with status "pending" appear in DB
4. Activity log records the ingestion event

## Implementation Decisions

### Provider Test Validation Strategy
- **D-01:** Pre-validate provider configuration locally before making the HTTP call. The gateway should check for missing/empty API key and raise a specific exception before attempting the network request.
- **D-02:** Treat "no provider configured at all" (no DB config + no env fallback) and "provider exists but API key is empty" as the same error category. Return a single unified error message.
- **D-03:** Validation logic lives in `ProviderGateway` (reusable across test endpoint and extraction worker). Add a validation method or integrate checks into the existing `complete()` flow.
- **D-04:** Return **400 Bad Request** for all configuration errors (missing/empty API key, no provider configured). Return 502 for provider HTTP errors, 504 for timeouts.
- **D-05:** Use `max_tokens=5` for the provider test call (not 20). This is a cost-conscious health probe pattern used by LiteLLM and other mature projects — validates connectivity without burning tokens.

### LiteLLM Integration (Architectural Decision)
- **D-05:** Adopt LiteLLM as the provider abstraction layer for VM2. `litellm` will be added as a pip dependency in `apps/api/pyproject.toml`.
- **D-06:** Rewrite `ProviderGateway` as a thin wrapper around `litellm.acompletion()`. The gateway resolves config from PostgreSQL (existing `provider_configs` table) and passes `api_key`, `api_base`, `model` directly to LiteLLM per-request.
- **D-07:** LiteLLM handles all provider schema translation internally (OpenAI, Anthropic, OpenRouter, custom OpenAI-compatible). VM2's custom `_openai_complete()` and `_anthropic_complete()` methods become unnecessary.
- **D-08:** LiteLLM's exception taxonomy (`AuthenticationError`, `RateLimitError`, `ServiceUnavailableError`) will be mapped to VM2's existing `ProviderError` hierarchy to preserve backward compatibility with router error handling.
- **D-09:** This decision eliminates the need for custom Phase 6 (Dynamic Models) and Phase 7 (Provider Schema Auto-Detection) — LiteLLM satisfies PROV-03 and PROV-04 natively. Phases 5-7 merge into a single "LiteLLM Integration & Provider Configuration UI" phase.

### Pipeline Verification Method
- **D-10:** Use **both** a synthetic verification script and a real OpenCode plugin test. The synthetic script provides fast, repeatable validation; the real plugin test confirms actual integration.
- **D-11:** The synthetic script must verify: (a) POST /api/ingest returns 200 with exchange_id and job_id, (b) Exchange row exists in DB, (c) ExtractionJob has status "pending", (d) ActivityLog records the ingestion event.
- **D-12:** **Scope expansion:** Include worker job pickup verification in the synthetic script. The script should confirm the background worker claims the pending job and transitions it to "processing". (Note: This requirement technically belongs to Phase 3 but is explicitly included here per user decision.)
- **D-13:** Provide **both** a pytest test (`apps/api/tests/test_e2e_phase2.py`) and a standalone Python script (`scripts/verify_pipeline.py`). The pytest integrates with existing test infrastructure; the standalone script is for quick manual checks.

### the agent's Discretion
- Exact wording of error messages returned by the test endpoint
- Whether to add a new exception type (`ProviderConfigError`) or reuse existing `ProviderError`
- Specific implementation of the validation method in `ProviderGateway` (separate `validate()` vs. inline checks)
- How the standalone script connects to the database (direct SQLAlchemy vs. API-only verification)
- Details of the real plugin test procedure (specific conversation content, verification steps)
- Exact LiteLLM wrapper implementation (pass-through vs. custom preprocessing)
- Which LiteLLM exception types to catch and how to map them to VM2's HTTP status codes

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-Level
- `.planning/ROADMAP.md` — Phase 2 definition, success criteria, requirement traceability
- `.planning/REQUIREMENTS.md` — PROV-06, SYS-02, PLG-01 detailed requirements
- `.planning/PROJECT.md` — Project context, constraints, known concerns (provider gateway singleton issue)

### Provider Architecture
- `apps/api/app/domains/providers/gateway.py` — ProviderGateway implementation, config resolution, OpenAI/Anthropic completion paths
- `apps/api/app/domains/providers/router.py` — Provider test endpoint (`POST /providers/{role}/test`), currently catches errors but doesn't pre-validate
- `apps/api/app/domains/providers/schemas.py` — ProviderConfigCreate, ProviderConfigResponse, ProviderTestResponse schemas

### Ingestion Pipeline
- `apps/api/app/domains/ingest/router.py` — POST /api/ingest endpoint
- `apps/api/app/domains/ingest/service.py` — ingest_exchange() logic: creates Exchange row, ExtractionJob, logs activity
- `apps/plugin/victorious.js` — OpenCode plugin: captures exchanges, POSTs to /api/ingest, token threshold logic

### Data Models
- `apps/api/app/models.py` — ProviderConfig, Exchange, ExtractionJob, ActivityLog, Project models

### Codebase Maps
- `.planning/codebase/ARCHITECTURE.md` — System overview, data flow (ingestion → extraction pipeline)
- `.planning/codebase/INTEGRATIONS.md` — Provider gateway patterns, plugin framework integration
- `.planning/codebase/CONVENTIONS.md` — Naming patterns, error handling conventions, function design

## Existing Code Insights

### Reusable Assets
- `apps/api/tests/test_e2e_phase1.py` — Existing end-to-end test pattern for Phase 1. Use as template for Phase 2 pytest.
- `ProviderGateway` singleton (`gateway.py:223`) — Module-level singleton pattern already established. Add validation to this class.
- `ProviderConfig` model (`models.py:326`) — DB schema for provider configuration with role, provider_type, base_url, model, api_key, max_tokens fields.
- `ingest_exchange()` service (`ingest/service.py:22`) — Already creates Exchange + ExtractionJob + ActivityLog atomically.
- `api()` helper in plugin (`victorious.js:47`) — Reusable fetch wrapper with error handling and logging.

### Established Patterns
- Router→service separation: Routers are thin HTTP adapters, services contain business logic. Keep validation in gateway (called by both router and worker).
- Error handling: Services return `None`/`False` for not-found → router raises `HTTPException`. Gateway raises custom exceptions (`ProviderError`, `ProviderTimeoutError`) → router maps to HTTP status codes.
- ID generation: `_generate_id("exc")` for exchanges, `_generate_id("job")` for jobs, `_generate_id("act")` for activity log.
- Activity logging: `log_activity()` helper inserts immutable audit records. Called from services, not routers.

### Integration Points
- Provider test endpoint connects to ProviderGateway → needs validation before HTTP call
- Plugin connects to POST /api/ingest → needs real-world verification
- Extraction worker polls `extraction_jobs` table → synthetic script should verify job creation and worker pickup
- Activity log (`/api/activity`) → read-only verification endpoint for pipeline confirmation

## Specific Ideas

No specific requirements — open to standard approaches. The existing Phase 1 test pattern (`test_e2e_phase1.py`) should guide the Phase 2 test structure.

## Deferred Ideas

- **Database connectivity in /health endpoint** — Adding a `SELECT 1` or `pg_isready` call to the `/health` response. Deferred from Phase 1, still not in scope here.
- **Web/MCP startup verification** — These are verified in Phase 9 (Plugin & MCP Integration Verification).
- **Full extraction pipeline verification** (LLM call → memory candidates → validation → storage) — Explicitly Phase 3 scope. While worker job pickup is included here per user decision, the full extraction and memory creation belongs to Phase 3.
- **Custom provider schema handling** — No longer needed; LiteLLM handles all provider schemas internally.
- **Dynamic model list fetching** — No longer needed as a separate phase; LiteLLM provides model discovery.
- **LiteLLM advanced features** — Fallback chains, budget tracking, rate limiting. These are LiteLLM capabilities that VM2 may leverage in future phases but are not required for v1.

---

*Phase: 2-Provider Test Fix & Pipeline Check*
*Context gathered: 2026-05-25*
