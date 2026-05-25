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
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[#1e293b] border border-[#464554] rounded-xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#464554]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#c0c1ff]">
              add_circle
            </span>
            <h2 className="text-[18px] font-semibold text-[#e4e1ed]">
              Create New Memory
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-[#c7c4d7] hover:text-[#e4e1ed] transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Content */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#c7c4d7] mb-1.5">
              Content
            </label>
            <textarea
              className="w-full bg-[#0d0d15] border border-[#464554] rounded-sm p-3 text-[14px] text-[#e4e1ed] placeholder-[#908fa0] focus:outline-none focus:border-[#c0c1ff] resize-y min-h-[100px]"
              placeholder="Enter the memory content..."
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>

          {/* Type + Scope */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#c7c4d7] mb-1.5">
                Type
              </label>
              <select
                className="w-full bg-[#0d0d15] border border-[#464554] rounded-sm p-2.5 text-[14px] text-[#e4e1ed] focus:outline-none focus:border-[#c0c1ff]"
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
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#c7c4d7] mb-1.5">
                Scope
              </label>
              <select
                className="w-full bg-[#0d0d15] border border-[#464554] rounded-sm p-2.5 text-[14px] text-[#e4e1ed] focus:outline-none focus:border-[#c0c1ff]"
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
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#c7c4d7] mb-1.5">
                Project ID
              </label>
              <input
                className="w-full bg-[#0d0d15] border border-[#464554] rounded-sm p-2.5 text-[14px] text-[#e4e1ed] font-mono placeholder-[#908fa0] focus:outline-none focus:border-[#c0c1ff]"
                placeholder="Optional"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#c7c4d7] mb-1.5">
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
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#c7c4d7] mb-1.5">
              Tags
            </label>
            <input
              className="w-full bg-[#0d0d15] border border-[#464554] rounded-sm p-2.5 text-[14px] text-[#e4e1ed] placeholder-[#908fa0] focus:outline-none focus:border-[#c0c1ff]"
              placeholder="Comma separated tags"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
            />
          </div>

          {error && (
            <div className="text-[#ffb4ab] text-[13px] bg-[#93000a]/20 border border-[#93000a] rounded-sm p-2">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-[#464554]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[14px] text-[#c7c4d7] border border-[#464554] rounded-sm hover:bg-[#292932] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!content.trim() || loading}
            className="px-4 py-2 text-[14px] bg-[#c0c1ff] text-[#1000a9] font-semibold rounded-sm hover:bg-[#e1e0ff] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading && (
              <span className="material-symbols-outlined animate-spin text-[16px]">
                progress_activity
              </span>
            )}
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

