"use client";
import { useEffect, useState } from "react";
import { projectsApi, memoriesApi } from "@/lib/api";
import { useParams } from "next/navigation";
import Link from "next/link";

export default function ProjectDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [project, setProject] = useState<any>(null);
  const [memories, setMemories] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ display_name: "", workspace_path: "" });

  useEffect(() => {
    async function load() {
      try {
        const [p, m, t, s] = await Promise.all([
          projectsApi.get(id),
          memoriesApi.list({ project_id: id, per_page: "10" }),
          projectsApi.timeline(id),
          memoriesApi.stats(id),
        ]);
          setProject(p);
          setForm({ display_name: p.display_name || "", workspace_path: p.workspace_path || "" });
        setMemories(m.items || []);
        setTimeline(t.items || []);
        setStats(s);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
  }, [id]);

  if (loading) return <div className="flex justify-center py-20"><span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span></div>;
  if (!project) return <div className="text-center py-20 text-muted-foreground">Project not found</div>;

  const handleDelete = async () => {
    if (!confirm("Delete this project?")) return;
    await projectsApi.delete(id, true);
    window.location.href = "/projects";
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await projectsApi.update(id, form);
      setProject(updated);
      setEditing(false);
    } catch (e: any) {
      alert(e?.message || "Could not update project");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/projects" className="text-muted-foreground hover:text-foreground">
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
        <div>
          {editing ? (
            <div className="flex flex-col gap-2">
              <input className="bg-card border border-border rounded-md px-3 py-2 text-[18px] font-semibold" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
              <input className="bg-card border border-border rounded-md px-3 py-2 text-[13px] font-mono w-[min(640px,80vw)]" value={form.workspace_path} onChange={(e) => setForm({ ...form, workspace_path: e.target.value })} placeholder="Workspace path" />
              <div className="flex gap-2">
                <button onClick={handleSave} disabled={saving} className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-[13px]">{saving ? "Saving..." : "Save"}</button>
                <button onClick={() => setEditing(false)} className="px-3 py-1.5 border border-border rounded-md text-[13px]">Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <h1 className="text-[30px] leading-[38px] font-semibold tracking-tight">{project.display_name}</h1>
              <div className="font-mono text-[13px] text-muted-foreground">{project.workspace_path}</div>
              <button onClick={() => setEditing(true)} className="mt-2 text-[13px] text-primary font-semibold">Edit project</button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Main Content */}
        <div className="xl:col-span-2 flex flex-col gap-4">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: "Total Memories", value: stats?.total || 0 },
              { label: "Decisions", value: stats?.by_type?.decision || 0 },
              { label: "Bugs Tracked", value: stats?.by_type?.bugfix || 0 },
              { label: "Patterns", value: stats?.by_type?.pattern || 0 },
            ].map((s) => (
              <div key={s.label} className="bg-card border border-border rounded-lg p-4">
                <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{s.label}</div>
                <div className="font-mono text-2xl font-bold text-foreground mt-1">{s.value}</div>
              </div>
            ))}
          </div>

          {/* Recent Memories */}
          <div className="bg-card border border-border rounded-lg">
            <div className="p-4 border-b border-border text-[18px] font-semibold">Recent Memories</div>
            {memories.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No memories yet</div>
            ) : (
              memories.map((m) => (
                <div key={m.id} className="px-4 py-3 border-b border-[rgba(51,65,85,0.3)] hover:bg-muted flex items-center gap-3">
                  <div className="font-mono text-[12px] text-muted-foreground w-16 shrink-0">{m.id.slice(0, 10)}</div>
                  <div className="flex-1 text-[14px] truncate">{m.content}</div>
                  <span className={`badge border ${m.memory_type === "decision" ? "bg-[#8083ff]/10 border-[#8083ff] text-[#8083ff]" : m.memory_type === "bugfix" ? "bg-destructive/10 border-[#ffb4ab] text-destructive" : "bg-secondary/10 border-secondary text-secondary-foreground"}`}>{m.memory_type}</span>
                </div>
              ))
            )}
          </div>

          {/* Danger Zone */}
          <div className="bg-card border border-[#93000a]/30 rounded-lg p-5">
            <h3 className="text-[16px] font-semibold text-destructive mb-2">Danger Zone</h3>
            <p className="text-[13px] text-muted-foreground mb-3">Permanently delete this project and all associated memories.</p>
            <button onClick={handleDelete} className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md shadow-sm hover:bg-destructive/80 text-[14px]">Delete Project</button>
          </div>
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-4">
          {/* Tech Stack */}
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="text-[14px] font-semibold mb-3">Tech Stack</div>
            <div className="flex gap-1.5 flex-wrap">
              {(project.tech_stack || []).map((t: string) => (
                <span key={t} className="badge bg-accent border border-border text-muted-foreground text-[12px] px-2.5 py-1">{t}</span>
              ))}
              {(!project.tech_stack || project.tech_stack.length === 0) && (
                <span className="text-[13px] text-muted-foreground">No tech stack detected</span>
              )}
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="text-[14px] font-semibold mb-3">Activity Timeline</div>
            {timeline.length === 0 ? (
              <div className="text-[13px] text-muted-foreground">No timeline entries yet</div>
            ) : (
              <div className="space-y-4 border-l-2 border-input pl-4">
                {timeline.map((e) => (
                  <div key={e.id}>
                    <div className="text-[11px] font-bold uppercase text-muted-foreground">{new Date(e.created_at).toLocaleDateString()}</div>
                    <div className="text-[14px] text-foreground mt-0.5">{e.title}</div>
                    {e.description && <div className="text-[13px] text-muted-foreground mt-0.5">{e.description}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
