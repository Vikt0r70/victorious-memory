"use client";

interface ErrorBannerProps {
  message: string;
}

export default function ErrorBanner({ message }: ErrorBannerProps) {
  return (
    <div className="bg-[#ffb4ab]/10 border border-[#ffb4ab] text-[#ffb4ab] p-3 rounded-lg flex items-center gap-2">
      <span className="material-symbols-outlined text-[18px]">error</span>
      <span className="text-sm">{message}</span>
    </div>
  );
}
