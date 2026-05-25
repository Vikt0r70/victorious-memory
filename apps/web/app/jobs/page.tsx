"use client";
import { useEffect, useState } from "react";
import { jobsApi } from "@/lib/api";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-[#d97721]/10 border-[#d97721] text-[#d97721]",
  processing: "bg-[#3b82f6]/10 border-[#3b82f6] text-[#3b82f6]",
  completed: "bg-[#4ade80]/10 border-[#4ade80] text-[#4ade80]",
  failed: "bg-[#ffb4ab]/10 border-[#ffb4ab] text-[#ffb4ab]",
  cancelled: "bg-[#908fa0]/10 border-[#908fa0] text-[#908fa0]",
};

function formatDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function timeAgo(d: string) {
  if (!d) return "-";
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), per_page: "50" };
      if (statusFilter) params.status = statusFilter;
      const [jobData, statsData] = await Promise.all([
        jobsApi.list(params),
        jobsApi.stats(),
      ]);
      setJobs(jobData.items || []);
      setTotal(jobData.total || 0);
      setStats(statsData);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [page, statusFilter]);

  const handleRetry = async (id: string) => { await jobsApi.retry(id); load(); };
  const handleCancel = async (id: string) => { await jobsApi.cancel(id); load(); };
  const handleRetryAll = async () => { await jobsApi.retryAllFailed(); load(); };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-[30px] leading-[38px] font-semibold tracking-tight">Extraction Jobs</h1>
          <p className="text-[#c7c4d7] text-[14px] mt-1">Background memory extraction pipeline</p>
        </div>
        <div className="flex gap-3">
          <button onClick={load} className="flex items-center gap-1 px-3 py-2 border border-[#464554] rounded-sm text-[14px] text-[#c7c4d7] hover:bg-[#292932]">
            <span className="material-symbols-outlined text-[16px]">refresh</span>Refresh
          </button>
          <button onClick={handleRetryAll} className="flex items-center gap-1 px-3 py-2 border border-[#ffb4ab] text-[#ffb4ab] rounded-sm text-[14px] hover:bg-[#ffb4ab]/10">
            <span className="material-symbols-outlined text-[16px]">replay</span>Retry All Failed
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          {[
            { label: "Total Jobs", value: stats.total, icon: "engineering" },
            { label: "Pending", value: stats.by_status?.pending || 0, icon: "pending", color: "text-[#d97721]" },
            { label: "Processing", value: stats.by_status?.processing || 0, icon: "sync", color: "text-[#3b82f6]" },
            { label: "Failed", value: stats.by_status?.failed || 0, icon: "error", color: "text-[#ffb4ab]" },
            { label: "Avg Time", value: stats.avg_processing_time_ms ? formatDuration(stats.avg_processing_time_ms) : "—", icon: "timer" },
            { label: "Last Completed", value: stats.last_completed_at ? timeAgo(stats.last_completed_at) : "—", icon: "schedule" },
          ].map((s) => (
            <div key={s.label} className="bg-[#1e293b] border border-[rgba(51,65,85,0.5)] rounded-lg p-4 hover-glow stat-card-transition">
              <div className="flex justify-between items-start">
                <div className="text-[13px] text-[#c7c4d7]">{s.label}</div>
                <span className={`material-symbols-outlined text-sm ${s.color || "text-[#c0c1ff]"}`}>{s.icon}</span>
              </div>
              <div className={`font-mono text-2xl font-bold mt-1 ${s.color || "text-[#e4e1ed]"}`}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-3 items-center">
        {["", "pending", "processing", "completed", "failed", "cancelled"].map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`px-3 py-1.5 text-[13px] rounded-sm border transition-colors ${
              statusFilter === s
                ? "bg-[#c0c1ff]/20 border-[#c0c1ff] text-[#c0c1ff]"
                : "border-[#464554] text-[#c7c4d7] hover:bg-[#292932]"
            }`}
          >
            {s || "All"}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-[#1e293b] border border-[rgba(51,65,85,0.5)] rounded-lg overflow-hidden">
        <div className="grid grid-cols-[140px_140px_100px_80px_1fr_100px_80px_80px] gap-2 px-4 py-3 border-b border-[rgba(51,65,85,0.5)] text-[11px] font-bold uppercase tracking-wider text-[#908fa0]">
          <div>Job ID</div><div>Exchange</div><div>Status</div><div>Attempts</div><div>Error</div><div>Created</div><div>Duration</div><div>Actions</div>
        </div>
        {loading ? (
          <div className="flex justify-center py-16">
            <span className="material-symbols-outlined animate-spin text-3xl text-[#c0c1ff]">progress_activity</span>
          </div>
        ) : jobs.map((j) => (
          <div key={j.id} className="grid grid-cols-[140px_140px_100px_80px_1fr_100px_80px_80px] gap-2 px-4 py-3 border-b border-[rgba(51,65,85,0.3)] hover:bg-[#334155]/20">
            <div className="font-mono text-[13px] text-[#e4e1ed] truncate">{j.id}</div>
            <div className="font-mono text-[13px] text-[#c0c1ff] truncate">{j.exchange_id}</div>
            <div><span className={`badge border ${STATUS_STYLES[j.status === "done" ? "completed" : j.status] || STATUS_STYLES.pending}`}>{j.status === "done" ? "completed" : j.status}</span></div>
            <div className="font-mono text-[13px] text-[#c7c4d7]">{j.attempts}/{j.max_attempts}</div>
            <div className="text-[13px] text-[#ffb4ab] truncate">{j.error || "-"}</div>
            <div className="font-mono text-[13px] text-[#c7c4d7]">{timeAgo(j.created_at)}</div>
            <div className="font-mono text-[13px] text-[#c7c4d7]">
              {j.started_at && j.completed_at ? formatDuration(new Date(j.completed_at).getTime() - new Date(j.started_at).getTime()) : "—"}
            </div>
            <div className="flex gap-2">
              {j.status === "failed" && (
                <button onClick={() => handleRetry(j.id)} className="text-[#c0c1ff] hover:text-[#e1e0ff]" title="Retry">
                  <span className="material-symbols-outlined text-[18px]">replay</span>
                </button>
              )}
              {j.status === "pending" && (
                <button onClick={() => handleCancel(j.id)} className="text-[#908fa0] hover:text-[#ffb4ab]" title="Cancel">
                  <span className="material-symbols-outlined text-[18px]">cancel</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

