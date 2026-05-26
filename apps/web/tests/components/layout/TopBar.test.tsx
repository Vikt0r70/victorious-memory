import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import TopBar from "@/components/layout/TopBar";

vi.mock("@/lib/api", () => ({
  activityApi: {
    list: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  },
  memoriesApi: {
    list: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  },
}));

describe("TopBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the Victorious Memory title", () => {
    render(<TopBar />);
    expect(screen.getByText("Victorious Memory")).toBeInTheDocument();
  });

  it("renders the Create Memory button", () => {
    render(<TopBar />);
    expect(screen.getByText("Create Memory")).toBeInTheDocument();
  });

  it("renders a search input with focus ring class", () => {
    const { container } = render(<TopBar />);
    const input = container.querySelector("input");
    expect(input?.className).toContain("focus:ring-[#c0c1ff]");
  });

  it("renders the bell icon with red notification dot", () => {
    const { container } = render(<TopBar />);
    const dot = container.querySelector(".bg-\\[\\#ffb4ab\\]\\.rounded-full");
    if (!dot) {
      const spans = container.querySelectorAll("span.absolute");
      const redDot = Array.from(spans).find(
        (s) => s.className.includes("bg-[#ffb4ab]")
      );
      expect(redDot).toBeTruthy();
    }
  });

  it("has cursor-pointer on the Create Memory button", () => {
    render(<TopBar />);
    const button = screen.getByText("Create Memory").closest("button");
    expect(button?.className).toContain("cursor-pointer");
  });
});
