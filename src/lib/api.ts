import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type {
  Conversation,
  Message,
  OllamaModel,
  SystemPrompt,
  HardwareInfo,
  AppSettings,
  ChatStreamEvent,
  ModelPullProgress,
  TrainingConfig,
  TrainingProgress,
  ExportResult,
  SearchResult,
} from "./types";

// --- Chat ---

export async function sendMessage(
  conversationId: string,
  content: string,
  model: string,
  systemPrompt?: string,
  skipUserSave?: boolean
) {
  return invoke<void>("send_message", {
    conversationId,
    content,
    model,
    systemPrompt,
    skipUserSave,
  });
}

export async function stopStreaming() {
  return invoke<void>("stop_streaming");
}

export function onChatStream(callback: (event: ChatStreamEvent) => void) {
  return listen<ChatStreamEvent>("chat-stream", (e) => callback(e.payload));
}

// --- Conversations ---

export async function createConversation(model: string, systemPromptId?: string) {
  return invoke<Conversation>("create_conversation", { model, systemPromptId });
}

export async function listConversations() {
  return invoke<Conversation[]>("list_conversations");
}

export async function getConversation(id: string) {
  return invoke<{ conversation: Conversation; messages: Message[] }>(
    "get_conversation",
    { id }
  );
}

export async function deleteConversation(id: string) {
  return invoke<void>("delete_conversation", { id });
}

export async function renameConversation(id: string, title: string) {
  return invoke<void>("rename_conversation", { id, title });
}

export async function exportConversation(id: string, format: "markdown" | "json") {
  return invoke<ExportResult>("export_conversation", { id, format });
}

export async function searchMessages(query: string) {
  return invoke<SearchResult[]>("search_messages", { query });
}

export async function deleteMessagesAfter(conversationId: string, afterMessageId: string) {
  return invoke<number>("delete_messages_after", { conversationId, afterMessageId });
}

// --- Models ---

export async function listModels() {
  return invoke<OllamaModel[]>("list_models");
}

export async function pullModel(name: string) {
  return invoke<void>("pull_model", { name });
}

export function onModelPullProgress(callback: (event: ModelPullProgress) => void) {
  return listen<ModelPullProgress>("model-pull-progress", (e) =>
    callback(e.payload)
  );
}

export async function cancelPull() {
  return invoke<void>("cancel_pull");
}

export async function deleteModel(name: string) {
  return invoke<void>("delete_model", { name });
}

export function onTitleUpdated(callback: (event: { conversationId: string; title: string }) => void) {
  return listen<{ conversationId: string; title: string }>("conversation-title-updated", (e) =>
    callback(e.payload)
  );
}

// --- System Prompts ---

export async function listSystemPrompts() {
  return invoke<SystemPrompt[]>("list_system_prompts");
}

export async function createSystemPrompt(name: string, content: string) {
  return invoke<SystemPrompt>("create_system_prompt", { name, content });
}

export async function updateSystemPrompt(id: string, name: string, content: string) {
  return invoke<void>("update_system_prompt", { id, name, content });
}

export async function deleteSystemPrompt(id: string) {
  return invoke<void>("delete_system_prompt", { id });
}

// --- System ---

export async function getHardwareInfo() {
  return invoke<HardwareInfo>("get_hardware_info");
}

export async function getSettings() {
  return invoke<AppSettings>("get_settings");
}

export async function updateSettings(settings: Partial<AppSettings>) {
  return invoke<void>("update_settings", { settings });
}

export async function checkOllamaConnection() {
  return invoke<boolean>("check_ollama_connection");
}

// --- Training ---

export async function startTraining(config: TrainingConfig) {
  return invoke<void>("start_training", { config });
}

export async function stopTraining() {
  return invoke<void>("stop_training");
}

export function onTrainingProgress(callback: (event: TrainingProgress) => void) {
  return listen<TrainingProgress>("training-progress", (e) =>
    callback(e.payload)
  );
}

export async function generateTrainingData(
  documentsPath: string,
  model: string
) {
  return invoke<{ pairs: Array<{ instruction: string; response: string }> }>(
    "generate_training_data",
    { documentsPath, model }
  );
}
