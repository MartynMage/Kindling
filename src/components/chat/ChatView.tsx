import { useState, useEffect, useRef, useCallback } from "react";
import MessageBubble from "./MessageBubble";
import InputBar from "./InputBar";
import { Flame, Loader2, RefreshCw, ChevronDown } from "lucide-react";
import type { Message, Conversation, ChatStreamEvent, SystemPrompt } from "@/lib/types";
import * as api from "@/lib/api";

interface ChatViewProps {
  conversationId: string | null;
  model: string;
  ollamaConnected: boolean;
  onConversationCreated: (convo: Conversation) => void;
  onConversationUpdated: () => void;
  onRetryConnection: () => Promise<void>;
}

export default function ChatView({
  conversationId,
  model,
  ollamaConnected,
  onConversationCreated,
  onConversationUpdated,
  onRetryConnection,
}: ChatViewProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingContent, setStreamingContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [systemPrompts, setSystemPrompts] = useState<SystemPrompt[]>([]);
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);
  const [showPromptPicker, setShowPromptPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const promptPickerRef = useRef<HTMLDivElement>(null);

  // Refs to avoid stale closures in event listeners
  const activeConvoRef = useRef(conversationId);
  const modelRef = useRef(model);
  const isStreamingRef = useRef(isStreaming);
  const onConversationUpdatedRef = useRef(onConversationUpdated);
  const streamingContentRef = useRef("");
  const scrollThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedPromptRef = useRef<string | null>(null);

  useEffect(() => { activeConvoRef.current = conversationId; }, [conversationId]);
  useEffect(() => { modelRef.current = model; }, [model]);
  useEffect(() => { isStreamingRef.current = isStreaming; }, [isStreaming]);
  useEffect(() => { onConversationUpdatedRef.current = onConversationUpdated; }, [onConversationUpdated]);
  useEffect(() => { selectedPromptRef.current = selectedPromptId; }, [selectedPromptId]);

  // Load system prompts
  useEffect(() => {
    let cancelled = false;
    async function loadPrompts() {
      try {
        const prompts = await api.listSystemPrompts();
        if (!cancelled) setSystemPrompts(prompts);
      } catch {
        // No prompts available
      }
    }
    loadPrompts();
    return () => { cancelled = true; };
  }, []);

  // Close prompt picker on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (promptPickerRef.current && !promptPickerRef.current.contains(e.target as Node)) {
        setShowPromptPicker(false);
      }
    }
    if (showPromptPicker) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showPromptPicker]);

  // Load messages when conversation changes, and restore selected prompt
  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      setError(null);
      setLoadingMessages(false);
      return;
    }
    let cancelled = false;
    async function loadMessages() {
      setLoadingMessages(true);
      try {
        const data = await api.getConversation(conversationId!);
        if (!cancelled) {
          setMessages(data.messages);
          if (data.conversation.systemPromptId) {
            setSelectedPromptId(data.conversation.systemPromptId);
          }
        }
      } catch {
        if (!cancelled) setMessages([]);
      } finally {
        if (!cancelled) setLoadingMessages(false);
      }
    }
    loadMessages();
    return () => { cancelled = true; };
  }, [conversationId]);

  // Auto-scroll — throttled during streaming to avoid jank
  useEffect(() => {
    if (isStreaming && streamingContent) {
      if (!scrollThrottleRef.current) {
        scrollThrottleRef.current = setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
          scrollThrottleRef.current = null;
        }, 100);
      }
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, streamingContent, isStreaming]);

  useEffect(() => {
    return () => {
      if (scrollThrottleRef.current) clearTimeout(scrollThrottleRef.current);
    };
  }, []);

  // Chat stream listener — stable via refs, no dependency churn
  useEffect(() => {
    const unlisten = api.onChatStream((event: ChatStreamEvent) => {
      if (event.conversationId !== activeConvoRef.current) return;

      if (event.error) {
        setIsStreaming(false);
        setStreamingContent("");
        streamingContentRef.current = "";
        setError(event.error);
        return;
      }
      if (event.token) {
        streamingContentRef.current += event.token;
        setStreamingContent(streamingContentRef.current);
      }
      if (event.done) {
        const content = streamingContentRef.current;
        if (content) {
          const assistantMsg: Message = {
            id: crypto.randomUUID(),
            conversationId: activeConvoRef.current || "",
            role: "assistant",
            content,
            model: modelRef.current,
            createdAt: new Date().toISOString(),
          };
          setMessages((msgs) => [...msgs, assistantMsg]);
          onConversationUpdatedRef.current();
        }
        streamingContentRef.current = "";
        setStreamingContent("");
        setIsStreaming(false);
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // Get the selected system prompt content
  const getSelectedPromptContent = useCallback((): string | undefined => {
    const promptId = selectedPromptRef.current;
    if (!promptId) return undefined;
    const prompt = systemPrompts.find((p) => p.id === promptId);
    return prompt?.content;
  }, [systemPrompts]);

  const handleSend = useCallback(
    async (content: string) => {
      if (!content.trim() || isStreamingRef.current) return;
      isStreamingRef.current = true;

      setError(null);
      let convoId = activeConvoRef.current;

      if (!convoId) {
        try {
          const convo = await api.createConversation(
            modelRef.current,
            selectedPromptRef.current || undefined
          );
          convoId = convo.id;
          onConversationCreated(convo);
        } catch {
          isStreamingRef.current = false;
          return;
        }
      }

      const userMsg: Message = {
        id: crypto.randomUUID(),
        conversationId: convoId,
        role: "user",
        content,
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsStreaming(true);
      streamingContentRef.current = "";
      setStreamingContent("");

      try {
        await api.sendMessage(convoId, content, modelRef.current, getSelectedPromptContent());
      } catch {
        setIsStreaming(false);
        isStreamingRef.current = false;
        setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
        setError("Failed to send message. Please try again.");
      }
    },
    [onConversationCreated, getSelectedPromptContent]
  );

  const handleStop = useCallback(async () => {
    try {
      await api.stopStreaming();
    } catch {
      // Force stop on frontend regardless
    }
    setIsStreaming(false);
    isStreamingRef.current = false;
    const content = streamingContentRef.current;
    if (content) {
      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        conversationId: activeConvoRef.current || "",
        role: "assistant",
        content,
        model: modelRef.current,
        createdAt: new Date().toISOString(),
      };
      setMessages((msgs) => [...msgs, assistantMsg]);
    }
    streamingContentRef.current = "";
    setStreamingContent("");
  }, []);

  const handleRegenerate = useCallback(async () => {
    if (isStreamingRef.current) return;

    const lastUserMsgIndex = messages.reduce(
      (lastIdx, msg, idx) => (msg.role === "user" ? idx : lastIdx),
      -1
    );
    if (lastUserMsgIndex === -1) return;

    const lastUserMsg = messages[lastUserMsgIndex];
    setMessages((prev) => prev.slice(0, lastUserMsgIndex + 1));

    isStreamingRef.current = true;
    setIsStreaming(true);
    setError(null);
    streamingContentRef.current = "";
    setStreamingContent("");

    try {
      await api.sendMessage(
        activeConvoRef.current!,
        lastUserMsg.content,
        modelRef.current,
        getSelectedPromptContent()
      );
    } catch {
      setIsStreaming(false);
      isStreamingRef.current = false;
      setError("Failed to regenerate response. Please try again.");
    }
  }, [messages, getSelectedPromptContent]);

  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await onRetryConnection();
    } finally {
      setRetrying(false);
    }
  };

  const handleOpenOllama = () => {
    window.open("https://ollama.com", "_blank");
  };

  const selectedPromptName = systemPrompts.find((p) => p.id === selectedPromptId)?.name;

  const lastAssistantIndex = messages.reduce(
    (lastIdx, msg, idx) => (msg.role === "assistant" ? idx : lastIdx),
    -1
  );

  if (!ollamaConnected) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <Flame className="h-12 w-12 text-accent/40 mb-4" />
        <h2 className="text-lg font-semibold text-foreground mb-2">
          Ollama Not Connected
        </h2>
        <p className="text-sm text-foreground-secondary text-center max-w-md mb-4">
          Make sure Ollama is installed and running on your machine.
          Visit{" "}
          <button
            type="button"
            onClick={handleOpenOllama}
            className="text-accent hover:underline"
          >
            ollama.com
          </button>{" "}
          to get started, then check your connection in Settings.
        </p>
        <button
          type="button"
          onClick={handleRetry}
          disabled={retrying}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-surface-border text-sm text-foreground-secondary hover:text-foreground hover:bg-surface-hover transition-colors disabled:opacity-40"
        >
          <RefreshCw className={`h-4 w-4 ${retrying ? "animate-spin" : ""}`} />
          {retrying ? "Checking..." : "Retry Connection"}
        </button>
      </div>
    );
  }

  // System prompt picker component
  const promptPicker = systemPrompts.length > 0 && (
    <div className="relative mb-2" ref={promptPickerRef}>
      <button
        type="button"
        onClick={() => setShowPromptPicker((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-foreground-muted hover:text-foreground hover:bg-surface-hover border border-surface-border transition-colors"
      >
        {selectedPromptName || "No persona"}
        <ChevronDown className="h-3 w-3" />
      </button>
      {showPromptPicker && (
        <div className="absolute bottom-full left-0 mb-1 w-56 bg-surface border border-surface-border rounded-lg shadow-lg py-1 z-10">
          <button
            type="button"
            onClick={() => { setSelectedPromptId(null); setShowPromptPicker(false); }}
            className={`w-full text-left px-3 py-2 text-xs hover:bg-surface-hover transition-colors ${
              !selectedPromptId ? "text-accent" : "text-foreground-secondary"
            }`}
          >
            No persona
          </button>
          {systemPrompts.map((p) => (
            <button
              type="button"
              key={p.id}
              onClick={() => { setSelectedPromptId(p.id); setShowPromptPicker(false); }}
              className={`w-full text-left px-3 py-2 text-xs hover:bg-surface-hover transition-colors ${
                selectedPromptId === p.id ? "text-accent" : "text-foreground-secondary"
              }`}
            >
              <span className="font-medium text-foreground">{p.name}</span>
              <span className="block text-foreground-muted truncate">{p.content.slice(0, 60)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  if (!conversationId && messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <Flame className="h-12 w-12 text-accent/30 mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Kindling
          </h2>
          <p className="text-sm text-foreground-secondary text-center max-w-md mb-6">
            Chat with local AI models. Your data never leaves your machine.
          </p>
          <p className="text-xs text-foreground-muted">
            {model
              ? "Start typing to begin a conversation."
              : "Install a model from the Models tab to get started."}
          </p>
        </div>
        {error && (
          <div className="mx-4 mb-2 p-3 bg-red-400/10 border border-red-400/30 rounded-lg">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}
        <div className="px-4 pb-4">
          <div className="max-w-3xl mx-auto">
            {promptPicker}
            <InputBar
              onSend={handleSend}
              onStop={handleStop}
              disabled={!model || isStreaming}
              isStreaming={isStreaming}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {loadingMessages ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 text-foreground-muted animate-spin" />
            </div>
          ) : (
            messages.map((msg, idx) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                isLastAssistant={idx === lastAssistantIndex && !isStreaming}
                onRegenerate={idx === lastAssistantIndex ? handleRegenerate : undefined}
              />
            ))
          )}
          {isStreaming && streamingContent && (
            <MessageBubble
              message={{
                id: "streaming",
                conversationId: conversationId || "",
                role: "assistant",
                content: streamingContent,
                createdAt: new Date().toISOString(),
              }}
              isStreaming
            />
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {error && (
        <div className="mx-4 mb-2 p-3 bg-red-400/10 border border-red-400/30 rounded-lg flex items-center justify-between">
          <p className="text-sm text-red-400">{error}</p>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-xs text-red-400/60 hover:text-red-400 ml-3"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="px-4 pb-4">
        <div className="max-w-3xl mx-auto">
          <InputBar
            onSend={handleSend}
            onStop={handleStop}
            disabled={!model || isStreaming}
            isStreaming={isStreaming}
          />
        </div>
      </div>
    </div>
  );
}
