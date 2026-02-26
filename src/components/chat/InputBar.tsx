import { Send, Square, X } from "lucide-react";
import { useState, useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from "react";

/** Maximum message length in characters (~100 KB) */
const MAX_MESSAGE_LENGTH = 100_000;

interface InputBarProps {
  onSend: (content: string) => void;
  onStop?: () => void;
  disabled?: boolean;
  isStreaming?: boolean;
  /** Last user message content — loaded when pressing up-arrow in empty input */
  lastUserMessage?: string;
  /** Callback when "/" is typed in an empty input */
  onSlashCommand?: () => void;
}

export interface InputBarHandle {
  focus: () => void;
}

const InputBar = forwardRef<InputBarHandle, InputBarProps>(function InputBar({ onSend, onStop, disabled, isStreaming, lastUserMessage, onSlashCommand }, ref) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
  }));

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 200) + "px";
    }
  }, [value]);

  const handleSubmit = useCallback(() => {
    if (!value.trim() || disabled) return;
    onSend(value.trim());
    setValue("");
  }, [value, disabled, onSend]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    // Enforce max length
    if (newValue.length > MAX_MESSAGE_LENGTH) {
      setValue(newValue.slice(0, MAX_MESSAGE_LENGTH));
    } else {
      setValue(newValue);
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    // Up arrow in empty input loads last user message for editing
    if (e.key === "ArrowUp" && !value && lastUserMessage) {
      e.preventDefault();
      setValue(lastUserMessage);
    }
    // "/" in empty input opens prompt picker
    if (e.key === "/" && !value && onSlashCommand) {
      e.preventDefault();
      onSlashCommand();
    }
  };

  const charCount = value.length;
  const showCharCount = charCount > 500;
  const nearLimit = charCount > MAX_MESSAGE_LENGTH * 0.9;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-end gap-2 bg-surface border border-surface-border rounded-2xl px-3 py-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Type a message... (/ for prompts)"
          aria-label="Message input"
          disabled={disabled}
          rows={1}
          maxLength={MAX_MESSAGE_LENGTH}
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-foreground-muted resize-none outline-none max-h-[200px] disabled:opacity-40"
        />
        {/* Clear button */}
        {value && !isStreaming && (
          <button
            type="button"
            onClick={() => setValue("")}
            aria-label="Clear input"
            className="flex-shrink-0 p-1.5 rounded-lg text-foreground-muted hover:text-foreground transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
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
      {/* Character count — shown when message is long */}
      {showCharCount && (
        <div className="flex justify-end px-2">
          <span className={`text-[10px] ${nearLimit ? "text-red-400" : "text-foreground-muted"}`}>
            {charCount.toLocaleString()} / {MAX_MESSAGE_LENGTH.toLocaleString()}
          </span>
        </div>
      )}
    </div>
  );
});

export default InputBar;
