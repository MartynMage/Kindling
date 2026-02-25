import { X, Keyboard } from "lucide-react";
import { useEffect } from "react";

interface KeyboardShortcutsOverlayProps {
  open: boolean;
  onClose: () => void;
}

const shortcuts = [
  { keys: ["Ctrl", "N"], description: "New conversation" },
  { keys: ["Ctrl", "B"], description: "Toggle sidebar" },
  { keys: ["Ctrl", ","], description: "Open settings" },
  { keys: ["Ctrl", "/"], description: "Show keyboard shortcuts" },
  { keys: ["Enter"], description: "Send message" },
  { keys: ["Shift", "Enter"], description: "New line in message" },
  { keys: ["Esc"], description: "Close dialog" },
];

export default function KeyboardShortcutsOverlay({ open, onClose }: KeyboardShortcutsOverlayProps) {
  useEffect(() => {
    if (!open) return;
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className="bg-surface border border-surface-border rounded-xl shadow-2xl w-full max-w-md mx-4"
        role="dialog"
        aria-label="Keyboard shortcuts"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border">
          <div className="flex items-center gap-2">
            <Keyboard className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-semibold text-foreground">Keyboard Shortcuts</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-foreground-muted hover:text-foreground hover:bg-surface-hover transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-3 space-y-2">
          {shortcuts.map((s) => (
            <div key={s.description} className="flex items-center justify-between py-1.5">
              <span className="text-sm text-foreground-secondary">{s.description}</span>
              <div className="flex items-center gap-1">
                {s.keys.map((key) => (
                  <kbd
                    key={key}
                    className="px-2 py-0.5 rounded bg-surface-hover border border-surface-border text-xs font-mono text-foreground-muted"
                  >
                    {key}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="px-5 py-3 border-t border-surface-border">
          <p className="text-xs text-foreground-muted text-center">
            On macOS, use ⌘ instead of Ctrl
          </p>
        </div>
      </div>
    </div>
  );
}
