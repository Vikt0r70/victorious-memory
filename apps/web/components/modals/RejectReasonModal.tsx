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
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[#1e293b] border border-[#464554] rounded-xl shadow-2xl w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center gap-2 p-6 border-b border-[#464554]">
          <span className="material-symbols-outlined text-[#ffb4ab]">block</span>
          <h2 className="text-[18px] font-semibold text-[#e4e1ed]">Reject Memory</h2>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {memoryContent && (
            <p className="text-[13px] text-[#908fa0] line-clamp-3 bg-[#0d0d15] border border-[#464554] rounded-sm p-3">
              {memoryContent}
            </p>
          )}

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#c7c4d7] mb-1.5">
              Reason for rejection (optional)
            </label>
            <textarea
              className="w-full bg-[#0d0d15] border border-[#464554] rounded-sm p-3 text-[14px] text-[#e4e1ed] placeholder-[#908fa0] focus:outline-none focus:border-[#c0c1ff] resize-y min-h-[80px]"
              placeholder="Enter reason..."
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
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
            onClick={handleConfirm}
            disabled={loading}
            className="px-4 py-2 text-[14px] bg-[#93000a] text-[#ffb4ab] font-semibold rounded-sm hover:bg-[#93000a]/80 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {loading && (
              <span className="material-symbols-outlined animate-spin text-[16px]">
                progress_activity
              </span>
            )}
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}

