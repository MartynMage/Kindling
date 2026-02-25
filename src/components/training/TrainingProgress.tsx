import { useEffect, useState, useRef } from "react";
import { Activity, StopCircle } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { TrainingProgress as TProgress } from "@/lib/types";
import * as api from "@/lib/api";

interface TrainingProgressProps {
  onComplete: () => void;
}

export default function TrainingProgress({ onComplete }: TrainingProgressProps) {
  const [progress, setProgress] = useState<TProgress | null>(null);
  const [lossHistory, setLossHistory] = useState<
    Array<{ step: number; loss: number }>
  >([]);
  const [logs, setLogs] = useState<Array<{ id: number; text: string }>>([]);
  const logCounterRef = useRef(0);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    const unlisten = api.onTrainingProgress((event) => {
      setProgress(event);

      if (event.loss > 0) {
        setLossHistory((prev) => {
          const next = [...prev, { step: event.step, loss: event.loss }];
          return next.length > 500 ? next.slice(-500) : next;
        });
      }

      if (event.message) {
        const msg = event.message;
        setLogs((prev) => [...prev.slice(-100), { id: ++logCounterRef.current, text: msg }]);
      }

      if (event.status === "complete") {
        onCompleteRef.current();
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const overallPercent =
    progress && progress.totalEpochs > 0 && progress.totalSteps > 0
      ? Math.min(
          100,
          Math.max(
            0,
            Math.round(
              ((progress.epoch - 1) / progress.totalEpochs +
                progress.step / progress.totalSteps / progress.totalEpochs) *
                100
            )
          )
        )
      : 0;

  const handleStop = async () => {
    try {
      await api.stopTraining();
    } catch (err) {
      console.error("Failed to stop training:", err);
    }
  };

  return (
    <div>
      {/* Status header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-accent animate-pulse" />
          <span className="text-sm font-medium text-foreground">
            {progress?.status === "preparing"
              ? "Preparing..."
              : progress?.status === "saving"
              ? "Saving model..."
              : progress?.status === "registering"
              ? "Registering with Ollama..."
              : progress?.status === "error"
              ? "Error"
              : `Training — Epoch ${progress?.epoch || 0}/${progress?.totalEpochs || 0}`}
          </span>
        </div>
        <button
          type="button"
          onClick={handleStop}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-red-400 border border-red-400/30 hover:bg-red-400/10 transition-colors"
        >
          <StopCircle className="h-3.5 w-3.5" />
          Stop
        </button>
      </div>

      {/* Error message */}
      {progress?.status === "error" && progress.message && (
        <div className="mb-4 p-3 bg-red-400/10 border border-red-400/30 rounded-lg">
          <p className="text-sm text-red-400">{progress.message}</p>
        </div>
      )}

      {/* Overall progress bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-foreground-muted">Overall Progress</span>
          <span className="text-xs text-foreground-muted">
            {overallPercent}%{progress?.eta && ` — ETA: ${progress.eta}`}
          </span>
        </div>
        <div className="h-3 bg-surface-hover rounded-full overflow-hidden">
          <div
            className="h-full bg-accent rounded-full transition-all duration-500"
            style={{ width: `${overallPercent}%` }}
          />
        </div>
      </div>

      {/* Loss chart */}
      {lossHistory.length > 1 && (
        <div className="bg-surface border border-surface-border rounded-lg p-4 mb-4">
          <p className="text-xs font-medium text-foreground-secondary mb-3">
            Training Loss
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={lossHistory}>
              <CartesianGrid stroke="#2a2a4a" strokeDasharray="3 3" />
              <XAxis
                dataKey="step"
                stroke="#6b6b8a"
                fontSize={11}
                tickLine={false}
              />
              <YAxis
                stroke="#6b6b8a"
                fontSize={11}
                tickLine={false}
                domain={["auto", "auto"]}
              />
              <Tooltip
                contentStyle={{
                  background: "#1a1a2e",
                  border: "1px solid #2a2a4a",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Line
                type="monotone"
                dataKey="loss"
                stroke="#f97316"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Stats */}
      {progress && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-surface border border-surface-border rounded-lg p-3 text-center">
            <p className="text-xs text-foreground-muted">Current Loss</p>
            <p className="text-lg font-semibold text-foreground">
              {progress.loss > 0 ? progress.loss.toFixed(4) : "—"}
            </p>
          </div>
          <div className="bg-surface border border-surface-border rounded-lg p-3 text-center">
            <p className="text-xs text-foreground-muted">Step</p>
            <p className="text-lg font-semibold text-foreground">
              {progress.step}/{progress.totalSteps}
            </p>
          </div>
          <div className="bg-surface border border-surface-border rounded-lg p-3 text-center">
            <p className="text-xs text-foreground-muted">Epoch</p>
            <p className="text-lg font-semibold text-foreground">
              {progress.epoch}/{progress.totalEpochs}
            </p>
          </div>
        </div>
      )}

      {/* Log output */}
      <div className="bg-[#0d0d14] border border-surface-border rounded-lg p-3 max-h-40 overflow-y-auto font-mono">
        {logs.length === 0 ? (
          <p className="text-xs text-foreground-muted">Waiting for output...</p>
        ) : (
          logs.map((log) => (
            <p key={log.id} className="text-xs text-foreground-muted leading-relaxed">
              {log.text}
            </p>
          ))
        )}
      </div>
    </div>
  );
}
