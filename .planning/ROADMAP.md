# Roadmap: Victorious Memory V2

**Created:** 2026-05-25
**Granularity:** Fine (12 phases)

---

### Phase 1: Stack Health & Container Audit

**Goal:** Confirm the Docker Compose stack starts cleanly and all services are healthy. Identify the unknown Brave MCnulty container.
**Mode:** mvp
**Requirements:** SYS-01, SYS-07
**Success Criteria**:

1. `docker compose up -d` starts all containers without errors
2. All containers report healthy within 30 seconds
3. Brave MCnulty container identified and documented
4. `GET /health` returns 200 on the API

**Plans:** 1 planPlans:

- [x] 01-01-PLAN.md — Add api healthcheck, verify stack health, identify Brave MCnulty

### Phase 2: Provider Test Fix & Pipeline Check

**Goal:** Fix the broken provider test endpoint (should fail without API key) and verify the ingestion pipeline works.
**Mode:** mvp
**Requirements:** PROV-06, SYS-02, PLG-01
**Success Criteria**:

1. Provider test returns 4xx/5xx error when API key is missing or invalid
2. Plugin captures a real exchange and POSTs to /api/ingest
3. Exchange rows and extraction jobs with status "pending" appear in DB
4. Activity log records the ingestion event

### Phase 3: Extraction Pipeline End-to-End

**Goal:** Verify the extraction worker processes jobs end-to-end: LLM call → memory candidates → validation → storage.
**Mode:** mvp
**Requirements:** SYS-03
**Success Criteria**:

1. Worker claims pending jobs and calls the extraction agent
2. LLM returns valid JSON with memory candidates
3. Validator deduplicates, assigns confidence labels, decides auto-approve
4. New memory rows with embeddings appear in the database
5. Job status transitions: pending → processing → done

### Phase 4: Context Retrieval Verification

**Goal:** Confirm context injection works — GET /api/context returns relevant memories formatted for system prompt injection.
**Mode:** mvp
**Requirements:** SYS-04, PLG-02
**Success Criteria**:

1. `/api/context?query=database&project_id=X` returns a formatted block with 3 sections
2. Project decisions section includes architecture/decision memories
3. User preferences section includes global preference memories
4. Relevant section includes hybrid search results
5. Plugin injects the block into system prompt before messages

### Phase 5: Unified Provider Registry

**Goal:** Replace per-agent provider configs with a shared provider registry — configure once, select per agent.
**Mode:** mvp
**Requirements:** PROV-01, PROV-02, PROV-05, PROV-07, PROV-08
**Success Criteria**:

1. New "Providers" tab in settings with CRUD for provider configs
2. Pre-configured provider list: OpenAI, Anthropic, OpenCode, OpenRouter, Groq, Custom
3. Agent settings show provider dropdown instead of inline config fields
4. Extraction, edge-detection, consolidation roles are fixed (read-only)
5. Adding a custom provider saves base URL, name, API key
6. Deleting a provider warns if it's in use by an agent

### Phase 6: Dynamic Model Lists

**Goal:** Fetch available models from provider APIs instead of requiring manual model name entry.
**Mode:** mvp
**Requirements:** PROV-03
**Success Criteria**:

1. Model field is a dropdown populated by GET {base_url}/v1/models (OpenAI-compatible) or equivalent
2. Dropdown updates when provider is changed
3. Loading state shown while models are being fetched
4. Graceful fallback to text input if model fetch fails (with error message)
5. Cache model list for 5 minutes to avoid excessive API calls

### Phase 7: Provider Schema Auto-Detection

**Goal:** Build correct API request payloads per provider type automatically.
**Mode:** mvp
**Requirements:** PROV-04
**Success Criteria**:

1. OpenAI-compatible providers: POST /chat/completions with standard schema
2. Anthropic providers: POST /v1/messages with Anthropic schema
3. Provider type selection updates the backend gateway routing
4. Test endpoint uses the correct schema for the selected provider type
5. Custom providers with "anthropic-compatible" type use Anthropic schema

### Phase 8: UX Fixes Round 1 — Interactive Elements

**Goal:** Fix cursor indicators, button styling, and clickable element feedback.
**Mode:** mvp
**Requirements:** UX-01, UX-02, UX-05
**Success Criteria**:

1. All clickable chips, tabs, and navigation items show `cursor: pointer` on hover
2. Approve High and Reject buttons in review queue styled as proper buttons
3. Buttons show hover state (background color change)
4. Empty review queue shows "No memories pending review" with disabled buttons visible
5. Allowed types chips in auto-approve section show selection state clearly

### Phase 9: UX Fixes Round 2 — Layout Stability

**Goal:** Fix table layout shift in memory repository and auto-approve section behavior.
**Mode:** mvp
**Requirements:** UX-03, UX-04
**Success Criteria**:

1. Memory repository table position remains stable when filter chips are toggled
2. Content type selector does not push table content down
3. Filter area has fixed height with overflow or reserved space
4. Auto-approve allowed types click toggles selection with clear visual feedback
5. No jarring layout jumps in any settings section

### Phase 10: Memory Lifecycle Verification

**Goal:** Verify decay, consolidation, and conflict detection processes actually execute and produce results.
**Mode:** mvp
**Requirements:** SYS-05
**Success Criteria**:

1. Memory decay logic can be triggered and updates confidence scores
2. Consolidation detects related/duplicate memories and suggests merges
3. Conflict detection identifies contradictory memories (e.g., "use PostgreSQL" vs "use SQLite")
4. Activity log records lifecycle events
5. Lifecycle endpoints return correct status and results

### Phase 11: Plugin & MCP Integration Verification

**Goal:** Verify the plugin and MCP server are fully functional with real data flow.
**Mode:** mvp
**Requirements:** SYS-06, PLG-03, PLG-04
**Success Criteria**:

1. Plugin token threshold configuration change takes effect within one exchange cycle
2. MCP search_memories returns relevant results for a query
3. MCP get_context returns formatted block matching API output
4. MCP save_memory creates a memory with correct fields
5. MCP list_memories and get_activity return accurate data
6. Plugin flush behavior responds to dashboard config changes

### Phase 12: Cleanup & Final Verification

**Goal:** Resolve any remaining issues, clean up temp files, verify the full system.
**Mode:** mvp
**Requirements:** (integration check — all previous requirements verified)
**Success Criteria**:

1. Full end-to-end test: plugin capture → ingest → extract → store → context retrieve → inject
2. All provider types can be configured and tested successfully
3. No console errors in web dashboard
4. No orphaned Docker containers or volumes
5. All temp files and debug artifacts removed
6. README updated with verified quick-start instructions

---

## Coverage Summary

| Phase | Requirements | Count |
|-------|-------------|-------|
| 1: Stack Health | SYS-01, SYS-07 | 2 |
| 2: Provider Test | PROV-06, SYS-02, PLG-01 | 3 |
| 3: Extraction E2E | SYS-03 | 1 |
| 4: Context Retrieval | SYS-04, PLG-02 | 2 |
| 5: Provider Registry | PROV-01, PROV-02, PROV-05, PROV-07, PROV-08 | 5 |
| 6: Dynamic Models | PROV-03 | 1 |
| 7: Provider Schemas | PROV-04 | 1 |
| 8: UX Round 1 | UX-01, UX-02, UX-05 | 3 |
| 9: UX Round 2 | UX-03, UX-04 | 2 |
| 10: Memory Lifecycle | SYS-05 | 1 |
| 11: Plugin & MCP | SYS-06, PLG-03, PLG-04 | 3 |
| 12: Cleanup | Integration | — |

**Total:** 12 phases, 24 requirements, 100% coverage ✓

---
*Roadmap created: 2026-05-25*
