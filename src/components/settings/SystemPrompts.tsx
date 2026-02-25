import { useState, useEffect } from "react";
import { Plus, Trash2, Edit3, Save, X } from "lucide-react";
import type { SystemPrompt } from "@/lib/types";
import * as api from "@/lib/api";

export default function SystemPrompts() {
  const [prompts, setPrompts] = useState<SystemPrompt[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editContent, setEditContent] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadPrompts();
  }, []);

  async function loadPrompts() {
    try {
      const p = await api.listSystemPrompts();
      setPrompts(p);
    } catch {
      // No prompts yet
    }
  }

  const handleCreate = async () => {
    if (!editName.trim() || !editContent.trim()) return;
    try {
      await api.createSystemPrompt(editName.trim(), editContent.trim());
      setCreating(false);
      setEditName("");
      setEditContent("");
      loadPrompts();
    } catch {
      // Handle error
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editName.trim() || !editContent.trim()) return;
    try {
      await api.updateSystemPrompt(id, editName.trim(), editContent.trim());
      setEditing(null);
      loadPrompts();
    } catch {
      // Handle error
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteSystemPrompt(id);
      loadPrompts();
    } catch {
      // Handle error
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-medium text-foreground">System Prompts</h3>
          <p className="text-xs text-foreground-muted">
            Create reusable personas for your conversations
          </p>
        </div>
        <button
          onClick={() => {
            setCreating(true);
            setEditName("");
            setEditContent("");
          }}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-accent border border-accent/30 hover:bg-accent/10 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> New
        </button>
      </div>

      {/* Create form */}
      {creating && (
        <div className="bg-surface border border-accent/30 rounded-lg p-4 mb-4">
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="Prompt name (e.g., Python Tutor)"
            className="w-full px-3 py-2 mb-3 bg-surface-hover border border-surface-border rounded-lg text-sm text-foreground outline-none focus:border-accent/40"
          />
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            placeholder="You are a helpful Python tutor..."
            rows={4}
            className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-lg text-sm text-foreground outline-none focus:border-accent/40 resize-none"
          />
          <div className="flex justify-end gap-2 mt-3">
            <button
              onClick={() => setCreating(false)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-foreground-muted hover:bg-surface-hover transition-colors"
            >
              <X className="h-3.5 w-3.5" /> Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!editName.trim() || !editContent.trim()}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-white bg-accent hover:bg-accent-dim transition-colors disabled:opacity-40"
            >
              <Save className="h-3.5 w-3.5" /> Save
            </button>
          </div>
        </div>
      )}

      {/* Prompt list */}
      <div className="space-y-2">
        {prompts.length === 0 && !creating && (
          <div className="bg-surface border border-surface-border rounded-lg p-8 text-center">
            <p className="text-sm text-foreground-secondary">
              No system prompts yet. Create one to get started.
            </p>
          </div>
        )}

        {prompts.map((prompt) => (
          <div
            key={prompt.id}
            className="bg-surface border border-surface-border rounded-lg p-4"
          >
            {editing === prompt.id ? (
              <>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 mb-3 bg-surface-hover border border-surface-border rounded-lg text-sm text-foreground outline-none focus:border-accent/40"
                />
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 bg-surface-hover border border-surface-border rounded-lg text-sm text-foreground outline-none focus:border-accent/40 resize-none"
                />
                <div className="flex justify-end gap-2 mt-3">
                  <button
                    onClick={() => setEditing(null)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-foreground-muted hover:bg-surface-hover transition-colors"
                  >
                    <X className="h-3.5 w-3.5" /> Cancel
                  </button>
                  <button
                    onClick={() => handleUpdate(prompt.id)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-white bg-accent hover:bg-accent-dim transition-colors"
                  >
                    <Save className="h-3.5 w-3.5" /> Save
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {prompt.name}
                  </p>
                  <p className="text-xs text-foreground-secondary mt-1 line-clamp-2">
                    {prompt.content}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => {
                      setEditing(prompt.id);
                      setEditName(prompt.name);
                      setEditContent(prompt.content);
                    }}
                    className="p-1.5 rounded text-foreground-muted hover:text-foreground hover:bg-surface-hover transition-colors"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(prompt.id)}
                    className="p-1.5 rounded text-foreground-muted hover:text-red-400 hover:bg-surface-hover transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
