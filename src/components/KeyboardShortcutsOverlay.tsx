import { X, Keyboard } from "lucide-react";
import { useEffect, useRef } from "react";

interface KeyboardShortcutsOverlayProps {
  open: boolean;
  onClose: () => void;
}

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent);
const mod = isMac ? "\u2318" : "Ctrl";

const shortcutDefs = [
  { keys: [mod, "N"], description: "New conversation" },
  { keys: [mod, "B"], description: "Toggle sidebar" },
  { keys: [mod, "F"], description: "Search conversations" },
  { keys: [mod, ","], description: "Open settings" },
  { keys: [mod, "/"], description: "Show keyboard shortcuts" },
  { keys: ["Enter"], description: "Send message" },
  { keys: ["Shift", "Enter"], description: "New line in message" },
  { keys: ["/"], description: "Open prompt picker (empty input)" },
  { keys: ["\u2191"], description: "Edit last message (empty input)" },
  { keys: ["Esc"], description: "Close dialog / dismiss error" },
  { keys: ["F2"], description: "Rename conversation" },
  { keys: ["Del"], description: "Delete conversation" },
];

export default function KeyboardShortcutsOverlay({ open, onClose }: KeyboardShortcutsOverlayProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  // Focus trap — keep Tab focus within the dialog
  useEffect(() => {
    if (!open || !dialogRef.current) return;
    const dialog = dialogRef.current;
    dialog.focus();

    function handleTab(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const focusable = dialog.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    dialog.addEventListener("keydown", handleTab);
    return () => dialog.removeEventListener("keydown", handleTab);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="bg-surface border border-surface-border rounded-xl shadow-2xl w-full max-w-md mx-4 outline-none animate-fade-scale"
        role="dialog"
        aria-label="Keyboard shortcuts"
        aria-modal="true"
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
          {shortcutDefs.map((s) => (
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
            {isMac ? "Using macOS shortcuts" : "On macOS, use \u2318 instead of Ctrl"}
          </p>
        </div>
      </div>
    </div>
  );
}
