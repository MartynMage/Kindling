import { useState, useEffect } from "react";
import { Download, Trash2, Search, HardDrive } from "lucide-react";
import type { OllamaModel, ModelPullProgress } from "@/lib/types";
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

function formatSize(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)} MB`;
}

export default function ModelBrowser({ models, onModelsChanged }: ModelBrowserProps) {
  const [pullName, setPullName] = useState("");
  const [pulling, setPulling] = useState(false);
  const [pullProgress, setPullProgress] = useState<ModelPullProgress | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    const unlisten = api.onModelPullProgress((progress) => {
      setPullProgress(progress);
      if (progress.status === "success") {
        setPulling(false);
        setPullProgress(null);
        setPullName("");
        onModelsChanged();
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
    try {
      await api.pullModel(name);
    } catch {
      setPulling(false);
      setPullProgress(null);
    }
  };

  const handleDelete = async (name: string) => {
    setDeleting(name);
    try {
      await api.deleteModel(name);
      onModelsChanged();
    } catch (err) {
      console.error("Failed to delete model:", err);
    } finally {
      setDeleting(null);
    }
  };

  const installedNames = new Set(models.map((m) => m.name));
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
                <span className="text-xs text-foreground-muted">
                  {pullProgress?.status || "starting"}
                  {pullPercent !== null && ` — ${pullPercent}%`}
                </span>
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
                  onClick={() => handleDelete(model.name)}
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
