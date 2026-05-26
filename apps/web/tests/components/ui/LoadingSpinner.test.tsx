import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

describe("LoadingSpinner", () => {
  it("renders the progress_activity Material Symbol", () => {
    const { container } = render(<LoadingSpinner />);
    const span = container.querySelector(".material-symbols-outlined");
    expect(span).toHaveTextContent("progress_activity");
  });

  it("has animate-spin class on the icon", () => {
    const { container } = render(<LoadingSpinner />);
    const span = container.querySelector(".material-symbols-outlined");
    expect(span?.className).toContain("animate-spin");
  });

  it("is centered with flex layout", () => {
    const { container } = render(<LoadingSpinner />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper?.className).toContain("flex");
    expect(wrapper?.className).toContain("justify-center");
  });
});
