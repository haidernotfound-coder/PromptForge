"use client";

import { Bold, Italic, List, Braces, Code2, Quote } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";

export type WrapKind = "bold" | "italic" | "code" | "quote" | "list" | "variable";

const ACTIONS: { kind: WrapKind; icon: typeof Bold; label: string }[] = [
  { kind: "bold", icon: Bold, label: "Bold (**text**)" },
  { kind: "italic", icon: Italic, label: "Italic (_text_)" },
  { kind: "code", icon: Code2, label: "Code block" },
  { kind: "quote", icon: Quote, label: "Quote" },
  { kind: "list", icon: List, label: "Bulleted list" },
  { kind: "variable", icon: Braces, label: "Insert variable {{ }}" },
];

export function EditorToolbar({ onAction }: { onAction: (kind: WrapKind) => void }) {
  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-0.5 rounded-md border border-border bg-surface p-1">
        {ACTIONS.map(({ kind, icon: Icon, label }) => (
          <Tooltip key={kind}>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                aria-label={label}
                onClick={() => onAction(kind)}
              >
                <Icon className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}

/** Applies a formatting action to a textarea's current selection, returning the new value + cursor position. */
export function applyWrap(
  kind: WrapKind,
  value: string,
  selectionStart: number,
  selectionEnd: number
): { value: string; start: number; end: number } {
  const before = value.slice(0, selectionStart);
  const selected = value.slice(selectionStart, selectionEnd);
  const after = value.slice(selectionEnd);

  switch (kind) {
    case "bold": {
      const text = selected || "bold text";
      const next = `${before}**${text}**${after}`;
      return { value: next, start: before.length + 2, end: before.length + 2 + text.length };
    }
    case "italic": {
      const text = selected || "italic text";
      const next = `${before}_${text}_${after}`;
      return { value: next, start: before.length + 1, end: before.length + 1 + text.length };
    }
    case "code": {
      const text = selected || "code here";
      const next = `${before}\n\`\`\`\n${text}\n\`\`\`\n${after}`;
      const start = before.length + 5;
      return { value: next, start, end: start + text.length };
    }
    case "quote": {
      const text = selected || "quoted text";
      const lines = text.split("\n").map((l) => `> ${l}`).join("\n");
      const next = `${before}${lines}${after}`;
      return { value: next, start: before.length, end: before.length + lines.length };
    }
    case "list": {
      const text = selected || "list item";
      const lines = text.split("\n").map((l) => `- ${l}`).join("\n");
      const next = `${before}${lines}${after}`;
      return { value: next, start: before.length, end: before.length + lines.length };
    }
    case "variable": {
      const name = selected || "variable_name";
      const next = `${before}{{${name}}}${after}`;
      return { value: next, start: before.length + 2, end: before.length + 2 + name.length };
    }
    default:
      return { value, start: selectionStart, end: selectionEnd };
  }
}

/** Extracts unique {{variable}} placeholder names from a prompt body, in first-seen order. */
export function extractVariables(body: string): string[] {
  const matches = body.match(/\{\{\s*[\w.-]+\s*\}\}/g) ?? [];
  const seen = new Set<string>();
  for (const m of matches) seen.add(m.replace(/[{}]/g, "").trim());
  return Array.from(seen);
}
