"use client";

import { useEffect, useState, useCallback } from "react";
import { memoriesApi } from "@/lib/api";
import MemoryDetailModal from "@/components/modals/MemoryDetailModal";
import EditMemoryModal from "@/components/modals/EditMemoryModal";

const TYPE_COLORS: Record<string, string> = {
  decision: "bg-[#8083ff]/10 border-[#8083ff] text-[#8083ff]",
  preference: "bg-[#c0c1ff]/10 border-[#c0c1ff] text-[#c0c1ff]",
  constraint: "bg-[#bcc7de]/10 border-[#bcc7de] text-[#bcc7de]",
  bugfix: "bg-[#ffb4ab]/10 border-[#ffb4ab] text-[#ffb4ab]",
  lesson: "bg-[#4ade80]/10 border-[#4ade80] text-[#4ade80]",
  pattern: "bg-[#a855f7]/10 border-[#a855f7] text-[#a855f7]",
  research: "bg-[#3b82f6]/10 border-[#3b82f6] text-[#3b82f6]",
  reference: "bg-[#f97316]/10 border-[#f97316] text-[#f97316]",
  architecture: "bg-[#d97721]/10 border-[#d97721] text-[#d97721]",
  context: "bg-[#908fa0]/10 border-[#908fa0] text-[#908fa0]",
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

  const load = useCallback(async () => {
    setLoading(true);
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
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [page, perPage, filters, semanticMode, searchQuery]);

  useEffect(() => {
    // Load projects for filter dropdown
    fetch("/api/projects")
      .then((r) => r.json())
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
    await memoriesApi.bulk(action, Array.from(selected));
    setSelected(new Set());
    load();
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

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[30px] leading-[38px] font-semibold tracking-tight">
            Memory Repository
          </h1>
          <p className="text-[#c7c4d7] text-[14px] mt-1">
            Manage and curate extracted knowledge fragments.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={clearFilters}
            className="flex items-center gap-2 px-3 py-2 border border-[#464554] rounded-sm text-[14px] text-[#c7c4d7] hover:bg-[#292932] transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">filter_list</span>
            Filters{activeFilterCount > 0 ? ` (${activeFilterCount} Active)` : ""}
          </button>
        </div>
      </div>

      {/* Search + Semantic Toggle */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-lg">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#c7c4d7]">search</span>
          <input
            className="w-full bg-[#0d0d15] border border-[#464554] rounded-sm py-2 pl-10 pr-4 text-[14px] text-[#e4e1ed] focus:outline-none focus:border-[#c0c1ff] placeholder-[#c7c4d7]"
            placeholder={semanticMode ? "Semantic search..." : "Search memories..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
          />
        </div>
        <button
          onClick={() => setSemanticMode((v) => !v)}
          className={`flex items-center gap-1 px-3 py-2 border rounded-sm text-[13px] transition-colors ${
            semanticMode ? "border-[#c0c1ff] bg-[#c0c1ff]/10 text-[#c0c1ff]" : "border-[#464554] text-[#c7c4d7] hover:bg-[#292932]"
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">{semanticMode ? "toggle_on" : "toggle_off"}</span>
          Semantic
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select
          className="bg-[#0d0d15] border border-[#464554] rounded-sm px-3 py-1.5 text-[13px] text-[#e4e1ed] focus:outline-none focus:border-[#c0c1ff]"
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
          className="bg-[#0d0d15] border border-[#464554] rounded-sm px-3 py-1.5 text-[13px] text-[#e4e1ed] focus:outline-none focus:border-[#c0c1ff]"
          value={filters.memory_type}
          onChange={(e) => setFilters((f) => ({ ...f, memory_type: e.target.value }))}
        >
          <option value="">All Types</option>
          {Object.keys(TYPE_COLORS).map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select
          className="bg-[#0d0d15] border border-[#464554] rounded-sm px-3 py-1.5 text-[13px] text-[#e4e1ed] focus:outline-none focus:border-[#c0c1ff]"
          value={filters.scope}
          onChange={(e) => setFilters((f) => ({ ...f, scope: e.target.value }))}
        >
          <option value="">All Scopes</option>
          <option value="global">Global</option>
          <option value="project">Project</option>
          <option value="cross_project">Cross-Project</option>
        </select>
        <select
          className="bg-[#0d0d15] border border-[#464554] rounded-sm px-3 py-1.5 text-[13px] text-[#e4e1ed] focus:outline-none focus:border-[#c0c1ff]"
          value={filters.project_id}
          onChange={(e) => setFilters((f) => ({ ...f, project_id: e.target.value }))}
        >
          <option value="">All Projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.display_name || p.id}</option>
          ))}
        </select>
        <select
          className="bg-[#0d0d15] border border-[#464554] rounded-sm px-3 py-1.5 text-[13px] text-[#e4e1ed] focus:outline-none focus:border-[#c0c1ff]"
          value={filters.confidence_label}
          onChange={(e) => setFilters((f) => ({ ...f, confidence_label: e.target.value }))}
        >
          <option value="">All Confidence</option>
          <option value="high">High (≥0.85)</option>
          <option value="medium">Medium (≥0.6)</option>
          <option value="low">Low (&lt;0.6)</option>
        </select>
        <input
          type="date"
          className="bg-[#0d0d15] border border-[#464554] rounded-sm px-3 py-1.5 text-[13px] text-[#e4e1ed] focus:outline-none focus:border-[#c0c1ff]"
          value={filters.created_after}
          onChange={(e) => setFilters((f) => ({ ...f, created_after: e.target.value }))}
        />
        <input
          type="date"
          className="bg-[#0d0d15] border border-[#464554] rounded-sm px-3 py-1.5 text-[13px] text-[#e4e1ed] focus:outline-none focus:border-[#c0c1ff]"
          value={filters.created_before}
          onChange={(e) => setFilters((f) => ({ ...f, created_before: e.target.value }))}
        />
        <select
          className="bg-[#0d0d15] border border-[#464554] rounded-sm px-3 py-1.5 text-[13px] text-[#e4e1ed] focus:outline-none focus:border-[#c0c1ff]"
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
        <div className="flex items-center gap-4 py-2 px-4 bg-[#292932] border border-[#464554] rounded-sm fade-in-up">
          <span className="text-[14px] text-[#c7c4d7]">{selected.size} selected</span>
          <div className="h-4 w-px bg-[#464554]" />
          <button
            onClick={() => bulkAction("approve")}
            className="flex items-center gap-1 text-[14px] text-[#4ade80] hover:text-[#22c55e] transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">check_circle</span>
            Approve
          </button>
          <button
            onClick={() => bulkAction("reject")}
            className="flex items-center gap-1 text-[14px] text-[#ffb4ab] hover:text-[#ff8a80] transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">block</span>
            Reject
          </button>
          <button
            onClick={() => bulkAction("delete")}
            className="flex items-center gap-1 text-[14px] text-[#908fa0] hover:text-[#ffb4ab] transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">delete</span>
            Delete
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-[#1e293b] border border-[rgba(51,65,85,0.5)] rounded-lg overflow-hidden">
        {/* Pagination */}
        <div className="flex justify-end items-center px-4 py-2 border-b border-[rgba(51,65,85,0.5)] text-[13px] text-[#c7c4d7]">
          <span>
            {(page - 1) * perPage + 1}-{Math.min(page * perPage, total)} of{" "}
            {total.toLocaleString()}
          </span>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="ml-3 p-1 hover:bg-[#292932] rounded transition-colors disabled:opacity-30"
          >
            <span className="material-symbols-outlined text-[18px]">chevron_left</span>
          </button>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page * perPage >= total}
            className="p-1 hover:bg-[#292932] rounded transition-colors disabled:opacity-30"
          >
            <span className="material-symbols-outlined text-[18px]">chevron_right</span>
          </button>
        </div>

        {/* Header */}
        <div className="grid grid-cols-[40px_1fr_120px_100px_150px_150px_80px] gap-2 px-4 py-3 border-b border-[rgba(51,65,85,0.5)] text-[11px] font-bold uppercase tracking-wider text-[#908fa0]">
          <div className="flex items-center">
            <input
              type="checkbox"
              checked={selected.size === memories.length && memories.length > 0}
              onChange={toggleAll}
              className="accent-[#c0c1ff]"
            />
          </div>
          <div>Content</div>
          <div>Type</div>
          <div>Scope</div>
          <div>Confidence</div>
          <div>Tags</div>
          <div>Created</div>
        </div>

        {/* Rows */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <span className="material-symbols-outlined animate-spin text-3xl text-[#c0c1ff]">
              progress_activity
            </span>
          </div>
        ) : memories.length === 0 ? (
          <div className="text-center py-20 text-[#908fa0]">
            No memories found
          </div>
        ) : (
          memories.map((m) => (
            <div
              key={m.id}
              onClick={() => setDetailMemoryId(m.id)}
              className={`grid grid-cols-[40px_1fr_120px_100px_150px_150px_80px] gap-2 px-4 py-3 border-b border-[rgba(51,65,85,0.3)] hover:bg-[#334155]/20 transition-colors cursor-pointer ${
                selected.has(m.id) ? "bg-[#c0c1ff]/5" : ""
              }`}
            >
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={selected.has(m.id)}
                  onChange={() => toggleSelect(m.id)}
                  className="accent-[#c0c1ff]"
                />
              </div>
              <div className="text-[14px] text-[#e4e1ed] truncate">
                {m.content}
              </div>
              <div>
                <span
                  className={`badge border ${
                    TYPE_COLORS[m.memory_type] || TYPE_COLORS.context
                  }`}
                >
                  {m.memory_type}
                </span>
              </div>
              <div>
                <span className="badge bg-[#34343d] border border-[#464554] text-[#c7c4d7]">
                  {m.scope}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[13px]">
                  {(m.confidence_score || 0).toFixed(2)}
                </span>
                <div className="w-16 h-1.5 bg-[#0d0d15] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(m.confidence_score || 0) * 100}%`,
                      backgroundColor:
                        m.confidence_score > 0.8
                          ? "#4ade80"
                          : m.confidence_score > 0.5
                          ? "#d97721"
                          : "#ffb4ab",
                    }}
                  />
                </div>
              </div>
              <div className="flex gap-1 flex-wrap">
                {(m.tags || []).slice(0, 2).map((tag: string) => (
                  <span
                    key={tag}
                    className="badge bg-[#292932] border border-[#464554] text-[#c7c4d7]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <div className="text-[13px] text-[#c7c4d7] font-mono">
                {timeAgo(m.created_at)}
              </div>
            </div>
          ))
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

