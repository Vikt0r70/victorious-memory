# Roadmap: Victorious Memory V2

**Created:** 2026-05-25
**Granularity:** Fine (6 phases)
**Milestone:** v1.1 Foundation & Architecture

---

### Phase 1: Provider System & Architecture

**Goal:** Integrate LiteLLM as the provider abstraction layer and build a complete provider management system with usage logging and fallback chains.
**Mode:** mvp
**Requirements:** PROV-01, PROV-02, PROV-03, PROV-04, PROV-05, PROV-06, PROV-07, PROV-08
**Success Criteria**:

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

### Phase 2: Dashboard Redesign

**Goal:** Complete UI overhaul — fix all interactive elements, redesign graph visualization, and ensure every button works.
**Mode:** mvp
**Requirements:** UX-01, UX-02, UX-03, UX-04
**Success Criteria**:

1. All pages have consistent design language and dark mode
2. Graph visualization uses best-in-class library with interactive node exploration
3. Review queue shows pending memories with Approve/Reject buttons that work
4. All clickable elements show proper cursor and hover states
5. Memory repository table stable — no layout shifts when filtering
6. Settings page fully functional with all sections working
7. Navigation sidebar and routing work correctly
8. Empty states handled gracefully across all pages

### Phase 3: Memory Lifecycle

**Goal:** Implement decay, consolidation, and conflict detection processes.
**Mode:** mvp
**Requirements:** ML-01, ML-02, ML-03
**Success Criteria**:

1. Memory decay logic triggered periodically, updates confidence scores based on age and access
2. Consolidation detects related/duplicate memories and suggests merges
3. Conflict detection identifies contradictory memories and flags for review
4. Activity log records all lifecycle events
5. Lifecycle endpoints return correct status and results
6. UI shows lifecycle status and allows manual triggering

### Phase 4: Deployment & Distribution

**Goal:** Make the system deployable on any device and distributable as plugin/MCP.
**Mode:** mvp
**Requirements:** SYS-01, SYS-02, SYS-03, SYS-04, SYS-05
**Success Criteria**:

1. `docker compose up` starts all services cleanly on fresh machine
2. Plugin published to npm registry with installation instructions
3. MCP server installable via standard methods (npx, pip, etc.)
4. E2E test suite covers: plugin → ingest → extract → store → context → inject
5. CI/CD pipeline runs tests on every commit/PR
6. All provider types can be configured and tested successfully
7. No console errors in web dashboard

### Phase 5: Documentation & Export

**Goal:** Write comprehensive documentation and implement data export.
**Mode:** mvp
**Requirements:** SYS-06, SYS-07
**Success Criteria**:

1. README updated with verified quick-start instructions
2. API documentation covers all endpoints with examples
3. User guide explains dashboard features and workflows
4. Agent/developer guide covers architecture and integration
5. Data export endpoint allows downloading memories as JSON/CSV
6. Export includes metadata: timestamps, confidence, project, tags

### Phase 6: Architecture Excellence

**Goal:** Optimize core architecture components — RAG, graph, semantic search, and memory types.
**Mode:** mvp
**Requirements:** ARCH-01, ARCH-02, ARCH-03, ARCH-04
**Success Criteria**:

1. Single-stage dense RAG implemented — pgvector HNSW with cosine similarity, no multi-stage pipeline
2. Graph system uses force-graph (Canvas + d3-force) for organic memory relationship exploration
3. Semantic search uses pgvector HNSW with BGE-M3 embeddings via TEI — simple and effective
4. Research completed on dynamic memory type taxonomy
5. Dynamic types implemented based on project context or memory content
6. Architecture documented with decision records

---

## Coverage Summary

| Phase | Requirements | Count |
|-------|-------------|-------|
| 1: Provider System | PROV-01→08 | 8 |
| 2: Dashboard Redesign | UX-01→04 | 4 |
| 3: Memory Lifecycle | ML-01→03 | 3 |
| 4: Deployment & Distribution | SYS-01→05 | 5 |
| 5: Documentation & Export | SYS-06, SYS-07 | 2 |
| 6: Architecture Excellence | ARCH-01→04 | 4 |

**Total:** 6 phases, 27 requirements, 100% coverage ✓

## Architecture Change Log

| Date | Change | Impact |
|------|--------|--------|
| 2026-05-25 | Adopted LiteLLM as provider abstraction layer | Phases 5-7 merged into single "Provider System" phase |
| 2026-05-25 | Dashboard redesign moved from v2 to v1.1 | Added Phase 2 for complete UI overhaul |
| 2026-05-25 | Memory lifecycle moved from v2 to v1.1 | Added Phase 3 for decay, consolidation, conflict detection |

---
*Roadmap created: 2026-05-25*
