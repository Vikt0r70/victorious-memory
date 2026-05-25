"use client";

import { useState } from "react";

interface Props {
  onClose: () => void;
  onConfirm: () => void;
}

export default function ConfirmPurgeModal({ onClose, onConfirm }: Props) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const isConfirmed = input.trim() === "PURGE";

  const handleConfirm = async () => {
    if (!isConfirmed) return;
    setLoading(true);
    try {
      await onConfirm();
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
      <div className="bg-[#1e293b] border border-[#93000a]/30 rounded-xl shadow-2xl w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center gap-2 p-6 border-b border-[#93000a]/30">
          <span className="material-symbols-outlined text-[#ffb4ab]">warning</span>
          <h2 className="text-[18px] font-semibold text-[#ffb4ab]">Delete All Data</h2>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <p className="text-[14px] text-[#e4e1ed]">
            This will permanently delete all memories, edges, exchanges, jobs, and projects.
            This action <strong className="text-[#ffb4ab]">cannot be undone</strong>.
          </p>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#c7c4d7] mb-1.5">
              Type PURGE to confirm
            </label>
            <input
              className="w-full bg-[#0d0d15] border border-[#464554] rounded-sm p-2.5 text-[14px] text-[#e4e1ed] placeholder-[#908fa0] focus:outline-none focus:border-[#c0c1ff] font-mono"
              placeholder="PURGE"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-[#93000a]/30">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[14px] text-[#c7c4d7] border border-[#464554] rounded-sm hover:bg-[#292932] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!isConfirmed || loading}
            className="px-4 py-2 text-[14px] bg-[#93000a] text-[#ffb4ab] font-semibold rounded-sm hover:bg-[#93000a]/80 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading && (
              <span className="material-symbols-outlined animate-spin text-[16px]">
                progress_activity
              </span>
            )}
            Delete Everything
          </button>
        </div>
      </div>
    </div>
  );
}

