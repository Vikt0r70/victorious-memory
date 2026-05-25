"use client";

import { useEffect, useState, useRef } from "react";
import { providersApi, settingsApi, systemApi } from "@/lib/api";
import ProviderConfigModal from "@/components/modals/ProviderConfigModal";
import ConfirmPurgeModal from "@/components/modals/ConfirmPurgeModal";

const TABS = ["Providers", "Extraction", "Auto-Approve", "Lifecycle", "Plugin", "Data"];

const MEMORY_TYPES = [
  "decision", "preference", "constraint", "bugfix", "lesson",
  "pattern", "research", "reference", "architecture", "context",
];

const SCOPES = ["project", "global", "cross_project"];

export default function SettingsPage() {
  const [tab, setTab] = useState(0);
  const [providers, setProviders] = useState<any[]>([]);
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [showProviderModal, setShowProviderModal] = useState(false);
  const [editProvider, setEditProvider] = useState<any>(null);

  // Data tab state
  const [exportFormat, setExportFormat] = useState<"json" | "csv">("json");
  const [importStatus, setImportStatus] = useState("");
  const [reembedStatus, setReembedStatus] = useState("");
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([
      providersApi.list().catch(() => ({ items: [] })),
      settingsApi.list().catch(() => ({ items: [] })),
    ]).then(([p, s]) => {
      const provs = p.items || p || [];
      setProviders(Array.isArray(provs) ? provs : []);
      const sett: Record<string, any> = {};
      (s.items || []).forEach((i: any) => { sett[i.key] = i.value; });
      setSettings(sett);
      setLoading(false);
    });
  }, []);

  const saveSetting = async (key: string, value: any) => {
    await settingsApi.set(key, value);
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const getSetting = (key: string, defaultValue: any) => {
    const val = settings[key];
    if (val === undefined || val === null) return defaultValue;
    // Handle wrapped values from backend (it wraps non-dict in {"value": X})
    if (typeof val === "object" && val !== null && "value" in val) return val.value;
    return val;
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
    } catch (e: any) {
      alert(`Export error: ${e.message}`);
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
    } catch (e: any) {
      setImportStatus(`Error: ${e.message}`);
    }
  };

  const handleReembed = async () => {
    setReembedStatus("Running...");
    try {
      const r = await systemApi.reEmbed();
      setReembedStatus(`Started: ${r.count || 0} memories to process`);
    } catch (e: any) {
      setReembedStatus(`Error: ${e.message}`);
    }
  };

  const handlePurgeConfirm = async () => {
    try {
      await systemApi.purge();
      setShowPurgeModal(false);
      alert("All data purged.");
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <span className="material-symbols-outlined animate-spin text-3xl text-[#c0c1ff]">progress_activity</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[30px] leading-[38px] font-semibold tracking-tight">Settings</h1>
          <p className="text-[#c7c4d7] text-[14px] mt-1">Configure system behavior and integrations</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[#464554]">
        {TABS.map((t, i) => (
          <button
            key={t}
            onClick={() => setTab(i)}
            className={`px-3 py-2.5 text-[14px] font-medium rounded-t-sm border-b-2 transition-colors duration-200 ${
              tab === i
                ? "border-[#c0c1ff] text-[#c0c1ff]"
                : "border-transparent text-[#c7c4d7] hover:bg-[#292932] hover:text-[#e4e1ed]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Providers */}
      {tab === 0 && (
        <div className="space-y-4">
          {["extraction", "edge_detection", "consolidation"].map((role) => {
            const provider = providers.find((p) => p.role === role);
            const isActive = !!provider;
            return (
              <div key={role} className="bg-[#1e293b] border border-[rgba(51,65,85,0.5)] rounded-lg p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-[18px] font-semibold text-[#e4e1ed] capitalize">{role.replace("_", " ")}</h3>
                    <p className="text-[13px] text-[#c7c4d7]">
                      {role === "extraction" && "Primary model for entity and relationship extraction"}
                      {role === "edge_detection" && "Secondary model optimized for relationship linking"}
                      {role === "consolidation" && "Model for merging duplicate memories"}
                    </p>
                  </div>
                  <span className={`badge border ${isActive ? "bg-[#4ade80]/10 border-[#4ade80] text-[#4ade80]" : "bg-[#908fa0]/10 border-[#908fa0] text-[#908fa0]"}`}>
                    {isActive ? "Connected" : "Not Configured"}
                  </span>
                </div>
                {provider && (
                  <div className="grid grid-cols-2 gap-4 mb-4 text-[13px]">
                    <div className="bg-[#0d0d15] border border-[#464554] rounded-sm p-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#908fa0] block mb-1">Base URL</span>
                      <span className="font-mono text-[#c7c4d7]">{provider.base_url || "—"}</span>
                    </div>
                    <div className="bg-[#0d0d15] border border-[#464554] rounded-sm p-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#908fa0] block mb-1">Model</span>
                      <span className="font-mono text-[#c7c4d7]">{provider.model || "—"}</span>
                    </div>
                  </div>
                )}
                <div className="flex justify-end">
                  <button
                    onClick={() => {
                      setEditProvider(provider || { role });
                      setShowProviderModal(true);
                    }}
                    className="px-4 py-2 bg-[#c0c1ff] text-[#1000a9] font-semibold text-[14px] rounded-sm hover:bg-[#e1e0ff] transition-colors flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[16px]">settings</span>
                    {isActive ? "Edit" : "Configure"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Extraction Config */}
      {tab === 1 && (
        <div className="bg-[#1e293b] border border-[rgba(51,65,85,0.5)] rounded-lg p-6 space-y-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-[#c0c1ff]">settings_suggest</span>
            <h3 className="text-[18px] font-semibold text-[#e4e1ed]">Extraction Worker Settings</h3>
          </div>
          {[
            { key: "extraction.token_threshold", label: "Token Threshold", type: "range", min: 200, max: 2000, step: 50, desc: "Tokens buffered before triggering extraction", default: 500 },
            { key: "extraction.max_retries", label: "Max Retries", type: "number", min: 1, max: 10, desc: "Max retry attempts on LLM failure", default: 3 },
            { key: "extraction.retry_backoff_base", label: "Retry Backoff Base (s)", type: "number", desc: "Base for exponential backoff", default: 2 },
            { key: "extraction.worker_poll_interval", label: "Worker Poll Interval (s)", type: "number", min: 1, max: 30, desc: "Seconds between job queue polls", default: 3 },
            { key: "extraction.max_concurrent_jobs", label: "Max Concurrent Jobs", type: "number", min: 1, max: 5, desc: "Parallel extraction jobs", default: 1 },
          ].map((f) => (
            <div key={f.key} className="flex items-center justify-between py-3 border-b border-[rgba(51,65,85,0.3)] last:border-0">
              <div>
                <div className="text-[14px] text-[#e4e1ed]">{f.label}</div>
                <div className="text-[12px] text-[#908fa0]">{f.desc}</div>
              </div>
              {f.type === "range" ? (
                <div className="flex items-center gap-3">
                  <input
                    type="range" min={f.min} max={f.max} step={f.step}
                    className="w-40"
                    value={getSetting(f.key, f.default)}
                    onChange={(e) => saveSetting(f.key, parseInt(e.target.value))}
                  />
                  <span className="font-mono text-[14px] w-12 text-right">{getSetting(f.key, f.default)}</span>
                </div>
              ) : (
                <input
                  type="number" min={f.min} max={f.max}
                  className="w-24 bg-[#0d0d15] border border-[#464554] rounded-sm p-2 text-[14px] text-[#e4e1ed] text-right font-mono"
                  value={getSetting(f.key, f.default)}
                  onChange={(e) => saveSetting(f.key, parseInt(e.target.value))}
                />
              )}
            </div>
          ))}

          {/* Toggles */}
          <div className="flex items-center justify-between py-3 border-b border-[rgba(51,65,85,0.3)]">
            <div>
              <div className="text-[14px] text-[#e4e1ed]">Extraction Enabled</div>
              <div className="text-[12px] text-[#908fa0]">Master on/off for extraction worker</div>
            </div>
            <Toggle
              checked={getSetting("extraction.enabled", true)}
              onChange={(v) => saveSetting("extraction.enabled", v)}
            />
          </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <div className="text-[14px] text-[#e4e1ed]">Keyword-Only Mode</div>
              <div className="text-[12px] text-[#908fa0]">Skip LLM, use keyword extraction only</div>
              <div className="text-[12px] text-[#d97721] mt-0.5">Significantly reduces extraction quality</div>
            </div>
            <Toggle
              checked={getSetting("extraction.keyword_only_mode", false)}
              onChange={(v) => saveSetting("extraction.keyword_only_mode", v)}
            />
          </div>
        </div>
      )}

      {/* Auto-Approve */}
      {tab === 2 && (
        <div className="bg-[#1e293b] border border-[rgba(51,65,85,0.5)] rounded-lg p-6 space-y-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-[#c0c1ff]">rule</span>
            <h3 className="text-[18px] font-semibold text-[#e4e1ed]">Auto-Approve Rules</h3>
          </div>

          <div className="flex items-center justify-between py-3 border-b border-[rgba(51,65,85,0.3)]">
            <div className="text-[14px] text-[#e4e1ed]">Auto-Approve Enabled</div>
            <Toggle checked={getSetting("approval.auto_approve_enabled", true)} onChange={(v) => saveSetting("approval.auto_approve_enabled", v)} />
          </div>

          <div className="flex items-center justify-between py-3 border-b border-[rgba(51,65,85,0.3)]">
            <div className="text-[14px] text-[#e4e1ed]">Confidence Threshold</div>
            <div className="flex items-center gap-3">
              <input type="range" min={0} max={1} step={0.05} className="w-40" value={getSetting("approval.confidence_threshold", 0.85)} onChange={(e) => saveSetting("approval.confidence_threshold", parseFloat(e.target.value))} />
              <span className="font-mono text-[14px] w-12 text-right">{getSetting("approval.confidence_threshold", 0.85).toFixed(2)}</span>
            </div>
          </div>

          <div className="flex items-center justify-between py-3 border-b border-[rgba(51,65,85,0.3)]">
            <div className="text-[14px] text-[#e4e1ed]">Never Auto-Approve Contradictions</div>
            <Toggle checked={getSetting("approval.never_auto_approve_contradictions", true)} onChange={(v) => saveSetting("approval.never_auto_approve_contradictions", v)} />
          </div>

          <div className="flex items-center justify-between py-3 border-b border-[rgba(51,65,85,0.3)]">
            <div className="text-[14px] text-[#e4e1ed]">Require Review for Global</div>
            <Toggle checked={getSetting("approval.require_review_for_global", false)} onChange={(v) => saveSetting("approval.require_review_for_global", v)} />
          </div>

          {/* Allowed Types */}
          <div className="py-3 border-b border-[rgba(51,65,85,0.3)]">
            <div className="text-[14px] text-[#e4e1ed] mb-2">Allowed Types</div>
            <div className="flex flex-wrap gap-2">
              {MEMORY_TYPES.map((t) => {
                const vals = getSetting("approval.allowed_types", MEMORY_TYPES);
                const checked = Array.isArray(vals) && vals.includes(t);
                return (
                  <button
                    key={t}
                    onClick={() => {
                      const current = getSetting("approval.allowed_types", MEMORY_TYPES);
                      const arr = Array.isArray(current) ? [...current] : [...MEMORY_TYPES];
                      const next = arr.includes(t) ? arr.filter((x: string) => x !== t) : [...arr, t];
                      saveSetting("approval.allowed_types", next.length > 0 ? next : MEMORY_TYPES);
                    }}
                    className={`badge text-[10px] border transition-colors duration-200 ${
                      checked ? "bg-[#c0c1ff]/20 border-[#c0c1ff] text-[#c0c1ff]" : "bg-[#292932] border-[#464554] text-[#c7c4d7] hover:bg-[#334155]/40"
                    }`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Allowed Scopes */}
          <div className="py-3">
            <div className="text-[14px] text-[#e4e1ed] mb-2">Allowed Scopes</div>
            <div className="flex flex-wrap gap-2">
              {SCOPES.map((s) => {
                const vals = getSetting("approval.allowed_scopes", SCOPES);
                const checked = Array.isArray(vals) && vals.includes(s);
                return (
                  <button
                    key={s}
                    onClick={() => {
                      const current = getSetting("approval.allowed_scopes", SCOPES);
                      const arr = Array.isArray(current) ? [...current] : [...SCOPES];
                      const next = arr.includes(s) ? arr.filter((x: string) => x !== s) : [...arr, s];
                      saveSetting("approval.allowed_scopes", next.length > 0 ? next : SCOPES);
                    }}
                    className={`badge text-[10px] border transition-colors duration-200 ${
                      checked ? "bg-[#c0c1ff]/20 border-[#c0c1ff] text-[#c0c1ff]" : "bg-[#292932] border-[#464554] text-[#c7c4d7] hover:bg-[#334155]/40"
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Lifecycle */}
      {tab === 3 && (
        <div className="bg-[#1e293b] border border-[rgba(51,65,85,0.5)] rounded-lg p-6 space-y-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-[#c0c1ff]">hourglass_empty</span>
            <h3 className="text-[18px] font-semibold text-[#e4e1ed]">Memory Lifecycle Config</h3>
          </div>

          <div className="flex items-center justify-between py-3 border-b border-[rgba(51,65,85,0.3)]">
            <div>
              <div className="text-[14px] text-[#e4e1ed]">Decay Enabled</div>
              <div className="text-[12px] text-[#908fa0]">Gradually reduce confidence of unused memories</div>
            </div>
            <Toggle checked={getSetting("lifecycle.decay_enabled", false)} onChange={(v) => saveSetting("lifecycle.decay_enabled", v)} />
          </div>

          <div className={`flex items-center justify-between py-3 border-b border-[rgba(51,65,85,0.3)] ${!getSetting("lifecycle.decay_enabled", false) ? "opacity-40" : ""}`}>
            <div className="text-[14px] text-[#e4e1ed]">Decay Half-Life (days)</div>
            <input
              type="number"
              disabled={!getSetting("lifecycle.decay_enabled", false)}
              className="w-24 bg-[#0d0d15] border border-[#464554] rounded-sm p-2 text-[14px] text-[#e4e1ed] text-right font-mono disabled:cursor-not-allowed"
              value={getSetting("lifecycle.decay_half_life_days", 90)}
              onChange={(e) => saveSetting("lifecycle.decay_half_life_days", parseInt(e.target.value))}
            />
          </div>

          <div className={`flex items-center justify-between py-3 border-b border-[rgba(51,65,85,0.3)] ${!getSetting("lifecycle.decay_enabled", false) ? "opacity-40" : ""}`}>
            <div className="text-[14px] text-[#e4e1ed]">Min Confidence Before Deprecate</div>
            <div className="flex items-center gap-3">
              <input
                type="range" min={0} max={1} step={0.05} className="w-40"
                disabled={!getSetting("lifecycle.decay_enabled", false)}
                value={getSetting("lifecycle.min_confidence_before_deprecate", 0.3)}
                onChange={(e) => saveSetting("lifecycle.min_confidence_before_deprecate", parseFloat(e.target.value))}
              />
              <span className="font-mono text-[14px] w-12 text-right">{getSetting("lifecycle.min_confidence_before_deprecate", 0.3).toFixed(2)}</span>
            </div>
          </div>

          <div className="flex items-center justify-between py-3 border-b border-[rgba(51,65,85,0.3)]">
            <div className="text-[14px] text-[#e4e1ed]">Consolidation Enabled</div>
            <Toggle checked={getSetting("lifecycle.consolidation_enabled", false)} onChange={(v) => saveSetting("lifecycle.consolidation_enabled", v)} />
          </div>

          <div className={`flex items-center justify-between py-3 border-b border-[rgba(51,65,85,0.3)] ${!getSetting("lifecycle.consolidation_enabled", false) ? "opacity-40" : ""}`}>
            <div className="text-[14px] text-[#e4e1ed]">Consolidation Similarity Threshold</div>
            <div className="flex items-center gap-3">
              <input
                type="range" min={0} max={1} step={0.05} className="w-40"
                disabled={!getSetting("lifecycle.consolidation_enabled", false)}
                value={getSetting("lifecycle.consolidation_similarity_threshold", 0.85)}
                onChange={(e) => saveSetting("lifecycle.consolidation_similarity_threshold", parseFloat(e.target.value))}
              />
              <span className="font-mono text-[14px] w-12 text-right">{getSetting("lifecycle.consolidation_similarity_threshold", 0.85).toFixed(2)}</span>
            </div>
          </div>

          <div className={`flex items-center justify-between py-3 border-b border-[rgba(51,65,85,0.3)] ${!getSetting("lifecycle.consolidation_enabled", false) ? "opacity-40" : ""}`}>
            <div className="text-[14px] text-[#e4e1ed]">Consolidation Schedule (hours)</div>
            <input
              type="number"
              disabled={!getSetting("lifecycle.consolidation_enabled", false)}
              className="w-24 bg-[#0d0d15] border border-[#464554] rounded-sm p-2 text-[14px] text-[#e4e1ed] text-right font-mono disabled:cursor-not-allowed"
              value={getSetting("lifecycle.consolidation_schedule_hours", 24)}
              onChange={(e) => saveSetting("lifecycle.consolidation_schedule_hours", parseInt(e.target.value))}
            />
          </div>

          <div className="flex items-center justify-between py-3">
            <div className="text-[14px] text-[#e4e1ed]">Cleanup Rejected After (days)</div>
            <input
              type="number"
              className="w-24 bg-[#0d0d15] border border-[#464554] rounded-sm p-2 text-[14px] text-[#e4e1ed] text-right font-mono"
              value={getSetting("lifecycle.cleanup_rejected_after_days", 30)}
              onChange={(e) => saveSetting("lifecycle.cleanup_rejected_after_days", parseInt(e.target.value))}
            />
          </div>
        </div>
      )}

      {/* Plugin */}
      {tab === 4 && (
        <div className="bg-[#1e293b] border border-[rgba(51,65,85,0.5)] rounded-lg p-6 space-y-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-[#c0c1ff]">extension</span>
            <h3 className="text-[18px] font-semibold text-[#e4e1ed]">Plugin Configuration</h3>
          </div>
          <p className="text-[13px] text-[#908fa0]">These settings are used by the OpenCode plugin. Changes take effect after restarting the plugin.</p>

          {[
            { key: "plugin.api_url", label: "API URL", type: "text", default: "http://localhost:8080", desc: "Where the plugin sends conversation data" },
            { key: "plugin.token_threshold", label: "Token Threshold", type: "number", default: 500, desc: "When to flush buffered tokens to the API" },
            { key: "plugin.inject_tokens", label: "Inject Tokens", type: "number", default: 1500, desc: "Max tokens injected into the system prompt" },
            { key: "plugin.debug_mode", label: "Debug Mode", type: "toggle", default: false, desc: "Verbose console logging in the plugin" },
          ].map((f) => (
            <div key={f.key} className="flex items-center justify-between py-3 border-b border-[rgba(51,65,85,0.3)] last:border-0">
              <div>
                <div className="text-[14px] text-[#e4e1ed]">{f.label}</div>
                <div className="text-[12px] text-[#908fa0]">{f.desc}</div>
              </div>
              {f.type === "toggle" ? (
                <Toggle checked={getSetting(f.key, f.default)} onChange={(v) => saveSetting(f.key, v)} />
              ) : f.type === "number" ? (
                <input
                  type="number"
                  className="w-24 bg-[#0d0d15] border border-[#464554] rounded-sm p-2 text-[14px] text-[#e4e1ed] text-right font-mono"
                  value={getSetting(f.key, f.default)}
                  onChange={(e) => saveSetting(f.key, parseInt(e.target.value))}
                />
              ) : (
                <input
                  type="text"
                  className="w-64 bg-[#0d0d15] border border-[#464554] rounded-sm p-2 text-[14px] text-[#e4e1ed] font-mono"
                  value={getSetting(f.key, f.default)}
                  onChange={(e) => saveSetting(f.key, e.target.value)}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Data Management */}
      {tab === 5 && (
        <div className="space-y-4">
          <div className="bg-[#1e293b] border border-[rgba(51,65,85,0.5)] rounded-lg p-6 space-y-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-[#c0c1ff]">download</span>
              <h3 className="text-[18px] font-semibold text-[#e4e1ed]">Export Data</h3>
            </div>
            <p className="text-[13px] text-[#908fa0]">Download all memories, projects, edges, and settings.</p>
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setExportFormat("json")}
                className={`px-3 py-1.5 border rounded-sm text-[13px] transition-colors ${exportFormat === "json" ? "border-[#c0c1ff] bg-[#c0c1ff]/10 text-[#c0c1ff]" : "border-[#464554] text-[#c7c4d7] hover:bg-[#292932]"}`}
              >
                JSON
              </button>
              <button
                onClick={() => setExportFormat("csv")}
                className={`px-3 py-1.5 border rounded-sm text-[13px] transition-colors ${exportFormat === "csv" ? "border-[#c0c1ff] bg-[#c0c1ff]/10 text-[#c0c1ff]" : "border-[#464554] text-[#c7c4d7] hover:bg-[#292932]"}`}
              >
                CSV
              </button>
            </div>
            <button onClick={handleExport} className="px-4 py-2 border border-[#464554] text-[14px] text-[#c7c4d7] rounded-sm hover:bg-[#292932] transition-colors flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">download</span>Export All Data
            </button>
          </div>

          <div className="bg-[#1e293b] border border-[rgba(51,65,85,0.5)] rounded-lg p-6 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-[#c0c1ff]">upload</span>
              <h3 className="text-[18px] font-semibold text-[#e4e1ed]">Import Data</h3>
            </div>
            <p className="text-[13px] text-[#908fa0]">Upload a previously exported JSON or CSV file.</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImport(file);
              }}
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              onDrop={(e) => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file) handleImport(file); }}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed border-[#464554] rounded-sm p-6 text-center text-[#908fa0] hover:border-[#c0c1ff] transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-3xl mb-1">upload_file</span>
              <div className="text-[13px]">Click or drop files here</div>
            </div>
            {importStatus && <p className="text-[12px] text-[#c7c4d7]">{importStatus}</p>}
          </div>

          <div className="bg-[#1e293b] border border-[rgba(51,65,85,0.5)] rounded-lg p-6 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-[#d97721]">sync</span>
              <h3 className="text-[18px] font-semibold text-[#e4e1ed]">Vector Operations</h3>
            </div>
            <p className="text-[13px] text-[#908fa0]">Regenerate all embeddings. Useful after changing the embedding model.</p>
            <button onClick={handleReembed} className="px-4 py-2 border border-[#d97721] text-[#d97721] text-[14px] rounded-sm hover:bg-[#d97721]/10 transition-colors flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">sync</span>Re-embed All
            </button>
            {reembedStatus && <p className="text-[12px] text-[#c7c4d7]">{reembedStatus}</p>}
          </div>

          <div className="bg-[#1e293b] border border-[#93000a]/30 rounded-lg p-6 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-[#ffb4ab]">warning</span>
              <h3 className="text-[18px] font-semibold text-[#ffb4ab]">Danger Zone</h3>
            </div>
            <p className="text-[13px] text-[#c7c4d7]">Permanently delete all memories, edges, exchanges, jobs, and projects. This cannot be undone.</p>
            <button
              onClick={() => setShowPurgeModal(true)}
              className="px-6 py-2.5 bg-[#93000a] text-[#ffdad6] font-semibold rounded-sm hover:bg-[#93000a]/80 transition-colors flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">delete_forever</span>Purge All Data
            </button>
          </div>
        </div>
      )}

      {/* Provider Modal */}
      {showProviderModal && (
        <ProviderConfigModal
          provider={editProvider}
          onClose={() => setShowProviderModal(false)}
          onSaved={() => {
            setShowProviderModal(false);
            providersApi.list().then((p: any) => {
              const provs = p.items || p || [];
              setProviders(Array.isArray(provs) ? provs : []);
            });
          }}
        />
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

// Toggle Switch Component
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="relative inline-flex items-center cursor-pointer">
      <input
        type="checkbox"
        className="sr-only peer"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <div className="w-12 h-6 bg-[#464554] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#4ade80]" />
    </label>
  );
}
