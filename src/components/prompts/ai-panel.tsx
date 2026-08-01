"use client";

import * as React from "react";
import { toast } from "sonner";
import { Check, Loader2, Sparkles, Wand2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { runAiAction, aiActionLabel, type AiActionType, type RewriteTone } from "@/lib/ai";
import { cn } from "@/lib/utils";

const ACTIONS: { kind: AiActionType; icon: typeof Wand2; label: string; blurb: string }[] = [
  { kind: "improve", icon: Sparkles, label: "Improve", blurb: "Tighten wording and clarity" },
  { kind: "rewrite", icon: Wand2, label: "Rewrite", blurb: "Rephrase in a chosen tone" },
  { kind: "expand", icon: Sparkles, label: "Expand", blurb: "Add helpful guidance" },
  { kind: "shorten", icon: Sparkles, label: "Shorten", blurb: "Cut it down" },
];

const TONES: { value: RewriteTone; label: string }[] = [
  { value: "professional", label: "Professional" },
  { value: "casual", label: "Casual" },
  { value: "confident", label: "Confident" },
  { value: "friendly", label: "Friendly" },
  { value: "concise", label: "Concise" },
];

export function AiPanel({
  body,
  onApply,
}: {
  body: string;
  onApply: (nextBody: string, note: string) => void;
}) {
  const [pending, setPending] = React.useState<AiActionType | null>(null);
  const [tone, setTone] = React.useState<RewriteTone>("professional");
  const [preview, setPreview] = React.useState<{ action: AiActionType; output: string; summary: string } | null>(
    null
  );

  async function run(action: AiActionType) {
    if (!body.trim()) {
      toast.error("Write a prompt body first");
      return;
    }
    setPending(action);
    try {
      const result = await runAiAction(action, body, { tone });
      setPreview({ action: result.action, output: result.output, summary: result.summary });
    } finally {
      setPending(null);
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-1.5 text-base">
            <Sparkles className="h-4 w-4 text-accent" /> AI assist
          </CardTitle>
          <CardDescription>
            Runs locally in demo mode — a real model provider is wired up in a later phase.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {ACTIONS.map(({ kind, icon: Icon, label, blurb }) => (
              <Button
                key={kind}
                type="button"
                variant="outline"
                size="sm"
                disabled={pending !== null}
                onClick={() => run(kind)}
                className="gap-1.5"
                title={blurb}
              >
                {pending === kind ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
                {label}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-faint">Rewrite tone</span>
            <Select value={tone} onValueChange={(v) => setTone(v as RewriteTone)}>
              <SelectTrigger className="h-8 w-40 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TONES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Dialog open={preview !== null} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{preview ? aiActionLabel(preview.action, { tone }) : ""} preview</DialogTitle>
            <DialogDescription>{preview?.summary}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
            <div className="space-y-1">
              <p className="text-xs font-medium text-text-faint">Before</p>
              <pre className="whitespace-pre-wrap rounded-md border border-border bg-surface p-3 font-mono text-xs text-text-muted">
                {body}
              </pre>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-accent">After</p>
              <pre
                className={cn(
                  "whitespace-pre-wrap rounded-md border border-accent/40 bg-accent-soft p-3 font-mono text-xs text-text"
                )}
              >
                {preview?.output}
              </pre>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setPreview(null)}>
              <X className="h-3.5 w-3.5" /> Discard
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => {
                if (!preview) return;
                onApply(preview.output, aiActionLabel(preview.action, { tone }));
                toast.success(`${aiActionLabel(preview.action, { tone })} applied`);
                setPreview(null);
              }}
            >
              <Check className="h-3.5 w-3.5" /> Apply to prompt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
