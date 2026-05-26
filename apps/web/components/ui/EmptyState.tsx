"use client";

interface EmptyStateProps {
  title: string;
  message: string;
  icon?: string;
}

export default function EmptyState({ title, message, icon = "text_snippet" }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12">
      <span className="material-symbols-outlined text-6xl text-[#908fa0]">
        {icon}
      </span>
      <div className="text-lg text-[#e4e1ed] font-medium">{title}</div>
      <div className="text-sm text-[#908fa0] text-center max-w-md">{message}</div>
    </div>
  );
}
