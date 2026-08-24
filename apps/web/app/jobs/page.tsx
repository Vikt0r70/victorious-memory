"use client";
import { useEffect, useState } from "react";
import { jobsApi } from "@/lib/api";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import ErrorBanner from "@/components/ui/ErrorBanner";
import EmptyState from "@/components/ui/EmptyState";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-info/10 border-info text-info",
  processing: "bg-[#3b82f6]/10 border-[#3b82f6] text-info",
  completed: "bg-success/10 border-[#4ade80] text-success",
  failed: "bg-destructive/10 border-[#ffb4ab] text-destructive",
  cancelled: "bg-[#908fa0]/10 border-[#908fa0] text-muted-foreground",
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
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
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
    } catch (e: any) {
      setError(e.message || "Failed to load jobs");
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [page, statusFilter]);

  const handleRetry = async (id: string) => {
    setError(null);
    try { await jobsApi.retry(id); load(); }
    catch (e: any) { setError(e.message || "Failed to retry job"); }
  };
  const handleCancel = async (id: string) => {
    setError(null);
    try { await jobsApi.cancel(id); load(); }
    catch (e: any) { setError(e.message || "Failed to cancel job"); }
  };
  const handleRetryAll = async () => {
    setError(null);
    try { await jobsApi.retryAllFailed(); load(); }
    catch (e: any) { setError(e.message || "Failed to retry all failed jobs"); }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-[30px] leading-[38px] font-semibold tracking-tight">Extraction Jobs</h1>
          <p className="text-muted-foreground text-[14px] mt-1">Background memory extraction pipeline</p>
        </div>
        <div className="flex gap-3">
          <button onClick={load} className="cursor-pointer flex items-center gap-1 px-3 py-2 border border-input rounded-md shadow-sm text-[14px] text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all duration-200 duration-200">
            <span className="material-symbols-outlined text-[16px]">refresh</span>Refresh
          </button>
          <button onClick={handleRetryAll} className="cursor-pointer flex items-center gap-1 px-3 py-2 border border-[#ffb4ab] text-destructive rounded-sm text-[14px] hover:bg-destructive/10 transition-colors duration-200">
            <span className="material-symbols-outlined text-[16px]">replay</span>Retry All Failed
          </button>
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          {[
            { label: "Total Jobs", value: stats.total, icon: "engineering" },
            { label: "Pending", value: stats.by_status?.pending || 0, icon: "pending", color: "text-info" },
            { label: "Processing", value: stats.by_status?.processing || 0, icon: "sync", color: "text-info" },
            { label: "Failed", value: stats.by_status?.failed || 0, icon: "error", color: "text-destructive" },
            { label: "Avg Time", value: stats.avg_processing_time_ms ? formatDuration(stats.avg_processing_time_ms) : "—", icon: "timer" },
            { label: "Last Completed", value: stats.last_completed_at ? timeAgo(stats.last_completed_at) : "—", icon: "schedule" },
          ].map((s) => (
            <div key={s.label} className="bg-card border border-border rounded-lg p-4 hover-glow stat-card-transition hover:bg-accent hover:text-accent-foreground transition-all duration-200 duration-200">
              <div className="flex justify-between items-start">
                <div className="text-[13px] text-muted-foreground">{s.label}</div>
                <span className={`material-symbols-outlined text-sm ${s.color || "text-primary"}`}>{s.icon}</span>
              </div>
              <div className={`font-mono text-2xl font-bold mt-1 ${s.color || "text-foreground"}`}>{s.value}</div>
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
            className={`cursor-pointer px-3 py-2 text-[13px] rounded-sm border transition-colors duration-200 ${
              statusFilter === s
                ? "bg-primary/20 border-primary text-primary"
                : "border-input text-muted-foreground hover:bg-accent"
            }`}
          >
            {s || "All"}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="grid grid-cols-[140px_140px_100px_80px_1fr_100px_80px_80px] gap-2 px-4 py-3 border-b border-border text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          <div>Job ID</div><div>Exchange</div><div>Status</div><div>Attempts</div><div>Error</div><div>Created</div><div>Duration</div><div>Actions</div>
        </div>
        {loading ? (
          <div className="flex justify-center py-16">
            <LoadingSpinner />
          </div>
        ) : jobs.length === 0 ? (
          <EmptyState title="No jobs found" message="Background extraction jobs will appear here." icon="work" />
        ) : (
          jobs.map((j) => (
            <div key={j.id} className="cursor-pointer grid grid-cols-[140px_140px_100px_80px_1fr_100px_80px_80px] gap-2 px-4 py-3 border-b border-[rgba(51,65,85,0.3)] hover:bg-accent hover:text-accent-foreground transition-all duration-200 duration-200">
              <div className="font-mono text-[13px] text-foreground truncate">{j.id}</div>
              <div className="font-mono text-[13px] text-primary truncate">{j.exchange_id}</div>
              <div><span className={`badge border ${STATUS_STYLES[j.status === "done" ? "completed" : j.status] || STATUS_STYLES.pending}`}>{j.status === "done" ? "completed" : j.status}</span></div>
              <div className="font-mono text-[13px] text-muted-foreground">{j.attempts}/{j.max_attempts}</div>
              <div className="text-[13px] text-destructive truncate">{j.error || "-"}</div>
              <div className="font-mono text-[13px] text-muted-foreground">{timeAgo(j.created_at)}</div>
              <div className="font-mono text-[13px] text-muted-foreground">
                {j.started_at && j.completed_at ? formatDuration(new Date(j.completed_at).getTime() - new Date(j.started_at).getTime()) : "—"}
              </div>
              <div className="flex gap-2">
                {j.status === "failed" && (
                  <button onClick={() => handleRetry(j.id)} className="cursor-pointer text-primary hover:text-[#e1e0ff]" title="Retry">
                    <span className="material-symbols-outlined text-[18px]">replay</span>
                  </button>
                )}
                {j.status === "pending" && (
                  <button onClick={() => handleCancel(j.id)} className="cursor-pointer text-muted-foreground hover:text-destructive" title="Cancel">
                    <span className="material-symbols-outlined text-[18px]">cancel</span>
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
