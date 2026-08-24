"use client";

import { useState } from "react";
import { memoriesApi } from "@/lib/api";

const MEMORY_TYPES = [
  "decision", "preference", "constraint", "bugfix", "lesson",
  "pattern", "research", "reference", "architecture", "context",
];

const SCOPES = ["global", "project", "cross_project"];

interface Props {
  onClose: () => void;
  onCreated?: () => void;
}

export default function CreateMemoryModal({ onClose, onCreated }: Props) {
  const [content, setContent] = useState("");
  const [memoryType, setMemoryType] = useState("reference");
  const [scope, setScope] = useState("global");
  const [projectId, setProjectId] = useState("");
  const [confidence, setConfidence] = useState(0.8);
  const [tagsInput, setTagsInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!content.trim()) return;
    setLoading(true);
    setError("");
    try {
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      await memoriesApi.create({
        content,
        memory_type: memoryType,
        scope,
        project_id: projectId || undefined,
        confidence_score: confidence,
        tags: tags.length > 0 ? tags : undefined,
      });
      onCreated?.();
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-card border border-input rounded-xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-input">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">
              add_circle
            </span>
            <h2 className="text-[18px] font-semibold text-foreground">
              Create New Memory
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Content */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
              Content
            </label>
            <textarea
              className="w-full bg-background border border-input rounded-md shadow-sm p-3 text-[14px] text-foreground placeholder-[#908fa0] focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary resize-y min-h-[100px]"
              placeholder="Enter the memory content..."
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>

          {/* Type + Scope */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Type
              </label>
              <select
                className="w-full bg-background border border-input rounded-md shadow-sm p-2.5 text-[14px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer hover:bg-accent/50 transition-colors"
                value={memoryType}
                onChange={(e) => setMemoryType(e.target.value)}
              >
                {MEMORY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Scope
              </label>
              <select
                className="w-full bg-background border border-input rounded-md shadow-sm p-2.5 text-[14px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer hover:bg-accent/50 transition-colors"
                value={scope}
                onChange={(e) => setScope(e.target.value)}
              >
                {SCOPES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Project + Confidence */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Project ID
              </label>
              <input
                className="w-full bg-background border border-input rounded-md shadow-sm p-2.5 text-[14px] text-foreground font-mono placeholder-[#908fa0] focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                placeholder="Optional"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Confidence ({confidence.toFixed(2)})
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                className="w-full mt-2"
                value={confidence}
                onChange={(e) => setConfidence(parseFloat(e.target.value))}
              />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
              Tags
            </label>
            <input
              className="w-full bg-background border border-input rounded-md shadow-sm p-2.5 text-[14px] text-foreground placeholder-[#908fa0] focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              placeholder="Comma separated tags"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
            />
          </div>

          {error && (
            <div className="text-destructive text-[13px] bg-destructive/20 border border-[#93000a] rounded-sm p-2">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-input">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[14px] text-muted-foreground border border-input rounded-md shadow-sm hover:bg-accent hover:text-accent-foreground transition-all duration-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!content.trim() || loading}
            className="px-4 py-2 text-[14px] bg-primary text-primary-foreground font-semibold rounded-md shadow-sm hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-w-[100px]"
          >
            {loading && (
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            )}
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

