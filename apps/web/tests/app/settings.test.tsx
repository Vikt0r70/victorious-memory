import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("@/lib/api", () => ({
  providersApi: {
    list: vi.fn().mockResolvedValue({ items: [] }),
    update: vi.fn().mockResolvedValue({ ok: true }),
    delete: vi.fn().mockResolvedValue({ ok: true }),
    test: vi.fn().mockResolvedValue({ ok: true }),
  },
  agentsApi: {
    list: vi.fn().mockResolvedValue({ items: [] }),
    update: vi.fn().mockResolvedValue({ ok: true }),
    test: vi.fn().mockResolvedValue({ ok: true }),
  },
  usageApi: {
    list: vi.fn().mockResolvedValue({ items: [] }),
  },
  settingsApi: {
    list: vi.fn().mockResolvedValue({ items: [] }),
    set: vi.fn().mockResolvedValue({ ok: true }),
  },
  systemApi: {
    reEmbed: vi.fn().mockResolvedValue({ count: 0 }),
    purge: vi.fn().mockResolvedValue({ ok: true }),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SettingsPage", () => {
  it("renders Settings heading", async () => {
    render(<SettingsPage />);
    await waitFor(() => {
      expect(screen.getByText("Settings")).toBeInTheDocument();
    });
  });

  it("renders all 6 tab triggers", async () => {
    render(<SettingsPage />);
    await waitFor(() => {
      const tabs = screen.getAllByRole("tab");
      expect(tabs.length).toBe(6);
      expect(tabs[0]).toHaveTextContent("Providers");
      expect(tabs[1]).toHaveTextContent("Extraction");
      expect(tabs[2]).toHaveTextContent("Auto-Approve");
      expect(tabs[3]).toHaveTextContent("Lifecycle");
      expect(tabs[4]).toHaveTextContent("Plugin");
      expect(tabs[5]).toHaveTextContent("Data");
    });
  });

  it("renders EmptyState when no providers configured", async () => {
    render(<SettingsPage />);
    await waitFor(() => {
      expect(screen.getByText("No providers configured yet.")).toBeInTheDocument();
    });
  });

  it("renders Agent Routing section", async () => {
    render(<SettingsPage />);
    await waitFor(() => {
      expect(screen.getByText("Agent Routing")).toBeInTheDocument();
    });
  });
});

import SettingsPage from "@/app/settings/page";
