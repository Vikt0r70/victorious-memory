# Phase 1: Provider System & Architecture - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-25
**Phase:** 1-Provider System & Architecture
**Areas discussed:** Registry data model, LiteLLM integration scope, Usage logging, Fallback chain UX, Provider test validation, Encryption key management, Settings UI structure, Alembic migration strategy, Provider type validation, API schema consistency, Error handling with LiteLLM, Rate limiting / retries

---

## Registry Data Model

| Option | Description | Selected |
|--------|-------------|----------|
| Option A: Two tables | Clean separation with providers registry + agent_settings. Requires schema migration. | ✓ |
| Option B: Modified ProviderConfig | Keep existing table, add flags and agent_settings. Minimal migration. | |
| Option C: Single table with NULLable role | Simplest schema, mixing registry entries and agent assignments. | |
| You decide | Let the planner determine the best approach. | |

**User's choice:** Option A: Two tables
**Notes:** User proposed JSONB-based approach with `providers` table (base config) + `agents` table (`provider_id` FK + `settings_override` JSONB). Runtime merge of base + override → pass to LiteLLM. This matches existing JSONB patterns in the codebase.

---

## Model Location

| Option | Description | Selected |
|--------|-------------|----------|
| Registry-level model | Model tied to provider entry. Create multiple entries for same provider + different models. | |
| Agent-level override | Registry has default, agent can override. More flexible. | |
| Both — list + selection | Registry tracks available models, agent picks one. Most explicit but more complex. | |

**User's choice:** Passthrough JSONB override (any LiteLLM kwargs)
**Notes:** User proposed `agents.settings_override` JSONB that can override any LiteLLM parameter. Maximum flexibility, no schema changes needed for new parameters.

---

## Templates

| Option | Description | Selected |
|--------|-------------|----------|
| Hardcoded in code | Python dict of templates. UI shows them, DB only stores user-added providers. | |
| Seeded as DB rows | Templates exist as rows in providers table with is_template=true. Users clone them. | |
| Hybrid | Hardcoded for UI display, written to DB on first use. | ✓ |

**User's choice:** Hybrid
**Notes:** Templates defined in code as `PROVIDER_TEMPLATES` dict. When user clicks "Add from Template", a DB row is created. No distinction between template and user-added providers in DB.

---

## API Key Storage

| Option | Description | Selected |
|--------|-------------|----------|
| Plain text in DB | Simplest. Matches current implementation. | |
| Encrypted at rest | Fernet encryption with env key. Good security/UX balance. | ✓ |
| Env var reference | Most secure. Keys live in .env, DB stores identifiers only. | |

**User's choice:** Encrypted at rest
**Notes:** Use `cryptography.fernet.Fernet` with key from `PROVIDER_KEY_ENCRYPTION_KEY` env var or auto-generated `.encryption_key` file.

---

## Agent Roles

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed roles | 3 hardcoded roles: extraction, edge_detection, consolidation. | ✓ |
| Dynamic roles | Users can create and configure any number of agent roles. | |
| Fixed for now | Start with 3, make dynamic in a future phase. | |

**User's choice:** Fixed roles
**Notes:** `agents` table seeded with 3 rows on migration. Roles are read-only in UI.

---

## Migration Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Drop and replace | Clean break. New schema, no legacy tables. | ✓ |
| Rename + migrate | Evolve existing table. Keeps Alembic history simpler. | |
| Keep both temporarily | Parallel schemas during transition. Safest but more work. | |

**User's choice:** Drop and replace
**Notes:** Single Alembic migration drops `provider_configs`, creates `providers` + `agents` + `usage_logs`, seeds 3 agent roles.

---

## Provider Equality

| Option | Description | Selected |
|--------|-------------|----------|
| is_builtin flag | Template providers are protected. Users can't delete built-in entries. | |
| All equal | No distinction. Users have full control over all providers. | ✓ |
| Soft delete only | Disable any provider, but only delete user-added ones. | |

**User's choice:** All equal
**Notes:** Once added to DB, all providers are equal. No built-in protection.

---

## LiteLLM Integration Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Full replacement | LiteLLM handles all provider schemas. Delete custom OpenAI/Anthropic paths. | |
| Partial wrapper | LiteLLM for completions, our gateway for config/logging/fallbacks. | ✓ |
| Discovery-only | LiteLLM only for model discovery. Keep custom gateway. | |

**User's choice:** Partial wrapper
**Notes:** Gateway calls `litellm.acompletion()` but handles config resolution, encryption/decryption, usage logging, and fallback orchestration itself.

---

## Model Mapping

| Option | Description | Selected |
|--------|-------------|----------|
| Concatenate at runtime | f"{provider_type}/{model}". Simple, assumes naming alignment. | ✓ |
| Explicit mapping table | Dict maps our types to LiteLLM strings. Handles edge cases. | |
| Store full LiteLLM name | Model field contains "openai/gpt-4o". Direct but messy. | |

**User's choice:** Concatenate at runtime
**Notes:** Build `f"{provider_type}/{model}"` string when calling LiteLLM. Assumes provider_type aligns with LiteLLM naming.

---

## Model Discovery

| Option | Description | Selected |
|--------|-------------|----------|
| LiteLLM static list | Use litellm.model_list. Simple, but not truly dynamic. | |
| Call provider APIs | Hit /v1/models per provider. Truly dynamic, requires per-provider code. | |
| Hybrid | Try provider API first, fall back to LiteLLM static list. | ✓ |

**User's choice:** Hybrid
**Notes:** Call provider's `/v1/models` endpoint first. If unavailable or fails, fall back to LiteLLM's static model list.

---

## Usage Logging Approach

| Option | Description | Selected |
|--------|-------------|----------|
| LiteLLM callbacks | Register callback class for automatic logging to usage_logs. | |
| Manual logging | Gateway wrapper logs before/after call. More control. | ✓ |
| Both | LiteLLM for tokens, manual for app context. | |

**User's choice:** Manual logging
**Notes:** Gateway logs directly to `usage_logs` table after `acompletion()` returns. Reads token counts from response object. Avoids global callback complexity and SQLAlchemy session threading issues.

---

## Usage Logging Schema

| Option | Description | Selected |
|--------|-------------|----------|
| Full detail | Comprehensive tracking including tokens, latency, fallback position, errors. | ✓ |
| Standard | Common fields without prompt/completion split or fallback details. | |
| Minimal | Basic cost tracking only. | |
| You decide | Planner designs exact schema based on available fields. | |

**User's choice:** Full detail
**Notes:** Schema includes: id, timestamp, agent_role, provider_id, model, prompt_tokens, completion_tokens, total_tokens, latency_ms, status, fallback_position, error_message. Uses Integer autoincrement PK for append-only audit table.

---

## Fallback Chains

| Option | Description | Selected |
|--------|-------------|----------|
| Per-role priority list | Each agent has its own ordered list of up to 4 providers. | ✓ |
| Global fallback chain | One chain for all agents. Simple but inflexible. | |
| Per-provider health score | Dynamic selection based on success rate. No explicit chain. | |

**User's choice:** Per-role priority list
**Notes:** `agents.fallback_provider_ids` JSONB stores ordered list of provider IDs. Gateway iterates with for loop, tries each in order.

---

## Provider Test Validation

| Option | Description | Selected |
|--------|-------------|----------|
| Model list call | GET /v1/models. No token cost, but not universally supported. | |
| Minimal completion | Send a real completion. Tests full path, costs a few tokens. | |
| Both | Try model list first, fall back to completion. Most robust. | ✓ |

**User's choice:** Both
**Notes:** Two-phase test: (1) Try `/v1/models` endpoint ($0 cost), (2) Fall back to `max_tokens=1` completion. Returns 401 for bad key, 502 for connection error.

---

## Encryption Key Management

| Option | Description | Selected |
|--------|-------------|----------|
| Env var only | PROVIDER_KEY_ENCRYPTION_KEY in .env. Explicit, standard. | |
| Auto-generated file | Generate on first run, store in file. Zero setup. | |
| Env var with auto-fallback | Prefer env var, auto-generate if missing. Best of both. | ✓ |

**User's choice:** Env var with auto-fallback
**Notes:** Check `PROVIDER_KEY_ENCRYPTION_KEY` env var first. If missing, check `.encryption_key` file. If missing, auto-generate and save. File must be gitignored.

---

## Settings UI Structure

| Option | Description | Selected |
|--------|-------------|----------|
| Single page with sections | One settings page, collapsible sections. Simplest routing. | ✓ |
| Tabbed settings | Tabs or sidebar sub-nav within settings. Clean separation. | |
| Separate pages | Dedicated pages per section. Deep linking, clear URLs. | |

**User's choice:** Single page with sections
**Notes:** `/settings` page with "Provider Registry" (top, grid of provider cards) and "Agent Settings" (bottom, 3-row routing table). Single React state object, dropdowns inherit live provider list.

---

## Alembic Migration Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Single migration | One atomic revision. Drop old, create new, seed agents. | ✓ |
| Two migrations | Create new tables first, then drop old + seed. | |
| Three migrations | Overly granular. Not needed for fresh start. | |

**User's choice:** Single migration
**Notes:** One atomic Alembic revision: drop `provider_configs`, create `providers` + `agents` + `usage_logs`, seed 3 agent roles with `op.bulk_insert()`.

---

## Provider Type Validation

| Option | Description | Selected |
|--------|-------------|----------|
| Strict enum | Only known provider types accepted. Rejects unknowns at API level. | |
| Flexible string | Accept anything. LiteLLM fails at runtime if unknown. | |
| Known + custom | Validate against known list, but allow custom catch-all. | ✓ |

**User's choice:** Known + custom
**Notes:** Pydantic `Literal["openai", "anthropic", "opencode", "openrouter", "groq", "ollama", "custom"]`. Users with unknown providers use `custom` type + their own base_url.

---

## API Schema Consistency

| Option | Description | Selected |
|--------|-------------|----------|
| Strict Pydantic everywhere | All endpoints use response_model. Type-safe, proper OpenAPI docs. | ✓ |
| Pragmatic | Pydantic for requests, lightweight for responses. | |
| Match existing | Follow current codebase patterns. Inconsistency continues. | |

**User's choice:** Strict Pydantic everywhere
**Notes:** All new provider endpoints use `response_model=` with full schemas. Response schemas explicitly exclude `api_key`. Fixes existing anti-pattern of manual dict construction.

---

## Error Handling with LiteLLM

| Option | Description | Selected |
|--------|-------------|----------|
| Map to our exceptions | Catch LiteLLM exceptions, re-raise as ProviderError/ProviderTimeoutError. | |
| Adopt LiteLLM exceptions | Use LiteLLM's exception types throughout. Simpler but leaky. | |
| Hybrid | Keep our hierarchy, add new types for LiteLLM-specific cases. | ✓ |

**User's choice:** Hybrid
**Notes:** Expand `ProviderError` hierarchy with `ProviderRateLimitError`, `ProviderAuthenticationError`. Gateway maps LiteLLM exceptions to internal types. Rest of app stays clean.

---

## Rate Limiting / Retries

| Option | Description | Selected |
|--------|-------------|----------|
| LiteLLM handles retries | Set num_retries on acompletion. Worker retries total failures only. | |
| Gateway handles retries | Gateway implements retry loop. LiteLLM retries disabled. | |
| Worker handles retries | Keep existing worker logic. LiteLLM retries disabled. | ✓ |

**User's choice:** Worker handles retries
**Notes:** Disable LiteLLM retries (`num_retries=0`). Existing worker retry logic (exponential backoff, max 3 attempts) handles all retries. Gateway remains thin and stateless. Avoids retry amplification.

---

## the agent's Discretion

- Exact Pydantic schema field names and types — planner determines based on SQLAlchemy models
- Specific UI component implementation — planner decides based on existing dashboard patterns
- Exact Alembic migration file naming convention

## Deferred Ideas

- Dynamic agent roles (beyond 3 fixed) — future phase
- Provider health scoring / automatic load balancing — over-engineering for current scale
- Global fallback chain — per-role is more flexible
- Rate limiting per provider in gateway — worker-level sufficient
- TEI embedding service — Phase 6
- Model caching / preloading — future optimization
