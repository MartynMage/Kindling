import { ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import type { OllamaModel } from "@/lib/types";

interface ModelSelectorProps {
  models: OllamaModel[];
  selectedModel: string;
  onSelectModel: (model: string) => void;
}

function formatSize(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1)}GB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)}MB`;
}

export default function ModelSelector({
  models,
  selectedModel,
  onSelectModel,
}: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const displayName = selectedModel
    ? selectedModel.split(":")[0]
    : "Select model";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm bg-surface-hover border border-surface-border hover:border-foreground-muted/30 transition-colors"
      >
        <span className="truncate text-foreground">{displayName}</span>
        <ChevronDown
          className={`h-4 w-4 text-foreground-muted shrink-0 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-surface-border rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto">
          {models.length === 0 ? (
            <div className="px-3 py-4 text-xs text-foreground-muted text-center">
              No models installed
            </div>
          ) : (
            models.map((model) => (
              <button
                key={model.name}
                onClick={() => {
                  onSelectModel(model.name);
                  setOpen(false);
                }}
                className={`flex items-center justify-between w-full px-3 py-2 text-sm hover:bg-surface-hover transition-colors ${
                  model.name === selectedModel
                    ? "text-accent"
                    : "text-foreground"
                }`}
              >
                <span className="truncate">{model.name.split(":")[0]}</span>
                <span className="text-xs text-foreground-muted shrink-0 ml-2">
                  {formatSize(model.size)}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
