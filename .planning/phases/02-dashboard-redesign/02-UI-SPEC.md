# UI Design Contract — Phase 2: Dashboard Redesign

**Status:** Draft → Review → Approved  
**Last Updated:** 2026-05-26  
**Designer:** gsd-ui-researcher  
**Scope:** Complete UI overhaul of the Victorious Memory V2 web dashboard

---

## 1. Overview

### Phase Goal
Deliver a cohesive, polished dark-mode dashboard where every interactive element works correctly, all pages share a consistent visual language, and the graph visualization uses a best-in-class library. Establish shadcn/ui as the component foundation and TanStack Table as the data-grid standard.

### In Scope
- Dashboard home page (`app/page.tsx`)
- Graph Explorer (`app/graph/page.tsx`)
- Review Queue (`app/review/page.tsx`)
- Memory Repository (`app/memories/page.tsx`)
- Settings (`app/settings/page.tsx`)
- Extraction Jobs (`app/jobs/page.tsx`)
- Navigation Sidebar (`components/layout/Sidebar.tsx`)
- TopBar (`components/layout/TopBar.tsx`)
- Empty states for all pages and lists
- Component standardization via shadcn/ui (11 components)
- Global interaction fixes: cursor-pointer, hover states, loading states, user-facing errors

### Out of Scope
- Backend API changes
- Mobile-responsive redesign (desktop-only per constraints)
- Memory lifecycle features (Phase 3)
- Deployment/Distribution (Phase 4)
- Documentation/Export content changes (Phase 5)
- Architecture optimizations (Phase 6)

### Design Principles
1. **Consistency first** — Every page uses the same spacing scale, color tokens, border radius, and shadow system.
2. **Dark mode only** — No light mode toggle. All colors are from the MD3 dark palette.
3. **Function over flair** — Animations are subtle and purposeful. No gratuitous motion.
4. **Developer-focused** — Dense information display, monospace for data, clear hierarchy, minimal chrome.
5. **Accessibility baseline** — WCAG 2.1 AA contrast for all text, keyboard-navigable modals, focus rings.

---

## 2. Pages / Screens

### 2.1 Dashboard Home (`app/page.tsx`)

**Purpose:** System overview — stat cards, recent activity, and memory type distribution.

**Layout:**
```
+---------------------------------------------------------------+
| [6 stat cards in a row]                                       |
+---------------------------------------------------------------+
| [Activity Feed — 2/3 width]    [Donut Chart — 1/3 width]     |
+---------------------------------------------------------------+
```

**Sections:**
| Section | Purpose | Key Elements |
|---------|---------|--------------|
| Stat Cards | At-a-glance metrics | 6 cards in grid-cols-6, icon, value, subtitle, optional progress bar |
| Activity Feed | Recent system events | Scrollable list, event icon, description, timestamp, tags |
| Donut Chart | Memory type breakdown | CSS conic-gradient donut, center total count, color legend |

**Components:**
- `StatCard` — Custom, props: title, value, icon, iconColor, subtitle, subtitleColor, badge, progress, delay
- `DonutChart` — Custom, props: data (Record<string, number>), total
- `ActivityItem` — Inline in page

**States:**
- **Loading:** Centered spinner (progress_activity icon, animate-spin, text-[#c0c1ff], text-4xl)
- **Empty:** Activity feed shows "No recent activity" in #908fa0; donut shows "No data yet"
- **Error:** Inline error banner
- **Success:** Silent data refresh

**Interactions:**
- Stat cards: hover-glow class (box-shadow + translateY(-2px), 0.3s cubic-bezier(0.16, 1, 0.3, 1))
- Activity items: hover:bg-[#334155]/40 hover:translate-x-1 transition-colors duration-300 cursor-pointer
- "View All" link: text-[#c0c1ff] hover:text-[#e1e0ff]
- Donut: hover:scale-105, 0.5s transition

---

### 2.2 Graph Explorer (`app/graph/page.tsx`)

**Purpose:** Interactive visualization of memory relationships using force-directed graph.

**Layout:**
```
+---------------------------------------------------------------+
| Graph Explorer                    [Search] [node count]       |
+---------------------------------------------------------------+
| [Legend: relation type color bars]                            |
+---------------------------------------------------------------+
| +------------------------------+ +-----------------------+  |
| | react-force-graph-2d         | | Node / Edge Details   |  |
| | Canvas fills container       | | or Filters Panel      |  |
| |                              | | (320px fixed width)   |  |
| | [Zoom +] [Zoom -] [Fit]    | |                       |  |
| +------------------------------+ +-----------------------+  |
+---------------------------------------------------------------+
```

**Sections:**
| Section | Purpose | Key Elements |
|---------|---------|--------------|
| Header | Title + search + stats | h1, search input, node/edge count |
| Legend | Relation type colors | Horizontal wrap of w-3 h-0.5 bars + labels |
| Graph Canvas | Force-directed graph | react-force-graph-2d filling flex-1 container |
| Right Panel | Details or filters | 320px fixed width, scrollable |

**Components:**
- `ForceGraph` — Third-party react-force-graph-2d, replaces custom Canvas
- `GraphDetailPanel` — Custom, shows node/edge details or filter controls
- `ZoomControls` — Custom, 3 buttons stacked bottom-right of canvas

**States:**
- **Loading:** Centered spinner inside canvas container
- **Empty:** "No graph data yet. Ingest conversations to build the graph." with hub icon
- **Error:** Inline error banner
- **Node selected:** Right panel shows node details (badges, confidence bar, tags, connected edges)
- **Edge selected:** Right panel shows edge details (relation type, source/target, description)
- **Nothing selected:** Right panel shows filters (depth slider, type toggles, relation toggles)

**Interactions:**
- Node click: select node, open detail panel, highlight connected edges
- Edge click: select edge, open edge detail panel
- Node drag: reposition node (built-in)
- Canvas drag: pan view
- Wheel: zoom in/out
- Zoom controls: + (1.2x), - (0.8x), Fit (reset)
- Search input: dim non-matching nodes to opacity 0.2
- Filter toggles: toggle visibility of node types / relation types

**Node Styling (react-force-graph-2d):**
- Node color: NODE_COLORS[memory_type] or #908fa0
- Node size: 18 + (access_count || 0) * 0.5
- Selected node glow: outer ring same color at opacity 0.2, radius + 8px
- Label: 10px JetBrains Mono, #e4e1ed, truncated to 20 chars
- Dimmed nodes: opacity 0.2

**Edge Styling:**
- Color: EDGE_COLORS[relation_type] or #6b7280
- Width: 1.5px (3px if selected)
- Arrowhead: 5px at target boundary
- Dimmed edges: opacity 0.2

---

### 2.3 Review Queue (`app/review/page.tsx`)

**Purpose:** Human-in-the-loop approval workflow for extracted memories.

**Layout:**
```
+---------------------------------------------------------------+
| Review Queue              [N Pending]                         |
| Review extracted memories before they are committed           |
+---------------------------------------------------------------+
| [Approve High Conf] [Reject Low Conf]                         |
+---------------------------------------------------------------+
| +-----------------------------------------------------------+|
| | [type badge] [scope badge] [time]        [0.85 conf]      ||
| | Memory content text...                                    ||
| | Tags: tag1 tag2                                           ||
| | [Find similar existing memories] -> expandable list       ||
| |                                                     ------||
| | [Defer] [Reject] [Edit & Approve] [Approve]               ||
| +-----------------------------------------------------------+|
| ... (repeat for each pending memory)                        |
+---------------------------------------------------------------+
```

**Sections:**
| Section | Purpose | Key Elements |
|---------|---------|--------------|
| Header | Title + count + description | h1, pending count badge, subtitle |
| Bulk Actions | Batch approve/reject | "Approve High Conf" (>=0.85), "Reject Low Conf" (<0.3) |
| Memory Cards | Individual review items | Type badge, scope badge, timestamp, confidence, content, tags, similar search, action buttons |

**Components:**
- `ReviewCard` — Custom
- `RejectReasonModal` — Existing, preserve
- `SimilarMemoryList` — Inline expandable

**States:**
- **Loading:** Centered spinner
- **Empty:** "All Clear!" with check_circle icon in #4ade80, subtitle "No memories pending review."
- **Error:** Inline error banner (not console.error)
- **Card expanded (similar):** Shows similar memories or "No similar memories found."
- **Reject modal open:** Modal with reason input

**Interactions:**
- **CRITICAL FIX:** "Edit & Approve" button MUST have an onClick handler. Behavior: open edit modal pre-populated with memory content, on save -> call memoriesApi.approve(id) with edited content, then reload.
- Approve button: bg-[#4ade80] text-[#0d0d15] hover:bg-[#22c55e]
- Reject button: bg-[#93000a] text-[#ffb4ab] hover:bg-[#93000a]/80
- Defer button: text-[#908fa0] hover:text-[#c7c4d7] (no-op)
- Edit & Approve button: border border-[#3b82f6] text-[#3b82f6] hover:bg-[#3b82f6]/10
- All buttons MUST have cursor-pointer

---

### 2.4 Memory Repository (`app/memories/page.tsx`)

**Purpose:** Browse, search, filter, and manage all stored memories with TanStack Table.

**Layout:**
```
+---------------------------------------------------------------+
| Memory Repository                                             |
| Manage and curate extracted knowledge fragments.              |
+---------------------------------------------------------------+
| [Search input]            [Semantic toggle]                   |
+---------------------------------------------------------------+
| [Status] [Type] [Scope] [Project] [Confidence] [Date] [Sort] |
+---------------------------------------------------------------+
| [Bulk Actions Bar (conditional)]                              |
+---------------------------------------------------------------+
| [Data Table — TanStack Table]                                 |
| [Pagination]                                                  |
+---------------------------------------------------------------+
```

**Sections:**
| Section | Purpose | Key Elements |
|---------|---------|--------------|
| Header | Title + description | h1, subtitle |
| Search | Text + semantic toggle | Search input with icon, semantic search toggle |
| Filters | Multiple dropdowns | Status, Type, Scope, Project, Confidence, Date range, Sort |
| Bulk Actions Bar | Appears on selection | Approve, Reject, Delete actions |
| Data Table | TanStack Table grid | Checkbox, Content, Type, Scope, Confidence (mini bar), Tags, Created |
| Pagination | Page navigation | Row range display, prev/next buttons |

**Components:**
- `MemoryTable` — TanStack Table v8 headless, styled with Tailwind/shadcn
- `FilterBar` — Custom, collection of shadcn/ui Select components
- `BulkActionsBar` — Custom, appears when selected.size > 0
- `MemoryDetailModal` — Existing, preserve
- `EditMemoryModal` — Existing, preserve

**States:**
- **Loading:** Centered spinner inside table container
- **Empty:** "No memories found" in #908fa0
- **Error:** Inline error banner
- **Row selected:** Row bg changes to bg-[#c0c1ff]/5
- **Bulk active:** Floating bar with action buttons above table

**Interactions:**
- Row click -> open MemoryDetailModal
- Checkbox click -> toggle selection (stops propagation)
- Sort header click -> toggle ascending/descending
- Filter change -> triggers reload, no layout shifts
- Semantic toggle -> switches from memoriesApi.list() to memoriesApi.search()

**TanStack Table Configuration:**
- Columns: select (checkbox), content, memory_type, scope, confidence_score, tags, created_at
- Default sort: created_at descending
- Page size: 50
- No multi-sort
- Row selection: controlled via useState<Set<string>>

---

### 2.5 Settings (`app/settings/page.tsx`)

**Purpose:** Configure providers, agents, extraction, auto-approve, lifecycle, plugin, and data management.

**Layout:**
```
+---------------------------------------------------------------+
| Settings                                                      |
| Configure system behavior and integrations                    |
+---------------------------------------------------------------+
| [Providers] [Extraction] [Auto-Approve] [Lifecycle] [Plugin] [Data]|
+---------------------------------------------------------------+
| [Tab content — preserved from Phase 1, wrapped in cards]  |
+---------------------------------------------------------------+
```

**Sections:**
| Section | Purpose | Key Elements |
|---------|---------|--------------|
| Tab Navigation | 6 settings categories | Horizontal tab row, active indicator |
| Tab Content | Preserved from Phase 1 | Provider cards, Agent Routing, Usage logs, Extraction config, Auto-Approve, Lifecycle, Plugin, Data |

**Components:**
- `SettingsTabs` — shadcn/ui Tabs, horizontal
- `ProviderCard` — Custom (existing), styled with shadcn Card tokens
- `AgentRoutingSection` — Custom (existing), preserve dropdown linkage state
- `UsageLogTable` — Migrate to TanStack Table
- `ConfigCard` — Custom wrapper for settings groups
- `Toggle` — Replace inline Toggle with shadcn/ui Switch
- `ProviderConfigModal` — Existing, preserve
- `ConfirmPurgeModal` — Existing, preserve

**States:**
- **Loading:** Centered spinner
- **Empty (Providers):** "No providers configured yet." with cloud_off icon
- **Empty (Usage Logs):** "No usage logs found."
- **Tab switch:** Instant, no loading spinner
- **Provider test:** Inline result banner (green/red)
- **Agent test:** Inline result banner (green/red)
- **Delete confirm:** Modal dialog (preserve existing)
- **Purge confirm:** ConfirmPurgeModal (preserve existing)

**Interactions:**
- Tab click -> instant switch, active tab has border-[#c0c1ff] text-[#c0c1ff] underline
- Provider card hover: hover:border-[#c0c1ff]/30
- Test Connection button: shows spinner while testingIds.has(id), then result banner
- Toggle provider: shadcn/ui Switch replaces inline Toggle
- Save Routing: primary button with spinner while routingSaving
- All form inputs: focus ring focus:border-[#c0c1ff]

**CRITICAL PRESERVATION:**
- The Provider Vault -> Agent Routing dropdown linkage (Provider IDs in agent primary/fallback selects) MUST remain functional. The agents state structure and handlePrimaryChange / handleFallbackChange / handleSaveRouting logic MUST be preserved exactly.

---

### 2.6 Extraction Jobs (`app/jobs/page.tsx`)

**Purpose:** Monitor and manage background extraction pipeline jobs.

**Layout:**
```
+---------------------------------------------------------------+
| Extraction Jobs                 [Refresh] [Retry All Failed] |
| Background memory extraction pipeline                         |
+---------------------------------------------------------------+
| [Total] [Pending] [Processing] [Failed] [Avg Time] [Last]   |
+---------------------------------------------------------------+
| [All] [pending] [processing] [completed] [failed] [cancelled]|
+---------------------------------------------------------------+
| [Job Table]                                                   |
+---------------------------------------------------------------+
```

**Sections:**
| Section | Purpose | Key Elements |
|---------|---------|--------------|
| Header | Title + actions | h1, Refresh button, Retry All Failed button |
| Stats | Job metrics | 6 stat cards |
| Status Filter | Quick filter tabs | Horizontal button group |
| Job Table | Job listing | Native table (TanStack migration optional) |

**Components:**
- `JobStatCard` — Reuse StatCard pattern
- `StatusFilter` — Custom horizontal button group
- `JobTable` — Native table

**States:**
- **Loading:** Centered spinner
- **Empty:** "No jobs found" in #908fa0
- **Error:** Inline error banner
- **Filter active:** Selected filter button has bg-[#c0c1ff]/20 border-[#c0c1ff] text-[#c0c1ff]

**Interactions:**
- Refresh button: reloads data
- Retry All Failed: bordered warning style, hover:bg-[#ffb4ab]/10
- Status filter: click sets filter, resets to page 1
- Retry (per job): visible only on failed status
- Cancel (per job): visible only on pending status
- All action buttons MUST have cursor-pointer

---

### 2.7 Navigation Sidebar (`components/layout/Sidebar.tsx`)

**Purpose:** Primary navigation for all dashboard pages.

**Layout:**
```
+----------+
| [V]      |
| Victorious|
| Memory   |
| Engine   |
+----------+
| Dashboard|
| Memories |
| Review [3]|
| Projects |
| Graph    |
| Activity |
| Jobs     |
| Exchanges|
+----------+
| Settings |
+----------+
```

**Sections:**
| Section | Purpose | Key Elements |
|---------|---------|--------------|
| Logo | Brand identity | "V" badge (bg-[#c0c1ff] text-[#1000a9]), "Victorious Memory Engine" |
| Main Nav | Primary pages | 8 links with Material Symbols icons |
| Bottom Nav | Settings | 1 link, separated by border |

**States:**
- **Active link:** border-l-4 border-[#c0c1ff] bg-[#3e495d]/30 text-[#aeb9d0], icon has fill class
- **Inactive link:** border-transparent text-[#c7c4d7] hover:bg-[#292932] hover:text-[#e4e1ed]
- **Pending badge:** bg-[#ffb4ab] text-[#93000a] rounded-full, only on Review Queue when pendingCount > 0

**Interactions:**
- Hover: transition-colors duration-200, bg changes to #292932
- Active indicator: left border 4px #c0c1ff
- Pending count badge: auto-fetches on mount
- All links MUST have cursor-pointer

---

### 2.8 TopBar (`components/layout/TopBar.tsx`)

**Purpose:** Global actions — create memory, search, notifications.

**Layout:**
```
+---------------------------------------------------------------+
| Victorious Memory    [Search input]    [+ Create Memory] [bell]|
+---------------------------------------------------------------+
```

**Sections:**
| Section | Purpose | Key Elements |
|---------|---------|--------------|
| Brand | Title | "Victorious Memory" text, text-[24px] font-black |
| Global Search | Semantic search | Input with search icon, placeholder "Semantic Search..." |
| Create Memory | Quick action | Primary button, opens CreateMemoryModal |
| Notifications | Activity feed | Bell icon with red dot, dropdown on click |

**States:**
- **Notification dropdown open:** absolute right-0 top-full mt-2 w-80 bg-[#1e293b] border border-[#464554] rounded-lg shadow-2xl z-50
- **No notifications:** "No recent notifications"
- **Has notifications:** List of activity items

**Interactions:**
- Search input: focus:ring-1 focus:ring-[#c0c1ff], placeholder #c7c4d7
- Create Memory button: bg-[#c0c1ff] hover:bg-[#e1e0ff] text-[#1000a9]
- Notifications bell: red dot bg-[#ffb4ab] w-2 h-2 absolute positioned
- Notification items: hover:bg-[#292932] transition-colors cursor-pointer

---

## 3. Design System

### 3.1 Colors

All colors from existing Tailwind config. Do NOT introduce new colors.

| Token | Hex | Tailwind Class | Usage |
|-------|-----|----------------|-------|
| Primary | #c0c1ff | text-primary, bg-primary | Active nav, buttons, links, badges |
| Primary Hover | #e1e0ff | hover:text-[#e1e0ff] | Button/link hover |
| Primary Container | #8083ff | bg-[#8083ff] | Secondary accents, donut segments |
| Secondary | #bcc7de | text-secondary | Secondary text, progress bars |
| Surface | #13131b | bg-background | Page background |
| Surface Low | #1b1b23 | bg-[#1b1b23] | Sidebar background |
| Surface Container | #1f1f27 | bg-[#1f1f27] | Card backgrounds |
| Surface Container High | #292932 | bg-[#292932] | Hover backgrounds, header bars |
| Surface Container Highest | #34343d | bg-[#34343d] | Badge backgrounds |
| Surface Bright | #393841 | bg-[#393841] | Elevated surfaces |
| Surface Lowest | #0d0d15 | bg-[#0d0d15] | Input backgrounds, graph canvas |
| Text Primary | #e4e1ed | text-foreground | Headings, body text |
| Text Secondary | #c7c4d7 | text-muted-foreground | Labels, descriptions |
| Text Tertiary | #908fa0 | text-[#908fa0] | Meta text, placeholders |
| Error | #ffb4ab | text-destructive | Errors, reject buttons |
| Error Container | #93000a | bg-[#93000a] | Error button backgrounds |
| Success | #4ade80 | text-success | Approve buttons, healthy status |
| Success Dim | #22c55e | bg-[#22c55e] | Success hover |
| Warning | #f97316 | text-warning | Warnings |
| Info | #3b82f6 | text-info | Info badges |
| Border | #464554 | border-border | Dividers, inputs, card borders |
| Ring Focus | #c0c1ff | ring-[#c0c1ff] | Focus rings |

**Migration Note:** Standardize cards from bg-[#1e293b] to bg-[#1f1f27] for MD3 consistency. Old values acceptable as fallback.

### 3.2 Typography

| Token | Font | Size | Weight | Line Height | Letter Spacing | Usage |
|-------|------|------|--------|-------------|----------------|-------|
| H1 | Inter | 30px | 600 | 38px | -0.02em | Page titles |
| H2 | Inter | 24px | 600 | 32px | -0.01em | Section headers |
| H3 | Inter | 18px | 600 | 26px | — | Card titles, panel headers |
| Body | Inter | 14px | 400 | 20px | — | Paragraphs, descriptions |
| Body Small | Inter | 13px | 400 | 18px | — | Secondary text |
| Caption | Inter | 12px | 400 | 16px | — | Timestamps, helper text |
| Label | Inter | 11px | 700 | 16px | 0.05em | Uppercase labels |
| Badge | JetBrains Mono | 10px | 700 | 16px | 0.05em | Tags, badges |
| Stat Value | JetBrains Mono | 24px | 700 | 32px | — | Stat card numbers |
| Mono Data | JetBrains Mono | 13px | 400 | 20px | — | IDs, scores |
| Code | JetBrains Mono | 13px | 400 | 20px | — | Inline code |

### 3.3 Spacing Scale

Base unit: 4px (0.25rem)

| Token | Value | Tailwind | Usage |
|-------|-------|----------|-------|
| xs | 4px | p-1, gap-1 | Tight gaps |
| sm | 8px | p-2, gap-2 | Inner padding |
| md | 12px | p-3 | Button padding |
| lg | 16px | p-4, gap-4 | Card padding |
| xl | 24px | p-6, gap-6 | Page sections |
| 2xl | 32px | p-8 | Major divisions |

**Layout Constants:**
- Sidebar width: 260px
- Main margin-left: ml-[260px]
- Main max-width: 1600px
- Main padding: p-6 (24px)

### 3.4 Border Radius

| Token | Value | Tailwind | Usage |
|-------|-------|----------|-------|
| DEFAULT | 0.125rem (2px) | rounded | Buttons, inputs, badges |
| lg | 0.25rem (4px) | rounded-lg | Cards, panels, modals |
| xl | 0.5rem (8px) | rounded-xl | Larger cards, dropdowns |
| full | 0.75rem (12px) | rounded-full | Pills, badges |

Note: full is 12px, not 9999px.

### 3.5 Shadows / Elevation

Border-based elevation (intentional for dark aesthetic):

| Token | Value | Usage |
|-------|-------|-------|
| Card | border border-[#464554] | Default card elevation |
| Card Hover | hover:border-[#c0c1ff]/30 | Elevated card on hover |
| Dropdown | shadow-2xl | Notifications dropdown, modals |
| Glow | box-shadow: 0 4px 20px rgba(192, 193, 255, 0.08) | hover-glow class |

### 3.6 Z-Index Layers

| Layer | Z-Index | Elements |
|-------|---------|----------|
| Base | 0 | Page content |
| Sticky | 10 | TopBar |
| Sidebar | 20 | Sidebar |
| Dropdown | 50 | Notifications dropdown |
| Modal | 50 | Modals, dialog backdrops |
| Toast | 60 | Toast notifications (if added) |

---

## 4. Component Library

### 4.1 Adopted from shadcn/ui

Install via `npx shadcn@latest init` in apps/web/, then copy components.

| Component | Location | Customizations |
|-----------|----------|----------------|
| Button | components/ui/button.tsx | Variants: default (primary #c0c1ff bg, #1000a9 text), secondary (bordered), destructive (#93000a bg), ghost. Size: sm, md, lg. Radius: rounded (2px). |
| Card | components/ui/card.tsx | Background: #1f1f27, border: #464554, radius: rounded-lg (4px). No shadow. |
| Dialog | components/ui/dialog.tsx | Backdrop: bg-black/60, content: bg-[#1f1f27] border border-[#464554] rounded-lg. Animation: scale-in 150ms. |
| Input | components/ui/input.tsx | Background: #0d0d15, border: #464554, text: #e4e1ed, placeholder: #c7c4d7, focus: border-[#c0c1ff] ring-1 ring-[#c0c1ff], radius: rounded (2px). |
| Label | components/ui/label.tsx | Font: 11px uppercase, weight 700, letter-spacing 0.05em, color: #908fa0. |
| Select | components/ui/select.tsx | Trigger: same as Input. Content: bg-[#1f1f27] border-[#464554]. Item hover: bg-[#292932]. |
| Tabs | components/ui/tabs.tsx | List: horizontal, border-bottom #464554. Trigger: text-[#c7c4d7], active: border-b-2 border-[#c0c1ff] text-[#c0c1ff]. |
| Switch | components/ui/switch.tsx | Track: #464554, checked: #4ade80, thumb: white. |
| Checkbox | components/ui/checkbox.tsx | Border: #464554, checked: bg-[#c0c1ff] border-[#c0c1ff], checkmark: #1000a9. |
| Tooltip | components/ui/tooltip.tsx | Content: bg-[#34343d] border-[#464554] text-[#e4e1ed] text-[12px], delay: 200ms. |
| Badge | components/ui/badge.tsx | Variants: default (bg-[#c0c1ff]/10 border-[#c0c1ff] text-[#c0c1ff]), secondary (bg-[#292932] border-[#464554]), destructive (bg-[#ffb4ab]/10 border-[#ffb4ab]), success (bg-[#4ade80]/10 border-[#4ade80]). Font: JetBrains Mono 10px uppercase. |

### 4.2 Custom Components

| Component | Location | Purpose |
|-----------|----------|---------|
| StatCard | app/page.tsx (inline) | Dashboard metric cards |
| DonutChart | app/page.tsx (inline) | CSS conic gradient chart |
| ReviewCard | app/review/page.tsx (inline) | Review queue memory cards |
| EmptyState | New: components/EmptyState.tsx | Reusable empty state |
| ErrorBanner | New: components/ErrorBanner.tsx | Reusable error display |
| LoadingSpinner | New: components/LoadingSpinner.tsx | Reusable spinner |
| GraphDetailPanel | app/graph/page.tsx (inline) | Node/edge details or filters |
| ZoomControls | app/graph/page.tsx (inline) | Graph zoom buttons |

### 4.3 Third-Party

| Library | Components | Usage |
|---------|------------|-------|
| react-force-graph-2d | ForceGraph2D | Graph Explorer page |
| @tanstack/react-table | useReactTable, flexRender | Memory Repository, Usage Logs tables |
| @radix-ui/react-* (via shadcn) | Primitives | All shadcn/ui components |

---

## 5. Interactions & Animations

### 5.1 Hover States

| Element | Duration | Easing | Transform | Other |
|---------|----------|--------|-----------|-------|
| Button (primary) | 150ms | ease-out | translateY(-1px) | — |
| Button (bordered) | 150ms | ease-out | — | bg opacity change |
| Card (stat) | 300ms | cubic-bezier(0.16, 1, 0.3, 1) | translateY(-2px) | box-shadow glow |
| Card (review) | 300ms | cubic-bezier(0.16, 1, 0.3, 1) | — | hover:border-[#c0c1ff]/30 |
| Nav link | 200ms | ease-in-out | — | bg-[#292932] |
| Activity item | 300ms | ease-in-out | translateX(4px) | bg-[#334155]/40 |
| Table row | 150ms | ease-out | — | bg-[#334155]/20 |
| Icon in stat card | 300ms | ease-out | scale(1.25) | — |
| Donut chart | 500ms | ease-out | scale(1.05) | — |

### 5.2 Focus States

| Element | Ring | Offset | Color |
|---------|------|--------|-------|
| Input | 1px | 0px | ring-[#c0c1ff] |
| Button | 2px | 2px | ring-[#c0c1ff] ring-offset-2 ring-offset-[#13131b] |
| Select | 1px | 0px | ring-[#c0c1ff] |
| Checkbox | 2px | 2px | ring-[#c0c1ff] |
| Nav link | 2px | 2px | `focus-visible:ring-2 focus-visible:ring-[#c0c1ff] focus-visible:ring-offset-2 focus-visible:ring-offset-[#13131b]` + `focus-visible:bg-[#292932]` for dual indicator |

### 5.3 Active / Pressed States

| Element | Transform | Color Change |
|---------|-----------|--------------|
| Button | scale(0.98) | Slightly darker bg |
| Card | — | Border color intensifies |
| Nav link | — | Active styles apply immediately |

### 5.4 Page Transitions

No explicit page transitions. Rely on:
- Content enter: fade-in-up animation (0.6s, cubic-bezier(0.16, 1, 0.3, 1))
- Stagger: delay-100 through delay-800 for sequential cards
- No exit animations

### 5.5 Loading States

| Pattern | Element | Implementation |
|---------|---------|----------------|
| Page spinner | Full page/block | progress_activity + animate-spin + text-[#c0c1ff] |
| Button spinner | Async buttons | Same icon, text-[16px], replaces button text/icon |
| Skeleton | Cards, tables | shimmer class — `linear-gradient(90deg, transparent, rgba(255,255,255,0.03) 20%, rgba(255,255,255,0.08) 60%, transparent)` animated via `translateX(-100%) -> translateX(100%)`, 2.5s infinite. Already defined in `globals.css`. |
| Inline spinner | Table refresh | Same page spinner, centered in table body |
| Progress bar | Stat cards | progress-fill class — `width: 0 -> var(--target-width)`, 1.2s `cubic-bezier(0.16, 1, 0.3, 1)`. Already defined in `globals.css`. |

### 5.6 Toast / Notifications

DEFERRED — No toast system in current codebase. Errors shown inline or in modals.

### 5.7 Modal / Dialog Animations

| Action | Animation | Duration |
|--------|-----------|----------|
| Open | Backdrop fade in, content scale in (0.95->1) + fade | 150ms |
| Close | Content fade out, backdrop fade out | 100ms |
| Backdrop | bg-black/60, click-to-close enabled | Static |

---

## 6. Responsive Behavior

### 6.1 Breakpoints

| Name | Width | Tailwind Prefix |
|------|-------|-----------------|
| Mobile | < 640px | Default |
| Tablet | 640px+ | sm: |
| Desktop | 1024px+ | lg: |
| Wide | 1280px+ | xl: |

### 6.2 Desktop-First Strategy

- Base styles target desktop (1024px+).
- Sidebar always visible at 260px width on desktop.
- Main content always has ml-[260px].
- Do NOT add new mobile-specific layouts.

### 6.3 Collapse Behavior

| Element | Desktop | Tablet | Mobile |
|---------|---------|--------|--------|
| Sidebar | Expanded 260px fixed | Expanded 260px fixed | Out of scope |
| Tables | Full grid layout | Full grid layout | Out of scope |
| Stat cards | 6 columns | 3 columns (lg:) | Out of scope |
| Graph panel | Canvas + 320px sidebar | Same | Out of scope |

---

## 7. Accessibility

### 7.1 ARIA Patterns

| Component | Pattern | Required ARIA |
|-----------|---------|---------------|
| Modal/Dialog | Dialog | role="dialog", aria-modal="true", aria-labelledby |
| Tabs | Tablist | role="tablist", role="tab", role="tabpanel", aria-selected |
| Select (shadcn) | Listbox | role="listbox", aria-expanded, aria-activedescendant |
| Table | Grid | role="grid" or semantic table, scope="col" |
| Checkbox | Checkbox | role="checkbox", aria-checked |
| Switch | Switch | role="switch", aria-checked |
| Tooltip | Tooltip | role="tooltip" |

### 7.2 Keyboard Navigation

| Component | Tab Order | Shortcuts |
|-----------|-----------|-----------|
| Modal | Focus trap, initial focus on primary action | Escape to close |
| Table | Tab through focusable elements | Arrow keys for cells |
| Tabs | Tab enters tablist, arrow keys switch | Left/Right to switch, Enter to activate |
| Dropdown | Tab to trigger, Up/Down to navigate, Enter to select | Escape to close |

### 7.3 Focus Management

- Initial page focus: No autofocus; natural tab order.
- Modal open focus: Focus moves to modal or first interactive element.
- Modal close focus: Focus returns to triggering element.
- Visible focus ring: All interactive elements MUST show visible focus indicator. Use ring-[#c0c1ff] with ring-offset-2 ring-offset-[#13131b].
- Skip link: DEFERRED.

### 7.4 Color Contrast

| Combination | Ratio | WCAG Level |
|-------------|-------|------------|
| Text Primary (#e4e1ed) / Background (#13131b) | ~14.5:1 | AAA |
| Text Secondary (#c7c4d7) / Background (#13131b) | ~10.2:1 | AAA |
| Text Tertiary (#908fa0) / Background (#13131b) | ~5.8:1 | AA |
| Primary (#c0c1ff) / On-Primary (#1000a9) | ~7.2:1 | AA |
| Success (#4ade80) / Background (#13131b) | ~11.3:1 | AAA |
| Error (#ffb4ab) / Background (#13131b) | ~10.8:1 | AAA |
| Warning (#f97316) / Background (#13131b) | ~7.5:1 | AA |

All text combinations meet WCAG 2.1 AA minimum.

### 7.5 Screen Reader

- All icon-only buttons MUST have aria-label.
- All images and decorative icons MUST have appropriate alt or aria-hidden.
- Live regions for dynamic updates: Add aria-live="polite" to pending count badge, bulk actions bar, test result banners.

---

## 8. Copy & Microcopy

### 8.1 Button Labels

| Action | Label | Context |
|--------|-------|---------|
| Primary action | Approve | Review queue |
| Destructive action | Reject | Review queue |
| Secondary action | Defer | Review queue (no-op) |
| Edit action | Edit & Approve | Review queue |
| Bulk approve | Approve High Conf | Review queue header |
| Bulk reject | Reject Low Conf | Review queue header |
| Create | Create Memory | TopBar |
| Save | Save Routing | Settings -> Agent Routing |
| Test | Test Connection | Settings -> Provider card |
| Export | Export All Data | Settings -> Data tab |
| Import | Click or drop files here | Settings -> Data tab |
| Danger | Purge All Data | Settings -> Data tab |
| Retry | Retry | Jobs table |
| Cancel | Cancel | Jobs table, all modals |
| Refresh | Refresh | Jobs page header |
| Retry All | Retry All Failed | Jobs page header |
| View All | View All | Dashboard activity feed |
| Find Similar | Find similar existing memories | Review queue card |

### 8.2 Empty States

| Page/Component | Message | CTA |
|----------------|---------|-----|
| Dashboard Activity | No recent activity | None |
| Dashboard Donut | No data yet | None |
| Review Queue | All Clear! / No memories pending review. | None |
| Memory Repository | No memories found | Clear filters button if filters active |
| Graph Explorer | No graph data yet. Ingest conversations to build the graph. | None |
| Jobs | No jobs found | None |
| Settings Providers | No providers configured yet. | Add from Template / Add Custom buttons |
| Settings Usage Logs | No usage logs found. | None |
| Notifications | No recent notifications | None |

### 8.3 Error Messages

CRITICAL FIX: Replace all console.error with user-facing error UI.

| Scenario | Message | Recovery |
|----------|---------|----------|
| Dashboard load failed | Failed to load dashboard data. Please try again. | Retry button |
| Review queue load failed | Failed to load review queue. | Retry button |
| Memory list failed | Failed to load memories. | Retry button |
| Graph load failed | Failed to load graph data. | Retry button |
| Jobs load failed | Failed to load jobs. | Retry button |
| Settings load failed | Failed to load settings. | Retry button |
| Approve failed | Failed to approve memory. Please try again. | Inline, auto-dismiss |
| Reject failed | Failed to reject memory. | Inline, auto-dismiss |
| Provider test failed | Shows error message from API | Inline banner on card |
| Agent test failed | Shows error message from API | Inline banner on card |
| Delete provider failed | Delete failed: {message} | Alert (preserve existing) |
| Save routing failed | Save routing failed: {message} | Alert (preserve existing) |
| Export failed | Export error: {message} | Alert (preserve existing) |
| Import failed | Error: {message} | Inline text below dropzone |
| Purge failed | Error: {message} | Alert (preserve existing) |

Error Banner Component:
- Background: bg-[#ffb4ab]/10 border-[#ffb4ab]
- Text: text-[#ffb4ab]
- Icon: error Material Symbol
- Position: Inline at top of page or within card

### 8.4 Confirmation Dialogs

| Action | Title | Body | Confirm / Cancel |
|--------|-------|------|------------------|
| Delete Provider | Delete Provider | Are you sure you want to delete this provider? This action cannot be undone. | Delete / Cancel |
| Purge All Data | Purge All Data | Permanently delete all memories, edges, exchanges, jobs, and projects. This cannot be undone. | Purge / Cancel |
| Bulk Delete Memories | Delete Memories | Are you sure you want to delete {N} selected memories? | Delete / Cancel |
| Reject Memory | Reject Memory | Reason input + This memory will be marked as rejected. | Reject / Cancel |

### 8.5 Tooltips

| Element | Tooltip Text |
|---------|--------------|
| Edit icon (provider) | Edit provider configuration |
| Delete icon (provider) | Delete provider |
| Test icon | Test connection |
| Retry icon (job) | Retry job |
| Cancel icon (job) | Cancel job |
| Zoom in (graph) | Zoom in |
| Zoom out (graph) | Zoom out |
| Fit view (graph) | Fit to screen |
| Confidence bar | Confidence score: {value} |

---

## 9. Iconography

### 9.1 Icon Library

Primary: Material Symbols Outlined (Google font) — already loaded in layout.tsx and globals.css.

Do NOT switch to Lucide or Heroicons. The entire codebase uses Material Symbols.

### 9.2 Size Mapping

| Context | Size | Tailwind / CSS |
|---------|------|----------------|
| Inline text | 16px | text-[16px] |
| Buttons | 16px | text-[16px] |
| Navigation | 24px (default) | Material Symbols default opsz: 24 |
| Card headers | 18px | text-[18px] |
| Empty states | 48px (text-6xl) | text-6xl |
| Loading spinners | 36-48px | text-3xl to text-4xl |

### 9.3 Color Rules

- Default: text-[#c7c4d7]
- Active/Selected: text-[#c0c1ff] or text-[#aeb9d0]
- Error: text-[#ffb4ab]
- Success: text-[#4ade80]
- Warning: text-[#f97316]
- Info: text-[#3b82f6]

Filled state: Add fill class to Material Symbols for active/selected nav items.

---

## 10. Data Display

### 10.1 Table Specifications

| Table | Columns | Default Sort | Pagination |
|-------|---------|--------------|------------|
| Memory Repository | Checkbox, Content, Type, Scope, Confidence, Tags, Created | Created desc | 50 rows/page |
| Usage Logs | Agent, Provider, Model, Tokens, Latency, Status | Created desc | 50 rows/page |
| Extraction Jobs | Job ID, Exchange, Status, Attempts, Error, Created, Duration, Actions | Created desc | 50 rows/page |

### 10.2 Sorting Behavior

- Click header -> toggle ascending/descending
- Multi-sort: Not supported
- Default: Created descending
- Sort indicator: Chevron icon or color change on active header

### 10.3 Pagination

- Style: Page numbers with prev/next arrows
- Page size: 50 rows (fixed for now)
- Position: Below table, right-aligned
- Row range display: "(page-1)*perPage+1 - min(page*perPage, total) of total"

### 10.4 Filters

| Table | Filter Fields | UI Pattern |
|-------|---------------|------------|
| Memory Repository | Status, Type, Scope, Project, Confidence, Date | Dropdown selects (shadcn/ui Select) |
| Usage Logs | Agent role | Dropdown select |
| Extraction Jobs | Status | Horizontal button group |

### 10.5 Date/Time Formatting

| Context | Format | Example |
|---------|--------|---------|
| Relative | {N}m/h/d ago | 2m ago, 3h ago, 1d ago |
| Absolute short | MMM DD, YYYY | Jan 15, 2024 |
| Absolute long | MMMM DD, YYYY HH:mm | January 15, 2024 14:30 |

### 10.6 Number Formatting

| Context | Format | Example |
|---------|--------|---------|
| Counts | 1,234 | 1,234 memories |
| Percentages | 12.3% | 98.5% |
| Confidence | 0.00-1.00 | 0.85 |
| Duration | 1.2s / 3.4m | 2.5s |

---

## 11. Forms & Inputs

### 11.1 Validation Patterns

| Field Type | Rules | Error Message |
|------------|-------|---------------|
| Required | Field must not be empty | {Field} is required |
| URL | Valid URL format | Please enter a valid URL |
| Number | Within min/max bounds | Must be between {min} and {max} |
| API Key | Non-empty string | API key is required |

### 11.2 Error Display

- Inline below field
- Red text: text-[#ffb4ab]
- Icon: error Material Symbol

### 11.3 Required Field Indication

- Asterisk (*) next to label
- Color: text-[#ffb4ab]

### 11.4 Helper Text

- Below input, below error if present
- Style: text-[#908fa0], text-sm (13px)

### 11.5 Success States

- Green checkmark icon (check_circle)
- Success message fades after 3 seconds

---

## 12. State Mapping

| UI State | Trigger | Visual |
|----------|---------|--------|
| Initial load | Component mounts | Skeleton screens or spinner |
| Loading more | Pagination/fetch | Inline spinner + disabled button |
| Empty | Data array length === 0 | EmptyState component |
| Error | API error | ErrorBanner inline or error boundary |
| Success | Mutation complete | Inline confirmation or silent refresh |
| Refreshing | Background refetch | Subtle spinner in header |
| Selecting | User selects rows | Row highlight + bulk actions bar |
| Filtering | Filter change | Table reload with spinner, no layout shift |

---

## 13. Deferred Decisions

| Decision | Reason | Resolution Target |
|----------|--------|---------------------|
| Toast notification system | Not in current codebase; errors use inline/modals | Phase 3 or later if needed |
| Skip to content link | Minor accessibility enhancement | Phase 3 or if time permits |
| Virtualized lists for large tables | Performance optimization for future scale | Phase 6 (Architecture Excellence) |
| Mobile-responsive layout | Explicitly out of scope per constraints | Future milestone |
| Graph physics controls (sliders) | P2 feature, not critical for MVP | Phase 3 or backlog |
| Graph preview on dashboard | P2 feature, optional mini force-graph | Phase 3 or backlog |
| Job table TanStack migration | Native table is functional; migrate if time permits | End of Phase 2 if capacity allows |
| Card background migration (#1e293b -> #1f1f27) | Gradual standardization, not blocking | Throughout Phase 2 as files are touched |

---

## 14. Critical Implementation Constraints

**These constraints MUST be reflected in the execution plan (02-PLAN.md).**

### 14.1 react-force-graph-2d — Next.js SSR Guard

`react-force-graph-2d` requires `window` and HTML5 `<canvas>`, which are unavailable during Next.js SSR. A static top-level import will crash the build with `window is not defined`.

**Mandate:** The graph component MUST be imported dynamically with `ssr: false`:

```tsx
import dynamic from 'next/dynamic';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
  ssr: false,
  loading: () => <LoadingSpinner />,
});
```

The planner must allocate a task for this dynamic import wrapper and ensure the graph page is a Client Component (`"use client"`).

### 14.2 shadcn/ui + Tailwind v4 — Theme Configuration Path

The project uses Tailwind CSS v4, which moves theme tokens out of `tailwind.config.ts` into pure CSS `@theme` variables inside `globals.css`. The `npx shadcn@latest init` command is aware of v4, but the planner must verify that generated theme tokens map into the correct CSS layer and do not assume a legacy `tailwind.config.js` exists.

**Mandate:** Verify after `shadcn/ui init` that:
- Color tokens (e.g., `--primary: #c0c1ff`) land in `globals.css` or a CSS theme file.
- The build passes (`npm run build`) without missing Tailwind plugin errors.
- No planner task blindly edits a non-existent `tailwind.config.ts`.

### 14.3 TanStack Table — Client-Side Pagination Default

The UI-SPEC specifies 50 rows/page for tables. Unless the Phase 1 API explicitly supports `page`/`limit` query parameters with server-side pagination, the default strategy for MVP must be **client-side pagination and sorting** using TanStack Table's built-in row models:

```tsx
getPaginationRowModel: getPaginationRowModel(),
getSortedRowModel: getSortedRowModel(),
```

**Mandate:** The planner should:
- Default to client-side pagination/sorting for MVP speed.
- Only switch to server-side pagination if the API contract clearly supports offset/limit parameters for memories and usage logs.
- Document the chosen strategy in the plan so implementors don't waste time wiring server-side APIs that don't exist.

---

*End of UI Design Contract*
