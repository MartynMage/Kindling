import { useState, useEffect, useCallback } from "react";
import { Cpu, MemoryStick, Monitor, RefreshCw } from "lucide-react";
import type { HardwareInfo as HWInfo } from "@/lib/types";
import { formatSize } from "@/lib/utils";
import * as api from "@/lib/api";

export default function HardwareInfo() {
  const [info, setInfo] = useState<HWInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (signal?: { cancelled: boolean }) => {
    setLoading(true);
    try {
      const hw = await api.getHardwareInfo();
      if (signal?.cancelled) return;
      setInfo(hw);
    } catch {
      if (signal?.cancelled) return;
      setInfo(null);
    } finally {
      if (!signal?.cancelled) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const signal = { cancelled: false };
    load(signal);
    return () => { signal.cancelled = true; };
  }, [load]);

  const getRecommendation = (ram: number, vram?: number): string => {
    const availableMemory = vram || ram;
    const gb = availableMemory / (1024 * 1024 * 1024);

    if (gb >= 16) return "You can run most 13B models comfortably. Try llama3.1:8b or mistral:7b.";
    if (gb >= 8) return "Good for 7B-8B models. Try llama3.2:3b or phi3:mini for best performance.";
    if (gb >= 4) return "Best with smaller models. Try phi3:mini or llama3.2:3b.";
    return "Limited memory. Consider llama3.2:1b or smaller quantized models.";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-5 w-5 text-foreground-muted animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-medium text-foreground">Hardware</h3>
          <p className="text-xs text-foreground-muted">
            System specs and model recommendations
          </p>
        </div>
        <button
          type="button"
          onClick={() => load()}
          className="p-1.5 rounded-lg text-foreground-muted hover:text-foreground hover:bg-surface-hover transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {info ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div className="bg-surface border border-surface-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Monitor className="h-4 w-4 text-accent" />
                <span className="text-xs text-foreground-muted">OS</span>
              </div>
              <p className="text-sm font-medium text-foreground">{info.os}</p>
            </div>

            <div className="bg-surface border border-surface-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <MemoryStick className="h-4 w-4 text-accent" />
                <span className="text-xs text-foreground-muted">RAM</span>
              </div>
              <p className="text-sm font-medium text-foreground mb-2">
                {formatSize(info.totalRam)}
              </p>
              <div className="h-1.5 bg-surface-hover rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent/60 rounded-full"
                  style={{ width: `${Math.min(100, Math.max(10, (info.totalRam / (32 * 1024 * 1024 * 1024)) * 100))}%` }}
                  title={`${formatSize(info.totalRam)} total`}
                />
              </div>
            </div>

            <div className="bg-surface border border-surface-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Cpu className="h-4 w-4 text-accent" />
                <span className="text-xs text-foreground-muted">GPU</span>
              </div>
              <p className="text-sm font-medium text-foreground">
                {info.gpuName || "Not detected"}
              </p>
              {info.vram && (
                <>
                  <p className="text-xs text-foreground-muted mt-0.5 mb-1.5">
                    {formatSize(info.vram)} VRAM
                  </p>
                  <div className="h-1.5 bg-surface-hover rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent/60 rounded-full"
                      style={{ width: `${Math.min(100, Math.max(10, (info.vram / (24 * 1024 * 1024 * 1024)) * 100))}%` }}
                      title={`${formatSize(info.vram)} VRAM`}
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="bg-accent/10 border border-accent/20 rounded-lg p-4">
            <p className="text-xs font-medium text-accent mb-1">
              Recommendation
            </p>
            <p className="text-sm text-foreground-secondary">
              {getRecommendation(info.totalRam, info.vram)}
            </p>
          </div>
        </>
      ) : (
        <div className="bg-surface border border-surface-border rounded-lg p-8 text-center">
          <p className="text-sm text-foreground-secondary">
            Unable to detect hardware info. Make sure Ollama is running.
          </p>
        </div>
      )}
    </div>
  );
}
