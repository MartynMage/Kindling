import type { TrainingConfig as TConfig } from "@/lib/types";

interface TrainingConfigProps {
  config: TConfig;
  onChange: (config: TConfig) => void;
}

interface FieldProps {
  label: string;
  description: string;
  children: React.ReactNode;
}

function Field({ label, description, children }: FieldProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-surface-border last:border-0">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-foreground-muted">{description}</p>
      </div>
      {children}
    </div>
  );
}

export default function TrainingConfig({ config, onChange }: TrainingConfigProps) {
  const update = (key: keyof TConfig, value: string | number) => {
    onChange({ ...config, [key]: value });
  };

  return (
    <div className="bg-surface border border-surface-border rounded-lg px-4">
      <Field
        label="Output Name"
        description="Name for the fine-tuned model"
      >
        <input
          type="text"
          value={config.outputName}
          onChange={(e) => update("outputName", e.target.value)}
          placeholder="my-model"
          className="w-48 px-3 py-1.5 bg-surface-hover border border-surface-border rounded-lg text-sm text-foreground outline-none focus:border-accent/40"
        />
      </Field>

      <Field
        label="Epochs"
        description="Number of training passes over the data"
      >
        <input
          type="number"
          value={config.epochs}
          onChange={(e) => update("epochs", parseInt(e.target.value) || 1)}
          min={1}
          max={20}
          className="w-20 px-3 py-1.5 bg-surface-hover border border-surface-border rounded-lg text-sm text-foreground text-center outline-none focus:border-accent/40"
        />
      </Field>

      <Field
        label="Learning Rate"
        description="How fast the model adapts (lower = more stable)"
      >
        <input
          type="number"
          value={config.learningRate}
          onChange={(e) => update("learningRate", parseFloat(e.target.value) || 2e-4)}
          step={0.0001}
          min={0.00001}
          max={0.01}
          className="w-28 px-3 py-1.5 bg-surface-hover border border-surface-border rounded-lg text-sm text-foreground text-center outline-none focus:border-accent/40"
        />
      </Field>

      <Field
        label="LoRA Rank"
        description="Size of the adaptation layer (higher = more capacity)"
      >
        <select
          value={config.loraRank}
          onChange={(e) => update("loraRank", parseInt(e.target.value))}
          className="w-20 px-3 py-1.5 bg-surface-hover border border-surface-border rounded-lg text-sm text-foreground outline-none focus:border-accent/40"
        >
          {[4, 8, 16, 32, 64].map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label="LoRA Alpha"
        description="Scaling factor (typically 2x rank)"
      >
        <select
          value={config.loraAlpha}
          onChange={(e) => update("loraAlpha", parseInt(e.target.value))}
          className="w-20 px-3 py-1.5 bg-surface-hover border border-surface-border rounded-lg text-sm text-foreground outline-none focus:border-accent/40"
        >
          {[8, 16, 32, 64, 128].map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label="Batch Size"
        description="Samples per training step (lower if low VRAM)"
      >
        <select
          value={config.batchSize}
          onChange={(e) => update("batchSize", parseInt(e.target.value))}
          className="w-20 px-3 py-1.5 bg-surface-hover border border-surface-border rounded-lg text-sm text-foreground outline-none focus:border-accent/40"
        >
          {[1, 2, 4, 8, 16].map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}
