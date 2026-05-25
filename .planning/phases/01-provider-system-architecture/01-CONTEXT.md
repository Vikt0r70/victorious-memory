# Phase 1: Provider System & Architecture - Context

**Gathered:** 2026-05-25
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers a unified provider management system that replaces the current role-based provider configs with a registry of providers, integrates LiteLLM for multi-provider support, adds comprehensive usage logging, and implements per-role fallback chains.

**In scope:**
- Unified provider registry (PROV-01)
- Agent provider selection from registry (PROV-02)
- Dynamic model lists via provider API (PROV-03)
- Provider type auto-detection with correct payloads (PROV-04)
- Fixed read-only roles per agent (PROV-05)
- Usage logging for every LLM call (PROV-06)
- Fallback chains up to 4 providers per role (PROV-07)
- Pre-configured provider templates (PROV-08)

**Out of scope:**
- Dashboard UI redesign (Phase 2)
- Memory lifecycle features (Phase 3)
- Deployment/Distribution (Phase 4)
- Documentation/Export (Phase 5)
- Architecture optimizations (Phase 6)

</domain>

<decisions>
## Implementation Decisions

### Registry Data Model
- **D-01:** Two-table design: `providers` (registry) + `agents` (with JSONB override)
- **D-02:** Runtime merge: base provider config + JSONB override → pass merged config to LiteLLM
- **D-03:** Templates: Hybrid approach — hardcoded in Python code, written to DB on first use
- **D-04:** API keys: Encrypted at rest using Fernet symmetric encryption
- **D-05:** Agent roles: Fixed — extraction, edge_detection, consolidation only
- **D-06:** Migration: Drop `provider_configs`, create fresh `providers` + `agents` tables
- **D-07:** Provider equality: All providers equal in DB, no built-in protection flag
- **D-08:** Override scope: Passthrough — `agents.settings_override` JSONB supports any LiteLLM-compatible kwargs

### LiteLLM Integration
- **D-09:** Partial wrapper: LiteLLM handles completions via `litellm.acompletion()`, our gateway handles config resolution, logging, and fallback orchestration
- **D-10:** Model mapping: Concatenate `f"{provider_type}/{model}"` at runtime for LiteLLM
- **D-11:** Model discovery: Hybrid — call provider's `/v1/models` endpoint first, fall back to LiteLLM static model list
- **D-12:** Disable LiteLLM retries: Set `num_retries=0` on `acompletion()` to avoid retry storms

### Usage Logging
- **D-13:** Manual logging: Gateway wrapper logs directly to `usage_logs` table after `acompletion()` returns
- **D-14:** Full detail schema: id, timestamp, agent_role, provider_id, model, prompt_tokens, completion_tokens, total_tokens, latency_ms, status, fallback_position, error_message

### Fallback Chains
- **D-15:** Per-role priority list: Each agent role has its own ordered list of up to 4 providers
- **D-16:** Implementation: `fallback_provider_ids` JSONB column on `agents` table
- **D-17:** Gateway logic: Simple for loop, try each provider in order, log fallback triggers

### Provider Test Validation
- **D-18:** Two-phase test: Try `/v1/models` endpoint first ($0 cost), fall back to minimal completion (`max_tokens=1`)
- **D-19:** Distinct errors: Return 401 for bad API key, 502 for connection error

### Encryption Key Management
- **D-20:** Env var preferred: `PROVIDER_KEY_ENCRYPTION_KEY` in `.env`
- **D-21:** Auto-fallback: If env var missing, auto-generate key and store in `.encryption_key` file (gitignored)
- **D-22:** VPS ready: Explicit env var overrides auto-generated key for production deployments

### Settings UI Structure
- **D-23:** Single page with sections: `/settings` page with "Provider Registry" (top) and "Agent Settings" (bottom)
- **D-24:** Unified state: Single React state object, dropdowns inherit live provider list

### Database Migration
- **D-25:** Single migration: One atomic Alembic revision drops `provider_configs`, creates `providers` + `agents` + `usage_logs`, seeds 3 agent roles

### API Design
- **D-26:** Strict Pydantic everywhere: All endpoints use `response_model=` with full schemas, no manual dict construction
- **D-27:** Provider type validation: `Literal["openai", "anthropic", "opencode", "openrouter", "groq", "ollama", "custom"]` in Pydantic input models
- **D-28:** Response security: Response schemas explicitly exclude `api_key` to prevent leakage

### Error Handling
- **D-29:** Hybrid exception hierarchy: Keep `ProviderError` base, add `ProviderRateLimitError`, `ProviderAuthenticationError` mapped from LiteLLM exceptions
- **D-30:** Gateway as adapter: Catch LiteLLM exceptions in gateway, re-raise as internal types. Rest of app stays clean.

### Retry Strategy
- **D-31:** Worker-level retries: Existing worker retry logic (exponential backoff, max 3 attempts) handles all retries
- **D-32:** Gateway is stateless: No retry logic in gateway, throws granular errors immediately

### the agent's Discretion
- Exact Pydantic schema field names and types for `ProviderCreate`, `ProviderResponse`, `AgentSettings` — planner determines exact structure based on SQLAlchemy models
- Specific UI component library for the settings page — planner decides based on existing dashboard patterns
- Exact Alembic migration file naming convention

### Folded Todos
None — no todos were folded into this phase's scope.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Planning
- `.planning/ROADMAP.md` §Phase 1 — Goal, success criteria, and requirements mapping
- `.planning/REQUIREMENTS.md` §Provider Architecture — PROV-01 through PROV-08 detailed requirements
- `.planning/PROJECT.md` §Context — Current state, known technical concerns, user preferences
- `.planning/PROJECT.md` §Key Decisions — Prior decisions including LiteLLM adoption, unified registry

### Architecture & Codebase
- `.planning/codebase/ARCHITECTURE.md` — System overview, component responsibilities, patterns, anti-patterns
- `.planning/codebase/INTEGRATIONS.md` — Current provider integration details, API formats, auth methods

### Existing Provider Code
- `apps/api/app/domains/providers/gateway.py` — Current custom gateway implementation (to be replaced)
- `apps/api/app/domains/providers/router.py` — Current role-based provider router (to be replaced)
- `apps/api/app/domains/providers/schemas.py` — Current Pydantic schemas (to be replaced)
- `apps/api/app/models.py` §ProviderConfig — Current provider config model (to be dropped)

### Existing Settings UI
- `apps/web/app/settings/page.tsx` — Current settings page (to be extended)
- `apps/web/lib/api.ts` — API client patterns

### Conventions
- `.planning/codebase/CONVENTIONS.md` — Naming patterns, code style, module design

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/web/lib/api.ts`: Typed `request<T>()` wrapper around fetch — reuse for new provider registry API calls
- `apps/api/app/database.py`: Async SQLAlchemy engine and session factory — new tables use same Base
- `apps/api/app/config.py`: Pydantic Settings singleton — add `PROVIDER_KEY_ENCRYPTION_KEY` here
- Existing dark mode and styling in `apps/web/app/layout.tsx` and Tailwind config — reuse for settings page

### Established Patterns
- Domain triad: `router.py` + `service.py` + `schemas.py` per domain — new `providers/` domain follows this
- Router layer thin, service layer contains business logic — gateway service should follow this
- Module-level singletons: `gateway = ProviderGateway()` — new gateway can follow same pattern
- Client-side React state with `useState`/`useEffect` — settings page uses this pattern
- `"use client"` directive for interactive components — settings page will need this

### Integration Points
- `apps/api/app/main.py`: Mount new provider router, start background worker (unchanged)
- `apps/api/app/worker.py`: Calls `gateway.complete()` — update to use new gateway API
- `apps/api/app/domains/extraction/agent.py`: Calls `gateway.complete(model_role="extraction")` — role name stays same
- `apps/web/app/settings/page.tsx`: Extend with provider registry UI and agent settings sections
- `apps/api/app/models.py`: Add `Provider`, `Agent`, `UsageLog` models, drop `ProviderConfig`

### Anti-Patterns to Fix
- Monolithic `models.py`: New models will be added here (deferred to future phase per PROJECT.md)
- Inconsistent Pydantic usage: New provider API uses strict `response_model=` everywhere
- Manual dict construction in routers: New provider router returns Pydantic models only

</code_context>

<specifics>
## Specific Ideas

- Provider registry UI should be a "Vault" (top section) with provider cards and "Add from Template" button
- Agent settings should be a "Routing Table" (bottom section) with 3 fixed rows (extraction, edge_detection, consolidation)
- Each agent row has primary provider dropdown + UI to add/remove fallback providers
- Fallback chain UI inherits live provider list from the Vault above (single React state)
- Templates hardcoded as `PROVIDER_TEMPLATES` dict in Python with name, type, base_url, default_model for each of 7 providers
- Usage log table uses `Integer` autoincrement primary key (not text prefix) since it's append-only audit data
- `.encryption_key` file must be added to `.gitignore` immediately
- Test endpoint returns distinct HTTP status codes: 200 (success), 401 (bad key), 502 (connection error), 504 (timeout)

</specifics>

<deferred>
## Deferred Ideas

- Dynamic agent roles (user-defined roles beyond the 3 fixed ones) — future phase when custom agents are needed
- Provider health scoring / automatic load balancing — over-engineering for current scale
- Global fallback chain (one chain for all agents) — per-role is more flexible
- Rate limiting per provider in gateway — worker-level retry is sufficient for now
- TEI embedding service integration — belongs in Phase 6 (Architecture Excellence)
- Model caching / preloading — optimization for future phase

### Reviewed Todos (not folded)
None — no todos were reviewed in cross_reference_todos.

</deferred>

---

*Phase: 1-Provider System & Architecture*
*Context gathered: 2026-05-25*
