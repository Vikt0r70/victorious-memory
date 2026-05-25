"use client";

import { useState } from "react";
import { providersApi } from "@/lib/api";

const ROLES = [
  { value: "extraction", label: "Extraction" },
  { value: "edge_detection", label: "Edge Detection" },
  { value: "consolidation", label: "Consolidation" },
];

const PROVIDER_TYPES = [
  { value: "openai_compatible", label: "OpenAI Compatible" },
  { value: "anthropic", label: "Anthropic" },
];

const PRESETS = [
  { label: "Custom", base_url: "", model: "" },
  { label: "OpenAI", base_url: "https://api.openai.com/v1", model: "gpt-4-turbo" },
  { label: "Anthropic", base_url: "https://api.anthropic.com/v1", model: "claude-3-opus-20240229" },
  { label: "DeepSeek", base_url: "https://api.deepseek.com/v1", model: "deepseek-chat" },
  { label: "Ollama", base_url: "http://localhost:11434/v1", model: "llama3" },
  { label: "OpenRouter", base_url: "https://openrouter.ai/api/v1", model: "openrouter/auto" },
];

interface Props {
  provider?: any;
  onClose: () => void;
  onSaved?: () => void;
}

export default function ProviderConfigModal({ provider, onClose, onSaved }: Props) {
  const [role, setRole] = useState(provider?.role || "extraction");
  const [providerType, setProviderType] = useState(provider?.provider_type || "openai_compatible");
  const [preset, setPreset] = useState("Custom");
  const [baseUrl, setBaseUrl] = useState(provider?.base_url || "");
  const [model, setModel] = useState(provider?.model || "");
  const [apiKey, setApiKey] = useState("");
  const [maxTokens, setMaxTokens] = useState(provider?.max_tokens || 2000);
  const [testResult, setTestResult] = useState<any>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    setError("");
    try {
      const res = await providersApi.test(role);
      setTestResult({ ok: res.status === "ok", message: res.response || res.status });
    } catch (e: any) {
      setTestResult({ ok: false, message: e.message });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const payload: any = {
        role,
        provider_type: providerType,
        base_url: baseUrl,
        model,
        max_tokens: maxTokens,
      };
      if (apiKey.trim()) payload.api_key = apiKey.trim();
      await providersApi.upsert(payload);
      onSaved?.();
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[#1e293b] border border-[#464554] rounded-xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#464554]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#c0c1ff]">settings</span>
            <h2 className="text-[18px] font-semibold text-[#e4e1ed]">Configure Provider</h2>
          </div>
          <button
            onClick={onClose}
            className="text-[#c7c4d7] hover:text-[#e4e1ed] transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Role */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#c7c4d7] mb-1.5">
              Role
            </label>
            <select
              className="w-full bg-[#0d0d15] border border-[#464554] rounded-sm p-2.5 text-[14px] text-[#e4e1ed] focus:outline-none focus:border-[#c0c1ff]"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          {/* Provider Type */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#c7c4d7] mb-1.5">
              Provider Type
            </label>
            <select
              className="w-full bg-[#0d0d15] border border-[#464554] rounded-sm p-2.5 text-[14px] text-[#e4e1ed] focus:outline-none focus:border-[#c0c1ff]"
              value={providerType}
              onChange={(e) => setProviderType(e.target.value)}
            >
              {PROVIDER_TYPES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          {/* Preset */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#c7c4d7] mb-1.5">
              Preset
            </label>
            <select
              className="w-full bg-[#0d0d15] border border-[#464554] rounded-sm p-2.5 text-[14px] text-[#e4e1ed] focus:outline-none focus:border-[#c0c1ff]"
              value={preset}
              onChange={(e) => {
                const p = PRESETS.find((x) => x.label === e.target.value);
                setPreset(e.target.value);
                if (p && p.label !== "Custom") {
                  setBaseUrl(p.base_url);
                  setModel(p.model);
                }
              }}
            >
              {PRESETS.map((p) => (
                <option key={p.label} value={p.label}>{p.label}</option>
              ))}
            </select>
          </div>

          {/* Base URL */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#c7c4d7] mb-1.5">
              Base URL
            </label>
            <input
              className="w-full bg-[#0d0d15] border border-[#464554] rounded-sm p-2.5 text-[14px] text-[#e4e1ed] font-mono placeholder-[#908fa0] focus:outline-none focus:border-[#c0c1ff]"
              placeholder="https://api.example.com/v1"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          </div>

          {/* Model */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#c7c4d7] mb-1.5">
              Model
            </label>
            <input
              className="w-full bg-[#0d0d15] border border-[#464554] rounded-sm p-2.5 text-[14px] text-[#e4e1ed] font-mono placeholder-[#908fa0] focus:outline-none focus:border-[#c0c1ff]"
              placeholder="e.g. deepseek-v4-flash"
              value={model}
              onChange={(e) => setModel(e.target.value)}
            />
          </div>

          {/* API Key */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#c7c4d7] mb-1.5">
              API Key
            </label>
            <input
              type="password"
              className="w-full bg-[#0d0d15] border border-[#464554] rounded-sm p-2.5 text-[14px] text-[#e4e1ed] font-mono placeholder-[#908fa0] focus:outline-none focus:border-[#c0c1ff]"
              placeholder={provider ? "•••••••• (leave blank to keep)" : "Enter API key"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>

          {/* Max Tokens */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#c7c4d7] mb-1.5">
              Max Tokens
            </label>
            <input
              type="number"
              min={1}
              max={32000}
              className="w-full bg-[#0d0d15] border border-[#464554] rounded-sm p-2.5 text-[14px] text-[#e4e1ed] focus:outline-none focus:border-[#c0c1ff]"
              value={maxTokens}
              onChange={(e) => setMaxTokens(parseInt(e.target.value) || 2000)}
            />
          </div>

          {/* Test Result */}
          {testResult && (
            <div className={`text-[13px] border rounded-sm p-3 ${
              testResult.ok
                ? "bg-[#4ade80]/10 border-[#4ade80] text-[#4ade80]"
                : "bg-[#ffb4ab]/10 border-[#ffb4ab] text-[#ffb4ab]"
            }`}>
              <div className="flex items-center gap-1 font-semibold">
                <span className="material-symbols-outlined text-[16px]">
                  {testResult.ok ? "check_circle" : "error"}
                </span>
                {testResult.ok ? "Connection successful" : "Connection failed"}
              </div>
              <div className="mt-1 text-[12px] opacity-90">{testResult.message}</div>
            </div>
          )}

          {error && (
            <div className="text-[#ffb4ab] text-[13px] bg-[#93000a]/20 border border-[#93000a] rounded-sm p-2">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-[#464554]">
          <button
            onClick={handleTest}
            disabled={testing}
            className="px-4 py-2 text-[14px] border border-[#c0c1ff] text-[#c0c1ff] rounded-sm hover:bg-[#c0c1ff]/10 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {testing && (
              <span className="material-symbols-outlined animate-spin text-[16px]">
                progress_activity
              </span>
            )}
            Test Connection
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-[14px] text-[#c7c4d7] border border-[#464554] rounded-sm hover:bg-[#292932] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-[14px] bg-[#c0c1ff] text-[#1000a9] font-semibold rounded-sm hover:bg-[#e1e0ff] transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {saving && (
              <span className="material-symbols-outlined animate-spin text-[16px]">
                progress_activity
              </span>
            )}
            Save Provider
          </button>
        </div>
      </div>
    </div>
  );
}

