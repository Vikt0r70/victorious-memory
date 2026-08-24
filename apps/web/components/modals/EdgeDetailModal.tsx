"use client";

import { graphApi } from "@/lib/api";

const EDGE_COLORS: Record<string, string> = {
  supersedes: "text-[#f97316] border-[#f97316]",
  contradicts: "text-[#ef4444] border-[#ef4444]",
  depends_on: "text-info border-[#3b82f6]",
  caused_by: "text-accent-foreground border-[#a855f7]",
  fixed_by: "text-success border-[#22c55e]",
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
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-card border border-input rounded-xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-input">
          <div className="flex items-center gap-2">
            <span className={`material-symbols-outlined ${EDGE_COLORS[edge.relation_type]?.split(" ")[0] || "text-primary"}`}>
              {edge.relation_type === "supersedes" ? "update" :
               edge.relation_type === "contradicts" ? "error" :
               edge.relation_type === "depends_on" ? "account_tree" :
               edge.relation_type === "caused_by" ? "bubble_chart" :
               edge.relation_type === "fixed_by" ? "bug_report" :
               edge.relation_type === "enables" ? "bolt" :
               edge.relation_type === "consolidates" ? "merge_type" : "link"}
            </span>
            <h2 className="text-[18px] font-semibold text-foreground capitalize">
              {edge.relation_type?.replace("_", " ")}
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
          {/* Source → Target */}
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-background border border-input rounded-md shadow-sm p-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Source</span>
              <span className="text-[13px] text-muted-foreground font-mono">{edge.source_id}</span>
              {edge.source && (
                <p className="text-[12px] text-foreground mt-1 line-clamp-2">{edge.source.content}</p>
              )}
            </div>
            <span className="material-symbols-outlined text-primary">arrow_forward</span>
            <div className="flex-1 bg-background border border-input rounded-md shadow-sm p-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Target</span>
              <span className="text-[13px] text-muted-foreground font-mono">{edge.target_id}</span>
              {edge.target && (
                <p className="text-[12px] text-foreground mt-1 line-clamp-2">{edge.target.content}</p>
              )}
            </div>
          </div>

          {/* Description */}
          {edge.description && (
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">Description</span>
              <p className="text-[14px] text-foreground bg-background border border-input rounded-md shadow-sm p-3">
                {edge.description}
              </p>
            </div>
          )}

          {/* Confidence */}
          <div className="flex items-center justify-between bg-background border border-input rounded-md shadow-sm p-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Confidence</span>
            <span className="font-mono text-[14px] text-foreground">{(edge.confidence || 0).toFixed(2)}</span>
          </div>

          {/* Created */}
          <div className="flex items-center justify-between bg-background border border-input rounded-md shadow-sm p-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Created</span>
            <span className="font-mono text-[13px] text-muted-foreground">{edge.created_at || "—"}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-input">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[14px] text-muted-foreground border border-input rounded-md shadow-sm hover:bg-accent hover:text-accent-foreground transition-all duration-200"
          >
            Close
          </button>
          {onDelete && (
            <button
              onClick={handleDelete}
              className="px-4 py-2 text-[14px] border border-[#ffb4ab] text-destructive rounded-md shadow-sm hover:bg-destructive/10 transition-colors flex items-center gap-1"
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

