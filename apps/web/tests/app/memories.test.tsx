import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("@/lib/api", () => ({
  memoriesApi: {
    list: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    search: vi.fn().mockResolvedValue({ items: [] }),
    bulk: vi.fn().mockResolvedValue({ ok: true }),
    delete: vi.fn().mockResolvedValue({ ok: true }),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn().mockResolvedValue({
    json: () => Promise.resolve({ items: [] }),
  });
});

describe("MemoriesPage", () => {
  it("renders Memory Repository heading", async () => {
    render(<MemoriesPage />);
    await waitFor(() => {
      expect(screen.getByText("Memory Repository")).toBeInTheDocument();
    });
  });

  it("renders EmptyState when no memories", async () => {
    render(<MemoriesPage />);
    await waitFor(() => {
      expect(screen.getByText("No memories found")).toBeInTheDocument();
    });
  });

  it("renders the Semantic toggle button", async () => {
    render(<MemoriesPage />);
    await waitFor(() => {
      expect(screen.getByText("Semantic")).toBeInTheDocument();
    });
  });

  it("renders the search input", async () => {
    const { container } = render(<MemoriesPage />);
    await waitFor(() => {
      const input = container.querySelector("input");
      expect(input).toBeTruthy();
    });
  });
});

import MemoriesPage from "@/app/memories/page";
