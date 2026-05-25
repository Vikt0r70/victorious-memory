# Requirements: Victorious Memory V2

**Defined:** 2026-05-25
**Milestone:** v1.1 Foundation & Architecture
**Core Value:** Automatically extract and surface relevant knowledge from developer conversations without manual effort.

## v1.1 Requirements

### Provider Architecture

- [ ] **PROV-01**: Unified provider registry — a dedicated tab/section in settings where providers are configured once
- [ ] **PROV-02**: Agent provider selection — each agent (extraction, edge-detection, consolidation) selects from the registered providers via dropdown
- [ ] **PROV-03**: Dynamic model list — available models are fetched from provider's /v1/models endpoint, not manually typed
- [ ] **PROV-04**: Provider type auto-detection — correct API schema and JSON payload built per provider type (OpenAI, Anthropic, OpenRouter, custom-compatible)
- [ ] **PROV-05**: Role field is read-only per agent — extraction/edge-detection/consolidation roles are fixed, not editable by user
- [ ] **PROV-06**: Usage logging — track every LLM call with provider, model, tokens, timing, and status
- [ ] **PROV-07**: Fallback chains — support up to 4 providers per role with priority-based failover via LiteLLM Router
- [ ] **PROV-08**: Pre-configured provider templates — OpenAI, Anthropic, OpenCode, OpenRouter, Groq, Ollama, Custom

### Dashboard & UX

- [ ] **UX-01**: Full dashboard redesign — complete UI overhaul, not just fixes
- [ ] **UX-02**: Graph visualization redesign — best-in-class graph system for memory relationships
- [ ] **UX-03**: Review queue — functional memory approval/rejection workflow with error handling
- [ ] **UX-04**: All buttons and functions wired — every interactive element works correctly

### Memory Lifecycle

- [ ] **ML-01**: Memory decay — confidence scores decrease over time based on relevance and access patterns
- [ ] **ML-02**: Memory consolidation — detect related/duplicate memories and suggest merges
- [ ] **ML-03**: Conflict detection — identify contradictory memories and flag them for review

### System & Deployment

- [ ] **SYS-01**: Deployment ready — Docker stack deploys cleanly on any device with docker compose up
- [ ] **SYS-02**: Plugin distribution — plugin published to npm for easy OpenCode integration
- [ ] **SYS-03**: MCP distribution — MCP server installable via standard methods
- [ ] **SYS-04**: E2E testing — comprehensive test suite covering critical paths
- [ ] **SYS-05**: CI/CD pipeline — automated testing on commits/PRs
- [ ] **SYS-06**: Documentation — API docs, README with quick start, agent/user guides
- [ ] **SYS-07**: Data export — export memories and system data

### Architecture

- [ ] **ARCH-01**: Best-in-class RAG — optimize retrieval-augmented generation architecture
- [ ] **ARCH-02**: Best-in-class graph — optimize graph system for memory relationship exploration
- [ ] **ARCH-03**: Best-in-class semantic search — optimize vector search and embedding strategy
- [ ] **ARCH-04**: Dynamic memory types — research and implement dynamic/project-based memory type taxonomy

## Out of Scope

| Feature | Reason |
|---------|--------|
| Dashboard full redesign | This IS in scope for v1.1 |
| Graph visualization rewrite | This IS in scope for v1.1 |
| Raw extraction UI redesign | Keep as-is, functional enough |
| Authentication/authorization | Localhost-only, not needed |
| Mobile responsive layout | Desktop-first, web dashboard only |
| New memory types | Use dynamic types from ARCH-04 |
| Multi-user support | Single-user system |
| Cloud deployment automation | Local desktop first |
| Data import | Too complex for this milestone |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PROV-01 | Phase 1 | Pending |
| PROV-02 | Phase 1 | Pending |
| PROV-03 | Phase 1 | Pending |
| PROV-04 | Phase 1 | Pending |
| PROV-05 | Phase 1 | Pending |
| PROV-06 | Phase 1 | Pending |
| PROV-07 | Phase 1 | Pending |
| PROV-08 | Phase 1 | Pending |
| UX-01 | Phase 2 | Pending |
| UX-02 | Phase 2 | Pending |
| UX-03 | Phase 2 | Pending |
| UX-04 | Phase 2 | Pending |
| ML-01 | Phase 3 | Pending |
| ML-02 | Phase 3 | Pending |
| ML-03 | Phase 3 | Pending |
| SYS-01 | Phase 4 | Pending |
| SYS-02 | Phase 4 | Pending |
| SYS-03 | Phase 4 | Pending |
| SYS-04 | Phase 4 | Pending |
| SYS-05 | Phase 4 | Pending |
| SYS-06 | Phase 5 | Pending |
| SYS-07 | Phase 5 | Pending |
| ARCH-01 | Phase 6 | Pending |
| ARCH-02 | Phase 6 | Pending |
| ARCH-03 | Phase 6 | Pending |
| ARCH-04 | Phase 6 | Pending |

**Coverage:**
- v1.1 requirements: 27 total
- Mapped to phases: 27
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-25*
*Last updated: 2026-05-25 after v1.1 milestone definition*
