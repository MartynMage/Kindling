import { useState } from "react";
import { Flame, ArrowRight, ArrowLeft, Upload, Play, Check } from "lucide-react";
import FileUpload from "./FileUpload";
import TrainingConfig from "./TrainingConfig";
import TrainingProgress from "./TrainingProgress";
import type { OllamaModel, TrainingConfig as TConfig } from "@/lib/types";
import * as api from "@/lib/api";

interface TrainingWizardProps {
  models: OllamaModel[];
  onComplete: () => void;
}

type Step = "model" | "data" | "preview" | "config" | "training" | "complete";

const STEPS: { key: Step; label: string }[] = [
  { key: "model", label: "Base Model" },
  { key: "data", label: "Training Data" },
  { key: "preview", label: "Preview" },
  { key: "config", label: "Configure" },
  { key: "training", label: "Train" },
  { key: "complete", label: "Complete" },
];

export default function TrainingWizard({ models, onComplete }: TrainingWizardProps) {
  const [step, setStep] = useState<Step>("model");
  const [selectedModel, setSelectedModel] = useState("");
  const [documentsPath, setDocumentsPath] = useState("");
  const [trainingPairs, setTrainingPairs] = useState<
    Array<{ instruction: string; response: string }>
  >([]);
  const [config, setConfig] = useState<TConfig>({
    baseModel: "",
    dataPath: "",
    outputName: "",
    epochs: 3,
    learningRate: 2e-4,
    loraRank: 16,
    loraAlpha: 32,
    batchSize: 4,
  });
  const [isGenerating, setIsGenerating] = useState(false);

  const stepIndex = STEPS.findIndex((s) => s.key === step);

  const handleGenerateData = async () => {
    if (!documentsPath || !selectedModel) return;
    setIsGenerating(true);
    try {
      const result = await api.generateTrainingData(documentsPath, selectedModel);
      setTrainingPairs(result.pairs);
      setStep("preview");
    } catch (err) {
      console.error("Failed to generate training data:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStartTraining = async () => {
    const trainingConfig: TConfig = {
      ...config,
      baseModel: selectedModel,
      dataPath: documentsPath,
      outputName: config.outputName || `${selectedModel.split(":")[0]}-finetuned`,
    };
    setStep("training");
    try {
      await api.startTraining(trainingConfig);
    } catch (err) {
      console.error("Failed to start training:", err);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-2 mb-1">
          <Flame className="h-5 w-5 text-accent" />
          <h1 className="text-xl font-semibold text-foreground">Fine-tune a Model</h1>
        </div>
        <p className="text-sm text-foreground-secondary mb-6">
          Train a model on your own data using LoRA
        </p>

        {/* Step indicator */}
        <div className="flex items-center gap-1 mb-8">
          {STEPS.map((s, i) => (
            <div key={s.key} className="flex items-center gap-1">
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  i < stepIndex
                    ? "bg-accent/20 text-accent"
                    : i === stepIndex
                    ? "bg-accent text-white"
                    : "bg-surface-hover text-foreground-muted"
                }`}
              >
                {i < stepIndex ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <span>{i + 1}</span>
                )}
                <span className="hidden sm:inline">{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className="w-4 h-px bg-surface-border" />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        {step === "model" && (
          <div>
            <h2 className="text-sm font-medium text-foreground mb-3">
              Select a base model to fine-tune
            </h2>
            <div className="space-y-2">
              {models.map((m) => (
                <button
                  key={m.name}
                  onClick={() => setSelectedModel(m.name)}
                  className={`flex items-center justify-between w-full px-4 py-3 rounded-lg border transition-colors ${
                    selectedModel === m.name
                      ? "border-accent bg-accent/10 text-foreground"
                      : "border-surface-border bg-surface text-foreground hover:border-foreground-muted/30"
                  }`}
                >
                  <div className="text-left">
                    <p className="text-sm font-medium">{m.name}</p>
                    <p className="text-xs text-foreground-muted">
                      {m.details.parameterSize} &middot;{" "}
                      {m.details.quantizationLevel}
                    </p>
                  </div>
                  {selectedModel === m.name && (
                    <Check className="h-4 w-4 text-accent" />
                  )}
                </button>
              ))}
            </div>
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setStep("data")}
                disabled={!selectedModel}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-dim transition-colors disabled:opacity-40"
              >
                Next <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {step === "data" && (
          <div>
            <h2 className="text-sm font-medium text-foreground mb-3">
              Select a folder of training documents
            </h2>
            <FileUpload
              path={documentsPath}
              onPathChange={setDocumentsPath}
            />
            <div className="flex justify-between mt-6">
              <button
                onClick={() => setStep("model")}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-surface-border text-foreground-secondary text-sm hover:bg-surface-hover transition-colors"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
              <button
                onClick={handleGenerateData}
                disabled={!documentsPath || isGenerating}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-dim transition-colors disabled:opacity-40"
              >
                {isGenerating ? (
                  "Generating..."
                ) : (
                  <>
                    <Upload className="h-4 w-4" /> Generate Training Pairs
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div>
            <h2 className="text-sm font-medium text-foreground mb-3">
              Review training pairs ({trainingPairs.length} generated)
            </h2>
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {trainingPairs.map((pair, i) => (
                <div
                  key={i}
                  className="bg-surface border border-surface-border rounded-lg p-4"
                >
                  <p className="text-xs text-accent font-medium mb-1">
                    Instruction
                  </p>
                  <p className="text-sm text-foreground mb-3">
                    {pair.instruction}
                  </p>
                  <p className="text-xs text-accent font-medium mb-1">
                    Response
                  </p>
                  <p className="text-sm text-foreground-secondary">
                    {pair.response}
                  </p>
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-6">
              <button
                onClick={() => setStep("data")}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-surface-border text-foreground-secondary text-sm hover:bg-surface-hover transition-colors"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
              <button
                onClick={() => setStep("config")}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-dim transition-colors"
              >
                Next <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {step === "config" && (
          <div>
            <h2 className="text-sm font-medium text-foreground mb-3">
              Training configuration
            </h2>
            <TrainingConfig config={config} onChange={setConfig} />
            <div className="flex justify-between mt-6">
              <button
                onClick={() => setStep("preview")}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-surface-border text-foreground-secondary text-sm hover:bg-surface-hover transition-colors"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
              <button
                onClick={handleStartTraining}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-dim transition-colors"
              >
                <Play className="h-4 w-4" /> Start Training
              </button>
            </div>
          </div>
        )}

        {step === "training" && (
          <TrainingProgress
            onComplete={() => setStep("complete")}
          />
        )}

        {step === "complete" && (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-4">
              <Check className="h-8 w-8 text-accent" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-2">
              Training Complete
            </h2>
            <p className="text-sm text-foreground-secondary mb-6">
              Your fine-tuned model is ready to use
            </p>
            <button
              onClick={onComplete}
              className="px-6 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-dim transition-colors"
            >
              Start Chatting
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
