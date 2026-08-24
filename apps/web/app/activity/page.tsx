"use client";
import { useEffect, useState } from "react";
import { activityApi, projectsApi } from "@/lib/api";

const EVENT_ICONS: Record<string, { icon: string; color: string }> = {
  memory_created: { icon: "add_circle", color: "bg-primary/20 text-primary" },
  memory_approved: { icon: "verified", color: "bg-success/20 text-success" },
  memory_rejected: { icon: "block", color: "bg-destructive/20 text-destructive" },
  extraction_started: { icon: "play_circle", color: "bg-info/20 text-info" },
  extraction_completed: { icon: "check_circle", color: "bg-success/20 text-success" },
  extraction_failed: { icon: "error", color: "bg-info/20 text-info" },
  memory_updated: { icon: "edit_note", color: "bg-secondary/20 text-secondary-foreground" },
  memory_deleted: { icon: "delete", color: "bg-muted-foreground/20 text-muted-foreground" },
  edge_created: { icon: "link", color: "bg-accent/20 text-accent-foreground" },
};

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

export default function ActivityPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventType, setEventType] = useState("");
  const [projectId, setProjectId] = useState("");
  const [dateRange, setDateRange] = useState(""); // "", "today", "7days", "30days"
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "50" };
      if (eventType) params.event_type = eventType;
      if (projectId) params.project_id = projectId;
      if (dateRange) {
        const now = new Date();
        if (dateRange === "today") params.created_after = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        if (dateRange === "7days") params.created_after = new Date(now.getTime() - 7 * 86400000).toISOString();
        if (dateRange === "30days") params.created_after = new Date(now.getTime() - 30 * 86400000).toISOString();
      }
      const data = await activityApi.list(params);
      setItems(data.items || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [eventType, projectId, dateRange]);

  useEffect(() => {
    // Load projects for filter dropdown
    projectsApi.list()
      .then((data) => setProjects(data.items || []))
      .catch(() => setProjects([]));
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, eventType, projectId, dateRange]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-[30px] leading-[38px] font-semibold tracking-tight">Activity Feed</h1>
        <p className="text-muted-foreground text-[14px] mt-1">Real-time system events and actions</p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-center flex-wrap">
        <select
          className="bg-background border border-input rounded-md shadow-sm px-3 py-2 text-[13px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
          value={eventType}
          onChange={(e) => setEventType(e.target.value)}
        >
          <option value="">All Event Types</option>
          {Object.keys(EVENT_ICONS).map((t) => (
            <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
          ))}
        </select>
        <select
          className="bg-background border border-input rounded-md shadow-sm px-3 py-2 text-[13px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
        >
          <option value="">All Projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.display_name || p.id}</option>
          ))}
        </select>
        <select
          className="bg-background border border-input rounded-md shadow-sm px-3 py-2 text-[13px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
        >
          <option value="">All Time</option>
          <option value="today">Today</option>
          <option value="7days">Last 7 Days</option>
          <option value="30days">Last 30 Days</option>
        </select>
        <button
          onClick={() => setAutoRefresh((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-2 border rounded-sm text-[13px] transition-colors ${
            autoRefresh ? "border-[#4ade80] text-success bg-success/10" : "border-input text-muted-foreground hover:bg-accent"
          }`}
        >
          {autoRefresh && <span className="w-2 h-2 rounded-full bg-[#4ade80] animate-pulse" />}
          <span className="material-symbols-outlined text-[16px]">{autoRefresh ? "sync" : "sync_disabled"}</span>
          Auto-refresh
        </button>
        <button onClick={load} className="flex items-center gap-1 px-3 py-2 border border-input rounded-md shadow-sm text-[13px] text-muted-foreground hover:bg-accent">
          <span className="material-symbols-outlined text-[16px]">refresh</span>Refresh
        </button>
      </div>

      {/* Feed */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <span className="material-symbols-outlined animate-spin text-3xl text-primary">progress_activity</span>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">No activity found</div>
        ) : (
          items.map((item) => {
            const ev = EVENT_ICONS[item.event_type] || { icon: "info", color: "bg-muted-foreground/20 text-muted-foreground" };
            const isFailed = item.event_type.includes("failed");
            return (
              <div key={item.id} className={`group flex items-start gap-4 p-4 border-b border-border hover:bg-muted hover:translate-x-1 transition-colors transition-transform duration-300 cursor-pointer ${isFailed ? "border-l-2 border-l-[#d97721]" : ""}`}>
                <div className={`w-10 h-10 rounded-full ${ev.color} flex items-center justify-center shrink-0 mt-0.5`}>
                  <span className="material-symbols-outlined text-[20px]">{ev.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-medium text-foreground">
                        {item.event_type.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}
                      </span>
                      {item.memory_id && (
                        <span className="badge bg-accent border border-border text-muted-foreground">{item.memory_id.slice(0, 12)}</span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground font-mono shrink-0 ml-4">{timeAgo(item.created_at)}</span>
                  </div>
                  <div className="text-[13px] text-muted-foreground">{item.description}</div>
                  {item.project_id && (
                    <div className="mt-1.5">
                      <span className="badge bg-info/10 border border-info text-info">{item.project_id}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

