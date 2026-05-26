# Phase 2: Dashboard Redesign - Context

**Gathered:** 2026-05-26
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers a complete UI overhaul of the Victorious Memory V2 web dashboard. It fixes all interactive elements, replaces the inadequate custom graph visualization with a best-in-class library, ensures every button works correctly, and establishes a consistent design language across all pages.

**In scope:**
- Dashboard home page redesign (stat cards, activity feed, donut chart)
- Graph visualization replacement with `react-force-graph-2d`
- Review queue functional improvements (button wiring, error handling)
- Memory repository table stability (no layout shifts when filtering)
- Settings page shell redesign (keep existing 6-tab content)
- Navigation sidebar and routing verification
- Empty states across all pages
- Consistent cursor/hover states for all interactive elements
- Component standardization via shadcn/ui
- Table stability via TanStack Table

**Out of scope:**
- Backend API changes (Phase 1 completed provider API)
- New features or capabilities not listed above
- Memory lifecycle features (Phase 3)
- Deployment/Distribution (Phase 4)
- Documentation/Export (Phase 5)
- Architecture optimizations (Phase 6)
- Mobile-responsive redesign (desktop-first per PROJECT.md)

</domain>

<decisions>
## Implementation Decisions

### Graph Visualization (UX-02 / ARCH-02)
- **D-01:** Adopt `react-force-graph-2d` as the graph rendering library. Delete the existing ~593-line custom Canvas renderer with hand-rolled physics.
- **D-02:** Library provides: Canvas rendering, d3-force physics, zoom/pan, hover tooltips, click handlers, drag, and node/link styling out of the box.
- **D-03:** Existing graph data format (nodes/edges arrays) should adapt cleanly to react-force-graph's expected props.
- **D-04:** Features to wire: node click → memory detail panel, hover tooltip with content preview, type filter, project filter, search-in-graph highlight, reset view button.

### Settings Page (UX-01 / UX-04)
- **D-05:** Redesign the outer shell only (layout, navigation, cards, spacing, typography) — keep all 6 tab contents intact.
- **D-06:** The 6 tabs (Providers, Extraction, Auto-Approve, Lifecycle, Plugin, Data) and their working React state from Phase 1 are preserved.
- **D-07:** Move from basic tab row to a sleeker navigation pattern (sidebar tabs or styled horizontal tabs) that matches the new design language.
- **D-08:** Wrap existing form content in standardized card/container components for visual consistency.

### Component Standardization (UX-01)
- **D-09:** Adopt shadcn/ui via copy-paste components (not npm package dependency). This injects Radix UI primitives styled with Tailwind directly into the codebase.
- **D-10:** Components to adopt: Dialog, Select, Tabs, Card, Button, Input, Label, Switch, Checkbox, Tooltip, Badge.
- **D-11:** Rationale: Eliminates time sink of hand-writing accessible, keyboard-navigable components from scratch. Retains full control since code lives in our repo.
- **D-12:** Pure Tailwind CSS v4 with Material Design 3 dark palette remains the styling foundation; shadcn/ui components adapt to existing theme tokens.

### Table Stability (UX-01 / UX-04)
- **D-13:** Adopt TanStack Table (React Table v8) for all data-grid needs.
- **D-14:** Tables to migrate: Memory repository table, Usage logs table, and any other paginated/filtered lists.
- **D-15:** TanStack Table is headless — handles sorting, pagination, filtering, column resizing math while we style `<table>` elements with Tailwind/shadcn.
- **D-16:** Rationale: Native HTML tables with manual `useState` for sorting/pagination become unmaintainable; TanStack Table is the industry standard for this problem.

### Interactive Element Fixes (UX-04)
- **D-17:** Audit every page for missing `onClick` handlers. Known bug: "Edit & Approve" button in review queue (`apps/web/app/review/page.tsx` lines 229-232) has no handler.
- **D-18:** Ensure all clickable elements have `cursor-pointer` and visible hover states.
- **D-19:** Add loading states to all async operations (button spinners, disabled states).
- **D-20:** Add error handling with user-friendly messages (not just `console.error`).

### Design Language
- **D-21:** Dark mode only (user preference, already implemented).
- **D-22:** Material Design 3 palette via Tailwind v4 extended color tokens (existing — preserve and extend).
- **D-23:** Consistent spacing, border radius, and shadow scales across all pages.
- **D-24:** Empty states for all lists and pages — no blank screens.

### the agent's Discretion
- Exact shadcn/ui component installation method (CLI vs manual copy) — either is acceptable as long as code lands in repo
- Specific animation/transition details beyond existing `@keyframes` in globals.css
- Exact TanStack Table column definitions and default sort behavior
- Specific responsive breakpoints (desktop-first per constraints)
- Exact wording of empty state messages

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Planning
- `.planning/ROADMAP.md` §Phase 2 — Goal, success criteria, and requirements mapping
- `.planning/REQUIREMENTS.md` §Dashboard & UX — UX-01 through UX-04 detailed requirements
- `.planning/PROJECT.md` §Context — Current state, known technical concerns, user preferences
- `.planning/PROJECT.md` §Key Decisions — Prior decisions including dashboard redesign mandate
- `.planning/UI-FEATURES.md` — Full UI feature inventory with priority mapping

### Architecture & Codebase
- `.planning/codebase/ARCHITECTURE.md` — System overview, component responsibilities, patterns, anti-patterns
- `.planning/codebase/CONVENTIONS.md` — Naming patterns, code style, module design
- `.planning/codebase/STRUCTURE.md` — Directory layout and where to add new code
- `.planning/codebase/STACK.md` — Technology stack and dependencies

### Existing Frontend Code
- `apps/web/app/page.tsx` — Dashboard (stat cards, activity feed, donut chart)
- `apps/web/app/graph/page.tsx` — Custom Canvas graph renderer (to be replaced)
- `apps/web/app/review/page.tsx` — Review queue ("Edit & Approve" button bug at lines 229-232)
- `apps/web/app/memories/page.tsx` — Memory repository table (to be migrated to TanStack Table)
- `apps/web/app/settings/page.tsx` — Settings page with 6 tabs (shell redesign, content preserved)
- `apps/web/app/jobs/page.tsx` — Extraction job management
- `apps/web/app/layout.tsx` — Root layout (Sidebar + TopBar + dark mode)
- `apps/web/components/layout/Sidebar.tsx` — Navigation sidebar
- `apps/web/lib/api.ts` — API client patterns
- `apps/web/app/globals.css` — Global styles, Tailwind v4, MD3 dark palette, animations

### Prior Phase Context
- `.planning/phases/01-provider-system-architecture/01-CONTEXT.md` — Provider system decisions that affect settings UI

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/web/lib/api.ts`: Typed `request<T>()` wrapper around fetch — reuse for all API calls
- `apps/web/app/layout.tsx`: Root layout with Sidebar + TopBar + dark mode — preserve structure, style refresh only
- `apps/web/components/layout/Sidebar.tsx`: Navigation with pending count badge — reuse, style refresh
- `apps/web/app/globals.css`: Tailwind v4 + MD3 dark palette + custom animations — extend, don't replace
- Existing donut chart component in `apps/web/app/page.tsx` — evaluate if it needs replacement

### Established Patterns
- Domain triad (router/service/schema) is backend-only; frontend uses page-level components with API calls
- Client-side React state with `useState`/`useEffect` — settings page uses this pattern extensively
- `"use client"` directive for interactive components
- API errors thrown as `new Error(...)` with HTTP status in message
- Components use `export default function` pattern
- Section dividers with `// ─── Name ───` comments
- Color maps and constants defined at module level (e.g., `DONUT_COLORS`)

### Integration Points
- `apps/web/app/graph/page.tsx`: New `react-force-graph-2d` component replaces entire file content; data comes from `/api/graph` and `/api/edges` endpoints (unchanged)
- `apps/web/app/memories/page.tsx`: TanStack Table replaces native HTML table; still calls `memoriesApi.list()` etc.
- `apps/web/app/review/page.tsx`: Fix "Edit & Approve" onClick + wire all buttons correctly; still calls `memoriesApi.approve()` / `memoriesApi.reject()`
- `apps/web/app/settings/page.tsx`: New shell layout wraps existing tab content; preserves all Phase 1 provider/agent state management
- `apps/web/app/page.tsx`: Dashboard refresh — stat cards, activity feed, donut chart styling updates
- `apps/web/components/layout/Sidebar.tsx`: Navigation links must remain correct; style refresh only

### Anti-Patterns to Fix
- Missing `onClick` handler on "Edit & Approve" button (review page)
- Native HTML tables with manual pagination state (memories page)
- ~593 lines of hand-rolled Canvas physics (graph page)
- Inconsistent hover/cursor states across pages
- Missing empty states on several pages
- `console.error()` only — no user-facing error UI

</code_context>

<specifics>
## Specific Ideas

- **Known bug**: `apps/web/app/review/page.tsx` lines 229-232 — "Edit & Approve" button renders but has no `onClick` handler. Must be wired to an appropriate action (likely approve + open edit modal).
- **Graph data format**: Existing graph returns `{ nodes: Node[], edges: Edge[] }` from API. Verify this maps cleanly to react-force-graph's `graphData` prop.
- **Settings state preservation**: The Provider Vault → Agent Routing table dropdown linkage is delicate unified React state. Any shell redesign must preserve this state structure.
- **shadcn/ui installation**: Use `npx shadcn@latest init` in `apps/web/` directory. Accept existing Tailwind v4 config. Copy components into `apps/web/components/ui/`.

</specifics>

<deferred>
## Deferred Ideas

- **Graph physics controls** (gravity, charge, link distance sliders) — P2 feature per UI-FEATURES.md, not critical for MVP
- **Graph preview on dashboard** — P2 feature, optional mini force-graph
- **Virtualized lists** for very large tables — optimization for future scale
- **Notification history panel** — P2 feature from UI-FEATURES.md
- **Data import UI** — explicitly out of scope per PROJECT.md
- **Mobile-responsive layout** — desktop-first per constraints
- **Custom provider schema handling** — no longer needed; LiteLLM handles this

### Reviewed Todos (not folded)
None — no todos were reviewed in cross_reference_todos.

</deferred>

---

*Phase: 2-Dashboard Redesign*
*Context gathered: 2026-05-26*
