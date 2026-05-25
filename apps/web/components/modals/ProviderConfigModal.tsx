"use client";

import { useState, useEffect } from "react";
import { providersApi } from "@/lib/api";

const PROVIDER_TYPES = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "opencode", label: "OpenCode" },
  { value: "openrouter", label: "OpenRouter" },
  { value: "groq", label: "Groq" },
  { value: "ollama", label: "Ollama" },
  { value: "custom", label: "Custom" },
];

const TEMPLATES = [
  {
    label: "OpenAI",
    provider_type: "openai",
    base_url: "https://api.openai.com/v1",
    model: "gpt-4o",
    max_tokens: 2000,
  },
  {
    label: "Anthropic",
    provider_type: "anthropic",
    base_url: "https://api.anthropic.com/v1",
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
  },
  {
    label: "OpenCode",
    provider_type: "openai",
    base_url: "http://localhost:7777/v1",
    model: "gpt-5-mini",
    max_tokens: 2000,
  },
  {
    label: "OpenRouter",
    provider_type: "openrouter",
    base_url: "https://openrouter.ai/api/v1",
    model: "openrouter/auto",
    max_tokens: 2000,
  },
  {
    label: "Groq",
    provider_type: "groq",
    base_url: "https://api.groq.com/openai/v1",
    model: "llama3-8b-8192",
    max_tokens: 2000,
  },
  {
    label: "Ollama",
    provider_type: "ollama",
    base_url: "http://localhost:11434/v1",
    model: "llama3",
    max_tokens: 2000,
  },
  {
    label: "Custom",
    provider_type: "custom",
    base_url: "",
    model: "",
    max_tokens: 2000,
  },
];

interface Props {
  provider?: any;
  mode?: "template" | "custom";
  onClose: () => void;
  onSaved?: () => void;
}

export default function ProviderConfigModal({ provider, mode = "custom", onClose, onSaved }: Props) {
  const [name, setName] = useState(provider?.name || "");
  const [providerType, setProviderType] = useState(provider?.provider_type || "openai");
  const [baseUrl, setBaseUrl] = useState(provider?.base_url || "");
  const [model, setModel] = useState(provider?.model || "");
  const [apiKey, setApiKey] = useState("");
  const [maxTokens, setMaxTokens] = useState(provider?.max_tokens || 2000);
  const [isEnabled, setIsEnabled] = useState(provider?.is_enabled !== false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<any>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showTemplatePicker, setShowTemplatePicker] = useState(mode === "template" && !provider);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  // Auto-fill when provider type changes (only in custom mode, not editing existing)
  useEffect(() => {
    if (!provider && !showTemplatePicker) {
      const template = TEMPLATES.find((t) => t.provider_type === providerType);
      if (template && providerType !== "custom") {
        setBaseUrl(template.base_url);
        setModel(template.model);
        setMaxTokens(template.max_tokens);
      }
    }
  }, [providerType, provider, showTemplatePicker]);

  // Fetch available models when editing an existing provider
  useEffect(() => {
    if (provider?.id) {
      setLoadingModels(true);
      providersApi.listModels(provider.id)
        .then((res: any) => {
          const models = res.models?.map((m: any) => m.id || m.name) || [];
          setAvailableModels(models);
        })
        .catch(() => setAvailableModels([]))
        .finally(() => setLoadingModels(false));
    }
  }, [provider?.id]);

  const handleSelectTemplate = (template: typeof TEMPLATES[0]) => {
    setSelectedTemplate(template.label);
    setName(template.label);
    setProviderType(template.provider_type);
    setBaseUrl(template.base_url);
    setModel(template.model);
    setMaxTokens(template.max_tokens);
    setShowTemplatePicker(false);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    setError("");
    try {
      // If editing existing provider, test by ID
      if (provider?.id) {
        const res = await providersApi.test(provider.id);
        setTestResult({ ok: res.status === "ok" || res.ok === true, message: res.response || res.status || res.message || "Test completed" });
      } else {
        // For new providers, we can't test by ID, so show info
        setTestResult({ ok: true, message: "Save the provider first to test the connection by ID." });
      }
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
        name: name || `${providerType} Provider`,
        provider_type: providerType,
        base_url: baseUrl,
        model,
        max_tokens: maxTokens,
        is_enabled: isEnabled,
      };
      if (apiKey.trim()) payload.api_key = apiKey.trim();

      if (provider?.id) {
        await providersApi.update(provider.id, payload);
      } else {
        await providersApi.create(payload);
      }
      onSaved?.();
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  // Template picker view
  if (showTemplatePicker) {
    return (
      <div
        className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div className="bg-[#1e293b] border border-[#464554] rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-[#464554]">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#c0c1ff]">library_add</span>
              <h2 className="text-[18px] font-semibold text-[#e4e1ed]">Add Provider from Template</h2>
            </div>
            <button
              onClick={onClose}
              className="text-[#c7c4d7] hover:text-[#e4e1ed] transition-colors"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          {/* Template Grid */}
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {TEMPLATES.map((template) => (
              <button
                key={template.label}
                onClick={() => handleSelectTemplate(template)}
                className="text-left bg-[#0d0d15] border border-[#464554] rounded-lg p-4 hover:border-[#c0c1ff] hover:bg-[#292932] transition-all group"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-[#c0c1ff] group-hover:text-[#e1e0ff]">cloud</span>
                  <h3 className="text-[16px] font-semibold text-[#e4e1ed]">{template.label}</h3>
                </div>
                <div className="space-y-1 text-[12px] text-[#c7c4d7]">
                  <div className="flex items-center gap-1">
                    <span className="text-[#908fa0]">Type:</span>
                    <span className="badge bg-[#292932] border-[#464554] text-[#c7c4d7]">{template.provider_type}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[#908fa0]">Model:</span>
                    <span className="font-mono">{template.model}</span>
                  </div>
                  <div className="font-mono truncate">{template.base_url || "Custom endpoint"}</div>
                </div>
              </button>
            ))}
          </div>

          {/* Footer */}
          <div className="flex justify-end p-6 border-t border-[#464554]">
            <button
              onClick={onClose}
              className="px-4 py-2 text-[14px] text-[#c7c4d7] border border-[#464554] rounded-sm hover:bg-[#292932] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[#1e293b] border border-[#464554] rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#464554]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#c0c1ff]">settings</span>
            <h2 className="text-[18px] font-semibold text-[#e4e1ed]">
              {provider ? "Edit Provider" : "Add Provider"}
            </h2>
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
          {/* Name */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#c7c4d7] mb-1.5">
              Name
            </label>
            <input
              className="w-full bg-[#0d0d15] border border-[#464554] rounded-sm p-2.5 text-[14px] text-[#e4e1ed] placeholder-[#908fa0] focus:outline-none focus:border-[#c0c1ff]"
              placeholder="My Provider"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
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
            {loadingModels ? (
              <div className="w-full bg-[#0d0d15] border border-[#464554] rounded-sm p-2.5 text-[14px] text-[#908fa0] font-mono">
                Loading models...
              </div>
            ) : availableModels.length > 0 ? (
              <select
                className="w-full bg-[#0d0d15] border border-[#464554] rounded-sm p-2.5 text-[14px] text-[#e4e1ed] font-mono focus:outline-none focus:border-[#c0c1ff]"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              >
                <option value="">Select a model...</option>
                {availableModels.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            ) : (
              <input
                className="w-full bg-[#0d0d15] border border-[#464554] rounded-sm p-2.5 text-[14px] text-[#e4e1ed] font-mono placeholder-[#908fa0] focus:outline-none focus:border-[#c0c1ff]"
                placeholder="e.g. gpt-4o"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              />
            )}
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

          {/* Enabled Toggle */}
          <div className="flex items-center justify-between py-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-[#c7c4d7]">
              Enabled
            </label>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={isEnabled}
                onChange={(e) => setIsEnabled(e.target.checked)}
              />
              <div className="w-12 h-6 bg-[#464554] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#4ade80]" />
            </label>
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
            {provider ? "Update Provider" : "Save Provider"}
          </button>
        </div>
      </div>
    </div>
  );
}
