"use client";

import * as React from "react";
import { toast } from "sonner";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MarkdownRenderer } from "@/components/shared/markdown-renderer";

/**
 * Shared "AI tool result" panel used by every product's one-shot tools
 * (CodeForge, StudyForge, and future ones) — despite the CodeForge-era
 * name, it isn't CodeForge-specific. Renders through the shared
 * MarkdownRenderer so headings, lists, tables, links, and (for code
 * results) syntax-highlighted fenced code blocks all render properly
 * instead of as a flat text block.
 */
export function CodeForgeOutputBlock({
  content,
  isCode,
  language,
  loading = false,
  emptyLabel = "Output will appear here.",
}: {
  content: string;
  isCode: boolean;
  /** For isCode results, the language to syntax-highlight as (defaults to
   *  plain-text detection by rehype-highlight if omitted). */
  language?: string;
  /** Shows shimmer skeleton lines instead of the empty state while a
   *  request is in flight, so "nothing happened yet" and "working on it"
   *  don't look identical. */
  loading?: boolean;
  emptyLabel?: string;
}) {
  const [copied, setCopied] = React.useState(false);

  function copy() {
    if (!content.trim()) return;
    navigator.clipboard.writeText(content).then(
      () => {
        setCopied(true);
        toast.success("Copied to clipboard");
        setTimeout(() => setCopied(false), 1500);
      },
      () => toast.error("Couldn't copy — try selecting the text manually")
    );
  }

  // Code-tool results (Generate, Fix, Optimize, etc.) usually come back as
  // a raw snippet, not already-fenced Markdown — wrap it in a fence so it
  // flows through the same highlighted-code renderer as everything else.
  const displayContent =
    isCode && content.trim() && !content.trim().startsWith("```")
      ? `\`\`\`${language ?? ""}\n${content}\n\`\`\``
      : content;

  return (
    <div className="relative rounded-md border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <span className="flex items-center gap-1.5 text-xs font-medium text-text-muted">
          {isCode ? "Code" : "Result"}
          {loading && <span className="text-text-faint">· Generating…</span>}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs"
          onClick={copy}
          disabled={loading || !content.trim()}
        >
          {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      {loading ? (
        <div className="space-y-2.5 p-4">
          <Skeleton className="h-3.5 w-[92%]" />
          <Skeleton className="h-3.5 w-[78%]" />
          <Skeleton className="h-3.5 w-[85%]" />
          <Skeleton className="h-3.5 w-[60%]" />
          <Skeleton className="h-3.5 w-[70%]" />
        </div>
      ) : content.trim() ? (
        <div className="max-h-[520px] overflow-auto p-4 animate-fade-in">
          <MarkdownRenderer content={displayContent} />
        </div>
      ) : (
        <p className="p-4 text-sm text-text-faint">{emptyLabel}</p>
      )}
    </div>
  );
}
