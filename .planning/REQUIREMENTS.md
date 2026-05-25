# Requirements: Victorious Memory V2

**Defined:** 2026-05-25
**Core Value:** Automatically extract and surface relevant knowledge from developer conversations without manual effort.

## v1 Requirements

### System Verification

- [ ] **SYS-01**: Docker Compose stack starts cleanly without errors (api, db, embed, web, mcp containers)
- [ ] **SYS-02**: Plugin captures exchanges and POSTs to /api/ingest — exchange rows and extraction jobs appear in DB
- [ ] **SYS-03**: Extraction worker picks up pending jobs, calls LLM, stores extracted memories with embeddings
- [ ] **SYS-04**: GET /api/context returns a formatted context block with project decisions, preferences, and relevant memories
- [ ] **SYS-05**: Memory lifecycle processes (decay, consolidation, conflict detection) execute when triggered
- [ ] **SYS-06**: Plugin configuration changes (token threshold, flush behavior) take effect without restart
- [ ] **SYS-07**: Identify and document the "Brave MCnulty" Docker container — its purpose, origin, and whether it's needed

### Provider Architecture

- [ ] **PROV-01**: Unified provider registry — a dedicated tab/section in settings where providers are configured once
- [ ] **PROV-02**: Agent provider selection — each agent (extraction, edge-detection, consolidation) selects from the registered providers via dropdown
- [ ] **PROV-03**: Dynamic model list — available models are fetched from provider's /v1/models endpoint, not manually typed
- [ ] **PROV-04**: Provider type auto-detection — correct API schema and JSON payload built per provider type (OpenAI, Anthropic, OpenRouter, custom-compatible)
- [ ] **PROV-05**: Role field is read-only per agent — extraction/edge-detection/consolidation roles are fixed, not editable by user
- [ ] **PROV-06**: Provider test returns meaningful error when API key is missing, invalid, or endpoint unreachable (not OK 200)
- [ ] **PROV-07**: Custom provider option with configurable name, base URL, and API key
- [ ] **PROV-08**: Pre-configured provider list includes: OpenAI, Anthropic, OpenCode, OpenRouter, Groq, and Custom

### UX Fixes

- [ ] **UX-01**: All clickable elements show pointer cursor on hover (allowed types chips, settings sections, navigation items)
- [ ] **UX-02**: Review queue "Approve High" and "Reject" display as styled buttons with proper cursor pointer
- [ ] **UX-03**: Memory repository table does not shift position when filter chips or content type selectors are toggled
- [ ] **UX-04**: Auto-approve section "allowed types" has clear visual feedback on click (color change, selection state) and shows it's interactive
- [ ] **UX-05**: Empty states in review queue show "No memories pending review" with the buttons still visible but disabled

### Plugin & Integration

- [ ] **PLG-01**: Plugin auto-captures conversation exchanges on token threshold and flushes to API
- [ ] **PLG-02**: Plugin injects context block from GET /api/context into system prompt before each message
- [ ] **PLG-03**: MCP server tools (search_memories, get_context, save_memory, list_memories, get_activity) return correct data
- [ ] **PLG-04**: Plugin settings changes in the dashboard are reflected in plugin behavior within one exchange cycle

## v2 Requirements

### Dashboard

- Dashboard redesign with modern layout and information hierarchy
- Graph visualization rewrite with interactive node exploration
- Raw extraction data view redesign

### Memory Lifecycle

- Advanced decay algorithms with configurable thresholds
- Automated consolidation of related memories
- Conflict resolution UI for contradictory memories
- Bulk operations on memories (tag, move, merge)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Dashboard full redesign | Focus on fixing functionality, not visuals |
| Graph visualization rewrite | Verify it works first, redesign later |
| Raw extraction UI redesign | Keep as-is, functional enough |
| Authentication/authorization | Localhost-only, not needed for v1 |
| Mobile responsive layout | Desktop-first, web dashboard only |
| New memory types | Use existing 10-type taxonomy |
| Multi-user support | Single-user system |
| Cloud deployment automation | Local desktop first |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SYS-01 | Phase 1 | Pending |
| SYS-02 | Phase 2 | Pending |
| SYS-03 | Phase 3 | Pending |
| SYS-04 | Phase 4 | Pending |
| SYS-05 | Phase 10 | Pending |
| SYS-06 | Phase 11 | Pending |
| SYS-07 | Phase 1 | Pending |
| PROV-01 | Phase 5 | Pending |
| PROV-02 | Phase 5 | Pending |
| PROV-03 | Phase 6 | Pending |
| PROV-04 | Phase 7 | Pending |
| PROV-05 | Phase 5 | Pending |
| PROV-06 | Phase 2 | Pending |
| PROV-07 | Phase 5 | Pending |
| PROV-08 | Phase 5 | Pending |
| UX-01 | Phase 8 | Pending |
| UX-02 | Phase 8 | Pending |
| UX-03 | Phase 9 | Pending |
| UX-04 | Phase 9 | Pending |
| UX-05 | Phase 8 | Pending |
| PLG-01 | Phase 2 | Pending |
| PLG-02 | Phase 4 | Pending |
| PLG-03 | Phase 11 | Pending |
| PLG-04 | Phase 11 | Pending |

**Coverage:**
- v1 requirements: 24 total
- Mapped to phases: 24
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-25*
*Last updated: 2026-05-25 after initial definition*
