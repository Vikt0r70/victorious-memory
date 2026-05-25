"use client";
import { useEffect, useState } from "react";
import { projectsApi, memoriesApi } from "@/lib/api";
import Link from "next/link";

function timeAgo(d: string) {
  if (!d) return "";
  const diff = Date.now() - new Date(d).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 24) return h < 1 ? "just now" : `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    projectsApi.list().then((d) => { setProjects(d.items || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><span className="material-symbols-outlined animate-spin text-4xl text-[#c0c1ff]">progress_activity</span></div>;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-[30px] leading-[38px] font-semibold tracking-tight">Projects</h1>
        <p className="text-[#c7c4d7] text-[14px] mt-1">Registered workspaces and their memory profiles</p>
      </div>
      {projects.length === 0 ? (
        <div className="bg-[#1e293b] border border-[rgba(51,65,85,0.5)] rounded-lg p-12 text-center">
          <span className="material-symbols-outlined text-5xl text-[#908fa0] mb-3">folder_off</span>
          <h2 className="text-[18px] font-semibold mb-1">No Projects Yet</h2>
          <p className="text-[#c7c4d7]">Projects are auto-detected when you use OpenCode in a workspace.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map((p, i) => (
            <Link key={p.id} href={`/projects/${p.id}`} className={`bg-[#1e293b] border border-[rgba(51,65,85,0.5)] rounded-lg p-5 hover-glow stat-card-transition cursor-pointer fade-in-up delay-${(i + 1) * 100}`}>
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-[18px] font-semibold text-[#e4e1ed]">{p.display_name}</h3>
                <div className="w-2 h-2 rounded-full bg-[#4ade80] mt-2" />
              </div>
              <div className="font-mono text-[12px] text-[#908fa0] mb-3">{p.workspace_path}</div>
              {p.tech_stack && p.tech_stack.length > 0 && (
                <div className="flex gap-1 flex-wrap mb-3">
                  {p.tech_stack.map((t: string) => (
                    <span key={t} className="badge bg-[#292932] border border-[#464554] text-[#c7c4d7]">{t}</span>
                  ))}
                </div>
              )}
              <div className="text-[13px] text-[#c7c4d7]">
                Created {timeAgo(p.created_at)}
              </div>
              <div className="mt-3 text-[13px] text-[#c0c1ff] font-semibold flex items-center gap-1">
                View Project <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

