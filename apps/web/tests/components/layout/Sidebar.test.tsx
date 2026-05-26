import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Sidebar from "@/components/layout/Sidebar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn() }),
}));

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({
    json: () => Promise.resolve({ total: 0 }),
  });
});

describe("Sidebar", () => {
  it("renders the Victorious brand name", () => {
    render(<Sidebar />);
    expect(screen.getByText("Victorious")).toBeInTheDocument();
    expect(screen.getByText("Memory Engine")).toBeInTheDocument();
  });

  it("renders all navigation items", () => {
    render(<Sidebar />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Memories")).toBeInTheDocument();
    expect(screen.getByText("Review Queue")).toBeInTheDocument();
    expect(screen.getByText("Projects")).toBeInTheDocument();
    expect(screen.getByText("Graph Explorer")).toBeInTheDocument();
    expect(screen.getByText("Activity Feed")).toBeInTheDocument();
    expect(screen.getByText("Extraction Jobs")).toBeInTheDocument();
    expect(screen.getByText("Raw Exchanges")).toBeInTheDocument();
  });

  it("renders Settings in the bottom section", () => {
    render(<Sidebar />);
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("applies cursor-pointer class to nav links", () => {
    const { container } = render(<Sidebar />);
    const links = container.querySelectorAll("a");
    links.forEach((link) => {
      expect(link.className).toContain("cursor-pointer");
    });
  });
});
