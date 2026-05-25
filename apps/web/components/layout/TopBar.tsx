"use client";

import { useState, useEffect, useRef } from "react";
import CreateMemoryModal from "@/components/modals/CreateMemoryModal";
import { activityApi } from "@/lib/api";

function timeAgo(d: string) {
  if (!d) return "";
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const EVENT_ICONS: Record<string, string> = {
  memory_created: "add_circle",
  memory_approved: "verified",
  memory_rejected: "block",
  extraction_started: "play_circle",
  extraction_completed: "check_circle",
  extraction_failed: "error",
  memory_updated: "edit_note",
  memory_deleted: "delete",
  edge_created: "link",
};

export default function TopBar() {
  const [showCreate, setShowCreate] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await activityApi.list({ limit: "10" });
        setNotifications(data.items || []);
      } catch (e) {
        console.error(e);
      }
    };
    load();
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    if (showNotifications) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [showNotifications]);

  return (
    <>
      <header className="flex justify-between items-center h-16 px-6 bg-[#13131b] border-b border-[#464554] sticky top-0 z-10 w-full">
        <div className="flex items-center gap-6 flex-1">
          <div className="text-[24px] leading-[32px] font-black tracking-tight text-[#e4e1ed]">
            Victorious Memory
          </div>
          <div className="relative flex-1 max-w-md">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#c7c4d7]">
              search
            </span>
            <input
              className="w-full bg-[#0d0d15] border border-[#464554] rounded-sm py-2 pl-10 pr-4 text-[14px] text-[#e4e1ed] focus:outline-none focus:border-[#c0c1ff] focus:ring-1 focus:ring-[#c0c1ff] placeholder-[#c7c4d7] transition-colors duration-300"
              placeholder="Semantic Search..."
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowCreate(true)}
            className="bg-[#c0c1ff] hover:bg-[#e1e0ff] text-[#1000a9] font-semibold py-2 px-4 rounded-sm transition-colors duration-300 flex items-center gap-2 text-[14px]"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Create Memory
          </button>
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setShowNotifications((v) => !v)}
              className="text-[#c7c4d7] hover:text-[#e4e1ed] hover:bg-[#292932] rounded-full p-2 transition-colors duration-300 relative"
            >
              <span className="material-symbols-outlined">notifications</span>
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#ffb4ab] rounded-full border border-[#13131b]" />
            </button>

            {/* Notifications Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-[#1e293b] border border-[#464554] rounded-lg shadow-2xl z-50 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#464554]">
                  <span className="text-[14px] font-semibold text-[#e4e1ed]">Notifications</span>
                  <button
                    onClick={() => setShowNotifications(false)}
                    className="text-[#c7c4d7] hover:text-[#e4e1ed]"
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-6 text-center text-[13px] text-[#908fa0]">
                      No recent notifications
                    </div>
                  ) : (
                    notifications.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start gap-3 px-4 py-3 border-b border-[rgba(51,65,85,0.3)] hover:bg-[#292932] transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[18px] text-[#c0c1ff] mt-0.5">
                          {EVENT_ICONS[item.event_type] || "info"}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] text-[#e4e1ed] truncate">
                            {item.description}
                          </div>
                          <div className="text-[11px] text-[#908fa0] mt-0.5">
                            {timeAgo(item.created_at)}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="px-4 py-2 border-t border-[#464554]">
                  <a
                    href="/activity"
                    className="text-[13px] text-[#c0c1ff] hover:text-[#e1e0ff] transition-colors"
                  >
                    View all activity
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {showCreate && (
        <CreateMemoryModal onClose={() => setShowCreate(false)} />
      )}
    </>
  );
}
