import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import EmptyState from "@/components/ui/EmptyState";

describe("EmptyState", () => {
  it("renders the title and message props", () => {
    render(<EmptyState title="No items" message="Nothing to show" />);
    expect(screen.getByText("No items")).toBeInTheDocument();
    expect(screen.getByText("Nothing to show")).toBeInTheDocument();
  });

  it("renders the default icon when none provided", () => {
    const { container } = render(<EmptyState title="Test" message="..." />);
    const icon = container.querySelector(".material-symbols-outlined");
    expect(icon).toHaveTextContent("text_snippet");
  });

  it("renders a custom icon when provided", () => {
    const { container } = render(
      <EmptyState title="Test" message="..." icon="cloud_off" />
    );
    const icon = container.querySelector(".material-symbols-outlined");
    expect(icon).toHaveTextContent("cloud_off");
  });

  it("applies correct styling classes", () => {
    const { container } = render(<EmptyState title="Test" message="..." />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper?.className).toContain("flex-col");
    expect(wrapper?.className).toContain("py-12");
  });
});
