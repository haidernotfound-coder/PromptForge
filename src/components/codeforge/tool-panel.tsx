"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2, Play, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CodeForgeOutputBlock } from "@/components/codeforge/code-block";
import { runCodeForgeTool, codeForgeToolMeta, type CodeForgeTool } from "@/lib/codeforge";

const LANGUAGES = [
  "JavaScript",
  "TypeScript",
  "Python",
  "Java",
  "C",
  "C++",
  "C#",
  "Go",
  "Rust",
  "Ruby",
  "PHP",
  "Swift",
  "Kotlin",
  "SQL",
  "Bash",
];

export function CodeForgeToolPanel({ tool }: { tool: CodeForgeTool }) {
  const meta = codeForgeToolMeta(tool);
  const [input, setInput] = React.useState("");
  const [language, setLanguage] = React.useState<string>("");
  const [targetLanguage, setTargetLanguage] = React.useState<string>(
    meta.needsTargetLanguage ? "Python" : ""
  );
  const [loading, setLoading] = React.useState(false);
  const [output, setOutput] = React.useState("");
  const [configured, setConfigured] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/codeforge")
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
  // is reused across every /codeforge/<tool> route).
  React.useEffect(() => {
    setInput("");
    setOutput("");
    setLanguage("");
    setTargetLanguage(meta.needsTargetLanguage ? "Python" : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool]);

  async function run() {
    if (!input.trim()) {
      toast.error(`${meta.inputLabel} is empty`);
      return;
    }
    if (meta.needsTargetLanguage && !targetLanguage.trim()) {
      toast.error("Choose a target language");
      return;
    }
    setLoading(true);
    setOutput("");
    try {
      const result = await runCodeForgeTool(tool, input, { language, targetLanguage });
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
            <Badge variant="brass">Demo mode — no CodeForge key configured</Badge>
          )}
          {configured === true && <Badge variant="success">Live</Badge>}
        </div>
        <p className="mt-1 text-sm text-text-muted">{meta.description}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{meta.inputLabel}</CardTitle>
            <CardDescription>Paste or write below, then run {meta.label.toLowerCase()}.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={meta.inputPlaceholder}
              rows={14}
              className="font-mono text-sm"
            />
            {(meta.needsLanguage || meta.needsTargetLanguage) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {meta.needsLanguage && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-text-muted">
                      {tool === "generate" ? "Target language (optional)" : "Language (optional, helps accuracy)"}
                    </label>
                    <Select value={language || undefined} onValueChange={setLanguage}>
                      <SelectTrigger>
                        <SelectValue placeholder="Auto-detect" />
                      </SelectTrigger>
                      <SelectContent>
                        {LANGUAGES.map((l) => (
                          <SelectItem key={l} value={l}>
                            {l}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {meta.needsTargetLanguage && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-text-muted">Convert to</label>
                    <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a language" />
                      </SelectTrigger>
                      <SelectContent>
                        {LANGUAGES.map((l) => (
                          <SelectItem key={l} value={l}>
                            {l}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
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
                ? "Powered by CodeForge's Groq key pool."
                : "Demo output — set CODEFORGE_GROQ_API_KEY_1 (or up to _7) for real results."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CodeForgeOutputBlock content={output} isCode={meta.outputIsCode} language={language || undefined} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
