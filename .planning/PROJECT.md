# Victorious Memory V2

## What This Is

Victorious Memory V2 is an AI memory system that automatically captures, structures, and retrieves knowledge from coding conversations. It integrates with OpenCode as a plugin — conversations are ingested, memories extracted via LLM, stored in PostgreSQL with vector embeddings, and injected back as context into future sessions. Currently has a working FastAPI backend, Next.js web dashboard, MCP server, and OpenCode plugin — but needs UX polish, provider architecture improvements, and end-to-end verification to be production-ready.

## Core Value

Automatically extract and surface relevant knowledge from developer conversations without manual effort.

## Requirements

### Validated

- ✓ Conversation ingestion pipeline (POST /api/ingest) — existing
- ✓ LLM extraction agent with provider gateway — existing
- ✓ Memory storage with vector embeddings (pgvector) — existing
- ✓ Hybrid search (semantic + BM25) — existing
- ✓ Context injection into system prompt — existing
- ✓ Web dashboard with dark mode — existing
- ✓ MCP server (5 tools) — existing
- ✓ OpenCode plugin (5 hooks) — existing
- ✓ Background extraction worker (asyncio) — existing
- ✓ Docker Compose deployment — existing

### Active

- [ ] **VER-01**: End-to-end verification — confirm extraction pipeline works from plugin → ingest → LLM → storage → context retrieval
- [ ] **PROV-01**: Unified provider registry — configure providers once in a dedicated tab, agents select from registry
- [ ] **PROV-02**: Dynamic model list — fetch available models from provider APIs instead of manual text input
- [ ] **PROV-03**: Provider test validation — test endpoint returns actual error when API key is missing/invalid
- [ ] **PROV-04**: Auto-detect provider type schema — build correct JSON payload per provider (OpenAI, Anthropic, OpenRouter, custom)
- [ ] **PROV-05**: Lock roles per agent — extraction/edge-detection/consolidation roles should be fixed per agent, not editable
- [ ] **PROV-ARCH**: Adopt LiteLLM as provider abstraction layer — handles schema translation, model discovery, multi-provider support
- [ ] **UX-01**: Fix hover cursor indicators on all clickable elements (allowed types, review queue buttons, settings)
- [ ] **UX-02**: Fix memory repository table layout shift when filters/content types are selected
- [ ] **UX-03**: Review queue buttons (Approve High, Reject) should display as proper buttons with cursor pointer
- [ ] **UX-04**: Fix auto-approve section allowed types click behavior and visual feedback
- [ ] **SYS-01**: Verify Docker Compose stack starts cleanly (api, db, embed, web, mcp)
- [ ] **SYS-02**: Verify plugin connectivity — confirm exchanges reach the API and jobs are created
- [ ] **SYS-03**: Verify extraction worker processes jobs and creates memories
- [ ] **SYS-04**: Verify context injection returns relevant memories
- [ ] **SYS-05**: Identify and document the "Brave MCnulty" container purpose
- [ ] **SYS-06**: Verify memory lifecycle (decay, consolidation, conflict detection) actually executes
- [ ] **SYS-07**: Verify plugin configuration changes take effect in the background

### Out of Scope

- Dashboard redesign — keep current layout, fix functionality only
- Raw extraction UI redesign — keep as-is for now
- Graph visualization redesign — verify it works, defer redesign
- New memory types or extraction logic changes
- Authentication/authorization for the API
- Mobile app or mobile-responsive redesign

## Context

**Brownfield project.** Existing code at `apps/api/` (Python FastAPI), `apps/web/` (Next.js 16), `apps/mcp/` (Python MCP server), `apps/plugin/` (JavaScript OpenCode plugin). Deployed via Docker Compose with PostgreSQL 16 + pgvector, HuggingFace TEI embeddings, and configurable LLM providers.

**Current state:** The architecture is solid but the web dashboard UX has accumulated issues — inconsistent cursor indicators, layout shifts, broken test flows, and a provider configuration model that forces per-agent setup instead of a shared registry. The extraction pipeline and memory lifecycle have never been verified end-to-end.

**Known technical concerns:**
- Provider gateway uses module-level singleton; provider test returns OK 200 with no API key
- In-process sentence-transformers blocks the event loop
- Models are in a single monolithic file (anti-pattern noted but deferred)
- No authentication on the API (CORS allows all origins)
- Agent output storage may be too verbose (large DB rows, high token costs)

## Constraints

- **Tech stack**: Python 3.12 + FastAPI (backend), Next.js 16 + React (frontend), PostgreSQL 16 + pgvector, Docker Compose
- **Deployment**: Local desktop first, VPS later
- **No auth**: API is open — security through localhost/network isolation
- **LLM providers**: Must support OpenAI-compatible and Anthropic APIs, plus custom endpoints
- **Embeddings**: Currently in-process sentence-transformers; plan was HuggingFace TEI as separate service

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Adopt LiteLLM as provider abstraction layer | 100+ providers instantly, schema handling, model discovery — eliminates custom provider engineering | — In Progress (Phase 2/5) |
| Unified provider registry over per-agent configs | Reduces setup friction, better UX | — Pending (Phase 5) |
| Dynamic model lists via provider API calls | Eliminates manual model name entry, stays current | — Pending (satisfied by LiteLLM) |
| Keep current dashboard layout | Focus on fixing what's broken, not redesign | — Pending |
| Fix UX issues before adding features | Broken UX erodes trust in the system | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-25 after initialization*
