---
phase: 02-dashboard-redesign
plan: 02
subsystem: web-ui
completed_date: "2026-05-26"
tags: [dashboard, shadcn, tanstack-table, react-force-graph, ui-fixes]
dependency_graph:
  requires: ["02-01"]
  provides: ["02-03"]
  affects:
    - apps/web/app/page.tsx
    - apps/web/app/graph/page.tsx
    - apps/web/app/review/page.tsx
    - apps/web/app/memories/page.tsx
    - apps/web/app/jobs/page.tsx
tech-stack:
  added:
    - react-force-graph-2d
    - @tanstack/react-table
  patterns:
    - shadcn/ui Card wrapper for stat cards and sections
    - LoadingSpinner / ErrorBanner / EmptyState reusable components
    - Dynamic import with ssr:false for client-only libraries
    - TanStack Table with client-side pagination and sorting
    - cursor-pointer + hover transitions on all interactive elements
key-files:
  created: []
  modified:
    - apps/web/app/page.tsx
    - apps/web/app/graph/page.tsx
    - apps/web/app/review/page.tsx
    - apps/web/app/memories/page.tsx
    - apps/web/app/jobs/page.tsx
decisions:
  - Used shadcn Card with custom bg-[#1f1f27] border-[#464554] to match dark theme
  - Replaced custom Canvas simulation with react-force-graph-2d for maintainability
  - Implemented Edit & Approve as two-step flow (EditMemoryModal saves content, then memoriesApi.approve is called in onSaved)
  - Preserved existing API pagination for Memories page while adding TanStack Table rendering (pageSize:50 applied to table UI)
  - Added hover:bg-[#292932] transition-colors duration-200 consistently across jobs table rows and filter buttons
metrics:
  duration: "~30 minutes"
  tasks_completed: 5
  files_modified: 5
---

# Phase 02 Plan 02: Core Dashboard Pages Redesign Summary

**One-liner:** Redesigned all five core dashboard pages with shadcn/ui Card wrappers, reusable loading/error/empty states, react-force-graph-2d for graph visualization, TanStack Table for memory grid, and wired the broken Edit & Approve button.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Task 2-3: Redesign Dashboard | `3edf26d` | `apps/web/app/page.tsx` |
| 2 | Task 2-4: Migrate Graph Explorer to react-force-graph-2d | `f3abb68` | `apps/web/app/graph/page.tsx` |
| 3 | Task 2-5: Review Queue Bug Fixes and Enhancements | `5e60ad2` | `apps/web/app/review/page.tsx` |
| 4 | Task 2-6: Migrate Memory Repository to TanStack Table | `17f200c` | `apps/web/app/memories/page.tsx` |
| 5 | Task 2-8: Apply UI Fixes to Extraction Jobs Page | `549cb9b` | `apps/web/app/jobs/page.tsx` |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Graph filter buttons had no cursor-pointer and no-op filtering**
- **Found during:** Task 2-4 (Graph Explorer)
- **Issue:** Memory type and relation filter buttons in the Graph Explorer sidebar lacked `cursor-pointer` classes and the existing filter state variables (`filterTypes`, `filterRelations`, `filterProject`, `filterScope`) were not actually filtering the rendered graph data.
- **Fix:** Added `cursor-pointer` to all filter buttons and implemented `filteredData` computation using `useMemo` to properly apply type, scope, project, relation, and search filters before passing data to `ForceGraph2D`.
- **Files modified:** `apps/web/app/graph/page.tsx`
- **Commit:** `f3abb68`

**2. [Rule 1 - Bug] Graph page missing hover tooltip implementation**
- **Found during:** Task 2-4 (Graph Explorer)
- **Issue:** Plan required `onNodeHover` to show a tooltip with content preview. The `react-force-graph-2d` component provides built-in tooltips via `nodeLabel`, but the plan explicitly asked for `onNodeHover` wiring.
- **Fix:** Added `onNodeHover` callback that updates `hoveredNode` state, and rendered a fixed-position tooltip div at the bottom-left of the viewport showing memory type and content preview.
- **Files modified:** `apps/web/app/graph/page.tsx`
- **Commit:** `f3abb68`

**3. [Rule 2 - Missing Critical Functionality] Review page buttons lacked disabled states during async actions**
- **Found during:** Task 2-5 (Review Queue)
- **Issue:** Approve, Reject, Defer, Edit & Approve, Bulk Approve, and Bulk Reject buttons could be double-clicked during API calls, causing duplicate requests.
- **Fix:** Added `isActionLoading` state, disabled all action buttons while loading, and showed an inline `<LoadingSpinner />` during action processing.
- **Files modified:** `apps/web/app/review/page.tsx`
- **Commit:** `5e60ad2`

### Pre-existing Issues (Out of Scope)

- `apps/web/app/settings/page.tsx` has a pre-existing TypeScript error (`Cannot find name 'TABS'`). This error existed before this plan's execution and is in an unrelated file.
- `apps/web/app/exchanges/page.tsx`, `apps/web/app/activity/page.tsx`, and `apps/web/app/projects/[id]/page.tsx` contain `console.error` calls. These files were not part of this plan.

## Auth Gates

None encountered.

## Known Stubs

None. All data sources are wired to existing API clients and all UI states are functional.

## Threat Flags

None introduced beyond the plan's registered threat model. All memory content is rendered as React children (text nodes), no `dangerouslySetInnerHTML` is used, and ErrorBanner only displays `err.message`.

## Self-Check

- [x] All 5 modified files compile and build successfully (Next.js static generation passes)
- [x] `apps/web/app/page.tsx` — contains `<LoadingSpinner>`, `<ErrorBanner>`, `<EmptyState>`, `<Card>`, `hover:translate-y-[-2px]`, zero `console.error`
- [x] `apps/web/app/graph/page.tsx` — contains `import dynamic from 'next/dynamic'`, `ssr: false`, `ForceGraph2D`, `onNodeClick`, `<EmptyState>`, zero `console.error`
- [x] `apps/web/app/review/page.tsx` — contains `handleEditApprove`, `onClick.*handleEditApprove`, `<ErrorBanner>`, `<EmptyState>`, `cursor-pointer`, zero `console.error`
- [x] `apps/web/app/memories/page.tsx` — contains `useReactTable`, `getPaginationRowModel`, `getSortedRowModel`, `pageSize: 50`, `<EmptyState>`, `<ErrorBanner>`, zero `console.error`
- [x] `apps/web/app/jobs/page.tsx` — contains `<LoadingSpinner>`, `<ErrorBanner>`, `<EmptyState>`, `cursor-pointer`, zero `console.error`

## Self-Check: PASSED
