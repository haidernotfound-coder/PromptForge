"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2, Sparkles, Download, Presentation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  PPTFORGE_STYLES,
  PPTFORGE_MIN_SLIDES,
  PPTFORGE_MAX_SLIDES,
  generatePptForge,
  downloadPptForgeBlob,
  type PptForgeStyle,
} from "@/lib/pptforge";

export default function PptForgePage() {
  const [topic, setTopic] = React.useState("");
  const [detail, setDetail] = React.useState("");
  const [slideCount, setSlideCount] = React.useState(8);
  const [style, setStyle] = React.useState<PptForgeStyle>("professional");
  const [loading, setLoading] = React.useState(false);
  const [configured, setConfigured] = React.useState<boolean | null>(null);
  const [lastFile, setLastFile] = React.useState<{ blob: Blob; filename: string } | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/pptforge")
      .then((res) => (res.ok ? res.json() : { configured: false }))
      .then((data) => {
        if (!cancelled) setConfigured(Boolean(data.configured));
      })
      .catch(() => {
        if (!cancelled) setConfigured(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function run() {
    if (!topic.trim()) {
      toast.error("Enter a topic first");
      return;
    }
    setLoading(true);
    setLastFile(null);
    try {
      const result = await generatePptForge({ topic, slideCount, style, detail });
      if (!result.ok || !result.blob || !result.filename) {
        toast.error(result.error ?? "Could not generate that presentation");
        return;
      }
      setLastFile({ blob: result.blob, filename: result.filename });
      downloadPptForgeBlob(result.blob, result.filename);
      toast.success("Presentation generated");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-2xl font-semibold tracking-tight">PPTForge</h1>
          {configured === false && <Badge variant="danger">Not configured</Badge>}
          {configured === true && <Badge variant="success">Live</Badge>}
        </div>
        <p className="mt-1 text-sm text-text-muted">
          Enter a topic and get back a real, downloadable .pptx — structured slides, varied layouts, charts and
          tables where they help.
        </p>
      </div>

      {configured === false && (
        <div className="rounded-lg border border-dashed border-border p-4 text-sm text-text-muted">
          PPTForge needs a Groq API key configured on the server (<code>PPTFORGE_GROQ_API_KEY_1</code>, or the
          shared <code>GROQ_API_KEY_1</code>) before it can generate presentations.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Topic</CardTitle>
          <CardDescription>What should the deck be about?</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Onboarding plan for new sales hires, or The basics of quantum computing"
            rows={4}
            className="text-sm"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-muted">
                Slide count ({PPTFORGE_MIN_SLIDES}–{PPTFORGE_MAX_SLIDES})
              </label>
              <Input
                type="number"
                min={PPTFORGE_MIN_SLIDES}
                max={PPTFORGE_MAX_SLIDES}
                value={slideCount}
                onChange={(e) => {
                  const n = Number.parseInt(e.target.value, 10);
                  if (Number.isFinite(n)) {
                    setSlideCount(Math.min(PPTFORGE_MAX_SLIDES, Math.max(PPTFORGE_MIN_SLIDES, n)));
                  }
                }}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-muted">Style</label>
              <Select value={style} onValueChange={(v) => setStyle(v as PptForgeStyle)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PPTFORGE_STYLES.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-muted">Extra instructions (optional)</label>
            <Input
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="e.g. for a non-technical audience, focus on Q3 results, keep it upbeat"
            />
          </div>

          <p className="text-xs text-text-muted">
            {PPTFORGE_STYLES.find((s) => s.id === style)?.description}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={run} disabled={loading || configured === false} className="gap-1.5">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {loading ? "Generating…" : "Generate presentation"}
            </Button>
            {lastFile && (
              <Button
                variant="outline"
                className="gap-1.5"
                onClick={() => downloadPptForgeBlob(lastFile.blob, lastFile.filename)}
              >
                <Download className="h-4 w-4" /> Download again
              </Button>
            )}
          </div>

          {loading && (
            <div className="flex items-center gap-2 rounded-md border border-dashed border-border p-3 text-xs text-text-muted">
              <Presentation className="h-3.5 w-3.5 shrink-0" />
              Planning slides, choosing layouts, and building the .pptx file — this can take up to a minute for
              longer decks.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
