import { useState, useEffect, useRef } from "react";
import {
  MessageSquare,
  Plus,
  Box,
  Flame,
  Settings,
  PanelLeftClose,
  PanelLeft,
  Search,
  FileText,
  Circle,
} from "lucide-react";
import ConversationList from "./ConversationList";
import ModelSelector from "./ModelSelector";
import type { View, Conversation, OllamaModel, SearchResult } from "@/lib/types";
import * as api from "@/lib/api";

interface SidebarProps {
  open: boolean;
  onToggle: () => void;
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onDeleteConversation: (id: string) => void;
  onConversationsChanged: () => void;
  models: OllamaModel[];
  selectedModel: string;
  onSelectModel: (model: string) => void;
  view: View;
  onChangeView: (view: View) => void;
  /** External ref for focusing the search input via Ctrl+F */
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
  /** Whether Ollama is connected — shown as status indicator */
  ollamaConnected?: boolean;
}

const navItems: { view: View; icon: typeof MessageSquare; label: string }[] = [
  { view: "chat", icon: MessageSquare, label: "Chat" },
  { view: "models", icon: Box, label: "Models" },
  { view: "training", icon: Flame, label: "Fine-tune" },
  { view: "settings", icon: Settings, label: "Settings" },
];

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent);
const mod = isMac ? "\u2318" : "Ctrl";

export default function Sidebar({
  open,
  onToggle,
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
  onConversationsChanged,
  models,
  selectedModel,
  onSelectModel,
  view,
  onChangeView,
  searchInputRef,
  ollamaConnected,
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [messageResults, setMessageResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced message search — triggers when query is 3+ chars
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

    if (searchQuery.trim().length < 3) {
      setMessageResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    searchTimerRef.current = setTimeout(async () => {
      try {
        const results = await api.searchMessages(searchQuery.trim());
        setMessageResults(results);
      } catch {
        setMessageResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchQuery]);

  if (!open) {
    return (
      <div className="flex flex-col items-center py-3 px-1.5 border-r border-surface-border bg-surface">
        <button
          type="button"
          onClick={onToggle}
          className="p-2 rounded-lg text-foreground-muted hover:text-foreground hover:bg-surface-hover transition-colors mb-2"
          title={`Open sidebar (${mod}+B)`}
        >
          <PanelLeft className="h-5 w-5" />
        </button>
        <div className="flex-1" />
        <nav aria-label="Main navigation" className="space-y-1">
          {navItems.map(({ view: v, icon: Icon, label }) => (
            <button
              type="button"
              key={v}
              onClick={() => onChangeView(v)}
              title={label}
              className={`p-2 rounded-lg transition-colors ${
                view === v
                  ? "bg-surface-hover text-foreground"
                  : "text-foreground-muted hover:text-foreground hover:bg-surface-hover"
              }`}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </nav>
      </div>
    );
  }

  // Deduplicate message results by conversation (show one per convo)
  const uniqueMessageResults = messageResults.reduce<SearchResult[]>((acc, r) => {
    if (!acc.some((a) => a.conversationId === r.conversationId)) {
      acc.push(r);
    }
    return acc;
  }, []);

  return (
    <div className="flex flex-col w-64 border-r border-surface-border bg-surface shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
        <div className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-accent" />
          <span className="text-sm font-semibold text-foreground">
            Kindling
          </span>
          {/* Connection status indicator */}
          <span title={ollamaConnected ? "Ollama connected" : "Ollama disconnected"}>
            <Circle
              className={`h-2 w-2 ${ollamaConnected ? "text-green-400 fill-green-400" : "text-red-400 fill-red-400"}`}
            />
          </span>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="p-1.5 rounded-lg text-foreground-muted hover:text-foreground hover:bg-surface-hover transition-colors"
          title={`Close sidebar (${mod}+B)`}
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>

      {/* Model Selector */}
      <div className="px-3 py-2 border-b border-surface-border">
        <ModelSelector
          models={models}
          selectedModel={selectedModel}
          onSelectModel={onSelectModel}
        />
      </div>

      {/* New Chat Button */}
      <div className="px-3 py-2">
        <button
          type="button"
          onClick={onNewChat}
          disabled={!selectedModel}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-medium text-foreground bg-accent/10 hover:bg-accent/20 border border-accent/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          title={`New Chat (${mod}+N)`}
        >
          <Plus className="h-4 w-4" />
          <span className="flex-1 text-left">New Chat</span>
          <kbd className="text-[10px] text-foreground-muted bg-surface-hover px-1.5 py-0.5 rounded hidden sm:inline">
            {mod}+N
          </kbd>
        </button>
      </div>

      {/* Search */}
      {conversations.length > 0 && (
        <div className="px-3 pb-1">
          <div className={`flex items-center gap-2 px-2.5 py-1.5 bg-surface-hover rounded-lg border transition-colors ${
            searchQuery.trim().length >= 3 ? "border-accent/40" : "border-surface-border"
          }`}>
            <Search className="h-3.5 w-3.5 text-foreground-muted shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setSearchQuery("");
                  (e.target as HTMLInputElement).blur();
                }
              }}
              placeholder={`Search... (${mod}+F)`}
              aria-label="Search conversations and messages"
              className="flex-1 bg-transparent text-xs text-foreground placeholder:text-foreground-muted outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="text-foreground-muted hover:text-foreground text-xs"
              >
                &times;
              </button>
            )}
          </div>
        </div>
      )}

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto px-2">
        <ConversationList
          conversations={conversations}
          activeId={activeConversationId}
          onSelect={onSelectConversation}
          onDelete={onDeleteConversation}
          onRenamed={onConversationsChanged}
          searchQuery={searchQuery}
        />

        {/* Message search results */}
        {searchQuery.trim().length >= 3 && (
          <div className="mt-2 pt-2 border-t border-surface-border">
            <p className="px-2 pb-1 text-[10px] font-medium text-foreground-muted uppercase tracking-wide">
              {searching ? "Searching messages..." : `Message matches (${uniqueMessageResults.length})`}
            </p>
            {!searching && uniqueMessageResults.length === 0 && (
              <p className="px-2 py-2 text-xs text-foreground-muted">
                No messages found
              </p>
            )}
            {uniqueMessageResults.map((result) => (
              <button
                type="button"
                key={result.messageId}
                onClick={() => {
                  onSelectConversation(result.conversationId);
                  setSearchQuery("");
                }}
                className="flex items-start gap-2 w-full px-2 py-2 rounded-lg text-left hover:bg-surface-hover transition-colors"
              >
                <FileText className="h-3 w-3 text-foreground-muted mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">
                    {result.conversationTitle}
                  </p>
                  <p className="text-[11px] text-foreground-muted line-clamp-2">
                    {result.content.slice(0, 120)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Nav */}
      <nav aria-label="Main navigation" className="border-t border-surface-border px-2 py-2 space-y-0.5">
        {navItems.map(({ view: v, icon: Icon, label }) => (
          <button
            type="button"
            key={v}
            onClick={() => {
              onChangeView(v);
              setSearchQuery("");
            }}
            className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm transition-colors ${
              view === v
                ? "bg-surface-hover text-foreground"
                : "text-foreground-muted hover:text-foreground hover:bg-surface-hover"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
