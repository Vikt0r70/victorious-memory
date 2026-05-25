# UI Feature Inventory

**Project:** Victorious Memory V2
**Purpose:** Comprehensive list of all UI features needed in the dashboard
**Phase:** Reference for all UI phases
**Total Features:** 77 (64 original + 13 additions)

---

## 1. Dashboard Home

**Purpose:** Overview and quick access to all system functions.

| Feature | Description | Status |
|---------|-------------|--------|
| Memory stats cards | Total memories, pending review, approved, rejected counts | Required |
| Recent activity feed | Last 10-20 system events (ingestions, approvals, extractions) | Required |
| Quick action buttons | Add memory, run extraction, export data | Required |
| Pending review count | Badge showing memories awaiting approval | Required |
| System health status | API, DB, TEI connection status indicators (evaluated on load/action, no background pinging) | Required |
| Graph preview | Mini force-graph showing recent memory clusters | Optional |

---

## 2. Memory Repository

**Purpose:** Browse, search, and manage all memories.

| Feature | Description | Status |
|---------|-------------|--------|
| Memory table | Paginated table with: content preview, type, project, confidence, date | Required |
| Search bar | Full-text search across memory content | Required |
| Type filter | Filter by memory type (decision, preference, bugfix, etc.) | Required |
| Project filter | Filter by project | Required |
| Confidence filter | Filter by confidence range | Required |
| Date filter | Filter by date range | Required |
| Sorting | Sort by date, confidence, type, project | Required |
| Bulk selection | Select multiple memories for batch operations | Required |
| Memory detail panel | Slide-out panel with full content, metadata, related memories | Required |
| Edit memory | In-place editing of memory content and metadata | Required |
| Delete memory | Soft delete with confirmation | Required |
| Empty state | "No memories found" with helpful message | Required |

---

## 3. Review Queue

**Purpose:** Approve or reject extracted memory candidates.

| Feature | Description | Status |
|---------|-------------|--------|
| Pending list | Memories awaiting review with content preview | Required |
| Approve button | Approve memory with current confidence | Required |
| Reject button | Reject memory (moves to rejected state) | Required |
| Approve High button | Approve with high confidence label | Required |
| Confidence indicator | Visual indicator of extraction confidence | Required |
| Batch approve | Approve multiple selected memories at once | Required |
| Source exchange | Link back to originating conversation exchange | Required |
| Auto-approve settings | Configure which types auto-approve | Required |
| Empty state | "No memories pending review" with disabled buttons | Required |

---

## 4. Graph Visualization

**Purpose:** Explore memory relationships visually.

| Feature | Description | Status |
|---------|-------------|--------|
| force-graph canvas | Full-screen Canvas-based graph with d3-force physics | Required |
| Memory nodes | Colored by type, sized by confidence | Required |
| Relationship edges | Connect related memories | Required |
| Click to detail | Click node → open memory detail panel | Required |
| Hover tooltip | Content preview on hover | Required |
| Zoom/pan | Mouse wheel zoom, drag to pan | Required |
| Type filter | Show/hide nodes by memory type | Required |
| Project filter | Show/hide nodes by project | Required |
| Physics controls | Adjust gravity, charge, link distance | Optional |
| Search in graph | Find and highlight specific memory | Required |
| Reset view | Return to default zoom/position | Required |
| Dark mode support | Canvas colors adapt to theme | Required |

---

## 5. Settings

**Purpose:** Configure all aspects of the system.

### 5.1 Provider Management
| Feature | Description | Status |
|---------|-------------|--------|
| Provider cards | List configured providers with status dot | Required |
| Add provider | Modal with template selector (OpenAI, Anthropic, etc.) | Required |
| Edit provider | Update API key, model, base URL | Required |
| Delete provider | Remove provider config | Required |
| Test provider | One-click test with live API call | Required |
| Model dropdown | Dynamic model list from provider API | Required |
| Custom model input | Free-text for models not in dropdown | Required |
| Fallback chain | Add/remove/reorder fallback providers per role | Required |
| Role assignment | Assign providers to extraction/edge-detection/consolidation roles | Required |
| Usage summary | Total calls, tokens, calls today | Required |
| Usage logs table | Paginated log of all LLM calls | Required |
| Retention setting | Permanent / 30 days / 90 days | Required |

### 5.2 Plugin Configuration
| Feature | Description | Status |
|---------|-------------|--------|
| Token threshold | Number of tokens before flush | Required |
| Flush behavior | Auto/manual flush settings | Required |
| Context injection toggle | Enable/disable system prompt injection | Required |
| Context size limit | Max tokens for injected context | Required |

### 5.3 System Settings
| Feature | Description | Status |
|---------|-------------|--------|
| Data export | Export memories as JSON | Required |
| Memory lifecycle trigger | Manual trigger for decay/consolidation | Required |
| Conflict badge | "Conflicts Detected" indicator | Required |

---

## 6. Activity Log

**Purpose:** Audit trail of all system events.

| Feature | Description | Status |
|---------|-------------|--------|
| Event list | All system events with timestamp, type, details | Required |
| Event filtering | Filter by event type (ingest, approve, reject, extract, etc.) | Required |
| Event search | Search event descriptions | Required |
| Pagination | Paginated view of events | Required |

---

## 7. Projects

**Purpose:** Manage projects and project-specific settings.

| Feature | Description | Status |
|---------|-------------|--------|
| Project list | All detected projects with memory counts | Required |
| Project detail | Memories belonging to project, project-specific types | Required |
| Memory type editor | CRUD for project-specific memory types | Required |

---

## 8. Conflict Resolution

**Purpose:** Handle contradictory memories detected by the system.

| Feature | Description | Status |
|---------|-------------|--------|
| Conflict list | Memories flagged as contradictory with explanation | Required |
| Side-by-side diff | Compare conflicting memories | Required |
| Merge modal | Select which version to keep or merge both | Required |
| Resolve action | Mark conflict as resolved | Required |
| Conflict badge | Dashboard badge showing unresolved conflicts | Required |

---

## 9. Global Toast / Alert System

**Purpose:** Notify users of background events regardless of current page.

| Feature | Description | Status |
|---------|-------------|--------|
| Toast notifications | Floating alerts for: extraction failures, provider errors, sync status | Required |
| Persistent alerts | Banner for critical issues (provider down, DB unreachable) | Required |
| Notification history | Recent notifications panel | Optional |

---

## 10. Data Import / Restore

**Purpose:** Import previously exported JSON data.

| Feature | Description | Status |
|---------|-------------|--------|
| JSON import | Upload and restore from JSON export file | Required |
| Import validation | Validate JSON structure before import | Required |
| Import preview | Show what will be imported before confirming | Required |
| Merge or replace | Option to merge with existing data or replace entirely | Required |

---

## 11. First-Run / Onboarding

**Purpose:** Guide new users through initial setup.

| Feature | Description | Status |
|---------|-------------|--------|
| Setup wizard | Step-by-step: provider config → test → project setup | Required |
| Hard-blocking empty state | Dashboard shows "Configure provider to get started" if none set up | Required |
| Skip onboarding | Option to skip and configure later | Optional |
| Quick-start guide | Brief explanation of how the system works | Required |

---

## 12. Dynamic Manual Entry

**Purpose:** Add memories manually with type-specific fields.

| Feature | Description | Status |
|---------|-------------|--------|
| Type selector | Dropdown to choose memory type | Required |
| Dynamic form fields | Form adapts based on selected type's JSON schema | Required |
| Schema validation | Validate input against type schema | Required |
| Project selector | Assign to specific project | Required |
| Confidence slider | Set initial confidence score | Optional |
| Tags input | Add custom tags | Required |

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
| Phase 1 (Provider System) | Settings → Provider Management, Usage Logs |
| Phase 2 (Dashboard Redesign) | All pages — full UI overhaul |
| Phase 3 (Memory Lifecycle) | Memory Repository, Review Queue, Settings → Lifecycle |
| Phase 4 (Deployment) | Settings → Plugin Config |
| Phase 5 (Documentation) | Help/Documentation page |
| Phase 3 (Memory Lifecycle) | Conflict Resolution UI |
| Phase 4 (Deployment) | First-Run / Onboarding, Data Import |
| Phase 5 (Documentation) | Help/Documentation page |
| Phase 6 (Architecture) | Graph Visualization enhancements, Dynamic Manual Entry |
