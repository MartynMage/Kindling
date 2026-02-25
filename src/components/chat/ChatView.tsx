import { useState, useEffect, useRef, useCallback } from "react";
import MessageBubble from "./MessageBubble";
import InputBar from "./InputBar";
import { Flame } from "lucide-react";
import type { Message, Conversation, ChatStreamEvent } from "@/lib/types";
import * as api from "@/lib/api";

interface ChatViewProps {
  conversationId: string | null;
  model: string;
  ollamaConnected: boolean;
  onConversationCreated: (convo: Conversation) => void;
  onConversationUpdated: () => void;
}

export default function ChatView({
  conversationId,
  model,
  ollamaConnected,
  onConversationCreated,
  onConversationUpdated,
}: ChatViewProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingContent, setStreamingContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeConvoRef = useRef(conversationId);

  useEffect(() => {
    activeConvoRef.current = conversationId;
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      return;
    }
    async function loadMessages() {
      try {
        const data = await api.getConversation(conversationId!);
        setMessages(data.messages);
      } catch {
        setMessages([]);
      }
    }
    loadMessages();
  }, [conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  useEffect(() => {
    const unlisten = api.onChatStream((event: ChatStreamEvent) => {
      if (event.error) {
        setIsStreaming(false);
        setStreamingContent("");
        return;
      }
      if (event.token) {
        setStreamingContent((prev) => prev + event.token);
      }
      if (event.done) {
        setStreamingContent((prev) => {
          if (prev) {
            const assistantMsg: Message = {
              id: crypto.randomUUID(),
              conversationId: activeConvoRef.current || "",
              role: "assistant",
              content: prev,
              model,
              createdAt: new Date().toISOString(),
            };
            setMessages((msgs) => [...msgs, assistantMsg]);
            onConversationUpdated();
          }
          return "";
        });
        setIsStreaming(false);
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [model, onConversationUpdated]);

  const handleSend = useCallback(
    async (content: string) => {
      if (!content.trim() || isStreaming) return;

      let convoId = conversationId;

      // Auto-create conversation if none active
      if (!convoId) {
        try {
          const convo = await api.createConversation(model);
          convoId = convo.id;
          onConversationCreated(convo);
        } catch {
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
      setStreamingContent("");

      try {
        await api.sendMessage(convoId, content, model);
      } catch {
        setIsStreaming(false);
      }
    },
    [conversationId, model, isStreaming, onConversationCreated]
  );

  if (!ollamaConnected) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <Flame className="h-12 w-12 text-accent/40 mb-4" />
        <h2 className="text-lg font-semibold text-foreground mb-2">
          Ollama Not Connected
        </h2>
        <p className="text-sm text-foreground-secondary text-center max-w-md">
          Make sure Ollama is installed and running on your machine.
          Visit{" "}
          <span className="text-accent">ollama.com</span>{" "}
          to get started, then check your connection in Settings.
        </p>
      </div>
    );
  }

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
            Select a model and start typing, or create a new chat.
          </p>
        </div>
        <div className="px-4 pb-4">
          <InputBar onSend={handleSend} disabled={!model || isStreaming} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
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

      <div className="px-4 pb-4">
        <div className="max-w-3xl mx-auto">
          <InputBar onSend={handleSend} disabled={!model || isStreaming} />
        </div>
      </div>
    </div>
  );
}
