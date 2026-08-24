"use client";

import { useEffect, useState } from "react";
import { memoriesApi, jobsApi, activityApi, projectsApi, REQUEST_TIMEOUT_MS } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import ErrorBanner from "@/components/ui/ErrorBanner";
import EmptyState from "@/components/ui/EmptyState";
import { BrainCircuit, PieChart, AlertTriangle, FolderGit2, Cpu, Activity, Info, PlusCircle, CheckCircle2, XCircle, PlayCircle, Edit3, Trash2, Link as LinkIcon, AlertCircle, History, Donut } from "lucide-react";
import { cn } from "@/lib/utils";

function StatCard({
  title,
  value,
  icon: Icon,
  iconClass = "text-primary",
  subtitle,
  subtitleClass,
  badge,
  progress,
  delay,
}: {
  title: string;
  value: string;
  icon?: any;
  iconClass?: string;
  subtitle?: string;
  subtitleClass?: string;
  badge?: string;
  progress?: number;
  delay: string;
}) {
  return (
    <div
      className={cn("flex flex-col gap-2 relative overflow-hidden group fade-in-up transition-all duration-300", delay)}
    >
      <div className="flex justify-between items-start">
        <div className="text-sm text-muted-foreground font-medium">{title}</div>
        {badge ? (
          <Badge variant="destructive" className="animate-pulse shadow-sm text-[10px] h-5 px-1.5 rounded-sm">
            {badge}
          </Badge>
        ) : (
          Icon && <Icon className={cn("size-4 transition-transform duration-300 group-hover:scale-125", iconClass)} />
        )}
      </div>
      <div className={cn("font-mono text-3xl font-bold tracking-tight", subtitleClass || "text-foreground")}>
        {value}
      </div>
      {progress !== undefined && (
        <Progress value={progress} className="h-1.5 mt-1" />
      )}
      {subtitle && (
        <div className={cn("text-xs mt-1", subtitleClass || "text-muted-foreground")}>
          {subtitle}
        </div>
      )}
    </div>
  );
}

const EVENT_ICONS: Record<string, { icon: any; color: string }> = {
  memory_created: { icon: PlusCircle, color: "bg-primary/20 text-primary" },
  memory_approved: { icon: CheckCircle2, color: "bg-success/20 text-success" },
  memory_rejected: { icon: XCircle, color: "bg-destructive/20 text-destructive" },
  extraction_started: { icon: PlayCircle, color: "bg-info/20 text-info" },
  extraction_completed: { icon: CheckCircle2, color: "bg-success/20 text-success" },
  extraction_failed: { icon: AlertTriangle, color: "bg-destructive/20 text-destructive" },
  memory_updated: { icon: Edit3, color: "bg-secondary/20 text-secondary-foreground" },
  memory_deleted: { icon: Trash2, color: "bg-muted text-muted-foreground" },
  edge_created: { icon: LinkIcon, color: "bg-accent text-accent-foreground" },
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
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api";
      const results = await Promise.allSettled([
        memoriesApi.stats(),
        jobsApi.stats(),
        activityApi.list({ limit: "10" }),
        projectsApi.list(),
        fetch(`${API_BASE.replace("/api", "")}/health`, {
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        }).then((r) => r.json().catch(() => ({ status: "unknown" }))),
      ]);
      const [s, j, a, p, h] = results.map((r) => (r.status === "fulfilled" ? r.value : null));
      if (s) setStats(s);
      if (j) setJobStats(j);
      if (a) setActivity(a.items || []);
      if (p) setProjects(p);
      if (h) setHealth(h);
      const failures = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
      if (failures.length === results.length) {
        setError(failures[0]?.reason?.message || "Failed to load dashboard data");
      } else if (failures.length > 0) {
        setError(`Some panels failed to load: ${failures.map((f) => f.reason?.message || "error").join(" · ")}`);
      } else {
        setError(null);
      }
      setLoading(false);
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
    <div className="flex flex-col gap-6">
      {error && <ErrorBanner message={error} />}

      {/* Stats Cards */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <Card className="hover:border-primary/50 transition-colors shadow-sm">
          <CardContent className="p-5">
            <StatCard
              title="Total Memories"
              value={total.toLocaleString()}
              icon={BrainCircuit}
              delay="delay-100"
            />
          </CardContent>
        </Card>
        <Card className="hover:border-primary/50 transition-colors shadow-sm">
          <CardContent className="p-5">
            <StatCard
              title="Active / Total"
              value={`${pct}%`}
              icon={PieChart}
              iconClass="text-secondary-foreground"
              progress={parseFloat(pct)}
              delay="delay-200"
            />
          </CardContent>
        </Card>
        <Card className="hover:border-primary/50 transition-colors shadow-sm">
          <CardContent className="p-5">
            <StatCard
              title="Pending Review"
              value={pending.toLocaleString()}
              badge={pending > 0 ? "CRITICAL" : undefined}
              subtitleClass={pending > 0 ? "text-destructive" : undefined}
              subtitle="Requires human verification"
              delay="delay-300"
            />
          </CardContent>
        </Card>
        <Card className="hover:border-primary/50 transition-colors shadow-sm">
          <CardContent className="p-5">
            <StatCard
              title="Active Projects"
              value={projectCount.toLocaleString()}
              icon={FolderGit2}
              iconClass="text-info"
              delay="delay-400"
            />
          </CardContent>
        </Card>
        <Card className="hover:border-primary/50 transition-colors shadow-sm">
          <CardContent className="p-5">
            <StatCard
              title="Extraction Jobs"
              value={jobsRunning.toLocaleString()}
              icon={Cpu}
              iconClass="text-secondary-foreground"
              subtitle={
                jobsFailed > 0
                  ? `${jobsFailed} failed`
                  : `${jobStats?.total || 0} total`
              }
              subtitleClass={jobsFailed > 0 ? "text-destructive" : undefined}
              delay="delay-500"
            />
          </CardContent>
        </Card>
        <Card className="hover:border-primary/50 transition-colors shadow-sm">
          <CardContent className="p-5">
            <StatCard
              title="System Health"
              value={health?.status === "ok" ? "Healthy" : "Check"}
              icon={Activity}
              iconClass={health?.status === "ok" ? "text-success" : "text-destructive"}
              subtitle={health?.version ? `v${health.version}` : "All systems nominal"}
              delay="delay-600"
            />
          </CardContent>
        </Card>
      </section>

      {/* Bottom Row */}
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Activity Feed */}
        <Card className="xl:col-span-2 flex flex-col overflow-hidden h-[600px] fade-in-up delay-700 shadow-sm border-border">
          <div className="px-5 py-4 border-b border-border flex justify-between items-center bg-muted/20">
            <div className="text-base font-semibold flex items-center gap-2">
              <History className="size-4 text-muted-foreground" />
              Recent Activity
            </div>
            <a
              href="/activity"
              className="text-primary hover:text-primary/80 text-sm font-medium transition-colors"
            >
              View All
            </a>
          </div>
          <div className="flex-1 overflow-y-auto">
            {activity.length === 0 ? (
              <EmptyState title="No recent activity" message="System events will appear here once data is ingested." icon={Activity} />
            ) : (
              activity.map((item, i) => {
                const ev =
                  EVENT_ICONS[item.event_type] ||
                  EVENT_ICONS.memory_created;
                const Icon = ev.icon;
                return (
                  <div
                    key={item.id}
                    className="group flex items-start gap-4 p-5 border-b border-border/50 hover:bg-accent/30 transition-all duration-300 cursor-pointer"
                  >
                    <div
                      className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 transition-transform duration-300 group-hover:scale-110", ev.color)}
                    >
                      <Icon className="size-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline mb-1">
                        <div className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                          {item.event_type
                            .replace(/_/g, " ")
                            .replace(/\b\w/g, (c: string) =>
                              c.toUpperCase()
                            )}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono shrink-0 ml-4">
                          {timeAgo(item.created_at)}
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground truncate group-hover:text-foreground transition-colors">
                        {item.description}
                      </div>
                      {(item.memory_id || item.project_id) && (
                        <div className="mt-2.5 flex gap-2">
                          {item.memory_id && (
                            <Badge variant="secondary" className="font-mono text-[10px] uppercase rounded-[4px] h-5 px-1.5">
                              {item.memory_id.slice(0, 12)}
                            </Badge>
                          )}
                          {item.project_id && (
                            <Badge variant="outline" className="font-mono text-[10px] text-info border-info/20 bg-info/10 uppercase rounded-[4px] h-5 px-1.5">
                              {item.project_id}
                            </Badge>
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
        <Card className="flex flex-col overflow-hidden h-[600px] fade-in-up delay-800 shadow-sm border-border">
          <div className="px-5 py-4 border-b border-border flex justify-between items-center bg-muted/20">
            <div className="text-base font-semibold flex items-center gap-2">
              <PieChart className="size-4 text-muted-foreground" />
              Memories by Type
            </div>
          </div>
          <div className="flex-1 p-6 flex flex-col items-center justify-center bg-background/50">
            {stats?.by_type && Object.keys(stats.by_type).length > 0 ? (
              <>
                <DonutChart data={stats.by_type} total={total} />
                <div className="w-full mt-10 space-y-3 px-4">
                  {Object.entries(stats.by_type).map(
                    ([type, count], i) => (
                      <div
                        key={type}
                        className="flex items-center justify-between group cursor-default"
                      >
                        <div className="flex items-center gap-2 transition-transform duration-300 group-hover:translate-x-1">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{
                              backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length],
                            }}
                          />
                          <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors capitalize font-medium">
                            {type.replace(/_/g, " ")}
                          </span>
                        </div>
                        <span className="font-mono text-sm font-semibold text-foreground">
                          {count as number}
                        </span>
                      </div>
                    )
                  )}
                </div>
              </>
            ) : (
              <EmptyState title="No data yet" message="Memories will appear once data is ingested." icon={Donut} />
            )}
          </div>
        </Card>
      </section>
    </div>
  );
}

const DONUT_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--info))",
  "hsl(var(--success))",
  "#a855f7",
  "hsl(var(--destructive))",
  "hsl(var(--muted-foreground))",
  "#f97316",
  "#8083ff",
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
      className="relative w-48 h-48 rounded-full flex items-center justify-center transition-transform duration-500 hover:scale-105 shadow-sm border border-border"
      style={{ background: gradient }}
    >
      <div className="w-36 h-36 bg-card rounded-full flex flex-col items-center justify-center border border-border shadow-inner">
        <span className="font-mono text-3xl font-bold text-foreground">
          {total.toLocaleString()}
        </span>
        <span className="text-[11px] text-muted-foreground font-semibold tracking-wider uppercase mt-1">
          Total
        </span>
      </div>
    </div>
  );
}
