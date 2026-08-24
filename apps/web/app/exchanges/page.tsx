"use client";
import { useEffect, useState } from "react";
import { exchangesApi, projectsApi } from "@/lib/api";

function timeAgo(d: string) {
  if (!d) return "";
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function ExchangesPage() {
  const [exchanges, setExchanges] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [filterProject, setFilterProject] = useState("");
  const [filterSession, setFilterSession] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [projects, setProjects] = useState<any[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), per_page: "20", sort_order: sortOrder };
      if (filterProject) params.project_id = filterProject;
      if (filterSession) params.session_id = filterSession;
      const data = await exchangesApi.list(params);
      setExchanges(data.items || []);
      setTotal(data.total || 0);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [page, filterProject, filterSession, sortOrder]);

  useEffect(() => {
    projectsApi.list()
      .then((data) => setProjects(data.items || []))
      .catch(() => setProjects([]));
  }, []);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-[30px] leading-[38px] font-semibold tracking-tight">Raw Exchanges</h1>
        <p className="text-muted-foreground text-[14px] mt-1">Ingested conversation data from OpenCode sessions</p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <select
          className="bg-background border border-input rounded-md shadow-sm px-3 py-2 text-[13px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
          value={filterProject}
          onChange={(e) => setFilterProject(e.target.value)}
        >
          <option value="">All Projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.display_name || p.id}</option>
          ))}
        </select>
        <input
          className="bg-background border border-input rounded-md shadow-sm px-3 py-2 text-[13px] text-foreground placeholder-[#908fa0] focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
          placeholder="Session ID"
          value={filterSession}
          onChange={(e) => setFilterSession(e.target.value)}
        />
        <button
          onClick={() => setSortOrder((o) => (o === "desc" ? "asc" : "desc"))}
          className="flex items-center gap-1 px-3 py-2 border border-input rounded-md shadow-sm text-[13px] text-muted-foreground hover:bg-accent"
        >
          <span className="material-symbols-outlined text-[16px]">{sortOrder === "desc" ? "arrow_downward" : "arrow_upward"}</span>
          {sortOrder === "desc" ? "Newest" : "Oldest"}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span></div>
      ) : exchanges.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-12 text-center text-muted-foreground">No exchanges ingested yet</div>
      ) : (
        <div className="space-y-4">
          {exchanges.map((e) => (
            <div key={e.id} className="bg-card border border-border rounded-lg overflow-hidden">
              {/* Header */}
              <div className="flex items-center gap-3 px-5 py-3 border-b border-border bg-accent/50">
                <span className="badge bg-primary/10 border border-primary text-primary text-[11px]">{e.id}</span>
                <span className="badge bg-accent border border-border text-muted-foreground">
                  <span className="material-symbols-outlined text-[12px] mr-1">chat</span>{e.session_id}
                </span>
                {e.project_id && <span className="badge bg-info/10 border border-info text-info">{e.project_id}</span>}
                <span className="ml-auto text-[12px] font-mono text-muted-foreground">{new Date(e.created_at).toLocaleString()}</span>
              </div>

              {/* User */}
              {e.user_content && (
                <div className="px-5 py-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="badge bg-primary/10 border border-primary text-primary">USER</span>
                  </div>
                  <div className="text-[14px] text-foreground border-l-2 border-primary/50 pl-3 ml-1">
                    {e.user_content}
                  </div>
                </div>
              )}

              {/* Agent */}
              {e.agent_parts && e.agent_parts.length > 0 && (
                <div className="px-5 py-4 bg-accent/30">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="badge bg-secondary/10 border border-secondary text-secondary-foreground">AGENT</span>
                  </div>
                  <div className="space-y-2 ml-1">
                    {e.agent_parts.slice(0, expanded.has(e.id) ? undefined : 3).map((part: any, i: number) => (
                      <div key={i} className={part.type === "tool_call" ? "bg-background border border-input rounded-md shadow-sm p-2.5 font-mono text-[12px] text-muted-foreground" : "text-[14px] text-foreground"}>
                        {part.type === "tool_call" ? (
                          <div><span className="material-symbols-outlined text-[14px] mr-1 text-secondary-foreground">terminal</span>{part.name || "tool_call"}</div>
                        ) : (
                          part.text || JSON.stringify(part)
                        )}
                      </div>
                    ))}
                    {e.agent_parts.length > 3 && !expanded.has(e.id) && (
                      <button onClick={() => toggle(e.id)} className="text-[13px] text-primary hover:text-[#e1e0ff]">Show more ({e.agent_parts.length - 3} more)...</button>
                    )}
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between px-5 py-3 border-t border-border">
                <div className="flex items-center gap-4 text-[13px]">
                  <span className="text-primary">
                    <span className="material-symbols-outlined text-[14px] mr-1">memory</span>
                    {e.produced_memory_count} Memories Extracted
                  </span>
                  <button
                    className="flex items-center gap-1 text-primary hover:text-[#e1e0ff] transition-colors"
                    title="Re-extract memories from this exchange"
                  >
                    <span className="material-symbols-outlined text-[14px]">replay</span>
                    Re-extract
                  </button>
                </div>
                {e.file_paths && e.file_paths.length > 0 && (
                  <div className="flex gap-1.5">
                    {e.file_paths.slice(0, 3).map((f: string) => (
                      <span key={f} className="bg-accent text-muted-foreground font-mono text-[11px] px-2 py-0.5 rounded-sm">{f.split("/").pop()}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Pagination */}
          <div className="flex justify-center">
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page * 20 >= total}
              className="px-6 py-2 border border-input rounded-md shadow-sm text-[14px] text-muted-foreground hover:bg-accent disabled:opacity-30 flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[16px]">expand_more</span>Load More Exchanges
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

