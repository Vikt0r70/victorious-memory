"use client";

import { useState, useEffect } from "react";
import { providersApi } from "@/lib/api";

export interface ProviderTemplate {
  key: string;
  name: string;
  provider_type: string;
  base_url: string;
  default_model: string;
  description: string;
}

const STATIC_TEMPLATES: ProviderTemplate[] = [
  {
    key: "openai",
    name: "OpenAI",
    provider_type: "openai",
    base_url: "https://api.openai.com/v1",
    default_model: "gpt-4o",
    description: "Official OpenAI API (GPT-4o, GPT-4o-mini, etc.)",
  },
  {
    key: "anthropic",
    name: "Anthropic",
    provider_type: "anthropic",
    base_url: "https://api.anthropic.com/v1",
    default_model: "claude-3-5-sonnet-20241022",
    description: "Anthropic Claude API (Sonnet 3.5, Haiku 3.5)",
  },
  {
    key: "openrouter",
    name: "OpenRouter",
    provider_type: "openrouter",
    base_url: "https://openrouter.ai/api/v1",
    default_model: "anthropic/claude-3.5-sonnet",
    description: "Unified multi-model API with auto-routing",
  },
  {
    key: "groq",
    name: "Groq",
    provider_type: "groq",
    base_url: "https://api.groq.com/openai/v1",
    default_model: "llama-3.3-70b-versatile",
    description: "Ultra-fast inference for open models",
  },
  {
    key: "ollama",
    name: "Ollama (Local)",
    provider_type: "ollama",
    base_url: "http://localhost:11434/v1",
    default_model: "llama3.2",
    description: "Local LLM inference (Docker: use host.docker.internal)",
  },
  {
    key: "opencode",
    name: "OpenCode / Proxy",
    provider_type: "opencode",
    base_url: "http://localhost:7777/v1",
    default_model: "deepseek-chat",
    description: "OpenCode proxy or custom local runner",
  },
  {
    key: "custom",
    name: "Custom OpenAI-Compatible",
    provider_type: "custom",
    base_url: "",
    default_model: "",
    description: "Any custom endpoint (LiteLLM, vLLM, DeepSeek, etc.)",
  },
];

const PROVIDER_TYPES = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "openrouter", label: "OpenRouter" },
  { value: "groq", label: "Groq" },
  { value: "ollama", label: "Ollama (Local)" },
  { value: "opencode", label: "OpenCode" },
  { value: "custom", label: "Custom OpenAI-Compatible" },
];

interface Props {
  provider?: any;
  mode?: "template" | "custom";
  onClose: () => void;
  onSaved?: () => void;
}

export default function ProviderConfigModal({
  provider,
  mode = "custom",
  onClose,
  onSaved,
}: Props) {
  const [templates, setTemplates] = useState<ProviderTemplate[]>(STATIC_TEMPLATES);
  const [name, setName] = useState(provider?.name || "");
  const [providerType, setProviderType] = useState(provider?.provider_type || "openai");
  const [baseUrl, setBaseUrl] = useState(provider?.base_url || "");
  const [model, setModel] = useState(provider?.model || "");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [maxTokens, setMaxTokens] = useState(provider?.max_tokens || 4096);
  const [isEnabled, setIsEnabled] = useState(provider?.is_enabled !== false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
    latency_ms?: number;
  } | null>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showTemplatePicker, setShowTemplatePicker] = useState(
    mode === "template" && !provider
  );
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  // Load templates from API if available
  useEffect(() => {
    providersApi.templates()
      .then((data: any) => {
        if (Array.isArray(data) && data.length > 0) {
          setTemplates(data);
        }
      })
      .catch(() => {});
  }, []);

  // Fetch available models if editing existing provider
  useEffect(() => {
    if (provider?.id) {
      fetchDiscoveredModels(provider.id);
    }
  }, [provider?.id]);

  const fetchDiscoveredModels = async (providerId: string) => {
    setLoadingModels(true);
    try {
      const res = await providersApi.listModels(providerId);
      const models = res.models?.map((m: any) => m.id || m.name) || [];
      setAvailableModels(models);
    } catch {
      setAvailableModels([]);
    } finally {
      setLoadingModels(false);
    }
  };

  const handleSelectTemplate = (template: ProviderTemplate) => {
    setName(template.name);
    setProviderType(template.provider_type);
    setBaseUrl(template.base_url);
    setModel(template.default_model);
    setShowTemplatePicker(false);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    setError("");

    try {
      if (provider?.id && !apiKey.trim()) {
        // Saved provider without modified key: test by ID
        const res = await providersApi.test(provider.id);
        const ok = res.status === "success" || res.status === "ok";
        setTestResult({
          ok,
          message: res.response || (ok ? "Connection verified" : res.error || "Failed"),
          latency_ms: res.latency_ms,
        });
        if (ok) {
          fetchDiscoveredModels(provider.id);
        }
      } else {
        // Test unsaved / transient configuration
        const payload = {
          name: name || "Test Provider",
          provider_type: providerType,
          base_url: baseUrl,
          api_key: apiKey.trim(),
          model: model.trim() || "gpt-4o",
          max_tokens: maxTokens,
        };
        const res = await providersApi.testConnection(payload);
        const ok = res.status === "success" || res.status === "ok";
        setTestResult({
          ok,
          message: ok
            ? (res.response || "Connection verified")
            : (res.error || "Connection failed"),
          latency_ms: res.latency_ms,
        });
      }
    } catch (e: any) {
      setTestResult({
        ok: false,
        message: e.message || "Failed to reach endpoint",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Please provide a name for this provider.");
      return;
    }
    if (!model.trim()) {
      setError("Please specify a model identifier.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload: any = {
        name: name.trim(),
        provider_type: providerType,
        base_url: baseUrl.trim(),
        model: model.trim(),
        max_tokens: Number(maxTokens) || 4096,
        is_enabled: isEnabled,
      };
      if (apiKey.trim()) {
        payload.api_key = apiKey.trim();
      }

      if (provider?.id) {
        await providersApi.update(provider.id, payload);
      } else {
        await providersApi.create(payload);
      }
      onSaved?.();
      onClose();
    } catch (e: any) {
      setError(e.message || "Failed to save provider");
    } finally {
      setSaving(false);
    }
  };

  // ── Template Picker View ──────────────────────────────────────────
  if (showTemplatePicker) {
    return (
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div className="bg-card border border-input rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between p-6 border-b border-border">
            <div>
              <h2 className="text-[18px] font-semibold text-foreground flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">add_circle</span>
                Choose a Provider Template
              </h2>
              <p className="text-[12px] text-muted-foreground mt-0.5">
                Quick-start with pre-configured settings or configure a custom endpoint
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors p-1"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-3 overflow-y-auto">
            {templates.map((template) => (
              <button
                key={template.key}
                onClick={() => handleSelectTemplate(template)}
                className="text-left bg-muted/30 border border-border rounded-lg p-4 hover:border-primary hover:bg-muted transition-all group relative cursor-pointer"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary group-hover:scale-110 transition-transform">
                      {template.key === "ollama" ? "dns" : template.key === "anthropic" ? "psychology" : "smart_toy"}
                    </span>
                    <h3 className="text-[15px] font-semibold text-foreground">{template.name}</h3>
                  </div>
                  <span className="badge bg-accent border-border text-muted-foreground text-[10px]">
                    {template.provider_type}
                  </span>
                </div>
                <p className="text-[12px] text-muted-foreground line-clamp-2 mb-2">
                  {template.description}
                </p>
                <div className="text-[11px] font-mono text-secondary-foreground truncate bg-background px-2 py-1 rounded border border-[#292932]">
                  {template.default_model || "Custom model ID"}
                </div>
              </button>
            ))}
          </div>

          <div className="flex justify-between items-center p-4 px-6 border-t border-border bg-muted/30">
            <button
              onClick={() => {
                setShowTemplatePicker(false);
                setProviderType("custom");
              }}
              className="text-[13px] text-primary hover:underline flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">edit</span>
              Configure custom from scratch
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 text-[13px] text-muted-foreground border border-input rounded-md shadow-sm hover:bg-accent hover:text-accent-foreground transition-all duration-200"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Form Configuration View ───────────────────────────────────────
  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-card border border-input rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-[18px] font-semibold text-foreground flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">
                {provider ? "tune" : "add_box"}
              </span>
              {provider ? "Edit LLM Provider" : "Configure LLM Provider"}
            </h2>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              Set credentials and model parameters for system agents
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Provider Name & Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Provider Name *
              </label>
              <input
                className="w-full bg-background border border-input rounded-md shadow-sm p-2.5 text-[14px] text-foreground placeholder-[#908fa0] focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                placeholder="e.g. OpenAI Primary, Fast Groq"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Provider Protocol
              </label>
              <select
                className="w-full bg-background border border-input rounded-md shadow-sm p-2.5 text-[14px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer hover:bg-accent/50 transition-colors"
                value={providerType}
                onChange={(e) => setProviderType(e.target.value)}
              >
                {PROVIDER_TYPES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Base URL */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Base URL
              </label>
              {providerType === "ollama" && (
                <span className="text-[11px] text-primary">
                  Docker: http://host.docker.internal:11434/v1
                </span>
              )}
            </div>
            <input
              className="w-full bg-background border border-input rounded-md shadow-sm p-2.5 text-[14px] text-foreground font-mono placeholder-[#908fa0] focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              placeholder="https://api.openai.com/v1"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          </div>

          {/* API Key */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
              API Key
            </label>
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                className="w-full bg-background border border-input rounded-md shadow-sm p-2.5 pr-10 text-[14px] text-foreground font-mono placeholder-[#908fa0] focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                placeholder={
                  provider?.id
                    ? "•••••••• (leave blank to retain stored key)"
                    : "sk-..."
                }
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground transition-colors"
                title={showKey ? "Hide key" : "Show key"}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {showKey ? "visibility_off" : "visibility"}
                </span>
              </button>
            </div>
          </div>

          {/* Model Selection & Discovery */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Model Identifier *
              </label>
              {availableModels.length > 0 && (
                <span className="text-[11px] text-success">
                  ✓ {availableModels.length} models discovered
                </span>
              )}
            </div>

            {loadingModels ? (
              <div className="w-full bg-background border border-input rounded-md shadow-sm p-2.5 text-[14px] text-muted-foreground font-mono flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                Discovering models from endpoint...
              </div>
            ) : availableModels.length > 0 ? (
              <div className="space-y-1.5">
                <select
                  className="w-full bg-background border border-input rounded-md shadow-sm p-2.5 text-[14px] text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                >
                  <option value="">Select a discovered model...</option>
                  {availableModels.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <input
                  className="w-full bg-background border border-border rounded-sm p-2 text-[12px] text-secondary-foreground font-mono placeholder-[#908fa0] focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                  placeholder="Or enter custom model ID directly..."
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                />
              </div>
            ) : (
              <input
                className="w-full bg-background border border-input rounded-md shadow-sm p-2.5 text-[14px] text-foreground font-mono placeholder-[#908fa0] focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                placeholder="e.g. gpt-4o, claude-3-5-sonnet-20241022, llama3.2"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              />
            )}
          </div>

          {/* Test Status Banner */}
          {testResult && (
            <div
              className={`text-[13px] border rounded-md p-3.5 ${
                testResult.ok
                  ? "bg-success/10 border-success/30 text-success"
                  : "bg-destructive/10 border-destructive/30 text-destructive"
              }`}
            >
              <div className="flex items-center justify-between font-semibold">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[18px]">
                    {testResult.ok ? "check_circle" : "error"}
                  </span>
                  {testResult.ok ? "Connection Successful" : "Connection Failed"}
                </div>
                {testResult.latency_ms && (
                  <span className="text-[11px] font-mono opacity-80">
                    {testResult.latency_ms}ms latency
                  </span>
                )}
              </div>
              <div className="mt-1 text-[12px] opacity-90 leading-relaxed break-words">
                {testResult.message}
              </div>
            </div>
          )}

          {error && (
            <div className="text-destructive text-[13px] bg-destructive/20 border border-[#93000a] rounded-sm p-2.5">
              {error}
            </div>
          )}

          {/* Advanced Accordion Toggle */}
          <div className="pt-2 border-t border-border">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-[12px] text-secondary-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">
                {showAdvanced ? "expand_less" : "expand_more"}
              </span>
              Advanced Parameters (Max Tokens & Status)
            </button>

            {showAdvanced && (
              <div className="mt-3 space-y-3 bg-muted/30 p-3.5 rounded-lg border border-border">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Max Output Tokens
                    </label>
                    <span className="text-[12px] font-mono text-primary">
                      {maxTokens}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={256}
                    max={16384}
                    step={256}
                    className="w-full w-4 h-4 rounded border-input cursor-pointer shadow-sm transition-colors text-primary focus:ring-primary focus:ring-offset-background bg-background cursor-pointer"
                    value={maxTokens}
                    onChange={(e) => setMaxTokens(parseInt(e.target.value, 10))}
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[12px] text-muted-foreground">Enable this Provider</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={isEnabled}
                      onChange={(e) => setIsEnabled(e.target.checked)}
                    />
                    <div className="w-10 h-5 bg-[#464554] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#4ade80]" />
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-between items-center p-4 px-6 border-t border-border bg-muted/30">
          <button
            type="button"
            onClick={handleTest}
            disabled={testing}
            className="px-3.5 py-2 text-[13px] border border-primary text-primary rounded-sm hover:bg-primary/10 transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
          >
            {testing ? (
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            ) : (
              <span className="material-symbols-outlined text-[16px]">cable</span>
            )}
            {testing ? "Testing..." : "Test Connection"}
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-[13px] text-muted-foreground border border-input rounded-md shadow-sm hover:bg-accent hover:text-accent-foreground transition-all duration-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-[13px] bg-primary text-primary-foreground font-semibold rounded-sm hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              {saving && (
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              )}
              {provider ? "Update Provider" : "Save Provider"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
