export interface Message {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  model?: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  title: string;
  model: string;
  systemPromptId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OllamaModel {
  name: string;
  modifiedAt: string;
  size: number;
  digest: string;
  details: {
    format: string;
    family: string;
    parameterSize: string;
    quantizationLevel: string;
  };
}

export interface SystemPrompt {
  id: string;
  name: string;
  content: string;
  createdAt: string;
}

export interface ChatStreamEvent {
  token?: string;
  done: boolean;
  error?: string;
}

export interface ModelPullProgress {
  status: string;
  digest?: string;
  total?: number;
  completed?: number;
}

export interface HardwareInfo {
  os: string;
  totalRam: number;
  gpuName?: string;
  vram?: number;
}

export interface TrainingConfig {
  baseModel: string;
  dataPath: string;
  outputName: string;
  epochs: number;
  learningRate: number;
  loraRank: number;
  loraAlpha: number;
  batchSize: number;
}

export interface TrainingProgress {
  epoch: number;
  totalEpochs: number;
  step: number;
  totalSteps: number;
  loss: number;
  eta?: string;
  status: "preparing" | "training" | "saving" | "registering" | "complete" | "error";
  message?: string;
}

export interface AppSettings {
  ollamaUrl: string;
  defaultModel?: string;
  temperature: number;
  contextLength: number;
  topP: number;
  topK: number;
  theme: "dark" | "light" | "system";
}

export type View = "chat" | "models" | "training" | "settings";
