"use client";
import { Info, CheckCircle2, SearchX, Network, Briefcase, CloudOff, BarChart3, type LucideIcon } from "lucide-react";

interface EmptyStateProps {
  title: string;
  message: string;
  icon?: any;
}

// Pre-redesign call sites pass Material Symbols names as strings — map them to lucide
const ICON_MAP: Record<string, LucideIcon> = {
  check_circle: CheckCircle2,
  search_off: SearchX,
  hub: Network,
  work: Briefcase,
  cloud_off: CloudOff,
  analytics: BarChart3,
};

export default function EmptyState({ title, message, icon }: EmptyStateProps) {
  const Icon = typeof icon === "string" ? ICON_MAP[icon] ?? Info : icon ?? Info;
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 px-4 text-center h-full">
      <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center mb-2">
        <Icon className="size-8 text-muted-foreground" />
      </div>
      <div className="text-lg text-foreground font-semibold">{title}</div>
      <div className="text-sm text-muted-foreground max-w-sm leading-relaxed">{message}</div>
    </div>
  );
}
