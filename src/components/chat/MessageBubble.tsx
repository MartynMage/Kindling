import { User, Bot, Copy, Check, RotateCcw } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import type { Message } from "@/lib/types";

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
  isLastAssistant?: boolean;
  onRegenerate?: () => void;
}

// Small component for code block copy button with "Copied!" feedback
function CodeCopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may not be available
    }
  }, [text]);

  return (
    <button
      type="button"
      aria-label="Copy code"
      onClick={handleCopy}
      className="text-foreground-muted hover:text-foreground transition-colors flex items-center gap-1"
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5" />
          <span className="text-xs">Copied!</span>
        </>
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

// Stable markdown component overrides — defined outside to avoid re-creation
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const markdownComponents: Record<string, React.ComponentType<any>> = {
  code({ className, children, ...props }: { className?: string; children?: React.ReactNode }) {
    const match = /language-(\w+)/.exec(className || "");
    const codeString = String(children).replace(/\n$/, "");

    if (match) {
      return (
        <div className="relative group/code my-2">
          <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--code-block-bg)] rounded-t-lg border-b border-surface-border">
            <span className="text-xs text-foreground-muted">
              {match[1]}
            </span>
            <CodeCopyButton text={codeString} />
          </div>
          <SyntaxHighlighter
            style={oneDark as Record<string, React.CSSProperties>}
            language={match[1]}
            PreTag="div"
            customStyle={{
              margin: 0,
              borderTopLeftRadius: 0,
              borderTopRightRadius: 0,
              background: "var(--code-block-bg)",
              fontSize: "0.8rem",
            }}
          >
            {codeString}
          </SyntaxHighlighter>
        </div>
      );
    }

    return (
      <code
        className="bg-surface-hover px-1.5 py-0.5 rounded text-sm text-accent-light"
        {...props}
      >
        {children}
      </code>
    );
  },
  p({ children }: { children?: React.ReactNode }) {
    return (
      <p className="text-sm leading-relaxed mb-2 last:mb-0">
        {children}
      </p>
    );
  },
  ul({ children }: { children?: React.ReactNode }) {
    return (
      <ul className="text-sm list-disc pl-4 mb-2 space-y-1">
        {children}
      </ul>
    );
  },
  ol({ children }: { children?: React.ReactNode }) {
    return (
      <ol className="text-sm list-decimal pl-4 mb-2 space-y-1">
        {children}
      </ol>
    );
  },
};

export default function MessageBubble({ message, isStreaming, isLastAssistant, onRegenerate }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may not be available
    }
  };

  return (
    <div className={`group flex gap-3 ${isUser ? "justify-end" : ""}`}>
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
          <Bot className="h-4 w-4 text-accent" />
        </div>
      )}

      <div
        className={`relative max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser
            ? "bg-accent/15 text-foreground"
            : "bg-surface text-foreground"
        }`}
      >
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-invert prose-sm max-w-none">
            <ReactMarkdown
              components={markdownComponents}
              skipHtml
              disallowedElements={["script", "iframe", "object", "embed"]}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}

        {isStreaming && (
          <span className="inline-block w-2 h-4 bg-accent/60 animate-pulse ml-0.5" />
        )}

        {/* Action buttons */}
        {!isStreaming && !isUser && (
          <div className="absolute -bottom-6 right-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-3">
            {isLastAssistant && onRegenerate && (
              <button
                type="button"
                aria-label="Regenerate response"
                onClick={onRegenerate}
                className="flex items-center gap-1 text-xs text-foreground-muted hover:text-foreground"
              >
                <RotateCcw className="h-3 w-3" /> Regenerate
              </button>
            )}
            <button
              type="button"
              aria-label="Copy message"
              onClick={handleCopy}
              className="flex items-center gap-1 text-xs text-foreground-muted hover:text-foreground"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3" /> Copied
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" /> Copy
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-surface-hover flex items-center justify-center">
          <User className="h-4 w-4 text-foreground-muted" />
        </div>
      )}
    </div>
  );
}
