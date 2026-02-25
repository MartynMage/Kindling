import { useState, useEffect, useMemo } from "react";
import { Download, Trash2, Search, HardDrive, AlertTriangle, X, Square } from "lucide-react";
import type { OllamaModel, ModelPullProgress } from "@/lib/types";
import { formatSize } from "@/lib/utils";
import * as api from "@/lib/api";

interface ModelBrowserProps {
  models: OllamaModel[];
  onModelsChanged: () => void;
}

const POPULAR_MODELS = [
  { name: "llama3.2:3b", description: "Meta's Llama 3.2 3B — fast and capable", size: "~2GB" },
  { name: "llama3.1:8b", description: "Meta's Llama 3.1 8B — great all-rounder", size: "~4.7GB" },
  { name: "mistral:7b", description: "Mistral 7B — efficient and high quality", size: "~4.1GB" },
  { name: "phi3:mini", description: "Microsoft Phi-3 Mini — compact powerhouse", size: "~2.3GB" },
  { name: "gemma2:9b", description: "Google Gemma 2 9B — strong reasoning", size: "~5.4GB" },
  { name: "codellama:7b", description: "Meta's Code Llama 7B — optimized for code", size: "~3.8GB" },
  { name: "qwen2.5:7b", description: "Alibaba Qwen 2.5 7B — multilingual", size: "~4.4GB" },
];

export default function ModelBrowser({ models, onModelsChanged }: ModelBrowserProps) {
  const [pullName, setPullName] = useState("");
  const [pulling, setPulling] = useState(false);
  const [pullProgress, setPullProgress] = useState<ModelPullProgress | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unlisten = api.onModelPullProgress((progress) => {
      setPullProgress(progress);
      if (progress.status === "success") {
        setPulling(false);
        setPullProgress(null);
        setPullName("");
        onModelsChanged();
      }
      // Handle pull failure from progress events
      if (progress.status === "error" || progress.status === "failed") {
        setPulling(false);
        setPullProgress(null);
        setError(`Failed to pull model: ${progress.status}`);
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [onModelsChanged]);

  const handlePull = async (name: string) => {
    if (pulling) return;
    setPulling(true);
    setPullName(name);
    setError(null);
    try {
      await api.pullModel(name);
    } catch (err) {
      setPulling(false);
      setPullProgress(null);
      setError(err instanceof Error ? err.message : `Failed to pull ${name}`);
    }
  };

  const handleDelete = async (name: string) => {
    setDeleting(name);
    setError(null);
    try {
      await api.deleteModel(name);
      onModelsChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to delete ${name}`);
    } finally {
      setDeleting(null);
    }
  };

  const installedNames = useMemo(() => new Set(models.map((m) => m.name)), [models]);
  const pullPercent =
    pullProgress?.total && pullProgress?.completed
      ? Math.round((pullProgress.completed / pullProgress.total) * 100)
      : null;

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-xl font-semibold text-foreground mb-1">Models</h1>
        <p className="text-sm text-foreground-secondary mb-6">
          Manage your locally installed models
        </p>

        {/* Error banner */}
        {error && (
          <div className="flex items-center gap-2 mb-4 p-3 bg-red-400/10 border border-red-400/30 rounded-lg">
            <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
            <p className="text-sm text-red-400 flex-1">{error}</p>
            <button
              type="button"
              onClick={() => setError(null)}
              className="p-0.5 text-red-400/60 hover:text-red-400"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Pull custom model */}
        <div className="mb-8">
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-2 bg-surface border border-surface-border rounded-lg px-3">
              <Search className="h-4 w-4 text-foreground-muted" />
              <input
                type="text"
                value={pullName}
                onChange={(e) => setPullName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && pullName.trim()) handlePull(pullName.trim());
                }}
                placeholder="Pull a model (e.g., llama3.1:8b)"
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-foreground-muted py-2.5 outline-none"
                disabled={pulling}
              />
            </div>
            <button
              type="button"
              onClick={() => pullName.trim() && handlePull(pullName.trim())}
              disabled={pulling || !pullName.trim()}
              className="px-4 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-dim transition-colors disabled:opacity-40"
            >
              <Download className="h-4 w-4" />
            </button>
          </div>

          {pulling && (
            <div className="mt-3 bg-surface border border-surface-border rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-foreground">
                  Pulling {pullName}...
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-foreground-muted">
                    {pullProgress?.status || "starting"}
                    {pullPercent !== null && ` — ${pullPercent}%`}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setPulling(false);
                      setPullProgress(null);
                      setPullName("");
                    }}
                    className="flex items-center gap-1 px-2 py-1 rounded text-xs text-red-400 hover:bg-red-400/10 transition-colors"
                    title="Cancel download"
                  >
                    <Square className="h-3 w-3" /> Cancel
                  </button>
                </div>
              </div>
              <div className="h-2 bg-surface-hover rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-all duration-300"
                  style={{ width: `${pullPercent ?? 0}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Installed models */}
        <h2 className="text-sm font-medium text-foreground-secondary mb-3 flex items-center gap-2">
          <HardDrive className="h-4 w-4" />
          Installed ({models.length})
        </h2>

        {models.length === 0 ? (
          <div className="bg-surface border border-surface-border rounded-lg p-8 text-center">
            <p className="text-sm text-foreground-secondary">
              No models installed. Pull one below or use the search above.
            </p>
          </div>
        ) : (
          <div className="space-y-2 mb-8">
            {models.map((model) => (
              <div
                key={model.name}
                className="flex items-center justify-between bg-surface border border-surface-border rounded-lg px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {model.name}
                  </p>
                  <p className="text-xs text-foreground-muted">
                    {model.details.parameterSize} &middot;{" "}
                    {model.details.quantizationLevel} &middot;{" "}
                    {formatSize(model.size)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Delete ${model.name}? This cannot be undone.`)) {
                      handleDelete(model.name);
                    }
                  }}
                  disabled={deleting === model.name}
                  className="p-2 rounded-lg text-foreground-muted hover:text-red-400 hover:bg-surface-hover transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Popular models */}
        <h2 className="text-sm font-medium text-foreground-secondary mb-3">
          Popular Models
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {POPULAR_MODELS.map((m) => {
            const installed = installedNames.has(m.name);
            return (
              <div
                key={m.name}
                className="flex items-center justify-between bg-surface border border-surface-border rounded-lg px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {m.name}
                  </p>
                  <p className="text-xs text-foreground-muted">
                    {m.description} &middot; {m.size}
                  </p>
                </div>
                {installed ? (
                  <span className="text-xs text-accent px-2 py-1 rounded bg-accent/10">
                    Installed
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handlePull(m.name)}
                    disabled={pulling}
                    className="p-2 rounded-lg text-foreground-muted hover:text-accent hover:bg-surface-hover transition-colors disabled:opacity-40"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
