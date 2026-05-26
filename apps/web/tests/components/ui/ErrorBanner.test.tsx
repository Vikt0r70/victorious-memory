import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ErrorBanner from "@/components/ui/ErrorBanner";

describe("ErrorBanner", () => {
  it("renders the error message", () => {
    render(<ErrorBanner message="Something went wrong" />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("renders the error Material Symbol icon", () => {
    const { container } = render(<ErrorBanner message="Error!" />);
    const icon = container.querySelector(".material-symbols-outlined");
    expect(icon).toHaveTextContent("error");
  });

  it("has error styling with red border", () => {
    const { container } = render(<ErrorBanner message="Error!" />);
    const banner = container.firstChild as HTMLElement;
    expect(banner?.className).toContain("bg-[#ffb4ab]/10");
    expect(banner?.className).toContain("border-[#ffb4ab]");
  });

  it("renders with empty message prop without crashing", () => {
    const { container } = render(<ErrorBanner message="" />);
    expect(container.querySelector(".bg-\\[\\#ffb4ab\\]\\/10")).toBeTruthy();
  });
});
