"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2, Play, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
// Reused as-is from CodeForge rather than duplicated — it's a generic
// "copyable output block" with no code-specific behavior when isCode=false.
import { CodeForgeOutputBlock } from "@/components/codeforge/code-block";
import { runStudyForgeTool, studyForgeToolMeta, type StudyForgeTool } from "@/lib/studyforge";

export function StudyForgeToolPanel({ tool }: { tool: StudyForgeTool }) {
  const meta = studyForgeToolMeta(tool);
  const [input, setInput] = React.useState("");
  const [detail, setDetail] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [output, setOutput] = React.useState("");
  const [configured, setConfigured] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/studyforge")
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

  // Reset the working area when navigating between tools (this component
  // is reused across every /studyforge/<tool> route).
  React.useEffect(() => {
    setInput("");
    setOutput("");
    setDetail("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool]);

  async function run() {
    if (!input.trim()) {
      toast.error(`${meta.inputLabel} is empty`);
      return;
    }
    setLoading(true);
    setOutput("");
    try {
      const result = await runStudyForgeTool(tool, input, { detail });
      setOutput(result.output);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-2xl font-semibold tracking-tight">{meta.label}</h1>
          {configured === false && (
            <Badge variant="brass">Demo mode — no StudyForge key configured</Badge>
          )}
          {configured === true && <Badge variant="success">Live</Badge>}
        </div>
        <p className="mt-1 text-sm text-text-muted">{meta.description}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{meta.inputLabel}</CardTitle>
            <CardDescription>Write or paste below, then run {meta.label.toLowerCase()}.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={meta.inputPlaceholder}
              rows={14}
              className="text-sm"
            />
            {meta.needsDetail && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-muted">{meta.detailLabel}</label>
                <Input
                  value={detail}
                  onChange={(e) => setDetail(e.target.value)}
                  placeholder={meta.detailPlaceholder}
                />
              </div>
            )}
            <Button onClick={run} disabled={loading} className="gap-1.5">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Run {meta.label}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-accent" /> Result
            </CardTitle>
            <CardDescription>
              {configured
                ? "Powered by StudyForge's Groq key pool."
                : "Demo output — set STUDYFORGE_GROQ_API_KEY_1 (or up to _10) for real results."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CodeForgeOutputBlock content={output} isCode={false} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
