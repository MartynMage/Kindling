import { useState } from "react";
import { Trash2, MessageSquare, Pencil, Check, X, Download } from "lucide-react";
import type { Conversation } from "@/lib/types";
import * as api from "@/lib/api";

interface ConversationListProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onRenamed: () => void;
  searchQuery: string;
}

export default function ConversationList({
  conversations,
  activeId,
  onSelect,
  onDelete,
  onRenamed,
  searchQuery,
}: ConversationListProps) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);

  const filtered = searchQuery.trim()
    ? conversations.filter((c) =>
        c.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : conversations;

  const handleRename = async (id: string) => {
    const trimmed = renameValue.trim();
    if (!trimmed) {
      setRenamingId(null);
      return;
    }
    setRenameError(null);
    try {
      await api.renameConversation(id, trimmed);
      onRenamed();
      setRenamingId(null);
    } catch {
      setRenameError(id);
    }
  };

  const handleExport = async (id: string) => {
    try {
      const result = await api.exportConversation(id, "markdown");
      // Create a download via a Blob + link click
      const blob = new Blob([result.content], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Export failed silently
    }
  };

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-foreground-muted">
        <MessageSquare className="h-8 w-8 mb-2 opacity-40" />
        <p className="text-xs">No conversations yet</p>
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-foreground-muted">
        <p className="text-xs">No matching conversations</p>
      </div>
    );
  }

  return (
    <div className="space-y-0.5 py-1">
      {filtered.map((convo) => (
        <div
          key={convo.id}
          role="button"
          tabIndex={renamingId === convo.id ? -1 : 0}
          onClick={() => renamingId !== convo.id && onSelect(convo.id)}
          onKeyDown={(e) => {
            if (renamingId === convo.id) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelect(convo.id);
            }
          }}
          className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-accent/50 ${
            activeId === convo.id
              ? "bg-surface-hover text-foreground"
              : "text-foreground-secondary hover:bg-surface-hover hover:text-foreground"
          }`}
        >
          {renamingId === convo.id ? (
            <form
              className="flex-1 flex flex-col gap-1"
              onSubmit={(e) => {
                e.preventDefault();
                handleRename(convo.id);
              }}
            >
              <div className="flex items-center gap-1">
                <input
                  autoFocus
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setRenamingId(null);
                      setRenameError(null);
                    }
                  }}
                  className={`flex-1 text-sm bg-surface-hover border rounded px-1.5 py-0.5 text-foreground outline-none ${
                    renameError === convo.id
                      ? "border-red-400/60"
                      : "border-surface-border focus:border-accent/40"
                  }`}
                />
                <button
                  type="submit"
                  className="p-0.5 text-accent hover:text-accent-dim"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRenamingId(null);
                    setRenameError(null);
                  }}
                  className="p-0.5 text-foreground-muted hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              {renameError === convo.id && (
                <span className="text-xs text-red-400 pl-0.5">Rename failed</span>
              )}
            </form>
          ) : (
            <>
              <span className="flex-1 text-sm truncate">
                {convo.title || "New conversation"}
              </span>
              <div className="hidden group-hover:flex items-center gap-0.5">
                <button
                  type="button"
                  aria-label="Rename conversation"
                  onClick={(e) => {
                    e.stopPropagation();
                    setRenamingId(convo.id);
                    setRenameValue(convo.title);
                    setRenameError(null);
                  }}
                  className="p-1 rounded text-foreground-muted hover:text-foreground transition-colors"
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  aria-label="Export conversation"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleExport(convo.id);
                  }}
                  className="p-1 rounded text-foreground-muted hover:text-foreground transition-colors"
                >
                  <Download className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  aria-label="Delete conversation"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm("Delete this conversation?")) {
                      onDelete(convo.id);
                    }
                  }}
                  className="p-1 rounded text-foreground-muted hover:text-red-400 transition-colors"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
