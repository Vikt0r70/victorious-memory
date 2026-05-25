"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const navItems = [
  { href: "/", icon: "dashboard", label: "Dashboard" },
  { href: "/memories", icon: "memory", label: "Memories" },
  { href: "/review", icon: "fact_check", label: "Review Queue", badge: "pendingReview" as const },
  { href: "/projects", icon: "folder_open", label: "Projects" },
  { href: "/graph", icon: "hub", label: "Graph Explorer" },
  { href: "/activity", icon: "history", label: "Activity Feed" },
  { href: "/jobs", icon: "engineering", label: "Extraction Jobs" },
  { href: "/exchanges", icon: "swap_horiz", label: "Raw Exchanges" },
];

const bottomItems = [
  { href: "/settings", icon: "settings", label: "Settings" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    fetch("/api/memories?status=pending_review&per_page=1")
      .then((r) => r.json())
      .then((data) => setPendingCount(data.total ?? 0))
      .catch(() => setPendingCount(0));
  }, []);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <nav className="fixed left-0 top-0 h-full w-[260px] bg-[#1b1b23] border-r border-[#464554] flex flex-col py-6 z-20">
      {/* Logo */}
      <div className="px-6 mb-8 flex items-center gap-3">
        <div className="w-8 h-8 rounded bg-[#c0c1ff] text-[#1000a9] flex items-center justify-center font-bold text-lg">
          V
        </div>
        <div>
          <div className="text-[18px] leading-[26px] font-bold text-[#e4e1ed]">
            Victorious
          </div>
          <div className="text-[13px] leading-[18px] text-[#c7c4d7]">
            Memory Engine
          </div>
        </div>
      </div>

      {/* Main Nav */}
      <div className="flex-1 overflow-y-auto px-2 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-4 py-2 transition-colors duration-200 rounded-r-sm border-l-4 ${
              isActive(item.href)
                ? "border-[#c0c1ff] bg-[#3e495d]/30 text-[#aeb9d0]"
                : "border-transparent text-[#c7c4d7] hover:bg-[#292932] hover:text-[#e4e1ed]"
            }`}
          >
            <span
              className={`material-symbols-outlined ${
                isActive(item.href) ? "fill" : ""
              }`}
            >
              {item.icon}
            </span>
            <span className="flex-1">{item.label}</span>
            {item.badge === "pendingReview" && pendingCount > 0 && (
              <span className="bg-[#ffb4ab] text-[#93000a] text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                {pendingCount}
              </span>
            )}
          </Link>
        ))}
      </div>

      {/* Bottom Nav */}
      <div className="px-2 space-y-1 pt-2 border-t border-[#464554]">
        {bottomItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-4 py-2 transition-colors duration-200 rounded-r-sm border-l-4 ${
              isActive(item.href)
                ? "border-[#c0c1ff] bg-[#3e495d]/30 text-[#aeb9d0]"
                : "border-transparent text-[#c7c4d7] hover:bg-[#292932] hover:text-[#e4e1ed]"
            }`}
          >
            <span className="material-symbols-outlined">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}

