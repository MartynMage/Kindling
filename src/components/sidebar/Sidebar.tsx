import { useState } from "react";
import {
  MessageSquare,
  Plus,
  Box,
  Flame,
  Settings,
  PanelLeftClose,
  PanelLeft,
  Search,
} from "lucide-react";
import ConversationList from "./ConversationList";
import ModelSelector from "./ModelSelector";
import type { View, Conversation, OllamaModel } from "@/lib/types";

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
}

const navItems: { view: View; icon: typeof MessageSquare; label: string }[] = [
  { view: "chat", icon: MessageSquare, label: "Chat" },
  { view: "models", icon: Box, label: "Models" },
  { view: "training", icon: Flame, label: "Fine-tune" },
  { view: "settings", icon: Settings, label: "Settings" },
];

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
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");

  if (!open) {
    return (
      <div className="flex flex-col items-center py-3 px-1.5 border-r border-surface-border bg-surface">
        <button
          type="button"
          onClick={onToggle}
          className="p-2 rounded-lg text-foreground-muted hover:text-foreground hover:bg-surface-hover transition-colors mb-2"
          title="Open sidebar (Ctrl+B)"
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

  return (
    <div className="flex flex-col w-64 border-r border-surface-border bg-surface shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
        <div className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-accent" />
          <span className="text-sm font-semibold text-foreground">
            Kindling
          </span>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="p-1.5 rounded-lg text-foreground-muted hover:text-foreground hover:bg-surface-hover transition-colors"
          title="Close sidebar (Ctrl+B)"
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
          title="New Chat (Ctrl+N)"
        >
          <Plus className="h-4 w-4" />
          <span className="flex-1 text-left">New Chat</span>
          <kbd className="text-[10px] text-foreground-muted bg-surface-hover px-1.5 py-0.5 rounded hidden sm:inline">
            Ctrl+N
          </kbd>
        </button>
      </div>

      {/* Search */}
      {conversations.length > 3 && (
        <div className="px-3 pb-1">
          <div className="flex items-center gap-2 px-2.5 py-1.5 bg-surface-hover rounded-lg border border-surface-border">
            <Search className="h-3.5 w-3.5 text-foreground-muted shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chats..."
              aria-label="Search conversations"
              className="flex-1 bg-transparent text-xs text-foreground placeholder:text-foreground-muted outline-none"
            />
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
