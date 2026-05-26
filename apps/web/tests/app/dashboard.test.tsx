import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("@/lib/api", () => ({
  memoriesApi: {
    stats: vi.fn().mockResolvedValue({
      total: 42, by_status: { active: 30, pending_review: 5 },
      by_type: { decision: 10, bugfix: 15 },
    }),
  },
  jobsApi: {
    stats: vi.fn().mockResolvedValue({
      total: 8, by_status: { processing: 2, failed: 1 },
    }),
  },
  activityApi: {
    list: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  },
  projectsApi: {
    list: vi.fn().mockResolvedValue({ items: [{ id: "prj1", display_name: "Test" }] }),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn().mockResolvedValue({
    json: () => Promise.resolve({ status: "ok", version: "1.0" }),
  });
});

describe("DashboardPage", () => {
  it("renders LoadingSpinner during initial load", () => {
    const { container } = render(<DashboardPage />);
    expect(container.querySelector(".animate-spin")).toBeTruthy();
  });

  it("renders StatCards after load", async () => {
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText("Total Memories")).toBeInTheDocument();
    });
  });

  it("renders the Activity Feed section", async () => {
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText("Recent Activity")).toBeInTheDocument();
    });
  });

  it("renders the Memories by Type donut chart section", async () => {
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText("Memories by Type")).toBeInTheDocument();
    });
  });

  it("renders EmptyState when activity feed is empty", async () => {
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText("No recent activity")).toBeInTheDocument();
    });
  });

  it("renders ErrorBanner when fetch fails", async () => {
    const { memoriesApi } = await import("@/lib/api");
    (memoriesApi.stats as any).mockRejectedValueOnce(new Error("Network error"));
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });
  });
});

import DashboardPage from "@/app/page";
