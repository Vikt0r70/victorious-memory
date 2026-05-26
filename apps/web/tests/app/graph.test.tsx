import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("@/lib/api", () => ({
  graphApi: {
    getGraph: vi.fn().mockResolvedValue({ nodes: [], edges: [] }),
  },
}));

vi.mock("react-force-graph-2d", () => ({
  default: () => null,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GraphPage", () => {
  it("renders the Graph Explorer heading", async () => {
    render(<GraphPage />);
    await waitFor(() => {
      expect(screen.getByText("Graph Explorer")).toBeInTheDocument();
    });
  });

  it("renders EmptyState when no graph data", async () => {
    render(<GraphPage />);
    await waitFor(() => {
      expect(screen.getByText("No graph data yet.")).toBeInTheDocument();
    });
  });

  it("renders filter section with Memory Types and Relation Types", async () => {
    render(<GraphPage />);
    await waitFor(() => {
      expect(screen.getByText("Memory Types")).toBeInTheDocument();
      expect(screen.getByText("Relation Types")).toBeInTheDocument();
    });
  });

  it("renders the search input", async () => {
    const { container } = render(<GraphPage />);
    await waitFor(() => {
      const input = container.querySelector("input");
      expect(input).toBeTruthy();
    });
  });

  it("has use client directive - can't test directly, page renders", async () => {
    const { container } = render(<GraphPage />);
    await waitFor(() => {
      expect(container.querySelector("input")).toBeTruthy();
    });
  });
});

import GraphPage from "@/app/graph/page";
