"use client";

import { useEffect, useState } from "react";
import { memoriesApi, graphApi } from "@/lib/api";

interface Props {
  memoryId: string;
  onClose: () => void;
  onEdit?: (memory: any) => void;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onDelete?: (id: string) => void;
}

const TYPE_COLORS: Record<string, string> = {
  decision: "bg-primary/10 border-primary/20 text-primary",
  preference: "bg-primary/10 border-primary/20 text-primary",
  bugfix: "bg-destructive/10 border-destructive/20 text-destructive",
  lesson: "bg-success/10 border-success/20 text-success",
  pattern: "bg-accent border-border text-foreground",
  research: "bg-accent border-border text-foreground",
  reference: "bg-accent border-border text-foreground",
  architecture: "bg-accent border-border text-foreground",
  constraint: "bg-destructive/10 border-destructive/20 text-destructive",
  context: "bg-muted border-border text-muted-foreground",
};

export default function MemoryDetailModal({
  memoryId,
  onClose,
  onEdit,
  onApprove,
  onReject,
  onDelete,
}: Props) {
  const [memory, setMemory] = useState<any>(null);
  const [edges, setEdges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pinning, setPinning] = useState(false);

  const handleTogglePin = async () => {
    if (!memory || pinning) return;
    setPinning(true);
    try {
      const updated = await memoriesApi.pin(memory.id);
      setMemory(updated);
    } catch (e) {
      console.error("Failed to toggle pin", e);
    } finally {
      setPinning(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [mem, edg] = await Promise.all([
          memoriesApi.get(memoryId),
          graphApi.listEdges({ memory_id: memoryId }),
        ]);
        setMemory(mem);
        setEdges(edg.items || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [memoryId]);

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex justify-end"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-card border-l border-input w-full max-w-md h-full overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-input sticky top-0 bg-card z-10">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">info</span>
            <h2 className="text-[18px] font-semibold text-foreground">
              Memory Detail
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <span className="material-symbols-outlined animate-spin text-3xl text-primary">
              progress_activity
            </span>
          </div>
        ) : !memory ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            Memory not found
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Content */}
            <div>
              <p className="text-[16px] text-foreground leading-relaxed">
                {memory.content}
              </p>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap gap-2 items-center">
              {memory.pinned && (
                <span className="badge bg-amber-500/10 border-amber-500/30 text-amber-400 flex items-center gap-1 font-semibold">
                  <span className="material-symbols-outlined text-[14px]">push_pin</span>
                  Pinned Core
                </span>
              )}
              <span className={`badge border ${TYPE_COLORS[memory.memory_type] || TYPE_COLORS.context}`}>
                {memory.memory_type}
              </span>
              <span className="badge bg-muted border border-border text-muted-foreground">
                {memory.scope}
              </span>
              <span className={`badge border ${
                memory.status === "active"
                  ? "bg-success/10 border-[#4ade80] text-success"
                  : memory.status === "pending_review"
                  ? "bg-info/10 border-info text-info"
                  : "bg-destructive/10 border-[#ffb4ab] text-destructive"
              }`}>
                {memory.status}
              </span>
              <span className="badge bg-accent border border-border text-muted-foreground">
                {memory.source_type}
              </span>
            </div>

            {/* Confidence */}
            <div className="bg-background border border-input rounded-md shadow-sm p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Confidence
                </span>
                <span className="font-mono text-[14px] text-foreground">
                  {(memory.confidence_score || 0).toFixed(2)}
                </span>
              </div>
              <div className="w-full h-2 bg-card rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${(memory.confidence_score || 0) * 100}%`,
                    backgroundColor:
                      memory.confidence_score > 0.8
                        ? "#4ade80"
                        : memory.confidence_score > 0.5
                        ? "#d97721"
                        : "#ffb4ab",
                  }}
                />
              </div>
              {memory.confidence_reasoning && (
                <p className="text-[13px] text-muted-foreground italic">
                  {memory.confidence_reasoning}
                </p>
              )}
            </div>

            {/* Tags */}
            {memory.tags && memory.tags.length > 0 && (
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-2">
                  Tags
                </span>
                <div className="flex flex-wrap gap-2">
                  {memory.tags.map((tag: string) => (
                    <span key={tag} className="badge bg-accent border border-border text-muted-foreground">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Metadata */}
            <div className="bg-background border border-input rounded-md shadow-sm p-4 space-y-2 text-[13px]">
              <div className="flex justify-between">
                <span className="text-muted-foreground">ID</span>
                <span className="font-mono text-muted-foreground">{memory.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span className="font-mono text-muted-foreground">{memory.created_at}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Updated</span>
                <span className="font-mono text-muted-foreground">{memory.updated_at}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last Accessed</span>
                <span className="font-mono text-muted-foreground">{memory.last_accessed || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Access Count</span>
                <span className="font-mono text-muted-foreground">{memory.access_count || 0}</span>
              </div>
            </div>

            {/* Source */}
            {memory.source_exchange_id && (
              <div className="bg-background border border-input rounded-md shadow-sm p-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-2">
                  Source
                </span>
                <a
                  href={`/exchanges/${memory.source_exchange_id}`}
                  className="flex items-center gap-1 text-[13px] text-primary hover:underline"
                >
                  <span className="material-symbols-outlined text-[16px]">link</span>
                  Session: {memory.source_session}
                </a>
              </div>
            )}

            {/* Connected Edges */}
            {edges.length > 0 && (
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-2">
                  Connected Edges
                </span>
                <div className="space-y-2">
                  {edges.map((edge: any) => (
                    <div
                      key={edge.id}
                      className="bg-background border border-input rounded-md shadow-sm p-3 text-[13px]"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="badge bg-[#a855f7]/10 border-[#a855f7] text-accent-foreground text-[10px]">
                          {edge.relation_type}
                        </span>
                        <span className="text-muted-foreground">
                          {(edge.confidence || 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="text-muted-foreground truncate">
                        {edge.description || `${edge.source_id} → ${edge.target_id}`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-4 border-t border-input sticky bottom-0 bg-card pb-4">
              <button
                onClick={handleTogglePin}
                disabled={pinning}
                className={`flex-1 px-4 py-2 text-[14px] border rounded-sm transition-colors flex items-center justify-center gap-1 cursor-pointer ${
                  memory.pinned
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                    : "border-input text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
                title={memory.pinned ? "Unpin from Core Rules" : "Pin to Core Rules (Always injected)"}
              >
                <span className="material-symbols-outlined text-[16px]">
                  {memory.pinned ? "keep_off" : "push_pin"}
                </span>
                {memory.pinned ? "Unpin" : "Pin Core"}
              </button>
              {onEdit && (
                <button
                  onClick={() => onEdit(memory)}
                  className="flex-1 px-4 py-2 text-[14px] border border-primary text-primary rounded-sm hover:bg-primary/10 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">edit</span>
                  Edit
                </button>
              )}
              {memory.status === "pending_review" && onApprove && (
                <button
                  onClick={() => onApprove(memory.id)}
                  className="flex-1 px-4 py-2 text-[14px] bg-[#4ade80] text-[#0d0d15] font-semibold rounded-sm hover:bg-[#22c55e] transition-colors flex items-center justify-center gap-1"
                >
                  <span className="material-symbols-outlined text-[16px]">check</span>
                  Approve
                </button>
              )}
              {memory.status === "pending_review" && onReject && (
                <button
                  onClick={() => onReject(memory.id)}
                  className="flex-1 px-4 py-2 text-[14px] bg-destructive text-destructive-foreground rounded-md shadow-sm hover:bg-destructive/80 transition-colors flex items-center justify-center gap-1"
                >
                  <span className="material-symbols-outlined text-[16px]">block</span>
                  Reject
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => onDelete(memory.id)}
                  className="px-4 py-2 text-[14px] text-muted-foreground hover:text-destructive transition-colors"
                >
                  <span className="material-symbols-outlined">delete</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

