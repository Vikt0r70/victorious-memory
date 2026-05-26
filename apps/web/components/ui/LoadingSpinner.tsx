"use client";

export default function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center">
      <span className="material-symbols-outlined animate-spin text-[#c0c1ff] text-4xl">
        progress_activity
      </span>
    </div>
  );
}
