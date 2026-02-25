import { useState, useEffect, useRef } from "react";
import { CheckCircle, XCircle, RefreshCw, Cpu, Globe, ScrollText, AlertTriangle, Sun, Moon, Monitor } from "lucide-react";
import SystemPrompts from "./SystemPrompts";
import HardwareInfo from "./HardwareInfo";
import type { AppSettings } from "@/lib/types";
import * as api from "@/lib/api";

interface SettingsPanelProps {
  ollamaConnected: boolean;
  onConnectionChange: () => Promise<void> | void;
  onThemeChange?: (theme: "dark" | "light" | "system") => void;
}

export default function SettingsPanel({
  ollamaConnected,
  onConnectionChange,
  onThemeChange,
}: SettingsPanelProps) {
  const [settings, setSettings] = useState<AppSettings>({
    ollamaUrl: "http://localhost:11434",
    temperature: 0.7,
    contextLength: 4096,
    topP: 0.9,
    topK: 40,
    theme: "dark",
  });
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"general" | "prompts" | "hardware">(
    "general"
  );
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const s = await api.getSettings();
        if (!cancelled) setSettings(s);
      } catch {
        // Use defaults
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // Debounced save for sliders — updates UI immediately, saves after 300ms idle
  const handleSliderChange = (updates: Partial<AppSettings>) => {
    setSettings((s) => ({ ...s, ...updates }));
    setSaveError(null);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaving(true);
    saveTimerRef.current = setTimeout(async () => {
      try {
        await api.updateSettings(updates);
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : "Failed to save setting");
      } finally {
        setSaving(false);
      }
    }, 300);
  };

  const handleSave = async (updates: Partial<AppSettings>) => {
    const oldSettings = settings;
    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);
    setSaveError(null);
    try {
      await api.updateSettings(updates);
    } catch (err) {
      setSettings(oldSettings);
      setSaveError(err instanceof Error ? err.message : "Failed to save setting");
    }
  };

  const handleCheckConnection = async () => {
    setChecking(true);
    try {
      await onConnectionChange();
    } finally {
      setChecking(false);
    }
  };

  const tabs = [
    { key: "general" as const, label: "General", icon: Globe },
    { key: "prompts" as const, label: "System Prompts", icon: ScrollText },
    { key: "hardware" as const, label: "Hardware", icon: Cpu },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-xl font-semibold text-foreground mb-1">Settings</h1>
        <p className="text-sm text-foreground-secondary mb-6">
          Configure Kindling to your preferences
        </p>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-surface-hover rounded-lg p-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                type="button"
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? "bg-surface text-foreground shadow-sm"
                    : "text-foreground-muted hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {saveError && (
          <div className="flex items-center gap-2 mb-4 p-3 bg-red-400/10 border border-red-400/30 rounded-lg">
            <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
            <p className="text-sm text-red-400 flex-1">{saveError}</p>
            <button
              type="button"
              onClick={() => setSaveError(null)}
              className="text-xs text-red-400/60 hover:text-red-400"
            >
              Dismiss
            </button>
          </div>
        )}

        {activeTab === "general" && (
          <div className="space-y-6">
            {/* Ollama Connection */}
            <div className="bg-surface border border-surface-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-foreground">
                  Ollama Connection
                </h3>
                <div className="flex items-center gap-2">
                  {ollamaConnected ? (
                    <span className="flex items-center gap-1 text-xs text-green-400">
                      <CheckCircle className="h-3.5 w-3.5" /> Connected
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-red-400">
                      <XCircle className="h-3.5 w-3.5" /> Disconnected
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={handleCheckConnection}
                    disabled={checking}
                    className="p-1.5 rounded-lg text-foreground-muted hover:text-foreground hover:bg-surface-hover transition-colors"
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${checking ? "animate-spin" : ""}`}
                    />
                  </button>
                </div>
              </div>
              <input
                type="text"
                value={settings.ollamaUrl}
                onChange={(e) => setSettings((s) => ({ ...s, ollamaUrl: e.target.value }))}
                onBlur={(e) => handleSave({ ollamaUrl: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                placeholder="http://localhost:11434"
                className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-lg text-sm text-foreground outline-none focus:border-accent/40"
              />
            </div>

            {/* Model parameters */}
            <div className="bg-surface border border-surface-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="text-sm font-medium text-foreground">
                  Model Parameters
                </h3>
                {saving && (
                  <span className="text-[10px] text-foreground-muted animate-pulse">Saving...</span>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="setting-temperature" className="text-xs text-foreground-secondary">
                      Temperature
                    </label>
                    <span className="text-xs text-foreground-muted">
                      {settings.temperature.toFixed(1)}
                    </span>
                  </div>
                  <input
                    id="setting-temperature"
                    type="range"
                    min={0}
                    max={2}
                    step={0.1}
                    value={settings.temperature}
                    onChange={(e) =>
                      handleSliderChange({ temperature: parseFloat(e.target.value) })
                    }
                    className="w-full accent-accent"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="setting-context-length" className="text-xs text-foreground-secondary">
                      Context Length
                    </label>
                    <span className="text-xs text-foreground-muted">
                      {settings.contextLength}
                    </span>
                  </div>
                  <input
                    id="setting-context-length"
                    type="range"
                    min={512}
                    max={32768}
                    step={512}
                    value={settings.contextLength}
                    onChange={(e) =>
                      handleSliderChange({ contextLength: parseInt(e.target.value) })
                    }
                    className="w-full accent-accent"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="setting-top-p" className="text-xs text-foreground-secondary">
                      Top P
                    </label>
                    <span className="text-xs text-foreground-muted">
                      {settings.topP.toFixed(2)}
                    </span>
                  </div>
                  <input
                    id="setting-top-p"
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={settings.topP}
                    onChange={(e) =>
                      handleSliderChange({ topP: parseFloat(e.target.value) })
                    }
                    className="w-full accent-accent"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="setting-top-k" className="text-xs text-foreground-secondary">
                      Top K
                    </label>
                    <span className="text-xs text-foreground-muted">
                      {settings.topK}
                    </span>
                  </div>
                  <input
                    id="setting-top-k"
                    type="range"
                    min={1}
                    max={100}
                    step={1}
                    value={settings.topK}
                    onChange={(e) =>
                      handleSliderChange({ topK: parseInt(e.target.value) })
                    }
                    className="w-full accent-accent"
                  />
                </div>
              </div>
            </div>

            {/* Reset to Defaults */}
            <div className="bg-surface border border-surface-border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-foreground">
                    Reset Parameters
                  </h3>
                  <p className="text-xs text-foreground-muted mt-0.5">
                    Restore temperature, context length, top_p, and top_k to defaults
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const defaults = {
                      temperature: 0.7,
                      contextLength: 4096,
                      topP: 0.9,
                      topK: 40,
                    };
                    setSettings((s) => ({ ...s, ...defaults }));
                    api.updateSettings(defaults).catch(() => {});
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-foreground-muted border border-surface-border hover:text-foreground hover:bg-surface-hover transition-colors"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Theme */}
            <div className="bg-surface border border-surface-border rounded-lg p-4">
              <h3 className="text-sm font-medium text-foreground mb-3">
                Appearance
              </h3>
              <div className="flex gap-2">
                {([
                  { value: "dark" as const, label: "Dark", icon: Moon },
                  { value: "light" as const, label: "Light", icon: Sun },
                  { value: "system" as const, label: "System", icon: Monitor },
                ]).map(({ value, label, icon: Icon }) => (
                  <button
                    type="button"
                    key={value}
                    onClick={() => {
                      handleSave({ theme: value });
                      onThemeChange?.(value);
                    }}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                      settings.theme === value
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-surface-border text-foreground-muted hover:text-foreground hover:bg-surface-hover"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "prompts" && <SystemPrompts />}
        {activeTab === "hardware" && <HardwareInfo />}
      </div>
    </div>
  );
}
