"use client";

import { useEffect, useState, useRef } from "react";
import { providersApi, agentsApi, usageApi, settingsApi, systemApi, ingestApi } from "@/lib/api";
import ProviderConfigModal from "@/components/modals/ProviderConfigModal";
import ConfirmPurgeModal from "@/components/modals/ConfirmPurgeModal";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import ErrorBanner from "@/components/ui/ErrorBanner";
import EmptyState from "@/components/ui/EmptyState";
import UsageLogTable, { type UsageLog } from "@/components/settings/UsageLogTable";

const MEMORY_TYPES = [
  "decision", "preference", "constraint", "bugfix", "lesson",
  "pattern", "research", "reference", "architecture", "context",
];

const SCOPES = ["project", "global", "cross_project"];

const AGENT_ROLES = [
  { value: "extraction", label: "Extraction", desc: "Entity and memory candidate extraction from conversations" },
  { value: "edge_detection", label: "Edge Detection", desc: "Graph relationship and dependency linking" },
  { value: "consolidation", label: "Consolidation", desc: "Merge duplicate memories and resolve contradictions" },
];

interface Provider {
  id: string;
  name: string;
  provider_type: string;
  base_url: string;
  model: string;
  api_key?: string;
  max_tokens?: number;
  is_enabled: boolean;
}

interface Agent {
  role: string;
  primary_provider_id?: string;
  fallback_provider_ids?: string[];
}

export default function SettingsPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [usageLogs, setUsageLogs] = useState<UsageLog[]>([]);
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [bufferStatus, setBufferStatus] = useState<any>(null);
  const [extractingNow, setExtractingNow] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const [showProviderModal, setShowProviderModal] = useState(false);
  const [editProvider, setEditProvider] = useState<Provider | null>(null);
  const [modalMode, setModalMode] = useState<"template" | "custom">("template");

  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; message: string; latency_ms?: number }>>({});
  const [testingIds, setTestingIds] = useState<Set<string>>(new Set());

  const [routingSaving, setRoutingSaving] = useState(false);
  const [agentTestResults, setAgentTestResults] = useState<Record<string, { ok: boolean; message: string; latency_ms?: number }>>({});
  const [agentTesting, setAgentTesting] = useState<Set<string>>(new Set());

  const [usageFilter, setUsageFilter] = useState<string>("all");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Data tab state
  const [exportFormat, setExportFormat] = useState<"json" | "csv">("json");
  const [importStatus, setImportStatus] = useState("");
  const [reembedStatus, setReembedStatus] = useState("");
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadAllData();
  }, []);

  const notify = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [pRes, aRes, uRes, sRes, bRes] = await Promise.all([
        providersApi.list().catch(() => []),
        agentsApi.list().catch(() => []),
        usageApi.list().catch(() => []),
        settingsApi.list().catch(() => ({ items: [] })),
        ingestApi.bufferStatus().catch(() => null),
      ]);

      const provs = Array.isArray(pRes) ? pRes : (pRes?.items || []);
      setProviders(provs);

      const ags = Array.isArray(aRes) ? aRes : (aRes?.items || []);
      setAgents(ags);

      const usage = Array.isArray(uRes) ? uRes : (uRes?.items || []);
      setUsageLogs(usage);

      const sett: Record<string, any> = {};
      (sRes?.items || []).forEach((i: any) => { sett[i.key] = i.value; });
      setSettings(sett);

      setBufferStatus(bRes);
    } catch (e: any) {
      setError(e.message || "Failed to load settings data");
    } finally {
      setLoading(false);
    }
  };

  const handleExtractNow = async () => {
    setExtractingNow(true);
    try {
      const res = await ingestApi.extractNow();
      if (res.status === "empty") {
        notify("error", "No unextracted exchanges buffered in the queue.");
      } else {
        notify("success", res.message || `Queued extraction job for ${res.exchanges_count} exchanges!`);
        // Refresh buffer status
        const updatedBuffer = await ingestApi.bufferStatus().catch(() => null);
        setBufferStatus(updatedBuffer);
      }
    } catch (e: any) {
      notify("error", `Failed to trigger extraction: ${e.message}`);
    } finally {
      setExtractingNow(false);
    }
  };

  const saveSetting = async (key: string, value: any) => {
    try {
      await settingsApi.set(key, value);
      setSettings((prev) => ({ ...prev, [key]: value }));
      notify("success", `Setting '${key}' saved.`);
    } catch (e: any) {
      notify("error", `Failed to save setting: ${e.message}`);
    }
  };

  const getSetting = (key: string, defaultValue: any) => {
    const val = settings[key];
    if (val === undefined || val === null) return defaultValue;
    if (typeof val === "object" && val !== null && "value" in val) return val.value;
    return val;
  };

  const handleTestProvider = async (id: string) => {
    setTestingIds((prev) => new Set(prev).add(id));
    setTestResults((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

    try {
      const res = await providersApi.test(id);
      const ok = res.status === "success" || res.status === "ok";
      setTestResults((prev) => ({
        ...prev,
        [id]: {
          ok,
          message: res.response || (ok ? "Connection verified" : res.error || "Failed"),
          latency_ms: res.latency_ms,
        },
      }));
    } catch (e: any) {
      setTestResults((prev) => ({
        ...prev,
        [id]: { ok: false, message: e.message || "Connection failed" },
      }));
    } finally {
      setTestingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleDeleteProvider = async (id: string) => {
    try {
      await providersApi.delete(id);
      setDeleteConfirmId(null);
      notify("success", "Provider removed successfully.");
      await loadAllData();
    } catch (e: any) {
      notify("error", `Delete failed: ${e.message}`);
    }
  };

  const handleToggleProvider = async (provider: Provider) => {
    try {
      const updated = !provider.is_enabled;
      await providersApi.update(provider.id, {
        name: provider.name,
        provider_type: provider.provider_type,
        base_url: provider.base_url,
        model: provider.model,
        max_tokens: provider.max_tokens,
        is_enabled: updated,
      });
      setProviders((prev) =>
        prev.map((p) => (p.id === provider.id ? { ...p, is_enabled: updated } : p))
      );
      notify("success", `Provider ${provider.name} ${updated ? "enabled" : "disabled"}.`);
    } catch (e: any) {
      notify("error", `Toggle failed: ${e.message}`);
    }
  };

  const getAgentFallbacks = (role: string): string[] => {
    const agent = agents.find((a) => a.role === role);
    return agent?.fallback_provider_ids || [];
  };

  const getAgentPrimary = (role: string): string => {
    const agent = agents.find((a) => a.role === role);
    return agent?.primary_provider_id || "";
  };

  const handlePrimaryChange = (role: string, providerId: string) => {
    setAgents((prev) =>
      prev.map((a) =>
        a.role === role ? { ...a, primary_provider_id: providerId || undefined } : a
      )
    );
  };

  const handleAddFallback = (role: string) => {
    setAgents((prev) =>
      prev.map((a) => {
        if (a.role !== role) return a;
        const current = a.fallback_provider_ids || [];
        if (current.length >= 4) return a;
        return { ...a, fallback_provider_ids: [...current, ""] };
      })
    );
  };

  const handleFallbackChange = (role: string, index: number, providerId: string) => {
    setAgents((prev) =>
      prev.map((a) => {
        if (a.role !== role) return a;
        const current = [...(a.fallback_provider_ids || [])];
        current[index] = providerId;
        return { ...a, fallback_provider_ids: current };
      })
    );
  };

  const handleRemoveFallback = (role: string, index: number) => {
    setAgents((prev) =>
      prev.map((a) => {
        if (a.role !== role) return a;
        const current = [...(a.fallback_provider_ids || [])];
        current.splice(index, 1);
        return { ...a, fallback_provider_ids: current };
      })
    );
  };

  const handleSaveRouting = async () => {
    setRoutingSaving(true);
    try {
      await Promise.all(
        agents.map((agent) =>
          agentsApi.update(agent.role, {
            role: agent.role,
            primary_provider_id: agent.primary_provider_id || null,
            fallback_provider_ids: (agent.fallback_provider_ids || []).filter(Boolean),
          })
        )
      );
      notify("success", "Agent routing saved successfully.");
      await loadAllData();
    } catch (e: any) {
      notify("error", `Save routing failed: ${e.message}`);
    } finally {
      setRoutingSaving(false);
    }
  };

  const handleTestAgent = async (role: string) => {
    setAgentTesting((prev) => new Set(prev).add(role));
    setAgentTestResults((prev) => {
      const next = { ...prev };
      delete next[role];
      return next;
    });

    try {
      const res = await agentsApi.test(role);
      const ok = res.status === "success" || res.status === "ok";
      setAgentTestResults((prev) => ({
        ...prev,
        [role]: {
          ok,
          message: res.response || (ok ? "Response received" : res.error || "Failed"),
          latency_ms: res.latency_ms,
        },
      }));
    } catch (e: any) {
      setAgentTestResults((prev) => ({
        ...prev,
        [role]: { ok: false, message: e.message || "Test failed" },
      }));
    } finally {
      setAgentTesting((prev) => {
        const next = new Set(prev);
        next.delete(role);
        return next;
      });
    }
  };

  // Data tab handlers
  const handleExport = async () => {
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api";
      const res = await fetch(`${API_BASE}/system/export?format=${exportFormat}`);
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `victorious-memory-export.${exportFormat}`;
      a.click();
      window.URL.revokeObjectURL(url);
      notify("success", "Export downloaded.");
    } catch (e: any) {
      notify("error", `Export error: ${e.message}`);
    }
  };

  const handleImport = async (file: File) => {
    setImportStatus("Importing...");
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api";
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API_BASE}/system/import`, { method: "POST", body: form });
      if (!res.ok) throw new Error("Import failed");
      const data = await res.json();
      setImportStatus(`Imported: ${data.imported?.memories || 0} memories, ${data.imported?.projects || 0} projects`);
      notify("success", "Data import completed.");
    } catch (e: any) {
      setImportStatus(`Error: ${e.message}`);
      notify("error", `Import error: ${e.message}`);
    }
  };

  const handleReembed = async () => {
    setReembedStatus("Running...");
    try {
      const r = await systemApi.reEmbed();
      setReembedStatus(`Started: ${r.count || 0} memories to process`);
      notify("success", `Re-embedding ${r.count || 0} memories.`);
    } catch (e: any) {
      setReembedStatus(`Error: ${e.message}`);
      notify("error", `Re-embedding failed: ${e.message}`);
    }
  };

  const handlePurgeConfirm = async () => {
    try {
      await systemApi.purge();
      setShowPurgeModal(false);
      notify("success", "All data purged.");
      await loadAllData();
    } catch (e: any) {
      notify("error", `Error: ${e.message}`);
    }
  };

  const filteredUsageLogs = usageFilter === "all"
    ? usageLogs
    : usageLogs.filter((u) => u.agent_role === usageFilter);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[28px] leading-tight font-bold tracking-tight text-foreground">
            Settings & Provider Registry
          </h1>
          <p className="text-muted-foreground text-[14px] mt-0.5">
            Configure LLM endpoints, agent routing chains, and system parameters
          </p>
        </div>
      </div>

      {/* Notification Banner */}
      {notification && (
        <div
          className={`px-4 py-2.5 rounded-lg border text-[13px] flex items-center gap-2 animate-in fade-in ${
            notification.type === "success"
              ? "bg-success/10 border-success/30 text-success"
              : "bg-destructive/10 border-destructive/30 text-destructive"
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">
            {notification.type === "success" ? "check_circle" : "error"}
          </span>
          {notification.message}
        </div>
      )}

      {error && <ErrorBanner message={error} />}

      <Tabs defaultValue="providers">
        <TabsList className="border-b border-border w-full justify-start gap-1 bg-transparent p-0">
          <TabsTrigger
            value="providers"
            className="px-4 py-2.5 text-[14px] font-medium border-b-2 border-transparent text-muted-foreground hover:text-foreground data-[active=true]:border-primary data-[active=true]:text-primary bg-transparent rounded-none flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">hub</span>
            LLM Providers & Routing
          </TabsTrigger>
          <TabsTrigger
            value="extraction"
            className="px-4 py-2.5 text-[14px] font-medium border-b-2 border-transparent text-muted-foreground hover:text-foreground data-[active=true]:border-primary data-[active=true]:text-primary bg-transparent rounded-none flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">psychology</span>
            Extraction
          </TabsTrigger>
          <TabsTrigger
            value="auto-approve"
            className="px-4 py-2.5 text-[14px] font-medium border-b-2 border-transparent text-muted-foreground hover:text-foreground data-[active=true]:border-primary data-[active=true]:text-primary bg-transparent rounded-none flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">verified</span>
            Auto-Approve
          </TabsTrigger>
          <TabsTrigger
            value="lifecycle"
            className="px-4 py-2.5 text-[14px] font-medium border-b-2 border-transparent text-muted-foreground hover:text-foreground data-[active=true]:border-primary data-[active=true]:text-primary bg-transparent rounded-none flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">published_with_changes</span>
            Lifecycle
          </TabsTrigger>
          <TabsTrigger
            value="plugin"
            className="px-4 py-2.5 text-[14px] font-medium border-b-2 border-transparent text-muted-foreground hover:text-foreground data-[active=true]:border-primary data-[active=true]:text-primary bg-transparent rounded-none flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">extension</span>
            Plugin
          </TabsTrigger>
          <TabsTrigger
            value="data"
            className="px-4 py-2.5 text-[14px] font-medium border-b-2 border-transparent text-muted-foreground hover:text-foreground data-[active=true]:border-primary data-[active=true]:text-primary bg-transparent rounded-none flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">database</span>
            Data & Backup
          </TabsTrigger>
        </TabsList>

        {/* ── Providers & Routing Tab ─────────────────────────────────── */}
        <TabsContent value="providers" className="pt-4">
          <div className="space-y-8">
            {/* 1. Provider Registry */}
            <Card className="bg-card border border-border rounded-xl p-6 space-y-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
                <div>
                  <h2 className="text-[18px] font-bold text-foreground flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">cloud_queue</span>
                    Configured Providers
                  </h2>
                  <p className="text-[13px] text-muted-foreground">
                    Manage LLM endpoints, credentials, and health status
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setModalMode("template");
                      setEditProvider(null);
                      setShowProviderModal(true);
                    }}
                    className="px-3.5 py-2 bg-primary text-primary-foreground font-semibold text-[13px] rounded-sm hover:bg-primary/90 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[16px]">add_circle</span>
                    Add from Template
                  </button>
                  <button
                    onClick={() => {
                      setModalMode("custom");
                      setEditProvider(null);
                      setShowProviderModal(true);
                    }}
                    className="px-3.5 py-2 border border-border text-muted-foreground text-[13px] rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">tune</span>
                    Add Custom
                  </button>
                </div>
              </div>

              {providers.length === 0 ? (
                <EmptyState
                  title="No LLM providers configured"
                  message="Add your first provider from the template picker to enable automated knowledge extraction."
                  icon="cloud_off"
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {providers.map((provider) => {
                    const test = testResults[provider.id];
                    const isTesting = testingIds.has(provider.id);

                    return (
                      <div
                        key={provider.id}
                        className={`bg-muted/30 border rounded-xl p-5 flex flex-col justify-between transition-all hover:border-primary/40 shadow-xs ${
                          provider.is_enabled ? "border-border" : "border-[#292932] opacity-60"
                        }`}
                      >
                        <div>
                          {/* Card Header */}
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary text-[20px]">
                                  {provider.provider_type === "ollama"
                                    ? "dns"
                                    : provider.provider_type === "anthropic"
                                    ? "psychology"
                                    : "smart_toy"}
                                </span>
                                <h3 className="text-[15px] font-bold text-foreground truncate max-w-[170px]" title={provider.name}>
                                  {provider.name}
                                </h3>
                              </div>
                              <div className="flex items-center gap-1.5 mt-1">
                                <span className="badge bg-muted border-border text-secondary-foreground text-[10px] uppercase font-mono">
                                  {provider.provider_type}
                                </span>
                                {test?.ok ? (
                                  <span className="flex items-center gap-1 text-[11px] text-success font-medium">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80]" />
                                    {test.latency_ms ? `${test.latency_ms}ms` : "Connected"}
                                  </span>
                                ) : test && !test.ok ? (
                                  <span className="flex items-center gap-1 text-[11px] text-destructive font-medium">
                                    <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
                                    Failed
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#908fa0]" />
                                    Ready
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => {
                                  setModalMode("custom");
                                  setEditProvider(provider);
                                  setShowProviderModal(true);
                                }}
                                className="p-1.5 text-muted-foreground hover:text-primary hover:bg-muted rounded-sm transition-colors cursor-pointer"
                                title="Edit Provider"
                              >
                                <span className="material-symbols-outlined text-[18px]">edit</span>
                              </button>
                              <button
                                onClick={() => setDeleteConfirmId(provider.id)}
                                className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/20 rounded-sm transition-colors cursor-pointer"
                                title="Delete Provider"
                              >
                                <span className="material-symbols-outlined text-[18px]">delete</span>
                              </button>
                            </div>
                          </div>

                          {/* Details */}
                          <div className="space-y-2 text-[12px] bg-background p-3 rounded-lg border border-border/50 mb-4">
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Model:</span>
                              <span className="font-mono text-foreground truncate max-w-[170px]" title={provider.model}>
                                {provider.model || "—"}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Endpoint:</span>
                              <span className="font-mono text-secondary-foreground truncate max-w-[170px]" title={provider.base_url}>
                                {provider.base_url || "Default"}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Max Tokens:</span>
                              <span className="font-mono text-foreground">
                                {provider.max_tokens || 4096}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div>
                          {/* Test Result Message */}
                          {test && (
                            <div
                              className={`text-[11px] rounded p-2 mb-3 ${
                                test.ok
                                  ? "bg-success/10 border border-success/30 text-success"
                                  : "bg-destructive/10 border border-destructive/30 text-destructive"
                              }`}
                            >
                              <div className="truncate" title={test.message}>
                                {test.message}
                              </div>
                            </div>
                          )}

                          {/* Actions */}
                          <div className="flex items-center justify-between pt-3 border-t border-[#292932]">
                            <button
                              onClick={() => handleTestProvider(provider.id)}
                              disabled={isTesting}
                              className="text-[12px] text-primary hover:text-[#e1e0ff] flex items-center gap-1.5 disabled:opacity-50 cursor-pointer font-medium"
                            >
                              {isTesting ? (
                                <span className="material-symbols-outlined animate-spin text-[16px]">
                                  progress_activity
                                </span>
                              ) : (
                                <span className="material-symbols-outlined text-[16px]">
                                  cable
                                </span>
                              )}
                              {isTesting ? "Testing..." : "Test Connection"}
                            </button>

                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-muted-foreground">
                                {provider.is_enabled ? "Active" : "Disabled"}
                              </span>
                              <Switch
                                checked={provider.is_enabled}
                                onCheckedChange={() => handleToggleProvider(provider)}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* 2. Agent Role Routing */}
            <Card className="bg-card border border-border rounded-xl p-6 space-y-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
                <div>
                  <h2 className="text-[18px] font-bold text-foreground flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">alt_route</span>
                    Agent Role Routing & Fallback Chains
                  </h2>
                  <p className="text-[13px] text-muted-foreground">
                    Assign primary providers and failover chains (up to 4 levels) per agent role
                  </p>
                </div>
                <button
                  onClick={handleSaveRouting}
                  disabled={routingSaving}
                  className="px-4 py-2 bg-primary text-primary-foreground font-semibold text-[13px] rounded-sm hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-sm self-start sm:self-auto"
                >
                  {routingSaving && (
                    <span className="material-symbols-outlined animate-spin text-[16px]">
                      progress_activity
                    </span>
                  )}
                  Save Routing
                </button>
              </div>

              <div className="space-y-4">
                {AGENT_ROLES.map((role) => {
                  const primary = getAgentPrimary(role.value);
                  const fallbacks = getAgentFallbacks(role.value);
                  const testRes = agentTestResults[role.value];
                  const isTesting = agentTesting.has(role.value);

                  return (
                    <div
                      key={role.value}
                      className="bg-muted/30 border border-border rounded-xl p-5 space-y-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="w-9 h-9 rounded-lg bg-muted border border-border text-primary flex items-center justify-center font-bold">
                            <span className="material-symbols-outlined text-[20px]">psychology</span>
                          </span>
                          <div>
                            <h3 className="text-[15px] font-bold text-foreground flex items-center gap-2">
                              {role.label}
                              {role.value === "extraction" && (
                                <span className="badge bg-success/10 text-success border-success/30 text-[10px]">
                                  Active Ingestion Worker
                                </span>
                              )}
                            </h3>
                            <p className="text-[12px] text-muted-foreground">{role.desc}</p>
                          </div>
                        </div>

                        <button
                          onClick={() => handleTestAgent(role.value)}
                          disabled={isTesting || !primary}
                          className="px-3 py-2 text-[12px] border border-primary text-primary rounded-sm hover:bg-primary/10 transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
                        >
                          {isTesting ? (
                            <span className="material-symbols-outlined animate-spin text-[14px]">
                              progress_activity
                            </span>
                          ) : (
                            <span className="material-symbols-outlined text-[14px]">
                              play_circle
                            </span>
                          )}
                          Test Pipeline
                        </button>
                      </div>

                      {/* Primary Provider Selector */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center bg-background p-3.5 rounded-lg border border-border/50">
                        <div className="flex items-center gap-2">
                          <span className="badge bg-primary/20 text-primary border-primary/30 text-[10px] uppercase font-bold">
                            Step 1
                          </span>
                          <span className="text-[13px] font-medium text-foreground">
                            Primary Provider
                          </span>
                        </div>
                        <div className="md:col-span-2">
                          <select
                            className="w-full bg-card border border-input rounded-md shadow-sm p-2 text-[13px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                            value={primary}
                            onChange={(e) => handlePrimaryChange(role.value, e.target.value)}
                          >
                            <option value="">(No primary assigned — auto-select any enabled)</option>
                            {providers.filter((p) => p.is_enabled).map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.model} · {p.provider_type})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Fallback Chain */}
                      {fallbacks.length > 0 && (
                        <div className="space-y-2 pl-2 border-l-2 border-border ml-3">
                          {fallbacks.map((fallbackId, index) => (
                            <div
                              key={index}
                              className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center bg-background p-3 rounded-lg border border-border/50"
                            >
                              <div className="flex items-center gap-2">
                                <span className="badge bg-muted-foreground/20 text-muted-foreground border-[#908fa0]/30 text-[10px] uppercase">
                                  Fallback #{index + 1}
                                </span>
                                <span className="text-[12px] text-muted-foreground">
                                  Failover Target
                                </span>
                              </div>
                              <div className="md:col-span-2 flex items-center gap-2">
                                <select
                                  className="flex-1 bg-card border border-input rounded-md shadow-sm p-2 text-[13px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                                  value={fallbackId}
                                  onChange={(e) =>
                                    handleFallbackChange(role.value, index, e.target.value)
                                  }
                                >
                                  <option value="">Select fallback provider...</option>
                                  {providers
                                    .filter((p) => p.is_enabled && p.id !== primary)
                                    .map((p) => (
                                      <option key={p.id} value={p.id}>
                                        {p.name} ({p.model})
                                      </option>
                                    ))}
                                </select>
                                <button
                                  onClick={() => handleRemoveFallback(role.value, index)}
                                  className="p-1.5 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                                  title="Remove this fallback"
                                >
                                  <span className="material-symbols-outlined text-[18px]">
                                    remove_circle
                                  </span>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {fallbacks.length < 4 && (
                        <button
                          onClick={() => handleAddFallback(role.value)}
                          className="text-[12px] text-primary hover:text-[#e1e0ff] flex items-center gap-1 cursor-pointer ml-3 font-medium"
                        >
                          <span className="material-symbols-outlined text-[16px]">add_circle</span>
                          + Add Fallback Level ({fallbacks.length}/4)
                        </button>
                      )}

                      {/* Agent Test Result */}
                      {testRes && (
                        <div
                          className={`text-[12px] border rounded-lg p-3 ${
                            testRes.ok
                              ? "bg-success/10 border-success/30 text-success"
                              : "bg-destructive/10 border-destructive/30 text-destructive"
                          }`}
                        >
                          <div className="flex items-center justify-between font-semibold">
                            <div className="flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-[16px]">
                                {testRes.ok ? "check_circle" : "error"}
                              </span>
                              {testRes.ok ? "Pipeline Test Passed" : "Pipeline Test Failed"}
                            </div>
                            {testRes.latency_ms && (
                              <span className="text-[11px] font-mono">
                                {testRes.latency_ms}ms
                              </span>
                            )}
                          </div>
                          <div className="mt-1 text-[11px] opacity-90 break-words font-mono">
                            {testRes.message}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* 3. Usage Logs */}
            <Card className="bg-card border border-border rounded-xl p-6 shadow-sm">
              <UsageLogTable
                data={filteredUsageLogs}
                filter={usageFilter}
                onFilterChange={setUsageFilter}
                agentRoles={AGENT_ROLES}
              />
            </Card>
          </div>
        </TabsContent>

        {/* ── Extraction Tab ──────────────────────────────────────────── */}
        <TabsContent value="extraction" className="pt-4">
          <div className="space-y-6">
            {/* Live Buffer Status Card */}
            <Card className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
                <div>
                  <h2 className="text-[17px] font-bold text-foreground flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">dataset</span>
                    Conversation Token Buffer
                  </h2>
                  <p className="text-[13px] text-muted-foreground">
                    Conversation exchanges buffer in PostgreSQL until the token threshold is reached
                  </p>
                </div>
                <button
                  onClick={handleExtractNow}
                  disabled={extractingNow || !bufferStatus || bufferStatus.unextracted_exchanges_count === 0}
                  className="px-4 py-2 bg-primary text-primary-foreground font-semibold text-[13px] rounded-sm hover:bg-primary/90 transition-colors flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-40 disabled:cursor-not-allowed self-start sm:self-auto"
                >
                  {extractingNow ? (
                    <span className="material-symbols-outlined animate-spin text-[16px]">
                      progress_activity
                    </span>
                  ) : (
                    <span className="material-symbols-outlined text-[16px]">
                      auto_awesome
                    </span>
                  )}
                  Trigger Extraction Now
                </button>
              </div>

              {bufferStatus ? (
                <div className="space-y-3 bg-background p-4 rounded-lg border border-border/50">
                  <div className="flex items-center justify-between text-[13px]">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground font-medium">Accumulated Buffer:</span>
                      <span className="font-mono text-primary font-bold text-[14px]">
                        {bufferStatus.accumulated_tokens.toLocaleString()} / {bufferStatus.threshold.toLocaleString()} tokens
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        ({bufferStatus.unextracted_exchanges_count} unextracted exchanges)
                      </span>
                    </div>
                    <span className="badge bg-primary/15 text-primary border-primary/30 text-[11px] font-bold">
                      {bufferStatus.progress_pct}% ready
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-card rounded-full h-2.5 overflow-hidden border border-border">
                    <div
                      className="bg-gradient-to-r from-[#4ade80] via-[#c0c1ff] to-[#7979ff] h-full transition-all duration-500 rounded-full"
                      style={{ width: `${Math.min(100, bufferStatus.progress_pct)}%` }}
                    />
                  </div>

                  <p className="text-[12px] text-muted-foreground">
                    💡 <em>During conversation, memory search and context injection are continuously available at zero LLM cost. When accumulated conversation hits the threshold, the server fires a batch extraction call to synthesize multi-turn durable knowledge.</em>
                  </p>
                </div>
              ) : (
                <div className="text-[13px] text-muted-foreground py-2">
                  Loading buffer status...
                </div>
              )}
            </Card>

            {/* Runtime Configuration Card */}
            <Card className="bg-card border border-border rounded-xl p-6 space-y-6 shadow-sm">
              <div className="bg-primary/10 border border-primary/30 rounded-lg p-3.5 text-[13px] text-primary flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">tune</span>
                <span>
                  <strong>Batch Extraction Parameters:</strong> Configure the token accumulation milestone before the background LLM is invoked.
                </span>
              </div>

              {[
                {
                  key: "extraction.token_threshold",
                  label: "Batch Token Threshold",
                  type: "range",
                  min: 1000,
                  max: 50000,
                  step: 500,
                  desc: "Tokens accumulated in conversation before triggering batch memory extraction (Default: 10,000 tokens / 10k). Higher values synthesize broader multi-turn context.",
                  default: 10000,
                },
                {
                  key: "extraction.max_retries",
                  label: "Max Retries",
                  type: "number",
                  min: 1,
                  max: 10,
                  desc: "Maximum retry attempts upon provider failure before marking job failed",
                  default: 3,
                },
                {
                  key: "extraction.retry_backoff_base",
                  label: "Retry Backoff Base (s)",
                  type: "number",
                  desc: "Exponential backoff multiplier (2^attempt seconds)",
                  default: 2,
                },
                {
                  key: "extraction.worker_poll_interval",
                  label: "Worker Poll Interval (s)",
                  type: "number",
                  min: 1,
                  max: 30,
                  desc: "Interval between database queue polling checks",
                  default: 2,
                },
              ].map((f) => (
                <div key={f.key} className="flex items-center justify-between py-3 border-b border-[#292932] last:border-0">
                  <div>
                    <div className="text-[14px] font-medium text-foreground">{f.label}</div>
                    <div className="text-[12px] text-muted-foreground">{f.desc}</div>
                  </div>
                  {f.type === "range" ? (
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={f.min}
                        max={f.max}
                        step={f.step}
                        className="w-44 w-4 h-4 rounded border-input cursor-pointer shadow-sm transition-colors text-primary focus:ring-primary focus:ring-offset-background bg-background"
                        value={getSetting(f.key, f.default)}
                        onChange={(e) => saveSetting(f.key, parseInt(e.target.value, 10))}
                      />
                      <span className="font-mono text-[13px] w-16 text-right text-primary font-bold">
                        {Number(getSetting(f.key, f.default)).toLocaleString()}t
                      </span>
                    </div>
                  ) : (
                    <input
                      type="number"
                      min={f.min}
                      max={f.max}
                      className="w-24 bg-background border border-input rounded-md shadow-sm p-2 text-[13px] text-foreground text-right font-mono focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                      value={getSetting(f.key, f.default)}
                      onChange={(e) => saveSetting(f.key, parseInt(e.target.value, 10))}
                    />
                  )}
                </div>
              ))}

              <div className="flex items-center justify-between py-3">
                <div>
                  <div className="text-[14px] font-medium text-foreground">Extraction Enabled</div>
                  <div className="text-[12px] text-muted-foreground">Global toggle to pause background extraction worker</div>
                </div>
                <Switch
                  checked={getSetting("extraction.enabled", true)}
                  onCheckedChange={(v) => saveSetting("extraction.enabled", v)}
                />
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* ── Auto-Approve Tab ────────────────────────────────────────── */}
        <TabsContent value="auto-approve" className="pt-4">
          <Card className="bg-card border border-border rounded-xl p-6 space-y-6 shadow-sm">
            <div className="flex items-center justify-between py-3 border-b border-[#292932]">
              <div>
                <div className="text-[14px] font-medium text-foreground">Auto-Approve High Confidence</div>
                <div className="text-[12px] text-muted-foreground">Automatically approve candidate memories that meet confidence threshold</div>
              </div>
              <Switch
                checked={getSetting("approval.auto_approve_enabled", true)}
                onCheckedChange={(v) => saveSetting("approval.auto_approve_enabled", v)}
              />
            </div>

            <div className="flex items-center justify-between py-3 border-b border-[#292932]">
              <div>
                <div className="text-[14px] font-medium text-foreground">Confidence Threshold</div>
                <div className="text-[12px] text-muted-foreground">Minimum score (0.00 – 1.00) required for auto-approval</div>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0.5}
                  max={1.0}
                  step={0.05}
                  className="w-40 w-4 h-4 rounded border-input cursor-pointer shadow-sm transition-colors text-primary focus:ring-primary focus:ring-offset-background bg-background"
                  value={getSetting("approval.confidence_threshold", 0.85)}
                  onChange={(e) => saveSetting("approval.confidence_threshold", parseFloat(e.target.value))}
                />
                <span className="font-mono text-[13px] w-12 text-right text-primary">
                  {Number(getSetting("approval.confidence_threshold", 0.85)).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between py-3">
              <div>
                <div className="text-[14px] font-medium text-foreground">Never Auto-Approve Contradictions</div>
                <div className="text-[12px] text-muted-foreground">Always require human review if memory contradicts existing records</div>
              </div>
              <Switch
                checked={getSetting("approval.never_auto_approve_contradictions", true)}
                onCheckedChange={(v) => saveSetting("approval.never_auto_approve_contradictions", v)}
              />
            </div>
          </Card>
        </TabsContent>

        {/* ── Lifecycle Tab ───────────────────────────────────────────── */}
        <TabsContent value="lifecycle" className="pt-4">
          <Card className="bg-card border border-border rounded-xl p-6 space-y-6 shadow-sm">
            <div className="bg-secondary border border-input rounded-lg p-3.5 text-[13px] text-muted-foreground flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">history_edu</span>
              <span>
                Memory decay, consolidation schedules, and cleanup policies.
              </span>
            </div>

            <div className="flex items-center justify-between py-3 border-b border-[#292932]">
              <div>
                <div className="text-[14px] font-medium text-foreground">Memory Decay Enabled</div>
                <div className="text-[12px] text-muted-foreground">Gradually lower confidence of memories that haven't been accessed</div>
              </div>
              <Switch
                checked={getSetting("lifecycle.decay_enabled", false)}
                onCheckedChange={(v) => saveSetting("lifecycle.decay_enabled", v)}
              />
            </div>

            <div className="flex items-center justify-between py-3">
              <div>
                <div className="text-[14px] font-medium text-foreground">Cleanup Rejected Memories</div>
                <div className="text-[12px] text-muted-foreground">Days before permanently purging rejected memories</div>
              </div>
              <input
                type="number"
                min={1}
                max={365}
                className="w-24 bg-background border border-input rounded-md shadow-sm p-2 text-[13px] text-foreground text-right font-mono focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                value={getSetting("lifecycle.cleanup_rejected_after_days", 30)}
                onChange={(e) => saveSetting("lifecycle.cleanup_rejected_after_days", parseInt(e.target.value, 10))}
              />
            </div>
          </Card>
        </TabsContent>

        {/* ── Plugin Tab ──────────────────────────────────────────────── */}
        <TabsContent value="plugin" className="pt-4">
          <Card className="bg-card border border-border rounded-xl p-6 space-y-6 shadow-sm">
            <div className="flex items-center justify-between py-3 border-b border-[#292932]">
              <div>
                <div className="text-[14px] font-medium text-foreground">Plugin API URL</div>
                <div className="text-[12px] text-muted-foreground">Default Victorious API endpoint for OpenCode plugin hooks</div>
              </div>
              <input
                type="text"
                className="w-64 bg-background border border-input rounded-md shadow-sm p-2 text-[13px] text-foreground font-mono focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                value={getSetting("plugin.api_url", "http://localhost:8080")}
                onChange={(e) => saveSetting("plugin.api_url", e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between py-3 border-b border-[#292932]">
              <div>
                <div className="text-[14px] font-medium text-foreground">Injected Memory Token Budget</div>
                <div className="text-[12px] text-muted-foreground">Maximum tokens injected into system prompt before LLM calls</div>
              </div>
              <input
                type="number"
                min={200}
                max={4000}
                step={100}
                className="w-24 bg-background border border-input rounded-md shadow-sm p-2 text-[13px] text-foreground text-right font-mono focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                value={getSetting("plugin.inject_tokens", 1500)}
                onChange={(e) => saveSetting("plugin.inject_tokens", parseInt(e.target.value, 10))}
              />
            </div>

            <div className="flex items-center justify-between py-3">
              <div>
                <div className="text-[14px] font-medium text-foreground">Debug Logging</div>
                <div className="text-[12px] text-muted-foreground">Verbose logging in OpenCode extension host</div>
              </div>
              <Switch
                checked={getSetting("plugin.debug_mode", false)}
                onCheckedChange={(v) => saveSetting("plugin.debug_mode", v)}
              />
            </div>
          </Card>
        </TabsContent>

        {/* ── Data & Backup Tab ───────────────────────────────────────── */}
        <TabsContent value="data" className="pt-4">
          <Card className="bg-card border border-border rounded-xl p-6 space-y-6 shadow-sm">
            {/* Export */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-3 border-b border-[#292932]">
              <div>
                <h3 className="text-[15px] font-bold text-foreground">Export Knowledge Base</h3>
                <p className="text-[12px] text-muted-foreground">Download all memories, projects, and relationships</p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  className="bg-background border border-input rounded-md shadow-sm p-2 text-[13px] text-foreground focus:outline-none"
                  value={exportFormat}
                  onChange={(e: any) => setExportFormat(e.target.value)}
                >
                  <option value="json">JSON Format</option>
                  <option value="csv">CSV Format</option>
                </select>
                <button
                  onClick={handleExport}
                  className="px-4 py-2 bg-primary text-primary-foreground font-semibold text-[13px] rounded-sm hover:bg-primary/90 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">download</span>
                  Export Data
                </button>
              </div>
            </div>

            {/* Vector Re-Embed */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-3 border-b border-[#292932]">
              <div>
                <h3 className="text-[15px] font-bold text-foreground">Re-generate Vector Embeddings</h3>
                <p className="text-[12px] text-muted-foreground">Recalculate pgvector embeddings for all memories in database</p>
              </div>
              <div className="flex items-center gap-3">
                {reembedStatus && <span className="text-[12px] text-primary font-mono">{reembedStatus}</span>}
                <button
                  onClick={handleReembed}
                  className="px-4 py-2 border border-border text-muted-foreground text-[13px] rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">sync</span>
                  Re-embed All
                </button>
              </div>
            </div>

            {/* Danger Zone */}
            <div className="p-4 rounded-lg bg-destructive/10 border border-[#93000a]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-[15px] font-bold text-destructive">Danger Zone: Purge System Data</h3>
                <p className="text-[12px] text-destructive/80">
                  Permanently delete all memories, raw exchanges, projects, and execution logs.
                </p>
              </div>
              <button
                onClick={() => setShowPurgeModal(true)}
                className="px-4 py-2 bg-destructive text-white font-semibold text-[13px] rounded-md shadow-sm hover:bg-destructive/90 transition-colors flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
              >
                <span className="material-symbols-outlined text-[16px]">delete_forever</span>
                Purge All Data
              </button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Provider Config Modal */}
      {showProviderModal && (
        <ProviderConfigModal
          provider={editProvider}
          mode={modalMode}
          onClose={() => setShowProviderModal(false)}
          onSaved={() => {
            setShowProviderModal(false);
            notify("success", "Provider configuration saved.");
            loadAllData();
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && setDeleteConfirmId(null)}
        >
          <div className="bg-card border border-destructive/30 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-destructive">
              <span className="material-symbols-outlined text-[24px]">warning</span>
              <h3 className="text-[17px] font-bold">Delete Provider</h3>
            </div>
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              Are you sure you want to delete this provider? Any agent fallback assignments using this provider will be safely unlinked.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 border border-border text-muted-foreground text-[13px] rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteProvider(deleteConfirmId)}
                className="px-4 py-2 bg-destructive text-white font-semibold text-[13px] rounded-md shadow-sm hover:bg-destructive/90 transition-colors"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Purge Modal */}
      {showPurgeModal && (
        <ConfirmPurgeModal
          onClose={() => setShowPurgeModal(false)}
          onConfirm={handlePurgeConfirm}
        />
      )}
    </div>
  );
}
