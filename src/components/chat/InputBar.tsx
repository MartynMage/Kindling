import { Send, Square } from "lucide-react";
import { useState, useRef, useEffect } from "react";

interface InputBarProps {
  onSend: (content: string) => void;
  onStop?: () => void;
  disabled?: boolean;
  isStreaming?: boolean;
}

export default function InputBar({ onSend, onStop, disabled, isStreaming }: InputBarProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 200) + "px";
    }
  }, [value]);

  const handleSubmit = () => {
    if (!value.trim() || disabled) return;
    onSend(value.trim());
    setValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex items-end gap-2 bg-surface border border-surface-border rounded-2xl px-4 py-3">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a message..."
        aria-label="Message input"
        disabled={disabled}
        rows={1}
        className="flex-1 bg-transparent text-sm text-foreground placeholder:text-foreground-muted resize-none outline-none max-h-[200px] disabled:opacity-40"
      />
      {isStreaming ? (
        <button
          type="button"
          onClick={onStop}
          aria-label="Stop generating"
          className="flex-shrink-0 p-2 rounded-xl bg-red-500/80 text-white hover:bg-red-500 transition-colors"
        >
          <Square className="h-4 w-4" />
        </button>
      ) : (
        <button
          type="button"
          onClick={handleSubmit}
          disabled={disabled || !value.trim()}
          aria-label="Send message"
          className="flex-shrink-0 p-2 rounded-xl bg-accent text-white hover:bg-accent-dim transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Send className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
