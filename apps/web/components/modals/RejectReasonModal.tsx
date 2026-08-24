"use client";

import { useState } from "react";

interface Props {
  memoryId: string;
  memoryContent?: string;
  onClose: () => void;
  onConfirm: (id: string, reason: string) => void;
}

export default function RejectReasonModal({ memoryId, memoryContent, onClose, onConfirm }: Props) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm(memoryId, reason);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-card border border-input rounded-xl shadow-2xl w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center gap-2 p-6 border-b border-input">
          <span className="material-symbols-outlined text-destructive">block</span>
          <h2 className="text-[18px] font-semibold text-foreground">Reject Memory</h2>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {memoryContent && (
            <p className="text-[13px] text-muted-foreground line-clamp-3 bg-background border border-input rounded-md shadow-sm p-3">
              {memoryContent}
            </p>
          )}

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
              Reason for rejection (optional)
            </label>
            <textarea
              className="w-full bg-background border border-input rounded-md shadow-sm p-3 text-[14px] text-foreground placeholder-[#908fa0] focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary resize-y min-h-[80px]"
              placeholder="Enter reason..."
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
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
            onClick={handleConfirm}
            disabled={loading}
            className="px-4 py-2 text-[14px] bg-destructive text-destructive-foreground font-semibold rounded-md shadow-sm hover:bg-destructive/80 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {loading && (
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            )}
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}

