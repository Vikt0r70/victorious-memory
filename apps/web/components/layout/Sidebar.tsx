"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { memoriesApi } from "@/lib/api";
import {
  LayoutDashboard,
  BrainCircuit,
  CheckSquare,
  FolderGit2,
  Network,
  Activity,
  Cpu,
  ArrowLeftRight,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/memories", icon: BrainCircuit, label: "Memories" },
  { href: "/review", icon: CheckSquare, label: "Review Queue", badge: "pendingReview" as const },
  { href: "/projects", icon: FolderGit2, label: "Projects" },
  { href: "/graph", icon: Network, label: "Graph Explorer" },
  { href: "/activity", icon: Activity, label: "Activity Feed" },
  { href: "/jobs", icon: Cpu, label: "Extraction Jobs" },
  { href: "/exchanges", icon: ArrowLeftRight, label: "Raw Exchanges" },
];

const bottomItems = [
  { href: "/settings", icon: Settings, label: "Settings" },
];

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

export default function Sidebar({ collapsed = false, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const [pendingCount, setPendingCount] = useState(0);

  const refreshPending = useCallback(() => {
    memoriesApi.list({ status: "pending_review", per_page: "1" })
      .then((data) => setPendingCount(data.total ?? 0))
      .catch(() => {
        // Transient failure — keep last known count instead of zeroing
      });
  }, []);

  useEffect(() => {
    refreshPending();
    const onPendingChanged = () => refreshPending();
    window.addEventListener("victorious:pending-changed", onPendingChanged);
    const interval = setInterval(refreshPending, 30000);
    return () => {
      window.removeEventListener("victorious:pending-changed", onPendingChanged);
      clearInterval(interval);
    };
  }, [refreshPending, pathname]);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const renderLink = (item: (typeof navItems)[number]) => {
    const active = isActive(item.href);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        title={collapsed ? item.label : undefined}
        className={cn(
          "relative flex items-center rounded-md cursor-pointer transition-colors duration-200 font-medium text-sm",
          collapsed ? "h-10 justify-center px-0 gap-0 mx-1.5" : "gap-3 px-3 py-2",
          active
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        )}
      >
        <Icon className={cn("size-4 shrink-0", active ? "opacity-100" : "opacity-70")} />
        {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
        {item.badge === "pendingReview" && pendingCount > 0 && (
          collapsed ? (
            <span className="absolute top-1.5 right-2 size-2 rounded-full bg-destructive ring-2 ring-sidebar" />
          ) : (
            <span className={cn(
              "text-[10px] font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center",
              active ? "bg-primary-foreground text-primary" : "bg-destructive text-destructive-foreground"
            )}>
              {pendingCount}
            </span>
          )
        )}
      </Link>
    );
  };

  return (
    <nav
      className={cn(
        "fixed left-0 top-0 h-full bg-sidebar border-r border-border flex flex-col py-4 z-20 transition-[width] duration-300 ease-in-out",
        collapsed ? "w-[68px]" : "w-[260px]"
      )}
    >
      {/* Logo */}
      <div className={cn("mb-6 flex items-center", collapsed ? "justify-center px-0" : "gap-3 px-6")}>
        <div className="size-8 shrink-0 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
          V
        </div>
        {!collapsed && (
          <div>
            <div className="text-[16px] leading-tight font-bold text-foreground">
              Victorious
            </div>
            <div className="text-[12px] leading-tight text-muted-foreground">
              Memory Engine
            </div>
          </div>
        )}
      </div>

      {/* Main Nav */}
      <div className={cn("flex-1 overflow-y-auto space-y-1", collapsed ? "px-0" : "px-3")}>
        {navItems.map(renderLink)}
      </div>

      {/* Bottom Nav */}
      <div className={cn("space-y-1 pt-4 pb-2 border-t border-border mt-4", collapsed ? "px-0" : "px-3")}>
        {bottomItems.map(renderLink)}
      </div>

      {/* Collapse toggle */}
      <button
        type="button"
        onClick={onToggle}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className={cn(
          "mt-2 h-9 rounded-md text-muted-foreground hover:text-accent-foreground hover:bg-accent cursor-pointer transition-colors flex items-center",
          collapsed ? "justify-center w-full mx-0" : "gap-2 px-3 mx-3 w-[calc(100%-24px)]"
        )}
      >
        {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        {!collapsed && <span className="text-sm font-medium">Collapse</span>}
      </button>
    </nav>
  );
}
