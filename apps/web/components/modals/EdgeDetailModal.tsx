"use client";

import { graphApi } from "@/lib/api";

const EDGE_COLORS: Record<string, string> = {
  supersedes: "text-[#f97316] border-[#f97316]",
  contradicts: "text-[#ef4444] border-[#ef4444]",
  depends_on: "text-[#3b82f6] border-[#3b82f6]",
  caused_by: "text-[#a855f7] border-[#a855f7]",
  fixed_by: "text-[#22c55e] border-[#22c55e]",
  enables: "text-[#eab308] border-[#eab308]",
  related_to: "text-[#6b7280] border-[#6b7280]",
  consolidates: "text-[#14b8a6] border-[#14b8a6]",
};

interface Props {
  edge: any;
  onClose: () => void;
  onDelete?: (id: string) => void;
}

export default function EdgeDetailModal({ edge, onClose, onDelete }: Props) {
  const handleDelete = async () => {
    if (!onDelete) return;
    try {
      await graphApi.deleteEdge(edge.id);
      onDelete(edge.id);
      onClose();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[#1e293b] border border-[#464554] rounded-xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#464554]">
          <div className="flex items-center gap-2">
            <span className={`material-symbols-outlined ${EDGE_COLORS[edge.relation_type]?.split(" ")[0] || "text-[#c0c1ff]"}`}>
              {edge.relation_type === "supersedes" ? "update" :
               edge.relation_type === "contradicts" ? "error" :
               edge.relation_type === "depends_on" ? "account_tree" :
               edge.relation_type === "caused_by" ? "bubble_chart" :
               edge.relation_type === "fixed_by" ? "bug_report" :
               edge.relation_type === "enables" ? "bolt" :
               edge.relation_type === "consolidates" ? "merge_type" : "link"}
            </span>
            <h2 className="text-[18px] font-semibold text-[#e4e1ed] capitalize">
              {edge.relation_type?.replace("_", " ")}
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
          {/* Source → Target */}
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-[#0d0d15] border border-[#464554] rounded-sm p-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#908fa0] block mb-1">Source</span>
              <span className="text-[13px] text-[#c7c4d7] font-mono">{edge.source_id}</span>
              {edge.source && (
                <p className="text-[12px] text-[#e4e1ed] mt-1 line-clamp-2">{edge.source.content}</p>
              )}
            </div>
            <span className="material-symbols-outlined text-[#c0c1ff]">arrow_forward</span>
            <div className="flex-1 bg-[#0d0d15] border border-[#464554] rounded-sm p-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#908fa0] block mb-1">Target</span>
              <span className="text-[13px] text-[#c7c4d7] font-mono">{edge.target_id}</span>
              {edge.target && (
                <p className="text-[12px] text-[#e4e1ed] mt-1 line-clamp-2">{edge.target.content}</p>
              )}
            </div>
          </div>

          {/* Description */}
          {edge.description && (
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#c7c4d7] block mb-1.5">Description</span>
              <p className="text-[14px] text-[#e4e1ed] bg-[#0d0d15] border border-[#464554] rounded-sm p-3">
                {edge.description}
              </p>
            </div>
          )}

          {/* Confidence */}
          <div className="flex items-center justify-between bg-[#0d0d15] border border-[#464554] rounded-sm p-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#c7c4d7]">Confidence</span>
            <span className="font-mono text-[14px] text-[#e4e1ed]">{(edge.confidence || 0).toFixed(2)}</span>
          </div>

          {/* Created */}
          <div className="flex items-center justify-between bg-[#0d0d15] border border-[#464554] rounded-sm p-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#c7c4d7]">Created</span>
            <span className="font-mono text-[13px] text-[#c7c4d7]">{edge.created_at || "—"}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-[#464554]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[14px] text-[#c7c4d7] border border-[#464554] rounded-sm hover:bg-[#292932] transition-colors"
          >
            Close
          </button>
          {onDelete && (
            <button
              onClick={handleDelete}
              className="px-4 py-2 text-[14px] border border-[#ffb4ab] text-[#ffb4ab] rounded-sm hover:bg-[#ffb4ab]/10 transition-colors flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">delete</span>
              Delete Edge
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

