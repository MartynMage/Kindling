import { useState, useMemo } from "react";
import { Trash2, MessageSquare, Pencil, Check, X, Download, AlertTriangle } from "lucide-react";
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

/** Group conversations by date category */
function groupByDate(conversations: Conversation[]) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  const groups: { label: string; items: Conversation[] }[] = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "Previous 7 Days", items: [] },
    { label: "Older", items: [] },
  ];

  for (const c of conversations) {
    const date = new Date(c.updatedAt);
    if (date >= today) {
      groups[0].items.push(c);
    } else if (date >= yesterday) {
      groups[1].items.push(c);
    } else if (date >= weekAgo) {
      groups[2].items.push(c);
    } else {
      groups[3].items.push(c);
    }
  }

  return groups.filter((g) => g.items.length > 0);
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
  const [exportedId, setExportedId] = useState<string | null>(null);
  const [exportErrorId, setExportErrorId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

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

  const handleExport = async (id: string, format: "markdown" | "json" = "markdown") => {
    try {
      const result = await api.exportConversation(id, format);
      const mimeType = format === "json" ? "application/json" : "text/markdown";
      const blob = new Blob([result.content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportedId(id);
      setTimeout(() => setExportedId(null), 1500);
    } catch {
      setExportErrorId(id);
      setTimeout(() => setExportErrorId(null), 2000);
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

  // Use date grouping when not searching and have enough conversations
  const groups = useMemo(() => {
    const useGrouping = !searchQuery.trim() && filtered.length > 3;
    return useGrouping ? groupByDate(filtered) : [{ label: "", items: filtered }];
  }, [filtered, searchQuery]);

  const renderConvo = (convo: Conversation) => (
    <div
      key={convo.id}
      role="button"
      tabIndex={renamingId === convo.id ? -1 : 0}
      onClick={() => renamingId !== convo.id && confirmDeleteId !== convo.id && onSelect(convo.id)}
      onKeyDown={(e) => {
        if (renamingId === convo.id || confirmDeleteId === convo.id) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(convo.id);
        }
        if (e.key === "Delete" || e.key === "Backspace") {
          e.preventDefault();
          setConfirmDeleteId(convo.id);
        }
        if (e.key === "F2") {
          e.preventDefault();
          setRenamingId(convo.id);
          setRenameValue(convo.title);
          setRenameError(null);
        }
      }}
      className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-accent/50 ${
        activeId === convo.id
          ? "bg-surface-hover text-foreground"
          : "text-foreground-secondary hover:bg-surface-hover hover:text-foreground"
      }`}
    >
      {/* Inline delete confirmation */}
      {confirmDeleteId === convo.id ? (
        <div className="flex-1 flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" />
          <span className="text-xs text-red-400 flex-1">Delete?</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(convo.id);
              setConfirmDeleteId(null);
            }}
            className="px-2 py-0.5 text-xs bg-red-500/20 text-red-400 rounded hover:bg-red-500/30"
          >
            Yes
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setConfirmDeleteId(null);
            }}
            className="px-2 py-0.5 text-xs text-foreground-muted hover:text-foreground rounded"
          >
            No
          </button>
        </div>
      ) : renamingId === convo.id ? (
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
          <div className="flex-1 min-w-0">
            <span className="text-sm truncate block">
              {convo.title || "New conversation"}
            </span>
            <span className="text-[10px] text-foreground-muted truncate block">
              {convo.model}
            </span>
          </div>
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
              aria-label="Export conversation as markdown"
              title="Export (right-click for JSON)"
              onClick={(e) => {
                e.stopPropagation();
                handleExport(convo.id, "markdown");
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleExport(convo.id, "json");
              }}
              className={`p-1 rounded transition-colors ${
                exportedId === convo.id
                  ? "text-accent"
                  : exportErrorId === convo.id
                    ? "text-red-400"
                    : "text-foreground-muted hover:text-foreground"
              }`}
            >
              {exportedId === convo.id ? (
                <Check className="h-3 w-3" />
              ) : exportErrorId === convo.id ? (
                <X className="h-3 w-3" />
              ) : (
                <Download className="h-3 w-3" />
              )}
            </button>
            <button
              type="button"
              aria-label="Delete conversation"
              onClick={(e) => {
                e.stopPropagation();
                setConfirmDeleteId(convo.id);
              }}
              className="p-1 rounded text-foreground-muted hover:text-red-400 transition-colors"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="space-y-0.5 py-1">
      {groups.map((group) => (
        <div key={group.label || "all"}>
          {group.label && (
            <p className="px-3 pt-3 pb-1 text-[10px] font-medium text-foreground-muted uppercase tracking-wide">
              {group.label}
            </p>
          )}
          {group.items.map(renderConvo)}
        </div>
      ))}
    </div>
  );
}
