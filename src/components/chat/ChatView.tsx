import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import MessageBubble from "./MessageBubble";
import InputBar from "./InputBar";
import type { InputBarHandle } from "./InputBar";
import { Flame, Loader2, RefreshCw, ChevronDown, ArrowDown } from "lucide-react";
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

/** Map raw Ollama/backend errors to user-friendly messages */
function friendlyError(raw: string): string {
  if (raw.includes("connection refused") || raw.includes("Connection refused"))
    return "Cannot connect to Ollama. Make sure it is running.";
  if (raw.includes("model") && raw.includes("not found"))
    return "Model not found. It may have been deleted — try selecting a different model.";
  if (raw.includes("context length") || raw.includes("num_ctx"))
    return "The context length is too large for this model. Try a smaller value in Settings.";
  if (raw.includes("out of memory") || raw.includes("OOM"))
    return "Out of memory. Try a smaller model or reduce the context length.";
  if (raw.includes("Response size limit"))
    return "The response was too long and was cut short.";
  if (raw.includes("timeout") || raw.includes("Timeout"))
    return "Request timed out. Ollama may be busy — try again.";
  return raw;
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
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const promptPickerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<InputBarHandle>(null);
  const [userScrolledUp, setUserScrolledUp] = useState(false);

  // Auto-focus input when conversation changes
  useEffect(() => {
    // Small delay so the DOM settles after state update
    const timer = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, [conversationId]);

  // Refs to avoid stale closures in event listeners
  const activeConvoRef = useRef(conversationId);
  const modelRef = useRef(model);
  const isStreamingRef = useRef(isStreaming);
  const onConversationUpdatedRef = useRef(onConversationUpdated);
  const streamingContentRef = useRef("");
  const scrollThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedPromptRef = useRef<string | null>(null);
  // Track whether we stopped manually (to avoid duplicate message on done event)
  const stoppedManuallyRef = useRef(false);

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
          // Restore or reset system prompt for this conversation
          setSelectedPromptId(data.conversation.systemPromptId || null);
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

  // Detect when user scrolls up manually
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const handleScroll = () => {
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      setUserScrolledUp(distFromBottom > 100);
    };
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  // Auto-scroll — throttled during streaming, respects user scroll position
  useEffect(() => {
    if (userScrolledUp) return;
    if (isStreaming) {
      if (!scrollThrottleRef.current) {
        scrollThrottleRef.current = setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
          scrollThrottleRef.current = null;
        }, 100);
      }
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, streamingContent, isStreaming, userScrolledUp]);

  useEffect(() => {
    return () => {
      if (scrollThrottleRef.current) clearTimeout(scrollThrottleRef.current);
    };
  }, []);

  // Graceful cleanup — cancel active stream when component unmounts
  useEffect(() => {
    return () => {
      if (isStreamingRef.current) {
        api.stopStreaming().catch(() => {});
      }
    };
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setUserScrolledUp(false);
  }, []);

  // Escape key dismisses error banner
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape" && error) {
        setError(null);
      }
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [error]);

  // Chat stream listener — stable via refs, no dependency churn
  useEffect(() => {
    const unlisten = api.onChatStream((event: ChatStreamEvent) => {
      if (event.conversationId !== activeConvoRef.current) return;

      if (event.error) {
        setIsStreaming(false);
        setStreamingContent("");
        streamingContentRef.current = "";
        stoppedManuallyRef.current = false;
        setError(friendlyError(event.error));
        return;
      }
      if (event.token) {
        streamingContentRef.current += event.token;
        setStreamingContent(streamingContentRef.current);
      }
      if (event.done) {
        const content = streamingContentRef.current;
        // Only append if we didn't already handle this via handleStop
        if (content && !stoppedManuallyRef.current) {
          const assistantMsg: Message = {
            // Use the database ID from the backend if available
            id: event.messageId || crypto.randomUUID(),
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
        stoppedManuallyRef.current = false;
      }
    });

    return () => {
      unlisten.then((fn) => fn()).catch(() => {});
    };
  }, []);

  // Listen for LLM-generated title updates
  useEffect(() => {
    const unlisten = api.onTitleUpdated((event) => {
      // The backend saved the title via a separate Ollama call.
      // We need to update the DB and refresh the conversation list.
      api.renameConversation(event.conversationId, event.title)
        .then(() => onConversationUpdatedRef.current())
        .catch(() => { /* Title update failed silently */ });
    });
    return () => { unlisten.then((fn) => fn()); };
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
      stoppedManuallyRef.current = false;

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
    // Mark that we stopped manually so the done event doesn't duplicate
    stoppedManuallyRef.current = true;
    try {
      await api.stopStreaming();
    } catch {
      // Force stop on frontend regardless
    }
    // Don't append message here — let the backend's done event handle it
    // (the backend saves the partial response and emits done with the DB ID)
    // We just clear the streaming state on the frontend
    setIsStreaming(false);
    isStreamingRef.current = false;
    // Wait briefly for the backend done event to arrive with the saved message
    // If it doesn't arrive within 500ms, append locally as fallback
    const content = streamingContentRef.current;
    setTimeout(() => {
      // If stoppedManuallyRef is still true, the done event hasn't arrived
      if (stoppedManuallyRef.current && content) {
        stoppedManuallyRef.current = false;
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
    }, 500);
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

    // Delete old assistant messages from DB after the last user message
    try {
      await api.deleteMessagesAfter(
        activeConvoRef.current!,
        lastUserMsg.id
      );
    } catch {
      // Best-effort cleanup
    }

    setMessages((prev) => prev.slice(0, lastUserMsgIndex + 1));

    isStreamingRef.current = true;
    stoppedManuallyRef.current = false;
    setIsStreaming(true);
    setError(null);
    streamingContentRef.current = "";
    setStreamingContent("");

    try {
      // skipUserSave=true prevents the backend from saving a duplicate user message
      await api.sendMessage(
        activeConvoRef.current!,
        lastUserMsg.content,
        modelRef.current,
        getSelectedPromptContent(),
        true
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

  // Get last user message content for up-arrow editing
  const lastUserMessage = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") return messages[i].content;
    }
    return undefined;
  }, [messages]);

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

  // Open prompt picker when "/" is typed in empty input
  const handleSlashCommand = useCallback(() => {
    if (systemPrompts.length > 0) {
      setShowPromptPicker(true);
    }
  }, [systemPrompts.length]);

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
              : "Select or install a model to get started."}
          </p>
          {model && (
            <div className="mt-3 flex items-center gap-1.5 text-[10px] text-foreground-muted/60">
              <span className="px-1.5 py-0.5 bg-surface-hover rounded">Enter</span> send
              <span className="px-1.5 py-0.5 bg-surface-hover rounded ml-2">Shift+Enter</span> new line
              <span className="px-1.5 py-0.5 bg-surface-hover rounded ml-2">/</span> prompts
            </div>
          )}
        </div>
        {error && (
          <div role="alert" className="mx-4 mb-2 p-3 bg-red-400/10 border border-red-400/30 rounded-lg flex items-center justify-between">
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
            {promptPicker}
            <InputBar
              ref={inputRef}
              onSend={handleSend}
              onStop={handleStop}
              disabled={!model || isStreaming}
              isStreaming={isStreaming}
              lastUserMessage={lastUserMessage}
              onSlashCommand={handleSlashCommand}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {loadingMessages ? (
            <div className="space-y-4 py-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className={`flex gap-3 ${i % 2 === 1 ? "justify-end" : ""}`}>
                  {i % 2 === 0 && <div className="w-8 h-8 rounded-lg bg-surface-hover animate-pulse shrink-0" />}
                  <div className={`rounded-2xl px-4 py-3 ${i % 2 === 1 ? "bg-accent/10" : "bg-surface"} space-y-2 max-w-[60%]`}>
                    <div className="h-3 bg-surface-hover rounded animate-pulse" style={{ width: `${120 + i * 40}px` }} />
                    <div className="h-3 bg-surface-hover rounded animate-pulse" style={{ width: `${80 + i * 30}px` }} />
                  </div>
                  {i % 2 === 1 && <div className="w-8 h-8 rounded-lg bg-surface-hover animate-pulse shrink-0" />}
                </div>
              ))}
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
          {/* Typing indicator — shows when streaming starts but no content yet */}
          {isStreaming && !streamingContent && (
            <div className="group flex gap-3" role="status" aria-label="Generating response">
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                <Loader2 className="h-4 w-4 text-accent animate-spin" />
              </div>
              <div className="rounded-2xl px-4 py-3 bg-surface text-foreground">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-foreground-muted rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 bg-foreground-muted rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 bg-foreground-muted rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
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

      {/* Scroll to bottom button */}
      {userScrolledUp && (
        <button
          type="button"
          onClick={scrollToBottom}
          className="absolute right-6 bottom-24 p-2 rounded-full bg-surface border border-surface-border shadow-lg text-foreground-muted hover:text-foreground hover:bg-surface-hover transition-colors z-10 animate-slide-in-right"
          aria-label="Scroll to bottom"
        >
          <ArrowDown className="h-4 w-4" />
        </button>
      )}

      {error && (
        <div role="alert" className="mx-4 mb-2 p-3 bg-red-400/10 border border-red-400/30 rounded-lg flex items-center justify-between">
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
          {promptPicker}
          <InputBar
            ref={inputRef}
            onSend={handleSend}
            onStop={handleStop}
            disabled={!model || isStreaming}
            isStreaming={isStreaming}
            lastUserMessage={lastUserMessage}
            onSlashCommand={handleSlashCommand}
          />
        </div>
      </div>
    </div>
  );
}
