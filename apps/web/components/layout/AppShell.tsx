"use client";

import { ReactNode, useCallback, useSyncExternalStore } from "react";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

const STORAGE_KEY = "victorious-sidebar-collapsed";
const CHANGE_EVENT = "victorious-sidebar-change";

function subscribe(callback: () => void) {
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function getSnapshot() {
  return localStorage.getItem(STORAGE_KEY) === "1";
}

function getServerSnapshot() {
  return false;
}

export default function AppShell({ children }: { children: ReactNode }) {
  const collapsed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggle = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, getSnapshot() ? "0" : "1");
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return (
    <>
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <div
        className={`min-h-screen flex flex-col transition-[margin-left] duration-300 ease-in-out ${
          collapsed ? "ml-[68px]" : "ml-[260px]"
        }`}
      >
        <TopBar />
        <main className="flex-1 p-6 max-w-[1600px] mx-auto w-full">{children}</main>
      </div>
    </>
  );
}
