import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/api", () => ({
  memoriesApi: {
    list: vi.fn().mockResolvedValue({
      items: [
        {
          id: "mem1",
          content: "Test memory content",
          memory_type: "decision",
          scope: "project",
          confidence_score: 0.9,
          confidence_label: "high",
          status: "pending_review",
          tags: ["test"],
          created_at: new Date().toISOString(),
        },
      ],
      total: 1,
    }),
    approve: vi.fn().mockResolvedValue({ ok: true }),
    reject: vi.fn().mockResolvedValue({ ok: true }),
    search: vi.fn().mockResolvedValue({ items: [] }),
    bulk: vi.fn().mockResolvedValue({ ok: true }),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ReviewPage", () => {
  it("renders Review Queue heading", async () => {
    render(<ReviewPage />);
    await waitFor(() => {
      expect(screen.getByText("Review Queue")).toBeInTheDocument();
    });
  });

  it("renders Approve, Reject, Edit & Approve, and Defer buttons", async () => {
    render(<ReviewPage />);
    await waitFor(() => {
      expect(screen.getByText("Approve")).toBeInTheDocument();
      expect(screen.getByText("Reject")).toBeInTheDocument();
      expect(screen.getByText("Edit & Approve")).toBeInTheDocument();
      expect(screen.getByText("Defer")).toBeInTheDocument();
    });
  });

  it("renders EmptyState when no memories pending review", async () => {
    const { memoriesApi } = await import("@/lib/api");
    (memoriesApi.list as any).mockResolvedValueOnce({ items: [], total: 0 });
    render(<ReviewPage />);
    await waitFor(() => {
      expect(screen.getByText("All Clear!")).toBeInTheDocument();
    });
  });

  it("renders Approve High Conf and Reject Low Conf bulk buttons", async () => {
    render(<ReviewPage />);
    await waitFor(() => {
      expect(screen.getByText("Approve High Conf")).toBeInTheDocument();
      expect(screen.getByText("Reject Low Conf")).toBeInTheDocument();
    });
  });

  it("has cursor-pointer on action buttons", async () => {
    render(<ReviewPage />);
    await waitFor(() => {
      const approveBtn = screen.getByText("Approve");
      expect(approveBtn.className).toContain("cursor-pointer");
    });
  });
});

import ReviewPage from "@/app/review/page";
