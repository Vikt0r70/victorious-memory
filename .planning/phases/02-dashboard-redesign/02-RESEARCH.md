# Phase 2: Dashboard Redesign - Research

## What do I need to know to PLAN this phase well?

To successfully execute the dashboard redesign, the planning phase must address technology integration, state preservation, systematic UI audits, and component standardization.

### 1. Technology Integration Strategy
- **shadcn/ui & Tailwind v4:** We need a plan to initialize `shadcn/ui` with the existing Tailwind v4 setup and MD3 dark palette. Components (`Dialog, Select, Tabs, Card, Button, Input, Label, Switch, Checkbox, Tooltip, Badge`) must be copy-pasted into `apps/web/components/ui/` and adapted to our specific color tokens.
- **TanStack Table (React Table v8):** We must define how to map the existing paginated API data (Memory table, Usage logs) to headless column definitions, sorting, and pagination controls, wrapped in standard shadcn table styling.
- **react-force-graph-2d:** The custom 593-line Canvas renderer must be safely removed. We need to plan the data mapping from `/api/graph` (`{ nodes: Node[], edges: Edge[] }`) to the library's `graphData` prop. Crucially, interaction handlers (`onNodeClick` opening the detail panel, `onNodeHover` tooltips, filters) must be wired correctly.
- **Next.js Breaking Changes:** Per `AGENTS.md`, this project utilizes a version of Next.js with breaking changes. The plan should account for consulting `node_modules/next/dist/docs/` when interacting with Next.js specific APIs.

### 2. State & Content Preservation
- **Settings Page State:** The 6 settings tabs (Providers, Extraction, Auto-Approve, Lifecycle, Plugin, Data) contain complex React state from Phase 1. The shell redesign must focus *only* on the outer layout (navigation, cards, spacing) and safely wrap the existing tab contents without breaking the `useState`/`useEffect` hooks bridging Provider and Agent configurations.

### 3. Systematic UI Overhaul & Bug Fixes
- **Interactive Element Audit:** We need a systematic approach to audit all clickable elements for `cursor-pointer`, hover states, loading spinners, and disabled states during async operations.
- **Review Queue Bug:** The "Edit & Approve" button (`apps/web/app/review/page.tsx`, lines 229-232) currently has no `onClick` handler. The plan must wire this to the `memoriesApi.approve()` endpoint and an edit modal.
- **Error Handling:** Replacing `console.error()` calls with user-facing error UI (toasts or inline alerts).
- **Empty States:** Every list and page (Dashboard, Memories, Review) must feature a designed empty state.

---

## Validation Architecture

To ensure the new Dashboard Redesign meets the project requirements (REQ-02, REQ-05) and delivers a stable, production-ready interface, we must enforce the following validation mechanisms (Nyquist requirements).

### 1. Component & Styling Validation
- **Theme Integrity Test:** Verify that all newly adopted `shadcn/ui` components inherit the Material Design 3 dark palette tokens rather than defaulting to standard Radix UI colors.
- **State Resilience Check:** Confirm that navigating between the redesigned Settings tabs does not lose unsaved configuration states from Phase 1.

### 2. Graph & Table Functional Testing
- **Graph Interaction Verification:**
  - Verify the graph canvas successfully renders nodes and edges from the API.
  - Test node clicks to ensure the memory detail side-panel successfully mounts and displays the correct memory.
  - Verify hover tooltips, type filtering, and search highlights work as intended.
- **Table Data Grid Verification:**
  - Test column resizing, sorting, and pagination via TanStack Table.
  - Ensure no layout shifts occur when filtering the Memory repository or Usage log tables.

### 3. End-to-End Interaction & Error Testing (Nyquist Criteria)
- **Review Queue Flow:** Perform an E2E test clicking the "Edit & Approve" button. Verify it correctly opens the modal, executes the API call, reflects a loading state, and updates the local UI state upon success.
- **Error Handling Simulation:** Force an API failure (e.g., simulating a 500 error from the backend) and validate that a human-readable error message or toast appears, confirming the removal of silent console errors.
- **Async Loading States:** Throttle the network connection and verify that buttons enter a disabled, spinning state to prevent double-submissions during API calls.

### 4. Visual & Edge-Case Validation
- **Systematic Hover/Cursor Audit:** Conduct a pass over the UI to ensure all buttons, links, and table rows correctly present a `cursor: pointer` and visual feedback on hover.
- **Empty State Rendering:** Manually mock empty API responses (0 memories, 0 review items) and ensure the polished empty state components are rendered instead of broken tables or blank screens.
