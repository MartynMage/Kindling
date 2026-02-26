import { useState } from "react";
import { Flame, Download, ArrowRight, CheckCircle, ExternalLink, RefreshCw } from "lucide-react";
import { open as shellOpen } from "@tauri-apps/plugin-shell";

interface OnboardingFlowProps {
  ollamaConnected: boolean;
  hasModels: boolean;
  onRetryConnection: () => Promise<void> | void;
  onGoToModels: () => void;
  onDismiss: () => void;
}

export default function OnboardingFlow({
  ollamaConnected,
  hasModels,
  onRetryConnection,
  onGoToModels,
  onDismiss,
}: OnboardingFlowProps) {
  const [checking, setChecking] = useState(false);
  const [checkFailed, setCheckFailed] = useState(false);

  const handleCheck = async () => {
    setChecking(true);
    setCheckFailed(false);
    try {
      await onRetryConnection();
      // If still not connected after the check, show a hint
      // (the parent updates ollamaConnected, so we use a short delay to let it propagate)
      setTimeout(() => {
        setChecking(false);
        // If the component is still showing (not connected), mark as failed
        setCheckFailed(true);
      }, 500);
    } catch {
      setChecking(false);
      setCheckFailed(true);
    }
  };

  const steps = [
    {
      title: "Install Ollama",
      description: "Download and install Ollama to run models locally.",
      done: ollamaConnected,
      action: !ollamaConnected && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => shellOpen("https://ollama.com/download")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-accent border border-accent/30 hover:bg-accent/10 transition-colors"
            >
              <ExternalLink className="h-3 w-3" /> Get Ollama
            </button>
            <button
              type="button"
              onClick={handleCheck}
              disabled={checking}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-foreground-muted hover:text-foreground hover:bg-surface-hover border border-surface-border transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${checking ? "animate-spin" : ""}`} />
              {checking ? "Checking..." : "Check Connection"}
            </button>
          </div>
          {checkFailed && !ollamaConnected && (
            <p className="text-[11px] text-red-400">
              Could not connect. Make sure Ollama is running (<code className="bg-surface-hover px-1 rounded">ollama serve</code>).
            </p>
          )}
        </div>
      ),
    },
    {
      title: "Download a Model",
      description: "Pull a model like llama3.2 or mistral to get started.",
      done: hasModels,
      action: ollamaConnected && !hasModels && (
        <button
          type="button"
          onClick={onGoToModels}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-accent border border-accent/30 hover:bg-accent/10 transition-colors"
        >
          <Download className="h-3 w-3" /> Browse Models
        </button>
      ),
    },
    {
      title: "Start Chatting",
      description: "You're all set! Start a new conversation.",
      done: false,
      action: ollamaConnected && hasModels && (
        <button
          type="button"
          onClick={onDismiss}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-accent hover:bg-accent-dim transition-colors"
        >
          Get Started <ArrowRight className="h-3 w-3" />
        </button>
      ),
    },
  ];

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8">
      <Flame className="h-16 w-16 text-accent mb-6" />
      <h1 className="text-2xl font-bold text-foreground mb-2">
        Welcome to Kindling
      </h1>
      <p className="text-sm text-foreground-secondary text-center max-w-md mb-8">
        Chat with AI models running locally on your machine.
        Your conversations stay private — nothing leaves your computer.
      </p>

      <div className="w-full max-w-md space-y-4">
        {steps.map((step, i) => (
          <div
            key={step.title}
            className={`flex items-start gap-4 p-4 rounded-lg border transition-colors ${
              step.done
                ? "bg-accent/5 border-accent/20"
                : "bg-surface border-surface-border"
            }`}
          >
            <div className="flex-shrink-0 mt-0.5">
              {step.done ? (
                <CheckCircle className="h-5 w-5 text-accent" />
              ) : (
                <div className="w-5 h-5 rounded-full border-2 border-surface-border flex items-center justify-center">
                  <span className="text-xs text-foreground-muted">{i + 1}</span>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${step.done ? "text-accent" : "text-foreground"}`}>
                {step.title}
              </p>
              <p className="text-xs text-foreground-muted mt-0.5">
                {step.description}
              </p>
              {step.action && <div className="mt-2">{step.action}</div>}
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onDismiss}
        className="mt-6 text-xs text-foreground-muted hover:text-foreground transition-colors"
      >
        Skip setup
      </button>
    </div>
  );
}
