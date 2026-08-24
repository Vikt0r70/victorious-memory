"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table";
import { memoriesApi, projectsApi } from "@/lib/api";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import ErrorBanner from "@/components/ui/ErrorBanner";
import EmptyState from "@/components/ui/EmptyState";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
  TableHead,
} from "@/components/ui/table";
import MemoryDetailModal from "@/components/modals/MemoryDetailModal";
import EditMemoryModal from "@/components/modals/EditMemoryModal";

const TYPE_COLORS: Record<string, string> = {
  decision: "bg-primary/10 border-primary/20 text-primary",
  preference: "bg-primary/10 border-primary/20 text-primary",
  bugfix: "bg-destructive/10 border-destructive/20 text-destructive",
  lesson: "bg-success/10 border-success/20 text-success",
  pattern: "bg-accent border-border text-foreground",
  research: "bg-accent border-border text-foreground",
  reference: "bg-accent border-border text-foreground",
  architecture: "bg-accent border-border text-foreground",
  constraint: "bg-destructive/10 border-destructive/20 text-destructive",
  context: "bg-muted border-border text-muted-foreground",
};

function timeAgo(dateStr: string) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function MemoriesPage() {
  const [memories, setMemories] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage] = useState(50);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState({
    status: "",
    memory_type: "",
    scope: "",
    search: "",
    project_id: "",
    confidence_label: "",
    created_after: "",
    created_before: "",
    sort_by: "created_at",
    sort_order: "desc",
  });
  const [semanticMode, setSemanticMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [projects, setProjects] = useState<any[]>([]);
  const [detailMemoryId, setDetailMemoryId] = useState<string | null>(null);
  const [editMemory, setEditMemory] = useState<any | null>(null);
  const [sorting, setSorting] = useState([{ id: "created_at", desc: true }]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (semanticMode && searchQuery.trim()) {
        const data = await memoriesApi.search(searchQuery, filters.project_id || undefined);
        setMemories((data.items || []).map((i: any) => i.memory));
        setTotal(data.items?.length || 0);
      } else {
        const params: Record<string, string> = {
          page: String(page),
          per_page: String(perPage),
          sort_by: filters.sort_by,
          sort_order: filters.sort_order,
        };
        if (filters.status) params.status = filters.status;
        if (filters.memory_type) params.memory_type = filters.memory_type;
        if (filters.scope) params.scope = filters.scope;
        if (filters.project_id) params.project_id = filters.project_id;
        if (filters.confidence_label) params.confidence_label = filters.confidence_label;
        if (filters.created_after) params.created_after = filters.created_after;
        if (filters.created_before) params.created_before = filters.created_before;
        if (searchQuery.trim()) params.search = searchQuery.trim();
        const data = await memoriesApi.list(params);
        setMemories(data.items || []);
        setTotal(data.total || 0);
      }
    } catch (e: any) {
      setError(e.message || "Failed to load memories");
    } finally {
      setLoading(false);
    }
  }, [page, perPage, filters, semanticMode, searchQuery]);

  useEffect(() => {
    projectsApi.list()
      .then((data) => setProjects(data.items || []))
      .catch(() => setProjects([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const toggleAll = () => {
    if (selected.size === memories.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(memories.map((m) => m.id)));
    }
  };

  const bulkAction = async (action: string) => {
    if (selected.size === 0) return;
    setError(null);
    try {
      await memoriesApi.bulk(action, Array.from(selected));
      setSelected(new Set());
      window.dispatchEvent(new Event("victorious:pending-changed"));
      load();
    } catch (e: any) {
      setError(e.message || `Failed to ${action} memories`);
    }
  };

  const activeFilterCount = Object.values(filters).filter((v) => !!v).length + (searchQuery ? 1 : 0);

  const clearFilters = () => {
    setFilters({
      status: "", memory_type: "", scope: "", search: "",
      project_id: "", confidence_label: "", created_after: "", created_before: "",
      sort_by: "created_at", sort_order: "desc",
    });
    setSearchQuery("");
    setSemanticMode(false);
  };

  const columns = useMemo<ColumnDef<any>[]>(() => [
    {
      id: "select",
      header: () => (
        <input
          type="checkbox"
          checked={memories.length > 0 && selected.size === memories.length}
          onChange={toggleAll}
          className="w-4 h-4 rounded border-input cursor-pointer shadow-sm transition-colors text-primary focus:ring-primary focus:ring-offset-background bg-background accent-primary"
        />
      ),
      cell: ({ row }: { row: any }) => (
        <input
          type="checkbox"
          checked={selected.has(row.original.id)}
          onClick={(e) => e.stopPropagation()}
          onChange={() => toggleSelect(row.original.id)}
          className="w-4 h-4 rounded border-input cursor-pointer shadow-sm transition-colors text-primary focus:ring-primary focus:ring-offset-background bg-background accent-primary"
        />
      ),
      enableSorting: false,
    },
    {
      accessorKey: "content",
      header: "Content",
      cell: ({ row }: { row: any }) => (
        <div className="text-[14px] text-foreground truncate max-w-md">
          {row.original.content}
        </div>
      ),
    },
    {
      accessorKey: "memory_type",
      header: "Type",
      cell: ({ row }: { row: any }) => (
        <span className={`badge border ${TYPE_COLORS[row.original.memory_type] || TYPE_COLORS.context}`}>
          {row.original.memory_type}
        </span>
      ),
    },
    {
      accessorKey: "scope",
      header: "Scope",
      cell: ({ row }: { row: any }) => (
        <span className="badge bg-muted border border-border text-muted-foreground">
          {row.original.scope}
        </span>
      ),
    },
    {
      accessorKey: "confidence_score",
      header: "Confidence",
      cell: ({ row }: { row: any }) => {
        const score = row.original.confidence_score || 0;
        return (
          <div className="flex items-center gap-2">
            <span className="font-mono text-[13px]">{(score).toFixed(2)}</span>
            <div className="w-16 h-1.5 bg-background rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${score * 100}%`,
                  backgroundColor:
                    score > 0.8
                      ? "#4ade80"
                      : score > 0.5
                      ? "#d97721"
                      : "#ffb4ab",
                }}
              />
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "tags",
      header: "Tags",
      cell: ({ row }: { row: any }) => (
        <div className="flex gap-1 flex-wrap">
          {(row.original.tags || []).slice(0, 2).map((tag: string) => (
            <span key={tag} className="badge bg-accent border border-border text-muted-foreground">
              {tag}
            </span>
          ))}
        </div>
      ),
    },
    {
      accessorKey: "created_at",
      header: "Created",
      cell: ({ row }: { row: any }) => (
        <div className="text-[13px] text-muted-foreground font-mono">
          {timeAgo(row.original.created_at)}
        </div>
      ),
    },
  ], [memories, selected]);

  const table = useReactTable({
    data: memories,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    initialState: {
      pagination: { pageSize: 50 },
    },
  });

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[30px] leading-[38px] font-semibold tracking-tight">
            Memory Repository
          </h1>
          <p className="text-muted-foreground text-[14px] mt-1">
            Manage and curate extracted knowledge fragments.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={clearFilters}
            className="cursor-pointer flex items-center gap-2 px-3 py-2 border border-input rounded-md shadow-sm text-[14px] text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all duration-200"
          >
            <span className="material-symbols-outlined text-[18px]">filter_list</span>
            Filters{activeFilterCount > 0 ? ` (${activeFilterCount} Active)` : ""}
          </button>
        </div>
      </div>

      {/* Search + Semantic Toggle */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-lg">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">search</span>
          <input
            className="w-full bg-background border border-input rounded-md shadow-sm py-2 pl-10 pr-4 text-[14px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder-[#c7c4d7]"
            placeholder={semanticMode ? "Semantic search..." : "Search memories..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
          />
        </div>
        <button
          onClick={() => setSemanticMode((v) => !v)}
          className={`cursor-pointer flex items-center gap-1 px-3 py-2 border rounded-sm text-[13px] transition-colors ${
            semanticMode ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground hover:bg-accent"
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">{semanticMode ? "toggle_on" : "toggle_off"}</span>
          Semantic
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select
          className="bg-background border border-input rounded-md shadow-sm px-3 py-2 text-[13px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
          value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="pending_review">Pending Review</option>
          <option value="deprecated">Deprecated</option>
          <option value="superseded">Superseded</option>
          <option value="rejected">Rejected</option>
        </select>
        <select
          className="bg-background border border-input rounded-md shadow-sm px-3 py-2 text-[13px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
          value={filters.memory_type}
          onChange={(e) => setFilters((f) => ({ ...f, memory_type: e.target.value }))}
        >
          <option value="">All Types</option>
          {Object.keys(TYPE_COLORS).map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select
          className="bg-background border border-input rounded-md shadow-sm px-3 py-2 text-[13px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
          value={filters.scope}
          onChange={(e) => setFilters((f) => ({ ...f, scope: e.target.value }))}
        >
          <option value="">All Scopes</option>
          <option value="global">Global</option>
          <option value="project">Project</option>
          <option value="cross_project">Cross-Project</option>
        </select>
        <select
          className="bg-background border border-input rounded-md shadow-sm px-3 py-2 text-[13px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
          value={filters.project_id}
          onChange={(e) => setFilters((f) => ({ ...f, project_id: e.target.value }))}
        >
          <option value="">All Projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.display_name || p.id}</option>
          ))}
        </select>
        <select
          className="bg-background border border-input rounded-md shadow-sm px-3 py-2 text-[13px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
          value={filters.confidence_label}
          onChange={(e) => setFilters((f) => ({ ...f, confidence_label: e.target.value }))}
        >
          <option value="">All Confidence</option>
          <option value="high">High (&ge;0.85)</option>
          <option value="medium">Medium (&ge;0.6)</option>
          <option value="low">Low (&lt;0.6)</option>
        </select>
        <input
          type="date"
          className="bg-background border border-input rounded-md shadow-sm px-3 py-2 text-[13px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
          value={filters.created_after}
          onChange={(e) => setFilters((f) => ({ ...f, created_after: e.target.value }))}
        />
        <input
          type="date"
          className="bg-background border border-input rounded-md shadow-sm px-3 py-2 text-[13px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
          value={filters.created_before}
          onChange={(e) => setFilters((f) => ({ ...f, created_before: e.target.value }))}
        />
        <select
          className="bg-background border border-input rounded-md shadow-sm px-3 py-2 text-[13px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
          value={`${filters.sort_by}-${filters.sort_order}`}
          onChange={(e) => {
            const [sort_by, sort_order] = e.target.value.split("-");
            setFilters((f) => ({ ...f, sort_by, sort_order }));
          }}
        >
          <option value="created_at-desc">Created (newest)</option>
          <option value="created_at-asc">Created (oldest)</option>
          <option value="last_accessed-desc">Last Accessed</option>
          <option value="access_count-desc">Access Count</option>
          <option value="confidence_score-desc">Confidence</option>
        </select>
      </div>

      {/* Bulk Actions Bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-4 py-2 px-4 bg-accent border border-input rounded-md shadow-sm fade-in-up">
          <span className="text-[14px] text-muted-foreground">{selected.size} selected</span>
          <div className="h-4 w-px bg-[#464554]" />
          <button
            onClick={() => bulkAction("approve")}
            className="cursor-pointer flex items-center gap-1 text-[14px] text-success hover:text-success transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">check_circle</span>
            Approve
          </button>
          <button
            onClick={() => bulkAction("reject")}
            className="cursor-pointer flex items-center gap-1 text-[14px] text-destructive hover:text-[#ff8a80] transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">block</span>
            Reject
          </button>
          <button
            onClick={() => bulkAction("delete")}
            className="cursor-pointer flex items-center gap-1 text-[14px] text-muted-foreground hover:text-destructive transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">delete</span>
            Delete
          </button>
        </div>
      )}

      {error && <ErrorBanner message={error} />}

      {/* Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {/* Pagination */}
        <div className="flex justify-end items-center px-4 py-2 border-b border-border text-[13px] text-muted-foreground">
          <span>
            {(page - 1) * perPage + 1}-{Math.min(page * perPage, total)} of{" "}
            {total.toLocaleString()}
          </span>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="cursor-pointer ml-3 p-1 hover:bg-accent rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-[18px]">chevron_left</span>
          </button>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page * perPage >= total}
            className="cursor-pointer p-1 hover:bg-accent rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-[18px]">chevron_right</span>
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner />
          </div>
        ) : memories.length === 0 ? (
          <EmptyState title="No memories found" message="Try adjusting your filters." icon="search_off" />
        ) : (
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      onClick={header.column.getToggleSortingHandler()}
                      className={header.column.getCanSort() ? "cursor-pointer hover:text-foreground" : ""}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() ? (
                        header.column.getIsSorted() === "asc" ? " ↑" : " ↓"
                      ) : null}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  onClick={() => setDetailMemoryId(row.original.id)}
                  className="cursor-pointer hover:bg-muted"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Modals */}
      {detailMemoryId && (
        <MemoryDetailModal
          memoryId={detailMemoryId}
          onClose={() => setDetailMemoryId(null)}
          onEdit={(memory) => {
            setDetailMemoryId(null);
            setEditMemory(memory);
          }}
          onDelete={async (id) => {
            await memoriesApi.delete(id);
            setDetailMemoryId(null);
            load();
          }}
        />
      )}
      {editMemory && (
        <EditMemoryModal
          memory={editMemory}
          onClose={() => setEditMemory(null)}
          onSaved={() => {
            setEditMemory(null);
            load();
          }}
        />
      )}
    </div>
  );
}
