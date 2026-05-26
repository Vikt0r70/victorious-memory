# Phase 2: Dashboard Redesign - Patterns

This document extracts the specific files to be created/modified, classifies their role and data flow, and provides concrete code excerpts of existing analogs to guide the dashboard redesign.

## 1. `apps/web/app/page.tsx` (Dashboard)
- **Role:** Main entry point displaying high-level system health, stats, recent activity, and memory distribution.
- **Data Flow:** Client-side data fetching via `useEffect` combining multiple API calls (`memories`, `jobs`, `activity`, `projects`, `health`). Passes data to presentation components like `StatCard` and `DonutChart`.
- **Closest Analog:** Current implementation of `page.tsx`.
- **Pattern Excerpt (Data Fetching):**
  ```typescript
  // Existing pattern to preserve and enhance with error handling / empty states
  useEffect(() => {
    async function load() {
      try {
        const [s, j, a, p, h] = await Promise.all([
          memoriesApi.stats(),
          jobsApi.stats(),
          activityApi.list({ limit: "10" }),
          projectsApi.list(),
          fetch(`${API_BASE.replace("/api", "")}/health`).then((r) => r.json().catch(() => ({ status: "unknown" }))),
        ]);
        setStats(s);
        // ...
      } catch (e) {
        console.error("Dashboard load error:", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);
  ```

## 2. `apps/web/app/graph/page.tsx` (Graph Explorer)
- **Role:** Visualizes memory nodes and their relationships.
- **Data Flow:** Fetches raw node and edge arrays from `graphApi.getGraph()`. Local state manages depth and filters. Will pass this data into `react-force-graph-2d`.
- **Closest Analog:** Current manual Canvas renderer in `graph/page.tsx` (to be replaced).
- **Pattern Excerpt (Data Mapping):**
  ```typescript
  // Existing data mapping logic to adapt to react-force-graph-2d
  graphApi.getGraph({ limit: "120", depth: String(depth) })
    .then((d) => {
      setGraphData(d);
      const nodes = (d.nodes || []).map((n: any) => ({
        id: n.id,
        // x, y, vx, vy will be handled natively by react-force-graph-2d
        data: n,
        val: 18 + (n.access_count || 0) * 0.5, // size scaling
      }));
      const edges = (d.edges || []).map((e: any) => ({
        source: e.source || e.source_id,
        target: e.target || e.target_id,
        data: e,
      }));
      // ...
    })
  ```

## 3. `apps/web/app/review/page.tsx` (Review Queue)
- **Role:** Workflow interface for reviewing unapproved memories.
- **Data Flow:** Fetches `status: "pending_review"` memories. Mutates via `approve`, `reject`, and `bulk` endpoints. Needs fixing for "Edit & Approve" button.
- **Closest Analog:** Existing `review/page.tsx`.
- **Pattern Excerpt (Action Handlers):**
  ```typescript
  // Existing handler to fix/expand
  const handleApprove = async (id: string) => {
    // Needs loading state and error handling (toast)
    await memoriesApi.approve(id);
    load();
  };
  
  // Bug to fix (lines 229-232 currently have no onClick):
  // <button className="... flex items-center gap-1">
  //   <span className="...">edit</span> Edit & Approve
  // </button>
  ```

## 4. `apps/web/app/memories/page.tsx` (Memory Repository)
- **Role:** Comprehensive list of all memories with advanced filtering, sorting, and pagination.
- **Data Flow:** Heavy client-side filter state mapped to `memoriesApi.list(params)`. Currently uses manual HTML tables. Will migrate to TanStack Table (React Table v8) for headless data grid management.
- **Closest Analog:** Existing manual table pagination logic.
- **Pattern Excerpt (Filter State to API mapping):**
  ```typescript
  // State management to map to TanStack Table instance
  const [filters, setFilters] = useState({
    status: "", memory_type: "", scope: "", search: "",
    project_id: "", confidence_label: "", created_after: "", created_before: "",
    sort_by: "created_at", sort_order: "desc",
  });
  
  const load = useCallback(async () => {
      // ...
      const params: Record<string, string> = {
        page: String(page),
        per_page: String(perPage),
        sort_by: filters.sort_by,
        sort_order: filters.sort_order,
      };
      // apply optional filters...
      const data = await memoriesApi.list(params);
  }, [page, perPage, filters]);
  ```

## 5. `apps/web/app/settings/page.tsx` (Settings)
- **Role:** Configuration interface for providers, agents, extraction rules, and lifecycle.
- **Data Flow:** Initial heavy fetch of all settings data. Preserves highly inter-dependent state between tabs (especially Agent Routing). Needs a layout shell redesign (e.g., vertical tabs) while keeping the content payload identical.
- **Closest Analog:** Existing settings tabs state management.
- **Pattern Excerpt (State Preservation):**
  ```typescript
  // This layout and data structure must remain intact within the new shell
  const [tab, setTab] = useState(0);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [settings, setSettings] = useState<Record<string, any>>({});
  
  const saveSetting = async (key: string, value: any) => {
    await settingsApi.set(key, value);
    setSettings((prev) => ({ ...prev, [key]: value }));
  };
  ```

## 6. `apps/web/components/layout/Sidebar.tsx`
- **Role:** Main application navigation and badge indicators.
- **Data Flow:** Navigates standard Next.js routes. Fetches `pending_review` count for notification badge.
- **Closest Analog:** Existing `Sidebar.tsx`.
- **Pattern Excerpt (Active State & Badges):**
  ```typescript
  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };
  
  // Dynamic pending count fetch to preserve
  useEffect(() => {
    fetch("/api/memories?status=pending_review&per_page=1")
      .then((r) => r.json())
      .then((data) => setPendingCount(data.total ?? 0))
  }, []);
  ```

## 7. `apps/web/app/globals.css`
- **Role:** Global styles, custom animations, and Tailwind v4 configuration.
- **Data Flow:** N/A.
- **Closest Analog:** Existing MD3 dark palette and animation tokens.
- **Pattern Excerpt (Design Tokens):**
  ```css
  /* Existing custom tokens to preserve and integrate with shadcn/ui */
  @theme {
    /* ... */
  }
  
  /* Animations to preserve */
  .fade-in-up {
    animation: fadeInUp 0.4s ease-out forwards;
    opacity: 0;
  }
  .stat-card-transition {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  ```

## 8. `apps/web/components/ui/*` (shadcn/ui Additions)
- **Role:** Standardized UI components injected directly into the codebase.
- **Data Flow:** UI presentation layer only.
- **Target Components:** `Dialog`, `Select`, `Tabs`, `Card`, `Button`, `Input`, `Label`, `Switch`, `Checkbox`, `Tooltip`, `Badge`.
- **Closest Analog:** None currently. Replaces manual `<div>` / `<button>` styling scattered across pages.
