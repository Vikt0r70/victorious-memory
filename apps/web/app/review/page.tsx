"use client";

import { useEffect, useState, useCallback } from "react";
import { memoriesApi } from "@/lib/api";
import RejectReasonModal from "@/components/modals/RejectReasonModal";

const TYPE_COLORS: Record<string, string> = {
  decision: "bg-[#8083ff]/10 border-[#8083ff] text-[#8083ff]",
  preference: "bg-[#c0c1ff]/10 border-[#c0c1ff] text-[#c0c1ff]",
  bugfix: "bg-[#ffb4ab]/10 border-[#ffb4ab] text-[#ffb4ab]",
  lesson: "bg-[#4ade80]/10 border-[#4ade80] text-[#4ade80]",
  pattern: "bg-[#a855f7]/10 border-[#a855f7] text-[#a855f7]",
  architecture: "bg-[#d97721]/10 border-[#d97721] text-[#d97721]",
  context: "bg-[#908fa0]/10 border-[#908fa0] text-[#908fa0]",
};

function timeAgo(d: string) {
  if (!d) return "";
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function ReviewPage() {
  const [memories, setMemories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectContent, setRejectContent] = useState("");
  const [similarMap, setSimilarMap] = useState<Record<string, any[]>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await memoriesApi.list({ status: "pending_review", per_page: "50" });
      setMemories(data.items || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (id: string) => {
    await memoriesApi.approve(id);
    load();
  };

  const handleReject = (id: string, content: string) => {
    setRejectId(id);
    setRejectContent(content);
  };

  const handleRejectConfirm = async (id: string, reason: string) => {
    await memoriesApi.reject(id, reason);
    setRejectId(null);
    load();
  };

  const handleDefer = (id: string) => {
    // Defer is a no-op — stays in queue
    console.log("Deferred", id);
  };

  const loadSimilar = async (memory: any) => {
    try {
      const res = await memoriesApi.search(memory.content, memory.project_id, 3);
      setSimilarMap((prev) => ({ ...prev, [memory.id]: res.items || [] }));
    } catch (e) {
      console.error(e);
    }
  };

  const handleBulkApproveHigh = async () => {
    const high = memories.filter((m) => (m.confidence_score || 0) >= 0.85);
    if (high.length > 0) {
      await memoriesApi.bulk("approve", high.map((m) => m.id));
      load();
    }
  };

  const handleBulkRejectLow = async () => {
    const low = memories.filter((m) => (m.confidence_score || 0) < 0.3);
    if (low.length > 0) {
      await memoriesApi.bulk("reject", low.map((m) => m.id));
      load();
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-[30px] leading-[38px] font-semibold tracking-tight">
              Review Queue
            </h1>
            <span className="badge bg-[#d97721]/20 border border-[#d97721] text-[#d97721] text-[12px] px-2 py-1">
              {memories.length} Pending
            </span>
          </div>
          <p className="text-[#c7c4d7] text-[14px] mt-1">
            Review extracted memories before they are committed to the graph.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleBulkApproveHigh}
            className="flex items-center gap-1 px-3 py-2 border border-[#4ade80] text-[#4ade80] rounded-sm text-[14px] hover:bg-[#4ade80]/10 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">done_all</span>
            Approve High Conf
          </button>
          <button
            onClick={handleBulkRejectLow}
            className="flex items-center gap-1 px-3 py-2 border border-[#ffb4ab] text-[#ffb4ab] rounded-sm text-[14px] hover:bg-[#ffb4ab]/10 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
            Reject Low Conf
          </button>
        </div>
      </div>

      {/* Cards */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <span className="material-symbols-outlined animate-spin text-4xl text-[#c0c1ff]">progress_activity</span>
        </div>
      ) : memories.length === 0 ? (
        <div className="bg-[#1e293b] border border-[rgba(51,65,85,0.5)] rounded-lg p-12 text-center">
          <span className="material-symbols-outlined text-6xl text-[#4ade80] mb-4">check_circle</span>
          <h2 className="text-[24px] font-semibold mb-2">All Clear!</h2>
          <p className="text-[#c7c4d7]">No memories pending review.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {memories.map((m, i) => (
            <div
              key={m.id}
              className={`bg-[#1e293b] border border-[rgba(51,65,85,0.5)] rounded-lg p-5 fade-in-up delay-${(i + 1) * 100}`}
            >
              {/* Top badges */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`badge border ${TYPE_COLORS[m.memory_type] || TYPE_COLORS.context}`}>
                    {m.memory_type}
                  </span>
                  <span className="badge bg-[#34343d] border border-[#464554] text-[#c7c4d7]">
                    {m.scope}
                  </span>
                  <span className="text-[13px] text-[#908fa0] ml-2">
                    {timeAgo(m.created_at)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[14px] text-[#d97721]">
                    {(m.confidence_score || 0).toFixed(2)} conf
                  </span>
                  {m.confidence_label && (
                    <span className="text-[12px] text-[#908fa0] italic">{m.confidence_label}</span>
                  )}
                </div>
              </div>

              {/* Content */}
              <p className="text-[16px] text-[#e4e1ed] leading-relaxed mb-4">
                {m.content}
              </p>

              {/* Tags */}
              {m.tags && m.tags.length > 0 && (
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#908fa0]">Tags:</span>
                  {m.tags.map((tag: string) => (
                    <span key={tag} className="badge bg-[#292932] border border-[#464554] text-[#c7c4d7]">{tag}</span>
                  ))}
                </div>
              )}

              {/* Similar Existing */}
              {m.content && (
                <div className="mt-3">
                  <button
                    onClick={() => loadSimilar(m)}
                    className="text-[12px] text-[#c0c1ff] hover:underline flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[14px]">search</span>
                    Find similar existing memories
                  </button>
                  {similarMap[m.id] && similarMap[m.id].length > 0 && (
                    <div className="mt-2 space-y-2 bg-[#0d0d15] border border-[#464554] rounded-sm p-3">
                      {similarMap[m.id].map((item: any) => (
                        <div key={item.memory.id} className="text-[13px]">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[#c0c1ff]">{item.score.toFixed(3)}</span>
                            <span className="text-[#e4e1ed] line-clamp-1">{item.memory.content}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {similarMap[m.id] && similarMap[m.id].length === 0 && (
                    <p className="text-[12px] text-[#908fa0] mt-1">No similar memories found.</p>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[rgba(51,65,85,0.3)]">
                <button
                  onClick={() => handleDefer(m.id)}
                  className="px-3 py-1.5 text-[14px] text-[#908fa0] hover:text-[#c7c4d7] transition-colors"
                >
                  Defer
                </button>
                <button
                  onClick={() => handleReject(m.id, m.content)}
                  className="px-4 py-1.5 text-[14px] bg-[#93000a] text-[#ffb4ab] rounded-sm hover:bg-[#93000a]/80 transition-colors flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[16px]">block</span>
                  Reject
                </button>
                <button className="px-4 py-1.5 text-[14px] border border-[#3b82f6] text-[#3b82f6] rounded-sm hover:bg-[#3b82f6]/10 transition-colors flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">edit</span>
                  Edit & Approve
                </button>
                <button
                  onClick={() => handleApprove(m.id)}
                  className="px-4 py-1.5 text-[14px] bg-[#4ade80] text-[#0d0d15] font-semibold rounded-sm hover:bg-[#22c55e] transition-colors flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[16px]">check</span>
                  Approve
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reject Modal */}
      {rejectId && (
        <RejectReasonModal
          memoryId={rejectId}
          memoryContent={rejectContent}
          onClose={() => setRejectId(null)}
          onConfirm={handleRejectConfirm}
        />
      )}
    </div>
  );
}

