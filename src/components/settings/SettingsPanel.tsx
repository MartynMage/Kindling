import { useState, useEffect } from "react";
import { CheckCircle, XCircle, RefreshCw, Cpu, Globe, ScrollText } from "lucide-react";
import SystemPrompts from "./SystemPrompts";
import HardwareInfo from "./HardwareInfo";
import type { AppSettings } from "@/lib/types";
import * as api from "@/lib/api";

interface SettingsPanelProps {
  ollamaConnected: boolean;
  onConnectionChange: () => void;
}

export default function SettingsPanel({
  ollamaConnected,
  onConnectionChange,
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
  const [activeTab, setActiveTab] = useState<"general" | "prompts" | "hardware">(
    "general"
  );

  useEffect(() => {
    async function load() {
      try {
        const s = await api.getSettings();
        setSettings(s);
      } catch {
        // Use defaults
      }
    }
    load();
  }, []);

  const handleSave = async (updates: Partial<AppSettings>) => {
    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);
    try {
      await api.updateSettings(updates);
    } catch {
      // Silently fail
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
                placeholder="http://localhost:11434"
                className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-lg text-sm text-foreground outline-none focus:border-accent/40"
              />
            </div>

            {/* Model parameters */}
            <div className="bg-surface border border-surface-border rounded-lg p-4">
              <h3 className="text-sm font-medium text-foreground mb-4">
                Model Parameters
              </h3>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-foreground-secondary">
                      Temperature
                    </label>
                    <span className="text-xs text-foreground-muted">
                      {settings.temperature}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={2}
                    step={0.1}
                    value={settings.temperature}
                    onChange={(e) =>
                      handleSave({ temperature: parseFloat(e.target.value) })
                    }
                    className="w-full accent-accent"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-foreground-secondary">
                      Context Length
                    </label>
                    <span className="text-xs text-foreground-muted">
                      {settings.contextLength}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={512}
                    max={32768}
                    step={512}
                    value={settings.contextLength}
                    onChange={(e) =>
                      handleSave({ contextLength: parseInt(e.target.value) })
                    }
                    className="w-full accent-accent"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-foreground-secondary">
                      Top P
                    </label>
                    <span className="text-xs text-foreground-muted">
                      {settings.topP}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={settings.topP}
                    onChange={(e) =>
                      handleSave({ topP: parseFloat(e.target.value) })
                    }
                    className="w-full accent-accent"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-foreground-secondary">
                      Top K
                    </label>
                    <span className="text-xs text-foreground-muted">
                      {settings.topK}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={100}
                    step={1}
                    value={settings.topK}
                    onChange={(e) =>
                      handleSave({ topK: parseInt(e.target.value) })
                    }
                    className="w-full accent-accent"
                  />
                </div>
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
