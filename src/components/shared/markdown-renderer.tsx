"use client";

import * as React from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * MarkdownRenderer — the single AI-response renderer for every NexPrompt
 * product (PromptForge, CodeForge, StudyForge, and anything that ships
 * after them). Anywhere a tool result or chat reply is shown, it should go
 * through this component instead of a raw `<pre>`/text node, so headings,
 * bold/italic, lists, tables, blockquotes, inline code, fenced code blocks
 * with syntax highlighting, horizontal rules, and links all render
 * properly — no per-product wiring required, since new products only need
 * to import this one component.
 *
 * Built on react-markdown + remark-gfm (tables, strikethrough, task lists,
 * autolinks) + rehype-highlight (fenced-code syntax highlighting). Visual
 * language lives in `.md-content` in globals.css, driven by the same theme
 * CSS variables as the rest of the app, so it matches light/dark mode
 * automatically instead of importing a canned highlight.js stylesheet.
 */
export function MarkdownRenderer({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  const components = React.useMemo<Components>(
    () => ({
      a: ({ href, children, ...props }) => (
        <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
          {children}
        </a>
      ),
      pre: ({ children }) => <CodeBlockWrapper>{children}</CodeBlockWrapper>,
      code: (props) => {
        const { className: codeClassName, children, ...rest } = props;
        // Fenced code blocks arrive with a `language-xxx` className (added
        // by remark/rehype); plain inline `` `code` `` doesn't have one —
        // that's the react-markdown v9+ way to tell them apart now that
        // the old `inline` prop is gone.
        const isBlock = /language-/.test(codeClassName ?? "");
        if (!isBlock) {
          return (
            <code className={codeClassName} {...rest}>
              {children}
            </code>
          );
        }
        return (
          <code className={codeClassName} {...rest}>
            {children}
          </code>
        );
      },
    }),
    []
  );

  return (
    <div className={cn("md-content", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

/** Wraps a fenced code block with a GitHub/ChatGPT-style header showing the
 *  detected language and a copy button, without disturbing the highlighted
 *  <code> markup rehype-highlight produced inside it. */
function CodeBlockWrapper({ children }: { children?: React.ReactNode }) {
  const preRef = React.useRef<HTMLPreElement>(null);
  const [copied, setCopied] = React.useState(false);

  const language = React.useMemo(() => {
    const child = React.Children.toArray(children)[0];
    if (React.isValidElement(child)) {
      const childProps = child.props as { className?: string };
      const match = /language-(\w+)/.exec(childProps.className ?? "");
      if (match) return match[1];
    }
    return "";
  }, [children]);

  function copy() {
    const text = preRef.current?.innerText ?? "";
    if (!text.trim()) return;
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(true);
        toast.success("Copied to clipboard");
        setTimeout(() => setCopied(false), 1500);
      },
      () => toast.error("Couldn't copy — try selecting the text manually")
    );
  }

  return (
    <div className="group relative">
      {language && (
        <span className="pointer-events-none absolute right-2 top-2 z-10 rounded bg-surface-raised px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-text-faint opacity-0 transition-opacity group-hover:opacity-100">
          {language}
        </span>
      )}
      <button
        type="button"
        onClick={copy}
        aria-label="Copy code"
        className="absolute right-2 bottom-2 z-10 flex items-center gap-1 rounded-md border border-border bg-surface-raised px-2 py-1 text-[11px] font-medium text-text-muted opacity-0 transition-opacity hover:text-text group-hover:opacity-100"
      >
        {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
        {copied ? "Copied" : "Copy"}
      </button>
      <pre ref={preRef}>{children}</pre>
    </div>
  );
}
