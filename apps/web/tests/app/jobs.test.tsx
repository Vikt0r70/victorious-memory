import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("@/lib/api", () => ({
  jobsApi: {
    list: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    stats: vi.fn().mockResolvedValue({
      total: 0, by_status: {},
    }),
    retry: vi.fn().mockResolvedValue({ ok: true }),
    cancel: vi.fn().mockResolvedValue({ ok: true }),
    retryAllFailed: vi.fn().mockResolvedValue({ ok: true }),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("JobsPage", () => {
  it("renders Extraction Jobs heading", async () => {
    render(<JobsPage />);
    await waitFor(() => {
      expect(screen.getByText("Extraction Jobs")).toBeInTheDocument();
    });
  });

  it("renders Refresh and Retry All Failed buttons", async () => {
    render(<JobsPage />);
    await waitFor(() => {
      expect(screen.getByText("Refresh")).toBeInTheDocument();
      expect(screen.getByText("Retry All Failed")).toBeInTheDocument();
    });
  });

  it("renders EmptyState when no jobs", async () => {
    render(<JobsPage />);
    await waitFor(() => {
      expect(screen.getByText("No jobs found")).toBeInTheDocument();
    });
  });

  it("renders status filter buttons", async () => {
    render(<JobsPage />);
    await waitFor(() => {
      expect(screen.getByText("All")).toBeInTheDocument();
      expect(screen.getByText("pending")).toBeInTheDocument();
      expect(screen.getByText("failed")).toBeInTheDocument();
    });
  });

  it("has cursor-pointer on Refresh button", async () => {
    render(<JobsPage />);
    await waitFor(() => {
      const btn = screen.getByText("Refresh");
      expect(btn.className).toContain("cursor-pointer");
    });
  });
});

import JobsPage from "@/app/jobs/page";
