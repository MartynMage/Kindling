import { User, Bot, Copy, Check, RotateCcw } from "lucide-react";
import { useState, useRef, useEffect, useCallback, memo, lazy, Suspense } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Message } from "@/lib/types";

// Lazy-load the heavy syntax highlighter (~400 KB) — only needed when code blocks appear
const SyntaxHighlighter = lazy(() =>
  import("react-syntax-highlighter/dist/esm/prism")
);
const oneDarkPromise = import("react-syntax-highlighter/dist/esm/styles/prism").then(
  (m) => m.oneDark
);

let oneDarkStyle: Record<string, React.CSSProperties> | null = null;
oneDarkPromise.then((s) => { oneDarkStyle = s as Record<string, React.CSSProperties>; });

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

// Lazy-loaded code block component
function LazyCodeBlock({ language, code }: { language: string; code: string }) {
  return (
    <div className="relative group/code my-2">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--code-block-bg)] rounded-t-lg border-b border-surface-border">
        <span className="text-xs text-foreground-muted">
          {language}
        </span>
        <CodeCopyButton text={code} />
      </div>
      <Suspense
        fallback={
          <pre className="px-3 py-2 text-xs font-mono bg-[var(--code-block-bg)] rounded-b-lg overflow-x-auto">
            <code>{code}</code>
          </pre>
        }
      >
        <SyntaxHighlighter
          style={(oneDarkStyle || {}) as Record<string, React.CSSProperties>}
          language={language}
          PreTag="div"
          customStyle={{
            margin: 0,
            borderTopLeftRadius: 0,
            borderTopRightRadius: 0,
            background: "var(--code-block-bg)",
            fontSize: "0.8rem",
          }}
        >
          {code}
        </SyntaxHighlighter>
      </Suspense>
    </div>
  );
}

// Stable markdown component overrides — defined outside to avoid re-creation
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const markdownComponents: Record<string, React.ComponentType<any>> = {
  code({ className, children, ...props }: { className?: string; children?: React.ReactNode }) {
    const match = /language-(\w+)/.exec(className || "");
    const codeString = String(children).replace(/\n$/, "");

    if (match) {
      return <LazyCodeBlock language={match[1]} code={codeString} />;
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
  h1({ children }: { children?: React.ReactNode }) {
    return <h1 className="text-lg font-bold text-foreground mb-2 mt-3">{children}</h1>;
  },
  h2({ children }: { children?: React.ReactNode }) {
    return <h2 className="text-base font-semibold text-foreground mb-2 mt-3">{children}</h2>;
  },
  h3({ children }: { children?: React.ReactNode }) {
    return <h3 className="text-sm font-semibold text-foreground mb-1 mt-2">{children}</h3>;
  },
  a({ href, children }: { href?: string; children?: React.ReactNode }) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-accent hover:underline"
      >
        {children}
      </a>
    );
  },
  blockquote({ children }: { children?: React.ReactNode }) {
    return (
      <blockquote className="border-l-2 border-accent/40 pl-3 my-2 text-sm text-foreground-secondary italic">
        {children}
      </blockquote>
    );
  },
  hr() {
    return <hr className="my-3 border-surface-border" />;
  },
  strong({ children }: { children?: React.ReactNode }) {
    return <strong className="font-semibold text-foreground">{children}</strong>;
  },
  del({ children }: { children?: React.ReactNode }) {
    return <del className="text-foreground-muted line-through">{children}</del>;
  },
  table({ children }: { children?: React.ReactNode }) {
    return (
      <div className="overflow-x-auto my-2">
        <table className="text-sm border-collapse border border-surface-border w-full">{children}</table>
      </div>
    );
  },
  thead({ children }: { children?: React.ReactNode }) {
    return <thead className="bg-surface-hover">{children}</thead>;
  },
  th({ children }: { children?: React.ReactNode }) {
    return <th className="border border-surface-border px-3 py-1.5 text-left text-xs font-semibold text-foreground">{children}</th>;
  },
  td({ children }: { children?: React.ReactNode }) {
    return <td className="border border-surface-border px-3 py-1.5 text-xs text-foreground-secondary">{children}</td>;
  },
};

/** Memoized markdown renderer — avoids re-parsing unchanged content */
const MemoizedMarkdown = memo(function MemoizedMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={markdownComponents}
      skipHtml
      disallowedElements={["script", "iframe", "object", "embed"]}
    >
      {content}
    </ReactMarkdown>
  );
});

/** Copy button with "Copied!" feedback — used for both user and assistant messages */
function CopyButton({ text }: { text: string }) {
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
  );
}

export default function MessageBubble({ message, isStreaming, isLastAssistant, onRegenerate }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={`group flex gap-3 animate-slide-up ${isUser ? "justify-end" : ""}`}>
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
        title={message.createdAt ? new Date(message.createdAt).toLocaleString() : undefined}
      >
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="max-w-none">
            <MemoizedMarkdown content={message.content} />
          </div>
        )}

        {isStreaming && (
          <span className="inline-block w-2 h-4 bg-accent/60 animate-pulse ml-0.5" />
        )}

        {/* Action buttons — assistant messages */}
        {!isStreaming && !isUser && (
          <div className="absolute -bottom-6 right-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-3">
            {/* Model name tag */}
            {message.model && (
              <span className="text-[10px] text-foreground-muted/60">
                {message.model}
              </span>
            )}
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
            <CopyButton text={message.content} />
          </div>
        )}

        {/* Action buttons — user messages */}
        {!isStreaming && isUser && (
          <div className="absolute -bottom-6 left-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <CopyButton text={message.content} />
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
