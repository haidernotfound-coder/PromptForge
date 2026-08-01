"use client";

import * as React from "react";
import { toast } from "sonner";
import { Check, Loader2, Sparkles, Wand2, X, Gauge, ThumbsUp, ThumbsDown, Lightbulb, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
  runAiAction,
  aiActionLabel,
  critiquePrompt,
  type AiActionType,
  type RewriteTone,
  type PromptCritique,
} from "@/lib/ai";
import { extractVariables } from "@/components/prompts/editor-toolbar";
import { VariableFillModal } from "@/components/prompts/variable-fill-modal";
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
  const [aiConfigured, setAiConfigured] = React.useState<boolean | null>(null);
  const [preview, setPreview] = React.useState<{ action: AiActionType; output: string; summary: string } | null>(
    null
  );
  // When the prompt body contains {{variables}}, an action click opens the
  // fill-in modal first instead of running immediately.
  const [variablePrompt, setVariablePrompt] = React.useState<AiActionType | null>(null);
  const variables = React.useMemo(() => extractVariables(body), [body]);

  // AI Prompt Critic — separate from the four text-transform actions above,
  // since it produces a structured analysis rather than a straight rewrite.
  const [criticLoading, setCriticLoading] = React.useState(false);
  const [critique, setCritique] = React.useState<PromptCritique | null>(null);
  const [criticOpen, setCriticOpen] = React.useState(false);
  const [fixingAutomatically, setFixingAutomatically] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/ai")
      .then((res) => (res.ok ? res.json() : { configured: false }))
      .then((data) => {
        if (!cancelled) setAiConfigured(Boolean(data.configured));
      })
      .catch(() => {
        if (!cancelled) setAiConfigured(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function runWithBody(action: AiActionType, input: string) {
    setPending(action);
    try {
      const result = await runAiAction(action, input, { tone });
      setPreview({ action: result.action, output: result.output, summary: result.summary });
    } finally {
      setPending(null);
    }
  }

  function run(action: AiActionType) {
    if (!body.trim()) {
      toast.error("Write a prompt body first");
      return;
    }
    if (variables.length > 0) {
      // Let the person fill in real values first — the AI action then runs
      // against the filled-in content instead of the raw {{placeholders}}.
      setVariablePrompt(action);
      return;
    }
    void runWithBody(action, body);
  }

  async function runCritic() {
    if (!body.trim()) {
      toast.error("Write a prompt body first");
      return;
    }
    setCriticLoading(true);
    setCriticOpen(true);
    try {
      const result = await critiquePrompt(body);
      setCritique(result);
    } catch {
      toast.error("Couldn't analyze this prompt — try again.");
      setCriticOpen(false);
    } finally {
      setCriticLoading(false);
    }
  }

  function fixAutomatically() {
    if (!critique) return;
    setFixingAutomatically(true);
    onApply(critique.fixedPrompt, "Critic auto-fix");
    toast.success("Applied the Critic's suggested fixes");
    setFixingAutomatically(false);
    setCriticOpen(false);
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-1.5 text-base">
            <Sparkles className="h-4 w-4 text-accent" /> AI assist
          </CardTitle>
          <CardDescription>
            {aiConfigured === null
              ? "Checking AI provider…"
              : aiConfigured
                ? "Powered by Groq (Llama 3.1 8B Instant) — real model calls."
                : "Runs locally in demo mode — set GROQ_API_KEY to wire up a real model provider."}
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
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending !== null}
              onClick={() => void runCritic()}
              className="gap-1.5"
              title="Score this prompt and get actionable suggestions"
            >
              <Gauge className="h-3.5 w-3.5" />
              Critic
            </Button>
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

      <Dialog
        open={criticOpen}
        onOpenChange={(open) => {
          setCriticOpen(open);
          if (!open) setCritique(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5">
              <Gauge className="h-4 w-4 text-accent" /> Prompt Critic
            </DialogTitle>
            <DialogDescription>Quality score, strengths, weaknesses, and actionable suggestions.</DialogDescription>
          </DialogHeader>

          {criticLoading || !critique ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-text-faint">
              <Loader2 className="h-4 w-4 animate-spin" /> Analyzing your prompt…
            </div>
          ) : (
            <div className="max-h-[26rem] space-y-4 overflow-y-auto pr-1">
              <div className="flex items-center gap-3 rounded-md border border-border bg-surface p-3">
                <div
                  className={cn(
                    "flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 font-display text-lg font-semibold",
                    critique.score >= 80
                      ? "border-green-500 text-green-500"
                      : critique.score >= 60
                        ? "border-brass text-brass"
                        : "border-danger text-danger"
                  )}
                >
                  {critique.score}
                </div>
                <div>
                  <p className="text-sm font-medium text-text">
                    {critique.score >= 80 ? "Strong prompt" : critique.score >= 60 ? "Decent, room to improve" : "Needs work"}
                  </p>
                  <p className="text-xs text-text-faint">Score out of 100</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-text">
                    <ThumbsUp className="h-3.5 w-3.5 text-green-500" /> Strengths
                  </p>
                  <ul className="space-y-1">
                    {critique.strengths.map((s, i) => (
                      <li key={i} className="text-xs text-text-muted">
                        · {s}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="space-y-1.5">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-text">
                    <ThumbsDown className="h-3.5 w-3.5 text-danger" /> Weaknesses
                  </p>
                  <ul className="space-y-1">
                    {critique.weaknesses.map((w, i) => (
                      <li key={i} className="text-xs text-text-muted">
                        · {w}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="flex items-center gap-1.5 text-xs font-medium text-text">
                  <Lightbulb className="h-3.5 w-3.5 text-brass" /> Suggestions
                </p>
                <ul className="space-y-1">
                  {critique.suggestions.map((s, i) => (
                    <li key={i} className="text-xs text-text-muted">
                      · {s}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setCriticOpen(false)}>
              <X className="h-3.5 w-3.5" /> Close
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              disabled={!critique || criticLoading || fixingAutomatically}
              onClick={fixAutomatically}
            >
              <Wrench className="h-3.5 w-3.5" /> Fix Automatically
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <VariableFillModal
        open={variablePrompt !== null}
        onOpenChange={(open) => !open && setVariablePrompt(null)}
        body={body}
        variables={variables}
        actionLabel={variablePrompt ? aiActionLabel(variablePrompt, { tone }) : ""}
        onConfirm={(filledBody) => {
          const action = variablePrompt;
          setVariablePrompt(null);
          if (action) void runWithBody(action, filledBody);
        }}
      />
    </>
  );
}
