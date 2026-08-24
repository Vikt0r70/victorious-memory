"use client";

import { useEffect, useState, useCallback } from "react";
import { memoriesApi } from "@/lib/api";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import ErrorBanner from "@/components/ui/ErrorBanner";
import EmptyState from "@/components/ui/EmptyState";
import RejectReasonModal from "@/components/modals/RejectReasonModal";
import EditMemoryModal from "@/components/modals/EditMemoryModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, CheckCheck, X, Ban, Pencil } from "lucide-react";

type BadgeVariant =
  | "default"
  | "primary"
  | "secondary"
  | "muted"
  | "outline"
  | "success"
  | "warning"
  | "info"
  | "destructive";

const TYPE_VARIANTS: Record<string, BadgeVariant> = {
  decision: "primary",
  preference: "primary",
  bugfix: "destructive",
  lesson: "success",
  pattern: "outline",
  research: "outline",
  reference: "outline",
  architecture: "outline",
  constraint: "warning",
  context: "muted",
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
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectContent, setRejectContent] = useState("");
  const [similarMap, setSimilarMap] = useState<Record<string, any[]>>({});
  const [editMemory, setEditMemory] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await memoriesApi.list({ status: "pending_review", per_page: "50" });
      setMemories(data.items || []);
    } catch (e: any) {
      setError(e.message || "Failed to load review queue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const notifyPendingChanged = () => window.dispatchEvent(new Event("victorious:pending-changed"));

  const handleApprove = async (id: string) => {
    setIsActionLoading(true);
    setError(null);
    try {
      await memoriesApi.approve(id);
      notifyPendingChanged();
      await load();
    } catch (e: any) {
      setError(e.message || "Failed to approve memory");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleReject = (id: string, content: string) => {
    setRejectId(id);
    setRejectContent(content);
  };

  const handleRejectConfirm = async (id: string, reason: string) => {
    setIsActionLoading(true);
    setError(null);
    try {
      await memoriesApi.reject(id, reason);
      setRejectId(null);
      notifyPendingChanged();
      await load();
    } catch (e: any) {
      setError(e.message || "Failed to reject memory");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDefer = (id: string) => {
    // Defer is a no-op — stays in queue
  };

  const handleEditApprove = (memory: any) => {
    setEditMemory(memory);
  };

  const handleEditSaved = async (memory: any) => {
    setIsActionLoading(true);
    setError(null);
    try {
      await memoriesApi.approve(memory.id);
      setEditMemory(null);
      notifyPendingChanged();
      await load();
    } catch (e: any) {
      setError(e.message || "Failed to approve edited memory");
    } finally {
      setIsActionLoading(false);
    }
  };

  const loadSimilar = async (memory: any) => {
    try {
      const res = await memoriesApi.search(memory.content, memory.project_id, 3);
      setSimilarMap((prev) => ({ ...prev, [memory.id]: res.items || [] }));
    } catch (e: any) {
      setError(e.message || "Failed to load similar memories");
    }
  };

  const handleBulkApproveHigh = async () => {
    const high = memories.filter((m) => (m.confidence_score || 0) >= 0.85);
    if (high.length > 0) {
      setIsActionLoading(true);
      setError(null);
      try {
        await memoriesApi.bulk("approve", high.map((m) => m.id));
        notifyPendingChanged();
        await load();
      } catch (e: any) {
        setError(e.message || "Failed to bulk approve");
      } finally {
        setIsActionLoading(false);
      }
    }
  };

  const handleBulkRejectLow = async () => {
    const low = memories.filter((m) => (m.confidence_score || 0) < 0.3);
    if (low.length > 0) {
      setIsActionLoading(true);
      setError(null);
      try {
        await memoriesApi.bulk("reject", low.map((m) => m.id));
        notifyPendingChanged();
        await load();
      } catch (e: any) {
        setError(e.message || "Failed to bulk reject");
      } finally {
        setIsActionLoading(false);
      }
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
            <Badge variant="info">{memories.length} pending</Badge>
          </div>
          <p className="text-muted-foreground text-[14px] mt-1">
            Review extracted memories before they are committed to the graph.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline-success"
            size="sm"
            onClick={handleBulkApproveHigh}
            disabled={isActionLoading}
          >
            <CheckCheck />
            Approve High Conf
          </Button>
          <Button
            variant="outline-destructive"
            size="sm"
            onClick={handleBulkRejectLow}
            disabled={isActionLoading}
          >
            <X />
            Reject Low Conf
          </Button>
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      {isActionLoading && (
        <div className="flex items-center justify-center py-4">
          <LoadingSpinner />
        </div>
      )}

      {/* Cards */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <LoadingSpinner />
        </div>
      ) : memories.length === 0 ? (
        <EmptyState title="All Clear!" message="No memories pending review." icon="check_circle" />
      ) : (
        <div className="space-y-4">
          {memories.map((m, i) => (
            <div
              key={m.id}
              className={`bg-card border border-border rounded-lg p-5 fade-in-up delay-${(i + 1) * 100}`}
            >
              {/* Top badges */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={TYPE_VARIANTS[m.memory_type] ?? "muted"} dot>
                    {m.memory_type}
                  </Badge>
                  <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">
                    {m.scope}
                  </Badge>
                  <span className="text-[13px] text-muted-foreground ml-1">
                    {timeAgo(m.created_at)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      (m.confidence_score || 0) >= 0.85
                        ? "success"
                        : (m.confidence_score || 0) >= 0.5
                          ? "info"
                          : "warning"
                    }
                    className="font-mono"
                  >
                    {(m.confidence_score || 0).toFixed(2)} conf
                  </Badge>
                  {m.confidence_label && (
                    <span className="text-[12px] text-muted-foreground italic capitalize">
                      {m.confidence_label}
                    </span>
                  )}
                </div>
              </div>

              {/* Content */}
              <p className="text-[16px] text-foreground leading-relaxed mb-4">
                {m.content}
              </p>

              {/* Tags */}
              {m.tags && m.tags.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 mb-4">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mr-1">
                    Tags
                  </span>
                  {m.tags.map((tag: string) => (
                    <Badge key={tag} variant="outline">
                      <span aria-hidden="true" className="text-muted-foreground/60">#</span>
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Similar Existing */}
              {m.content && (
                <div className="mt-3">
                  <button
                    onClick={() => loadSimilar(m)}
                    disabled={isActionLoading}
                    className="cursor-pointer text-[12px] text-primary hover:underline flex items-center gap-1 disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[14px]">search</span>
                    Find similar existing memories
                  </button>
                  {similarMap[m.id] && similarMap[m.id].length > 0 && (
                    <div className="mt-2 space-y-2 bg-background border border-input rounded-md shadow-sm p-3">
                      {similarMap[m.id].map((item: any) => (
                        <div key={item.memory.id} className="text-[13px]">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-primary">{item.score.toFixed(3)}</span>
                            <span className="text-foreground line-clamp-1">{item.memory.content}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {similarMap[m.id] && similarMap[m.id].length === 0 && (
                    <p className="text-[12px] text-muted-foreground mt-1">No similar memories found.</p>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/60">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDefer(m.id)}
                  disabled={isActionLoading}
                >
                  Defer
                </Button>
                <Button
                  variant="outline-destructive"
                  size="sm"
                  onClick={() => handleReject(m.id, m.content)}
                  disabled={isActionLoading}
                >
                  <Ban />
                  Reject
                </Button>
                <Button
                  variant="outline-info"
                  size="sm"
                  onClick={() => handleEditApprove(m)}
                  disabled={isActionLoading}
                >
                  <Pencil />
                  Edit &amp; Approve
                </Button>
                <Button
                  variant="success"
                  size="sm"
                  onClick={() => handleApprove(m.id)}
                  disabled={isActionLoading}
                >
                  <Check />
                  Approve
                </Button>
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

      {/* Edit Modal */}
      {editMemory && (
        <EditMemoryModal
          memory={editMemory}
          onClose={() => setEditMemory(null)}
          onSaved={() => handleEditSaved(editMemory)}
        />
      )}
    </div>
  );
}
