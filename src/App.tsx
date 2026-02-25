import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import Sidebar from "./components/sidebar/Sidebar";
import ChatView from "./components/chat/ChatView";
import KeyboardShortcutsOverlay from "./components/KeyboardShortcutsOverlay";
import OnboardingFlow from "./components/OnboardingFlow";
import type { View, Conversation, OllamaModel } from "./lib/types";
import * as api from "./lib/api";

// Code-split heavy components that aren't needed on first render
const ModelBrowser = lazy(() => import("./components/models/ModelBrowser"));
const TrainingWizard = lazy(() => import("./components/training/TrainingWizard"));
const SettingsPanel = lazy(() => import("./components/settings/SettingsPanel"));

function LazyFallback() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <Loader2 className="h-5 w-5 text-foreground-muted animate-spin" />
    </div>
  );
}

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
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light" | "system">("dark");
  const [initialized, setInitialized] = useState(false);

  // Use ref to avoid stale closure in loadModels and keyboard shortcuts
  const selectedModelRef = useRef(selectedModel);
  selectedModelRef.current = selectedModel;

  // Apply theme to document
  useEffect(() => {
    let resolvedTheme: "dark" | "light";
    if (theme === "system") {
      resolvedTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    } else {
      resolvedTheme = theme;
    }
    document.documentElement.setAttribute("data-theme", resolvedTheme);

    // Listen for system theme changes
    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = (e: MediaQueryListEvent) => {
        document.documentElement.setAttribute("data-theme", e.matches ? "dark" : "light");
      };
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, [theme]);

  // Load theme from settings on startup
  useEffect(() => {
    async function loadTheme() {
      try {
        const settings = await api.getSettings();
        if (settings.theme) setTheme(settings.theme);
      } catch {
        // Use default
      }
    }
    loadTheme();
  }, []);

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

  const handleNewChat = useCallback(async () => {
    const currentModel = selectedModelRef.current;
    if (!currentModel) return;
    try {
      const conversation = await api.createConversation(currentModel);
      setConversations((prev) => [conversation, ...prev]);
      setActiveConversationId(conversation.id);
      setView("chat");
    } catch (err) {
      console.error("Failed to create conversation:", err);
    }
  }, []);

  useEffect(() => {
    async function init() {
      try {
        const connected = await api.checkOllamaConnection();
        setOllamaConnected(connected);
        if (connected) {
          const [, modelList] = await Promise.all([
            loadConversations(),
            api.listModels(),
          ]);
          setModels(modelList);
          if (modelList.length > 0 && !selectedModelRef.current) {
            setSelectedModel(modelList[0].name);
          }
          // Show onboarding if no conversations and no models
          if (modelList.length === 0) {
            setShowOnboarding(true);
          }
        } else {
          setShowOnboarding(true);
        }
      } catch {
        setOllamaConnected(false);
        setShowOnboarding(true);
      }
      setInitialized(true);
    }
    init();
  }, [loadConversations]);

  // Keyboard shortcuts — stable dependency array
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
      // Ctrl/Cmd + /: Show shortcuts
      if ((e.ctrlKey || e.metaKey) && e.key === "/") {
        e.preventDefault();
        setShowShortcuts((prev) => !prev);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleNewChat]);

  const handleDeleteConversation = useCallback(async (id: string) => {
    try {
      await api.deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      setActiveConversationId((prev) => (prev === id ? null : prev));
    } catch (err) {
      console.error("Failed to delete conversation:", err);
    }
  }, []);

  const handleToggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  const handleSelectConversation = useCallback((id: string) => {
    setActiveConversationId(id);
    setView("chat");
  }, []);

  const handleConversationCreated = useCallback((convo: Conversation) => {
    setConversations((prev) => [convo, ...prev]);
    setActiveConversationId(convo.id);
  }, []);

  const handleTrainingComplete = useCallback(() => {
    loadModels();
    setView("chat");
  }, [loadModels]);

  const handleConnectionChange = useCallback(async () => {
    try {
      const connected = await api.checkOllamaConnection();
      setOllamaConnected(connected);
      if (connected) {
        await Promise.all([loadModels(), loadConversations()]);
      }
    } catch {
      setOllamaConnected(false);
    }
  }, [loadModels, loadConversations]);

  const handleCloseShortcuts = useCallback(() => {
    setShowShortcuts(false);
  }, []);

  // Handle theme changes from settings
  const handleThemeChange = useCallback((newTheme: "dark" | "light" | "system") => {
    setTheme(newTheme);
  }, []);

  // Don't render until initialized
  if (!initialized) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 text-accent animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      <Sidebar
        open={sidebarOpen}
        onToggle={handleToggleSidebar}
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
        onDeleteConversation={handleDeleteConversation}
        onConversationsChanged={loadConversations}
        models={models}
        selectedModel={selectedModel}
        onSelectModel={setSelectedModel}
        view={view}
        onChangeView={setView}
      />

      <main className="flex-1 flex flex-col overflow-hidden" aria-label="Main content">
        {showOnboarding && view === "chat" && !activeConversationId ? (
          <OnboardingFlow
            ollamaConnected={ollamaConnected}
            hasModels={models.length > 0}
            onRetryConnection={handleConnectionChange}
            onGoToModels={() => { setShowOnboarding(false); setView("models"); }}
            onDismiss={() => setShowOnboarding(false)}
          />
        ) : (
          <>
            {view === "chat" && (
              <ChatView
                conversationId={activeConversationId}
                model={selectedModel}
                ollamaConnected={ollamaConnected}
                onConversationCreated={handleConversationCreated}
                onConversationUpdated={loadConversations}
                onRetryConnection={handleConnectionChange}
              />
            )}
            {view === "models" && (
              <Suspense fallback={<LazyFallback />}>
                <ModelBrowser models={models} onModelsChanged={loadModels} />
              </Suspense>
            )}
            {view === "training" && (
              <Suspense fallback={<LazyFallback />}>
                <TrainingWizard
                  models={models}
                  onComplete={handleTrainingComplete}
                />
              </Suspense>
            )}
            {view === "settings" && (
              <Suspense fallback={<LazyFallback />}>
                <SettingsPanel
                  ollamaConnected={ollamaConnected}
                  onConnectionChange={handleConnectionChange}
                  onThemeChange={handleThemeChange}
                />
              </Suspense>
            )}
          </>
        )}
      </main>

      <KeyboardShortcutsOverlay open={showShortcuts} onClose={handleCloseShortcuts} />
    </div>
  );
}
