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
- ✓ Hybrid search (semantic + BM25) — existing (BM25 to be deprecated in favor of single-stage dense search)
- ✓ Context injection into system prompt — existing
- ✓ Web dashboard with dark mode — existing
- ✓ MCP server (5 tools) — existing
- ✓ OpenCode plugin (5 hooks) — existing
- ✓ Background extraction worker (asyncio) — existing
- ✓ Docker Compose deployment — existing
- ✓ Docker stack health and container audit (Phase 1) — v1.0

### Active

- [ ] **PROV-01**: Unified provider registry — configure providers once in a dedicated tab, agents select from registry
- [ ] **PROV-02**: Dynamic model list — fetch available models from provider APIs instead of manual text input
- [ ] **PROV-03**: Provider test validation — test endpoint returns actual error when API key is missing/invalid
- [ ] **PROV-04**: Auto-detect provider type schema — build correct JSON payload per provider (OpenAI, Anthropic, OpenRouter, custom)
- [ ] **PROV-05**: Lock roles per agent — extraction/edge-detection/consolidation roles should be fixed per agent, not editable
- [ ] **PROV-06**: Usage logging — track token usage per provider, agent role, and call
- [ ] **PROV-07**: Fallback chains — support multiple providers per role with priority-based failover
- [ ] **PROV-08**: Pre-configured provider templates — OpenAI, Anthropic, OpenCode, OpenRouter, Groq, Custom
- [ ] **UX-01**: Dashboard redesign — full UI overhaul, not just fixes
- [ ] **UX-02**: Graph visualization redesign — current implementation is inadequate
- [ ] **UX-03**: Review queue — functional memory approval/rejection workflow in UI
- [ ] **UX-04**: All buttons and functions wired — every interactive element works correctly
- [ ] **ML-01**: Memory decay — confidence scores decrease over time based on relevance
- [ ] **ML-02**: Memory consolidation — detect related/duplicate memories and suggest merges
- [ ] **ML-03**: Conflict detection — identify contradictory memories
- [ ] **SYS-01**: Deployment ready — Docker stack deploys cleanly on any device
- [ ] **SYS-02**: Plugin/MCP distribution — npm-hosted plugin, easy MCP install
- [ ] **SYS-03**: E2E testing — comprehensive test suite and CI/CD pipeline
- [ ] **SYS-04**: Documentation — API docs, README, agent/user guides
- [ ] **SYS-05**: Data export — export memories and data
- [ ] **ARCH-01**: Best-in-class RAG — optimize retrieval architecture
- [ ] **ARCH-02**: Best-in-class graph — optimize graph system for memory relationships
- [ ] **ARCH-03**: Best-in-class semantic search — optimize vector search and embeddings
- [ ] **ARCH-04**: Dynamic memory types — research and implement dynamic/project-based memory types

### Out of Scope

- Raw extraction UI redesign — keep as-is for now
- Authentication/authorization for the API — localhost-only, not needed
- Mobile app or mobile-responsive redesign — desktop-first
- Data import — too complex for this milestone
- Multi-user support — single-user system
- Cloud deployment automation — local desktop first

## Context

**Brownfield project.** Existing code at `apps/api/` (Python FastAPI), `apps/web/` (Next.js 16), `apps/mcp/` (Python MCP server), `apps/plugin/` (JavaScript OpenCode plugin). Deployed via Docker Compose with PostgreSQL 16 + pgvector, HuggingFace TEI embeddings, and configurable LLM providers.

**Current state:** The architecture is solid but the web dashboard UX needs a complete overhaul — graph visualization is inadequate, interactive elements are broken, and the provider configuration model forces per-agent setup instead of a shared registry. The extraction pipeline and memory lifecycle have never been verified end-to-end. Provider architecture needs LiteLLM integration for proper multi-provider support.

**Performance targets:**
- Scale: Tens of thousands of memories
- Search latency: <1s acceptable for context retrieval
- Graph rendering: Canvas-based (not DOM/SVG) for performance at scale

**User preferences:**
- Primary LLM provider: OpenCode Go (built-in)
- Memory lifecycle: Automatic daily background task, no notifications
- Conflict detection: Dashboard badge only (no alerts)
- Export: JSON format
- Plugin package: `victorious-memory` on npm
- MCP: npx distribution
- Testing: GitHub Actions on every commit
- Data migration: Start fresh (existing data is test data)

**Known technical concerns:**
- Provider gateway uses module-level singleton; provider test returns OK 200 with no API key
- In-process sentence-transformers blocks the event loop
- Models are in a single monolithic file (anti-pattern noted but deferred)
- No authentication on the API (CORS allows all origins)
- Agent output storage may be too verbose (large DB rows, high token costs)
- Graph visualization is inadequate for the memory relationship model

## Constraints

- **Tech stack**: Python 3.12 + FastAPI (backend), Next.js 16 + React (frontend), PostgreSQL 16 + pgvector, Docker Compose
- **Deployment**: Local desktop first, VPS later
- **No auth**: API is open — security through localhost/network isolation
- **LLM providers**: Must support OpenAI-compatible and Anthropic APIs, plus custom endpoints
- **Embeddings**: Currently in-process sentence-transformers; plan was HuggingFace TEI as separate service

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Adopt LiteLLM as provider abstraction layer | 100+ providers instantly, schema handling, model discovery — eliminates custom provider engineering | — In Progress (Phase 2) |
| Unified provider registry over per-agent configs | Reduces setup friction, better UX | — Pending |
| Dynamic model lists via provider API calls | Eliminates manual model name entry, stays current | — Pending (satisfied by LiteLLM) |
| Full dashboard redesign | Current UI has accumulated too many issues — better to rebuild than patch | — Pending |
| Data import excluded | Too complex for this milestone — focus on export first | — Pending |
| Scale target: tens of thousands of memories | User confirmed expected scale | — Pending |
| Search latency budget: <1s | User confirmed acceptable latency | — Pending |
| Primary LLM provider: OpenCode Go | User uses OpenCode's built-in provider | — Pending |
| Memory lifecycle: daily automatic task | User wants automatic cleanup without manual triggers | — Pending |
| Conflict detection: dashboard badge only | User doesn't want notifications, just UI indicator | — Pending |
| Export format: JSON only | User preference for data export | — Pending |
| Plugin npm package: `victorious-memory` | User-approved package name | — Pending |
| MCP distribution: npx | Recommended by user | — Pending |
| CI/CD: GitHub Actions on every commit | User preference for automated testing | — Pending |
| Embedding migration: start fresh | All existing data is test data | — Pending |
| 5000-token accumulator | Batch-driven extraction triggered by token threshold, not per-message | — Pending |
| Error-at-failure fallback | Handle provider errors at call site with try/except, not background health checks | — Pending |

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

## Current Milestone: v1.1 Foundation & Architecture

**Goal:** Build a solid foundation with best-in-class provider architecture, complete dashboard redesign, working memory lifecycle, and deployment-ready Docker stack.

**Target features:**
- Complete LiteLLM provider integration with usage logging and fallback chains
- Full dashboard redesign with working graph visualization
- Memory decay, consolidation, and conflict detection
- Dynamic memory types based on research
- Portable Docker deployment
- Plugin/MCP distribution
- Comprehensive testing and documentation

---
*Last updated: 2026-05-25 after v1.1 milestone initialization*
