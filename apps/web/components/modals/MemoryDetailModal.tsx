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
  decision: "bg-[#8083ff]/10 border-[#8083ff] text-[#8083ff]",
  preference: "bg-[#c0c1ff]/10 border-[#c0c1ff] text-[#c0c1ff]",
  constraint: "bg-[#bcc7de]/10 border-[#bcc7de] text-[#bcc7de]",
  bugfix: "bg-[#ffb4ab]/10 border-[#ffb4ab] text-[#ffb4ab]",
  lesson: "bg-[#4ade80]/10 border-[#4ade80] text-[#4ade80]",
  pattern: "bg-[#a855f7]/10 border-[#a855f7] text-[#a855f7]",
  research: "bg-[#3b82f6]/10 border-[#3b82f6] text-[#3b82f6]",
  reference: "bg-[#f97316]/10 border-[#f97316] text-[#f97316]",
  architecture: "bg-[#d97721]/10 border-[#d97721] text-[#d97721]",
  context: "bg-[#908fa0]/10 border-[#908fa0] text-[#908fa0]",
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
      <div className="bg-[#1e293b] border-l border-[#464554] w-full max-w-md h-full overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#464554] sticky top-0 bg-[#1e293b] z-10">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#c0c1ff]">info</span>
            <h2 className="text-[18px] font-semibold text-[#e4e1ed]">
              Memory Detail
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-[#c7c4d7] hover:text-[#e4e1ed] transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <span className="material-symbols-outlined animate-spin text-3xl text-[#c0c1ff]">
              progress_activity
            </span>
          </div>
        ) : !memory ? (
          <div className="flex-1 flex items-center justify-center text-[#908fa0]">
            Memory not found
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Content */}
            <div>
              <p className="text-[16px] text-[#e4e1ed] leading-relaxed">
                {memory.content}
              </p>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap gap-2">
              <span className={`badge border ${TYPE_COLORS[memory.memory_type] || TYPE_COLORS.context}`}>
                {memory.memory_type}
              </span>
              <span className="badge bg-[#34343d] border border-[#464554] text-[#c7c4d7]">
                {memory.scope}
              </span>
              <span className={`badge border ${
                memory.status === "active"
                  ? "bg-[#4ade80]/10 border-[#4ade80] text-[#4ade80]"
                  : memory.status === "pending_review"
                  ? "bg-[#d97721]/10 border-[#d97721] text-[#d97721]"
                  : "bg-[#ffb4ab]/10 border-[#ffb4ab] text-[#ffb4ab]"
              }`}>
                {memory.status}
              </span>
              <span className="badge bg-[#292932] border border-[#464554] text-[#c7c4d7]">
                {memory.source_type}
              </span>
            </div>

            {/* Confidence */}
            <div className="bg-[#0d0d15] border border-[#464554] rounded-sm p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#c7c4d7]">
                  Confidence
                </span>
                <span className="font-mono text-[14px] text-[#e4e1ed]">
                  {(memory.confidence_score || 0).toFixed(2)}
                </span>
              </div>
              <div className="w-full h-2 bg-[#1e293b] rounded-full overflow-hidden">
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
                <p className="text-[13px] text-[#908fa0] italic">
                  {memory.confidence_reasoning}
                </p>
              )}
            </div>

            {/* Tags */}
            {memory.tags && memory.tags.length > 0 && (
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#c7c4d7] block mb-2">
                  Tags
                </span>
                <div className="flex flex-wrap gap-2">
                  {memory.tags.map((tag: string) => (
                    <span key={tag} className="badge bg-[#292932] border border-[#464554] text-[#c7c4d7]">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Metadata */}
            <div className="bg-[#0d0d15] border border-[#464554] rounded-sm p-4 space-y-2 text-[13px]">
              <div className="flex justify-between">
                <span className="text-[#908fa0]">ID</span>
                <span className="font-mono text-[#c7c4d7]">{memory.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#908fa0]">Created</span>
                <span className="font-mono text-[#c7c4d7]">{memory.created_at}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#908fa0]">Updated</span>
                <span className="font-mono text-[#c7c4d7]">{memory.updated_at}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#908fa0]">Last Accessed</span>
                <span className="font-mono text-[#c7c4d7]">{memory.last_accessed || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#908fa0]">Access Count</span>
                <span className="font-mono text-[#c7c4d7]">{memory.access_count || 0}</span>
              </div>
            </div>

            {/* Source */}
            {memory.source_exchange_id && (
              <div className="bg-[#0d0d15] border border-[#464554] rounded-sm p-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#c7c4d7] block mb-2">
                  Source
                </span>
                <a
                  href={`/exchanges/${memory.source_exchange_id}`}
                  className="flex items-center gap-1 text-[13px] text-[#c0c1ff] hover:underline"
                >
                  <span className="material-symbols-outlined text-[16px]">link</span>
                  Session: {memory.source_session}
                </a>
              </div>
            )}

            {/* Connected Edges */}
            {edges.length > 0 && (
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#c7c4d7] block mb-2">
                  Connected Edges
                </span>
                <div className="space-y-2">
                  {edges.map((edge: any) => (
                    <div
                      key={edge.id}
                      className="bg-[#0d0d15] border border-[#464554] rounded-sm p-3 text-[13px]"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="badge bg-[#a855f7]/10 border-[#a855f7] text-[#a855f7] text-[10px]">
                          {edge.relation_type}
                        </span>
                        <span className="text-[#908fa0]">
                          {(edge.confidence || 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="text-[#c7c4d7] truncate">
                        {edge.description || `${edge.source_id} → ${edge.target_id}`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-4 border-t border-[#464554] sticky bottom-0 bg-[#1e293b] pb-4">
              {onEdit && (
                <button
                  onClick={() => onEdit(memory)}
                  className="flex-1 px-4 py-2 text-[14px] border border-[#c0c1ff] text-[#c0c1ff] rounded-sm hover:bg-[#c0c1ff]/10 transition-colors flex items-center justify-center gap-1"
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
                  className="flex-1 px-4 py-2 text-[14px] bg-[#93000a] text-[#ffb4ab] rounded-sm hover:bg-[#93000a]/80 transition-colors flex items-center justify-center gap-1"
                >
                  <span className="material-symbols-outlined text-[16px]">block</span>
                  Reject
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => onDelete(memory.id)}
                  className="px-4 py-2 text-[14px] text-[#908fa0] hover:text-[#ffb4ab] transition-colors"
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

