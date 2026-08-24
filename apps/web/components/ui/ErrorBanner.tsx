"use client";
import { AlertCircle } from "lucide-react";

interface ErrorBannerProps {
  message: string;
}

export default function ErrorBanner({ message }: ErrorBannerProps) {
  return (
    <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-md flex items-center gap-3 shadow-sm">
      <AlertCircle className="size-5 shrink-0" />
      <span className="text-sm font-medium">{message}</span>
    </div>
  );
}
