"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2, Play, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FlashcardDeck } from "@/components/studyforge/flashcard-deck";
import { runStudyForgeFlashcards, studyForgeToolMeta, type Flashcard } from "@/lib/studyforge";

export function StudyForgeFlashcardsPanel() {
  const meta = studyForgeToolMeta("flashcards");
  const [input, setInput] = React.useState("");
  const [detail, setDetail] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [cards, setCards] = React.useState<Flashcard[]>([]);
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

  async function run() {
    if (!input.trim()) {
      toast.error(`${meta.inputLabel} is empty`);
      return;
    }
    setLoading(true);
    setCards([]);
    try {
      const result = await runStudyForgeFlashcards(input, { detail });
      setCards(result.cards);
      if (result.cards.length === 0) {
        toast.error("Couldn't generate a flashcard deck — try rephrasing the topic.");
      }
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
            <CardDescription>Write or paste below, then generate your deck.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={meta.inputPlaceholder}
              rows={14}
              className="text-sm"
            />
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-muted">{meta.detailLabel}</label>
              <Input
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                placeholder={meta.detailPlaceholder}
              />
            </div>
            <Button onClick={run} disabled={loading} className="gap-1.5">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Generate Flashcards
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-accent" /> Deck
            </CardTitle>
            <CardDescription>
              {configured
                ? "Powered by StudyForge's Groq key pool."
                : "Demo deck — set STUDYFORGE_GROQ_API_KEY_1 (or up to _10) for real results."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-16 text-text-muted text-sm gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Generating deck…
              </div>
            ) : (
              <FlashcardDeck cards={cards} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
