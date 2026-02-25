import { useState, useEffect, useCallback, useRef } from "react";
import Sidebar from "./components/sidebar/Sidebar";
import ChatView from "./components/chat/ChatView";
import ModelBrowser from "./components/models/ModelBrowser";
import TrainingWizard from "./components/training/TrainingWizard";
import SettingsPanel from "./components/settings/SettingsPanel";
import type { View, Conversation, OllamaModel } from "./lib/types";
import * as api from "./lib/api";

export default function App() {
  const [view, setView] = useState<View>("chat");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [ollamaConnected, setOllamaConnected] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Use ref to avoid stale closure in loadModels
  const selectedModelRef = useRef(selectedModel);
  selectedModelRef.current = selectedModel;

  const loadConversations = useCallback(async () => {
    try {
      const convos = await api.listConversations();
      setConversations(convos);
    } catch {
      // Ollama may not be connected yet
    }
  }, []);

  const loadModels = useCallback(async () => {
    try {
      const modelList = await api.listModels();
      setModels(modelList);
      if (modelList.length > 0 && !selectedModelRef.current) {
        setSelectedModel(modelList[0].name);
      }
    } catch {
      // Ollama may not be connected yet
    }
  }, []);

  useEffect(() => {
    async function init() {
      try {
        const connected = await api.checkOllamaConnection();
        setOllamaConnected(connected);
        if (connected) {
          await Promise.all([loadConversations(), loadModels()]);
        }
      } catch {
        setOllamaConnected(false);
      }
    }
    init();
  }, [loadConversations, loadModels]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ctrl/Cmd + N: New chat
      if ((e.ctrlKey || e.metaKey) && e.key === "n") {
        e.preventDefault();
        handleNewChat();
      }
      // Ctrl/Cmd + B: Toggle sidebar
      if ((e.ctrlKey || e.metaKey) && e.key === "b") {
        e.preventDefault();
        setSidebarOpen((prev) => !prev);
      }
      // Ctrl/Cmd + ,: Open settings
      if ((e.ctrlKey || e.metaKey) && e.key === ",") {
        e.preventDefault();
        setView("settings");
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  const handleNewChat = useCallback(async () => {
    if (!selectedModel) return;
    try {
      const conversation = await api.createConversation(selectedModel);
      setConversations((prev) => [conversation, ...prev]);
      setActiveConversationId(conversation.id);
      setView("chat");
    } catch (err) {
      console.error("Failed to create conversation:", err);
    }
  }, [selectedModel]);

  const handleDeleteConversation = useCallback(async (id: string) => {
    try {
      await api.deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      setActiveConversationId((prev) => (prev === id ? null : prev));
    } catch (err) {
      console.error("Failed to delete conversation:", err);
    }
  }, []);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      <Sidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={(id) => {
          setActiveConversationId(id);
          setView("chat");
        }}
        onNewChat={handleNewChat}
        onDeleteConversation={handleDeleteConversation}
        onConversationsChanged={loadConversations}
        models={models}
        selectedModel={selectedModel}
        onSelectModel={setSelectedModel}
        view={view}
        onChangeView={setView}
      />

      <main className="flex-1 flex flex-col overflow-hidden">
        {view === "chat" && (
          <ChatView
            conversationId={activeConversationId}
            model={selectedModel}
            ollamaConnected={ollamaConnected}
            onConversationCreated={(convo) => {
              setConversations((prev) => [convo, ...prev]);
              setActiveConversationId(convo.id);
            }}
            onConversationUpdated={loadConversations}
          />
        )}
        {view === "models" && (
          <ModelBrowser models={models} onModelsChanged={loadModels} />
        )}
        {view === "training" && (
          <TrainingWizard
            models={models}
            onComplete={() => {
              loadModels();
              setView("chat");
            }}
          />
        )}
        {view === "settings" && (
          <SettingsPanel
            ollamaConnected={ollamaConnected}
            onConnectionChange={async () => {
              const connected = await api.checkOllamaConnection();
              setOllamaConnected(connected);
              if (connected) loadModels();
            }}
          />
        )}
      </main>
    </div>
  );
}
