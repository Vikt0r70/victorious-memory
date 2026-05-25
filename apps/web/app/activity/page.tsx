"use client";
import { useEffect, useState } from "react";
import { activityApi } from "@/lib/api";

const EVENT_ICONS: Record<string, { icon: string; color: string }> = {
  memory_created: { icon: "add_circle", color: "bg-[#c0c1ff]/20 text-[#c0c1ff]" },
  memory_approved: { icon: "verified", color: "bg-[#22c55e]/20 text-[#22c55e]" },
  memory_rejected: { icon: "block", color: "bg-[#ffb4ab]/20 text-[#ffb4ab]" },
  extraction_started: { icon: "play_circle", color: "bg-[#3b82f6]/20 text-[#3b82f6]" },
  extraction_completed: { icon: "check_circle", color: "bg-[#22c55e]/20 text-[#22c55e]" },
  extraction_failed: { icon: "error", color: "bg-[#d97721]/20 text-[#d97721]" },
  memory_updated: { icon: "edit_note", color: "bg-[#bcc7de]/20 text-[#bcc7de]" },
  memory_deleted: { icon: "delete", color: "bg-[#908fa0]/20 text-[#908fa0]" },
  edge_created: { icon: "link", color: "bg-[#a855f7]/20 text-[#a855f7]" },
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
    fetch("/api/projects")
      .then((r) => r.json())
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
        <p className="text-[#c7c4d7] text-[14px] mt-1">Real-time system events and actions</p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-center flex-wrap">
        <select
          className="bg-[#0d0d15] border border-[#464554] rounded-sm px-3 py-2 text-[13px] text-[#e4e1ed] focus:outline-none focus:border-[#c0c1ff]"
          value={eventType}
          onChange={(e) => setEventType(e.target.value)}
        >
          <option value="">All Event Types</option>
          {Object.keys(EVENT_ICONS).map((t) => (
            <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
          ))}
        </select>
        <select
          className="bg-[#0d0d15] border border-[#464554] rounded-sm px-3 py-2 text-[13px] text-[#e4e1ed] focus:outline-none focus:border-[#c0c1ff]"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
        >
          <option value="">All Projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.display_name || p.id}</option>
          ))}
        </select>
        <select
          className="bg-[#0d0d15] border border-[#464554] rounded-sm px-3 py-2 text-[13px] text-[#e4e1ed] focus:outline-none focus:border-[#c0c1ff]"
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
            autoRefresh ? "border-[#4ade80] text-[#4ade80] bg-[#4ade80]/10" : "border-[#464554] text-[#c7c4d7] hover:bg-[#292932]"
          }`}
        >
          {autoRefresh && <span className="w-2 h-2 rounded-full bg-[#4ade80] animate-pulse" />}
          <span className="material-symbols-outlined text-[16px]">{autoRefresh ? "sync" : "sync_disabled"}</span>
          Auto-refresh
        </button>
        <button onClick={load} className="flex items-center gap-1 px-3 py-2 border border-[#464554] rounded-sm text-[13px] text-[#c7c4d7] hover:bg-[#292932]">
          <span className="material-symbols-outlined text-[16px]">refresh</span>Refresh
        </button>
      </div>

      {/* Feed */}
      <div className="bg-[#1e293b] border border-[rgba(51,65,85,0.5)] rounded-lg overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <span className="material-symbols-outlined animate-spin text-3xl text-[#c0c1ff]">progress_activity</span>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-[#908fa0]">No activity found</div>
        ) : (
          items.map((item) => {
            const ev = EVENT_ICONS[item.event_type] || { icon: "info", color: "bg-[#908fa0]/20 text-[#908fa0]" };
            const isFailed = item.event_type.includes("failed");
            return (
              <div key={item.id} className={`group flex items-start gap-4 p-4 border-b border-[rgba(51,65,85,0.5)] hover:bg-[#334155]/40 hover:translate-x-1 transition-colors transition-transform duration-300 cursor-pointer ${isFailed ? "border-l-2 border-l-[#d97721]" : ""}`}>
                <div className={`w-10 h-10 rounded-full ${ev.color} flex items-center justify-center shrink-0 mt-0.5`}>
                  <span className="material-symbols-outlined text-[20px]">{ev.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-medium text-[#e4e1ed]">
                        {item.event_type.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}
                      </span>
                      {item.memory_id && (
                        <span className="badge bg-[#292932] border border-[#464554] text-[#c7c4d7]">{item.memory_id.slice(0, 12)}</span>
                      )}
                    </div>
                    <span className="text-xs text-[#c7c4d7] font-mono shrink-0 ml-4">{timeAgo(item.created_at)}</span>
                  </div>
                  <div className="text-[13px] text-[#c7c4d7]">{item.description}</div>
                  {item.project_id && (
                    <div className="mt-1.5">
                      <span className="badge bg-[#d97721]/10 border border-[#d97721] text-[#d97721]">{item.project_id}</span>
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

