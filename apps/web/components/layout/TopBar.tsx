"use client";

import { useState, useEffect, useRef } from "react";
import CreateMemoryModal from "@/components/modals/CreateMemoryModal";
import { activityApi } from "@/lib/api";
import { Bell, Search, Plus, X, PlusCircle, CheckCircle2, XCircle, PlayCircle, Edit3, Trash2, Link as LinkIcon, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";

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

const EVENT_ICONS: Record<string, React.ElementType> = {
  memory_created: PlusCircle,
  memory_approved: CheckCircle2,
  memory_rejected: XCircle,
  extraction_started: PlayCircle,
  extraction_completed: CheckCircle2,
  extraction_failed: XCircle,
  memory_updated: Edit3,
  memory_deleted: Trash2,
  edge_created: LinkIcon,
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
      <header className="flex justify-between items-center h-16 px-6 bg-background border-b border-border sticky top-0 z-10 w-full backdrop-blur-md bg-background/80">
        <div className="flex items-center gap-6 flex-1">
          <div className="text-[20px] font-bold tracking-tight text-foreground">
            Victorious
          </div>
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-4" />
            <Input
              className="w-full bg-accent/50 border-transparent rounded-md py-2 pl-9 pr-4 text-sm focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary transition-all duration-300"
              placeholder="Semantic Search..."
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => setShowCreate(true)}
            size="sm"
            className="hidden sm:flex gap-2 rounded-full px-4"
          >
            <Plus className="size-4" />
            Create Memory
          </Button>
          <div className="relative" ref={notifRef}>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowNotifications((v) => !v)}
              className="relative text-muted-foreground hover:text-foreground rounded-full size-9"
            >
              <Bell className="size-5" />
              <span className="absolute top-1.5 right-1.5 size-2 bg-primary rounded-full border-2 border-background" />
            </Button>

            {/* Notifications Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-popover border border-border rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in-0 zoom-in-95 slide-in-from-top-2">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
                  <span className="text-sm font-semibold text-foreground">Notifications</span>
                  <button
                    onClick={() => setShowNotifications(false)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-4" />
                  </button>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                      No recent notifications
                    </div>
                  ) : (
                    notifications.map((item) => {
                      const Icon = EVENT_ICONS[item.event_type] || Info;
                      return (
                        <div
                          key={item.id}
                          className="flex items-start gap-3 px-4 py-3 border-b border-border hover:bg-accent/50 transition-colors cursor-pointer"
                        >
                          <Icon className="size-4 text-primary mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-foreground truncate">
                              {item.description}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {timeAgo(item.created_at)}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                <div className="px-4 py-3 border-t border-border bg-muted/10 text-center">
                  <Link
                    href="/activity"
                    className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                  >
                    View all activity
                  </Link>
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
