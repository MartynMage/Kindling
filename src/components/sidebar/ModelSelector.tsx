import { ChevronDown } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import type { OllamaModel } from "@/lib/types";
import { formatSize } from "@/lib/utils";

interface ModelSelectorProps {
  models: OllamaModel[];
  selectedModel: string;
  onSelectModel: (model: string) => void;
}

export default function ModelSelector({
  models,
  selectedModel,
  onSelectModel,
}: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
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

  // Reset highlight when dropdown opens/closes
  useEffect(() => {
    if (open) {
      const idx = models.findIndex((m) => m.name === selectedModel);
      setHighlightIndex(idx >= 0 ? idx : 0);
    }
  }, [open, models, selectedModel]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!open) {
        if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setOpen(true);
        }
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightIndex((prev) =>
            prev < models.length - 1 ? prev + 1 : prev
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightIndex((prev) => (prev > 0 ? prev - 1 : prev));
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          if (highlightIndex >= 0 && highlightIndex < models.length) {
            onSelectModel(models[highlightIndex].name);
            setOpen(false);
          }
          break;
        case "Escape":
          e.preventDefault();
          setOpen(false);
          break;
      }
    },
    [open, models, highlightIndex, onSelectModel]
  );

  return (
    <div ref={ref} className="relative" onKeyDown={handleKeyDown}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Select model"
        className="flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm bg-surface-hover border border-surface-border hover:border-foreground-muted/30 transition-colors"
      >
        <span className="truncate text-foreground">
          {selectedModel || "Select model"}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-foreground-muted shrink-0 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Available models"
          className="absolute top-full left-0 right-0 mt-1 bg-surface border border-surface-border rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto"
        >
          {models.length === 0 ? (
            <div className="px-3 py-4 text-xs text-foreground-muted text-center">
              No models installed
            </div>
          ) : (
            models.map((model, i) => (
              <button
                type="button"
                role="option"
                aria-selected={model.name === selectedModel}
                key={model.name}
                onClick={() => {
                  onSelectModel(model.name);
                  setOpen(false);
                }}
                className={`flex items-center justify-between w-full px-3 py-2 text-sm transition-colors ${
                  i === highlightIndex
                    ? "bg-surface-hover"
                    : ""
                } ${
                  model.name === selectedModel
                    ? "text-accent"
                    : "text-foreground"
                }`}
                title={`${model.details.family} · ${model.details.parameterSize} · ${model.details.quantizationLevel}`}
              >
                <div className="flex flex-col items-start min-w-0 flex-1">
                  <span className="truncate w-full">{model.name}</span>
                  <span className="text-[10px] text-foreground-muted truncate w-full">
                    {model.details.parameterSize} · {model.details.quantizationLevel}
                  </span>
                </div>
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
