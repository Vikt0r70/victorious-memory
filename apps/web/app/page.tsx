"use client";

import { useEffect, useState } from "react";
import { memoriesApi, jobsApi, activityApi, projectsApi } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import ErrorBanner from "@/components/ui/ErrorBanner";
import EmptyState from "@/components/ui/EmptyState";

function StatCard({
  title,
  value,
  icon,
  iconColor = "text-[#c0c1ff]",
  subtitle,
  subtitleColor,
  badge,
  progress,
  delay,
}: {
  title: string;
  value: string;
  icon: string;
  iconColor?: string;
  subtitle?: string;
  subtitleColor?: string;
  badge?: string;
  progress?: number;
  delay: string;
}) {
  return (
    <div
      className={`flex flex-col gap-2 relative overflow-hidden group fade-in-up ${delay} hover-glow stat-card-transition hover:translate-y-[-2px] transition-all duration-300`}
    >
      <div className="flex justify-between items-start">
        <div className="text-[13px] text-[#c7c4d7]">{title}</div>
        {badge ? (
          <div className="bg-[#d97721]/20 border border-[#d97721] text-[#d97721] font-mono text-[10px] px-1.5 py-0.5 rounded-sm animate-pulse">
            {badge}
          </div>
        ) : (
          <span
            className={`material-symbols-outlined ${iconColor} text-sm transition-transform duration-300 group-hover:scale-125`}
          >
            {icon}
          </span>
        )}
      </div>
      <div
        className={`font-mono text-2xl font-bold ${
          subtitleColor || "text-[#e4e1ed]"
        }`}
      >
        {value}
      </div>
      {progress !== undefined && (
        <div className="w-full bg-[#0d0d15] h-1.5 rounded-full mt-1 overflow-hidden">
          <div
            className="bg-[#bcc7de] h-full rounded-full progress-fill"
            style={{ "--target-width": `${progress}%` } as any}
          />
        </div>
      )}
      {subtitle && (
        <div
          className={`text-xs ${subtitleColor || "text-[#c7c4d7]"} mt-1`}
        >
          {subtitle}
        </div>
      )}
    </div>
  );
}

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

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [jobStats, setJobStats] = useState<any>(null);
  const [activity, setActivity] = useState<any[]>([]);
  const [projects, setProjects] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api";
        const [s, j, a, p, h] = await Promise.all([
          memoriesApi.stats(),
          jobsApi.stats(),
          activityApi.list({ limit: "10" }),
          projectsApi.list(),
          fetch(`${API_BASE.replace("/api", "")}/health`).then((r) => r.json().catch(() => ({ status: "unknown" }))),
        ]);
        setStats(s);
        setJobStats(j);
        setActivity(a.items || []);
        setProjects(p);
        setHealth(h);
      } catch (e: any) {
        setError(e.message || "Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  const total = stats?.total || 0;
  const active = stats?.by_status?.active || 0;
  const pending = stats?.by_status?.pending_review || 0;
  const pct = total > 0 ? ((active / total) * 100).toFixed(1) : "0";
  const projectCount = projects?.items?.length || 0;
  const jobsRunning = jobStats?.by_status?.processing || 0;
  const jobsFailed = jobStats?.by_status?.failed || 0;

  return (
    <div className="flex flex-col gap-4">
      {error && <ErrorBanner message={error} />}

      {/* Stats Cards */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <Card className="bg-[#1f1f27] border border-[#464554] rounded-lg hover:translate-y-[-2px] transition-all duration-300">
          <CardContent className="p-4">
            <StatCard
              title="Total Memories"
              value={total.toLocaleString()}
              icon="memory"
              delay="delay-100"
            />
          </CardContent>
        </Card>
        <Card className="bg-[#1f1f27] border border-[#464554] rounded-lg hover:translate-y-[-2px] transition-all duration-300">
          <CardContent className="p-4">
            <StatCard
              title="Active / Total"
              value={`${pct}%`}
              icon="pie_chart"
              iconColor="text-[#bcc7de]"
              progress={parseFloat(pct)}
              delay="delay-200"
            />
          </CardContent>
        </Card>
        <Card className="bg-[#1f1f27] border border-[#464554] rounded-lg hover:translate-y-[-2px] transition-all duration-300">
          <CardContent className="p-4">
            <StatCard
              title="Pending Review"
              value={pending.toLocaleString()}
              icon=""
              badge={pending > 0 ? "CRITICAL" : undefined}
              subtitleColor={pending > 0 ? "text-[#d97721]" : undefined}
              subtitle="Requires human verification"
              delay="delay-300"
            />
          </CardContent>
        </Card>
        <Card className="bg-[#1f1f27] border border-[#464554] rounded-lg hover:translate-y-[-2px] transition-all duration-300">
          <CardContent className="p-4">
            <StatCard
              title="Active Projects"
              value={projectCount.toLocaleString()}
              icon="folder_open"
              iconColor="text-[#494bd6]"
              delay="delay-400"
            />
          </CardContent>
        </Card>
        <Card className="bg-[#1f1f27] border border-[#464554] rounded-lg hover:translate-y-[-2px] transition-all duration-300">
          <CardContent className="p-4">
            <StatCard
              title="Extraction Jobs"
              value={jobsRunning.toLocaleString()}
              icon="engineering"
              iconColor="text-[#bcc7de]"
              subtitle={
                jobsFailed > 0
                  ? `${jobsFailed} failed`
                  : `${jobStats?.total || 0} total`
              }
              subtitleColor={jobsFailed > 0 ? "text-[#ffb4ab]" : undefined}
              delay="delay-500"
            />
          </CardContent>
        </Card>
        <Card className="bg-[#1f1f27] border border-[#464554] rounded-lg hover:translate-y-[-2px] transition-all duration-300">
          <CardContent className="p-4">
            <StatCard
              title="System Health"
              value={health?.status === "ok" ? "Healthy" : "Check"}
              icon="monitor_heart"
              iconColor={health?.status === "ok" ? "text-[#4ade80]" : "text-[#ffb4ab]"}
              subtitle={health?.version ? `v${health.version}` : "All systems nominal"}
              delay="delay-600"
            />
          </CardContent>
        </Card>
      </section>

      {/* Bottom Row */}
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-4 mt-2">
        {/* Activity Feed */}
        <Card className="xl:col-span-2 bg-[#1f1f27] border border-[#464554] rounded-lg flex flex-col overflow-hidden h-[600px] fade-in-up delay-700 gap-0 p-0">
          <div className="p-4 border-b border-[rgba(51,65,85,0.5)] flex justify-between items-center bg-[#292932]">
            <div className="text-[18px] font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined">history</span>
              Recent Activity
            </div>
            <a
              href="/activity"
              className="text-[#c0c1ff] hover:text-[#e1e0ff] text-sm font-semibold transition-colors"
            >
              View All
            </a>
          </div>
          <div className="flex-1 overflow-y-auto">
            {activity.length === 0 ? (
              <EmptyState title="No recent activity" message="System events will appear here once data is ingested." icon="notifications" />
            ) : (
              activity.map((item, i) => {
                const ev =
                  EVENT_ICONS[item.event_type] ||
                  EVENT_ICONS.memory_created;
                return (
                  <div
                    key={item.id}
                    className="group flex items-start gap-4 p-4 border-b border-[rgba(51,65,85,0.5)] hover:bg-[#334155]/40 hover:translate-x-1 transition-colors transition-transform duration-300 cursor-pointer"
                  >
                    <div
                      className={`w-8 h-8 rounded-full ${ev.color} flex items-center justify-center shrink-0 mt-1 transition-transform duration-300 group-hover:scale-110`}
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {ev.icon}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline mb-1">
                        <div className="text-[14px] font-medium text-[#e4e1ed] truncate">
                          {item.event_type
                            .replace(/_/g, " ")
                            .replace(/\b\w/g, (c: string) =>
                              c.toUpperCase()
                            )}
                        </div>
                        <div className="text-xs text-[#c7c4d7] font-mono shrink-0 ml-4">
                          {timeAgo(item.created_at)}
                        </div>
                      </div>
                      <div className="text-[13px] text-[#c7c4d7] truncate">
                        {item.description}
                      </div>
                      {(item.memory_id || item.project_id) && (
                        <div className="mt-2 flex gap-2">
                          {item.memory_id && (
                            <span className="badge bg-[#bcc7de]/10 border border-[#bcc7de] text-[#bcc7de]">
                              {item.memory_id.slice(0, 12)}
                            </span>
                          )}
                          {item.project_id && (
                            <span className="badge bg-[#d97721]/10 border border-[#d97721] text-[#d97721]">
                              {item.project_id}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* Memories by Type Donut */}
        <Card className="bg-[#1f1f27] border border-[#464554] rounded-lg flex flex-col overflow-hidden h-[600px] fade-in-up delay-800 gap-0 p-0">
          <div className="p-4 border-b border-[rgba(51,65,85,0.5)] flex justify-between items-center bg-[#292932]">
            <div className="text-[18px] font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined">donut_large</span>
              Memories by Type
            </div>
          </div>
          <div className="flex-1 p-6 flex flex-col items-center justify-center">
            {stats?.by_type && Object.keys(stats.by_type).length > 0 ? (
              <>
                <DonutChart data={stats.by_type} total={total} />
                <div className="w-full mt-8 space-y-3">
                  {Object.entries(stats.by_type).map(
                    ([type, count], i) => (
                      <div
                        key={type}
                        className="flex items-center justify-between group cursor-default"
                      >
                        <div className="flex items-center gap-2 transition-transform duration-300 group-hover:translate-x-1">
                          <div
                            className="w-3 h-3 rounded-sm"
                            style={{
                              backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length],
                            }}
                          />
                          <span className="text-[13px] text-[#c7c4d7] group-hover:text-[#e4e1ed] transition-colors capitalize">
                            {type.replace(/_/g, " ")}
                          </span>
                        </div>
                        <span className="font-mono text-xs text-[#e4e1ed]">
                          {count as number}
                        </span>
                      </div>
                    )
                  )}
                </div>
              </>
            ) : (
              <EmptyState title="No data yet" message="Memories will appear once data is ingested." icon="donut_large" />
            )}
          </div>
        </Card>
      </section>
    </div>
  );
}

const DONUT_COLORS = [
  "#8083ff",
  "#bcc7de",
  "#d97721",
  "#3e495d",
  "#c0c1ff",
  "#ffb783",
  "#4ade80",
  "#f97316",
  "#a855f7",
  "#22c55e",
];

function DonutChart({
  data,
  total,
}: {
  data: Record<string, number>;
  total: number;
}) {
  const entries = Object.entries(data);
  let cumulative = 0;
  const segments = entries.map(([, count], i) => {
    const pct = total > 0 ? ((count as number) / total) * 100 : 0;
    const start = cumulative;
    cumulative += pct;
    return `${DONUT_COLORS[i % DONUT_COLORS.length]} ${start}% ${cumulative}%`;
  });

  const gradient = `conic-gradient(${segments.join(", ")})`;

  return (
    <div
      className="relative w-48 h-48 rounded-full flex items-center justify-center transition-transform duration-500 hover:scale-105"
      style={{ background: gradient }}
    >
      <div className="w-36 h-36 bg-[#1e293b] rounded-full flex flex-col items-center justify-center border border-[rgba(51,65,85,0.2)] shadow-inner">
        <span className="font-mono text-2xl font-bold text-[#e4e1ed]">
          {total.toLocaleString()}
        </span>
        <span className="text-[10px] text-[#c7c4d7] tracking-wider uppercase">
          Total
        </span>
      </div>
    </div>
  );
}

