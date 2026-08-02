"use client";

import * as React from "react";
import { toast } from "sonner";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CodeForgeOutputBlock({
  content,
  isCode,
  emptyLabel = "Output will appear here.",
}: {
  content: string;
  isCode: boolean;
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

  return (
    <div className="relative rounded-md border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <span className="text-xs font-medium text-text-muted">{isCode ? "Code" : "Result"}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs"
          onClick={copy}
          disabled={!content.trim()}
        >
          {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      {content.trim() ? (
        <pre
          className={cn(
            "max-h-[520px] overflow-auto whitespace-pre-wrap break-words p-4 text-sm leading-relaxed",
            isCode && "font-mono"
          )}
        >
          {content}
        </pre>
      ) : (
        <p className="p-4 text-sm text-text-faint">{emptyLabel}</p>
      )}
    </div>
  );
}
