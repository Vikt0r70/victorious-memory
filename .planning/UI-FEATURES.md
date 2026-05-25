# UI Feature Inventory

**Project:** Victorious Memory V2
**Purpose:** Comprehensive list of all UI features needed in the dashboard
**Phase:** Reference for all UI phases
**Total Features:** 77 (64 original + 13 additions)
**Priority Legend:** P0 = Critical (MVP), P1 = Important, P2 = Nice-to-have

---

## 1. Dashboard Home

**Purpose:** Overview and quick access to all system functions.

| Feature | Description | Status | Priority |
|---------|-------------|--------|----------|
| Memory stats cards | Total memories, pending review, approved, rejected counts | Required | P0 |
| Recent activity feed | Last 10-20 system events (ingestions, approvals, extractions) | Required | P0 |
| Quick action buttons | Add memory, run extraction, export data | Required | P1 |
| Pending review count | Badge showing memories awaiting approval | Required | P0 |
| System health status | API, DB, TEI connection status indicators (evaluated on load/action, no background pinging) | Required | P1 |
| Graph preview | Mini force-graph showing recent memory clusters | Optional | P2 |

---

## 2. Memory Repository

**Purpose:** Browse, search, and manage all memories.

| Feature | Description | Status | Priority |
|---------|-------------|--------|----------|
| Memory table | Paginated table with: content preview, type, project, confidence, date | Required | P0 |
| Search bar | Full-text search across memory content | Required | P0 |
| Type filter | Filter by memory type (decision, preference, bugfix, etc.) | Required | P0 |
| Project filter | Filter by project | Required | P0 |
| Confidence filter | Filter by confidence range | Required | P1 |
| Date filter | Filter by date range | Required | P1 |
| Sorting | Sort by date, confidence, type, project | Required | P0 |
| Bulk selection | Select multiple memories for batch operations | Required | P1 |
| Memory detail panel | Slide-out panel with full content, metadata, related memories | Required | P0 |
| Edit memory | In-place editing of memory content and metadata | Required | P1 |
| Delete memory | Soft delete with confirmation | Required | P1 |
| Empty state | "No memories found" with helpful message | Required | P0 |

---

## 3. Review Queue

**Purpose:** Approve or reject extracted memory candidates.

| Feature | Description | Status | Priority |
|---------|-------------|--------|----------|
| Pending list | Memories awaiting review with content preview | Required | P0 |
| Approve button | Approve memory with current confidence | Required | P0 |
| Reject button | Reject memory (moves to rejected state) | Required | P0 |
| Approve High button | Approve with high confidence label | Required | P1 |
| Confidence indicator | Visual indicator of extraction confidence | Required | P0 |
| Batch approve | Approve multiple selected memories at once | Required | P1 |
| Source exchange | Link back to originating conversation exchange | Required | P2 |
| Auto-approve settings | Configure which types auto-approve | Required | P1 |
| Empty state | "No memories pending review" with disabled buttons | Required | P0 |

---

## 4. Graph Visualization

**Purpose:** Explore memory relationships visually.

| Feature | Description | Status | Priority |
|---------|-------------|--------|----------|
| force-graph canvas | Full-screen Canvas-based graph with d3-force physics | Required | P0 |
| Memory nodes | Colored by type, sized by confidence | Required | P0 |
| Relationship edges | Connect related memories | Required | P0 |
| Click to detail | Click node → open memory detail panel | Required | P0 |
| Hover tooltip | Content preview on hover | Required | P1 |
| Zoom/pan | Mouse wheel zoom, drag to pan | Required | P0 |
| Type filter | Show/hide nodes by memory type | Required | P1 |
| Project filter | Show/hide nodes by project | Required | P1 |
| Physics controls | Adjust gravity, charge, link distance | Optional | P2 |
| Search in graph | Find and highlight specific memory | Required | P1 |
| Reset view | Return to default zoom/position | Required | P1 |
| Dark mode support | Canvas colors adapt to theme | Required | P0 |

---

## 5. Settings

**Purpose:** Configure all aspects of the system.

### 5.1 Provider Management
| Feature | Description | Status | Priority |
|---------|-------------|--------|----------|
| Provider cards | List configured providers with status dot | Required | P0 |
| Add provider | Modal with template selector (OpenAI, Anthropic, etc.) | Required | P0 |
| Edit provider | Update API key, model, base URL | Required | P0 |
| Delete provider | Remove provider config | Required | P1 |
| Test provider | One-click test with live API call | Required | P0 |
| Model dropdown | Dynamic model list from provider API | Required | P0 |
| Custom model input | Free-text for models not in dropdown | Required | P1 |
| Fallback chain | Add/remove/reorder fallback providers per role | Required | P1 |
| Role assignment | Assign providers to extraction/edge-detection/consolidation roles | Required | P0 |
| Usage summary | Total calls, tokens, calls today | Required | P1 |
| Usage logs table | Paginated log of all LLM calls | Required | P1 |
| Retention setting | Permanent / 30 days / 90 days | Required | P2 |

### 5.2 Plugin Configuration
| Feature | Description | Status | Priority |
|---------|-------------|--------|----------|
| Token threshold | Number of tokens before flush | Required | P0 |
| Flush behavior | Auto/manual flush settings | Required | P0 |
| Context injection toggle | Enable/disable system prompt injection | Required | P0 |
| Context size limit | Max tokens for injected context | Required | P1 |

### 5.3 System Settings
| Feature | Description | Status | Priority |
|---------|-------------|--------|----------|
| Data export | Export memories as JSON | Required | P1 |
| Memory lifecycle trigger | Manual trigger for decay/consolidation | Required | P1 |
| Conflict badge | "Conflicts Detected" indicator | Required | P1 |

---

## 6. Activity Log

**Purpose:** Audit trail of all system events.

| Feature | Description | Status | Priority |
|---------|-------------|--------|----------|
| Event list | All system events with timestamp, type, details | Required | P1 |
| Event filtering | Filter by event type (ingest, approve, reject, extract, etc.) | Required | P2 |
| Event search | Search event descriptions | Required | P2 |
| Pagination | Paginated view of events | Required | P1 |

---

## 7. Projects

**Purpose:** Manage projects and project-specific settings.

| Feature | Description | Status | Priority |
|---------|-------------|--------|----------|
| Project list | All detected projects with memory counts | Required | P1 |
| Project detail | Memories belonging to project, project-specific types | Required | P2 |
| Memory type editor | CRUD for project-specific memory types | Required | P2 |

---

## 8. Conflict Resolution

**Purpose:** Handle contradictory memories detected by the system.

| Feature | Description | Status | Priority |
|---------|-------------|--------|----------|
| Conflict list | Memories flagged as contradictory with explanation | Required | P1 |
| Side-by-side diff | Compare conflicting memories | Required | P2 |
| Merge modal | Select which version to keep or merge both | Required | P2 |
| Resolve action | Mark conflict as resolved | Required | P1 |
| Conflict badge | Dashboard badge showing unresolved conflicts | Required | P1 |

---

## 9. Global Toast / Alert System

**Purpose:** Notify users of background events regardless of current page.

| Feature | Description | Status | Priority |
|---------|-------------|--------|----------|
| Toast notifications | Floating alerts for: extraction failures, provider errors, sync status | Required | P0 |
| Persistent alerts | Banner for critical issues (provider down, DB unreachable) | Required | P0 |
| Notification history | Recent notifications panel | Optional | P2 |

---

## 10. Data Import / Restore

**Purpose:** Import previously exported JSON data.

| Feature | Description | Status | Priority |
|---------|-------------|--------|----------|
| JSON import | Upload and restore from JSON export file | Optional | P2 |
| Import validation | Validate JSON structure before import | Optional | P2 |
| Import preview | Show what will be imported before confirming | Optional | P2 |
| Merge or replace | Option to merge with existing data or replace entirely | Optional | P2 |

---

## 11. First-Run / Onboarding

**Purpose:** Guide new users through initial setup.

| Feature | Description | Status | Priority |
|---------|-------------|--------|----------|
| Setup wizard | Step-by-step: provider config → test → project setup | Required | P0 |
| Hard-blocking empty state | Dashboard shows "Configure provider to get started" if none set up | Required | P0 |
| Skip onboarding | Option to skip and configure later | Optional | P2 |
| Quick-start guide | Brief explanation of how the system works | Required | P1 |

---

## 12. Dynamic Manual Entry

**Purpose:** Add memories manually with type-specific fields.

| Feature | Description | Status | Priority |
|---------|-------------|--------|----------|
| Type selector | Dropdown to choose memory type | Required | P0 |
| Dynamic form fields | Form adapts based on selected type's JSON schema | Required | P1 |
| Schema validation | Validate input against type schema | Required | P1 |
| Project selector | Assign to specific project | Required | P0 |
| Confidence slider | Set initial confidence score | Optional | P2 |
| Tags input | Add custom tags | Required | P1 |

---

## Priority Summary

| Priority | Count | Examples |
|----------|-------|----------|
| P0 (Critical) | 32 | Memory table, Approve/Reject, Provider CRUD, force-graph canvas, Onboarding wizard |
| P1 (Important) | 32 | Bulk selection, Usage logs, Type filters, Data export, Conflict badge |
| P2 (Nice-to-have) | 13 | Graph preview, Physics controls, Data import, Notification history, Confidence slider |

**P0 features must be implemented in v1.1.**
**P1 features should be implemented but can be deferred if needed.**
**P2 features are post-v1.1 enhancements.**

---

## UI/UX Requirements

### Universal
- [ ] Dark mode only (user preference)
- [ ] Every clickable element shows cursor pointer
- [ ] Consistent design language across all pages
- [ ] Loading states for all async operations
- [ ] Error handling with user-friendly messages
- [ ] Empty states for all lists
- [ ] Responsive layout (desktop-first)

### Performance
- [ ] force-graph Canvas renderer for 10K+ nodes
- [ ] Virtualized lists for large tables
- [ ] Debounced search input
- [ ] Lazy loading for heavy components

### Accessibility
- [ ] Keyboard navigation support
- [ ] ARIA labels on interactive elements
- [ ] Focus indicators

---

## Phase Mapping

| Phase | UI Pages Affected |
|-------|-------------------|
| Phase 1 (Provider System) | Settings → Provider Management, Usage Logs, Graph Visualization (backend), pgvector HNSW |
| Phase 2 (Dashboard Redesign) | All pages — full UI overhaul |
| Phase 3 (Memory Lifecycle) | Memory Repository, Review Queue, Settings → Lifecycle, Conflict Resolution UI |
| Phase 4 (Deployment) | Settings → Plugin Config, First-Run / Onboarding, Data Import |
| Phase 5 (Documentation) | Help/Documentation page |
| Phase 6 (Architecture) | Graph Visualization enhancements, Dynamic Manual Entry |
