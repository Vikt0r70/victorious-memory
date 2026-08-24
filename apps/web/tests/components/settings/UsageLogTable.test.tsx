import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import UsageLogTable from "@/components/settings/UsageLogTable";

const agentRoles = [
  { value: "extraction", label: "Extraction" },
  { value: "edge_detection", label: "Edge Detection" },
];

const mockData = [
  {
    id: "log1",
    agent_role: "extraction",
    provider_id: "prov1",
    provider_name: "OpenAI",
    model: "gpt-4",
    total_tokens: 1500,
    latency_ms: 1200,
    status: "success",
    created_at: "2025-01-01T00:00:00Z",
  },
];

describe("UsageLogTable", () => {
  it("renders EmptyState when data is empty", () => {
    render(
      <UsageLogTable
        data={[]}
        filter="all"
        onFilterChange={vi.fn()}
        agentRoles={agentRoles}
      />
    );
    expect(screen.getByText("No usage logs found")).toBeInTheDocument();
  });

  it("renders table with data", () => {
    render(
      <UsageLogTable
        data={mockData}
        filter="all"
        onFilterChange={vi.fn()}
        agentRoles={agentRoles}
      />
    );
    expect(screen.getByText("Usage Logs")).toBeInTheDocument();
    expect(screen.getByText("OpenAI")).toBeInTheDocument();
    expect(screen.getByText("gpt-4")).toBeInTheDocument();
  });

  it("renders Token and Latency column headers", () => {
    render(
      <UsageLogTable
        data={mockData}
        filter="all"
        onFilterChange={vi.fn()}
        agentRoles={agentRoles}
      />
    );
    expect(screen.getByText("Tokens")).toBeInTheDocument();
    expect(screen.getByText("Latency")).toBeInTheDocument();
  });

  it("renders agent filter dropdown", () => {
    render(
      <UsageLogTable
        data={mockData}
        filter="all"
        onFilterChange={vi.fn()}
        agentRoles={agentRoles}
      />
    );
    const select = screen.getByRole("combobox");
    expect(select).toBeInTheDocument();
  });
});
