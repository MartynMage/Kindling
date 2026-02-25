import { User, Bot, Copy, Check } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import type { Message } from "@/lib/types";

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
}

export default function MessageBubble({ message, isStreaming }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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
              components={{
                code({ className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || "");
                  const codeString = String(children).replace(/\n$/, "");

                  if (match) {
                    return (
                      <div className="relative group/code my-2">
                        <div className="flex items-center justify-between px-3 py-1.5 bg-[#1e1e2e] rounded-t-lg border-b border-surface-border">
                          <span className="text-xs text-foreground-muted">
                            {match[1]}
                          </span>
                          <button
                            type="button"
                            aria-label="Copy code"
                            onClick={async () => {
                              await navigator.clipboard.writeText(codeString).catch(() => {});
                            }}
                            className="text-foreground-muted hover:text-foreground transition-colors"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <SyntaxHighlighter
                          style={oneDark as Record<string, React.CSSProperties>}
                          language={match[1]}
                          PreTag="div"
                          customStyle={{
                            margin: 0,
                            borderTopLeftRadius: 0,
                            borderTopRightRadius: 0,
                            background: "#1e1e2e",
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
                p({ children }) {
                  return (
                    <p className="text-sm leading-relaxed mb-2 last:mb-0">
                      {children}
                    </p>
                  );
                },
                ul({ children }) {
                  return (
                    <ul className="text-sm list-disc pl-4 mb-2 space-y-1">
                      {children}
                    </ul>
                  );
                },
                ol({ children }) {
                  return (
                    <ol className="text-sm list-decimal pl-4 mb-2 space-y-1">
                      {children}
                    </ol>
                  );
                },
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}

        {isStreaming && (
          <span className="inline-block w-2 h-4 bg-accent/60 animate-pulse ml-0.5" />
        )}

        {/* Copy button */}
        {!isStreaming && !isUser && (
          <button
            type="button"
            aria-label="Copy message"
            onClick={handleCopy}
            className="absolute -bottom-6 right-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-xs text-foreground-muted hover:text-foreground"
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
