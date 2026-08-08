"use client";

import * as React from "react";
import Link from "next/link";
import { History, Trash2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  getPptForgeHistory,
  clearPptForgeHistory,
  type PptForgeHistoryEntry,
} from "@/lib/pptforge-history";
import { pptForgeStyleMeta, type PptForgeStyle } from "@/lib/pptforge";

export default function PptForgeHistoryPage() {
  const [entries, setEntries] = React.useState<PptForgeHistoryEntry[] | null>(null);

  React.useEffect(() => {
    setEntries(getPptForgeHistory());
  }, []);

  function clear() {
    clearPptForgeHistory();
    setEntries([]);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">History</h1>
          <p className="mt-1 text-sm text-text-muted">
            Recent decks you&apos;ve generated on this device. PPTForge streams each file straight to your
            downloads and doesn&apos;t store decks on the server, so this list — and re-download — only works
            locally in this browser.
          </p>
        </div>
        {entries && entries.length > 0 && (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={clear}>
            <Trash2 className="h-3.5 w-3.5" /> Clear history
          </Button>
        )}
      </div>

      {entries === null ? (
        <p className="text-sm text-text-muted">Loading…</p>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border py-20 text-center">
          <History className="h-8 w-8 text-text-faint" />
          <h2 className="font-display text-base font-semibold">No decks yet</h2>
          <p className="max-w-xs text-sm text-text-muted">
            Generate your first presentation and it&apos;ll show up here.
          </p>
          <Button asChild size="sm" className="gap-1.5">
            <Link href="/pptforge">
              <Sparkles className="h-3.5 w-3.5" /> Go to Generate
            </Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => {
            const meta = pptForgeStyleMeta(entry.style as PptForgeStyle);
            return (
              <Card key={entry.id}>
                <CardContent className="pt-5 flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{entry.topic}</p>
                    <p className="mt-1 text-xs text-text-muted">
                      {new Date(entry.createdAt).toLocaleString()} · {entry.slideCount} slides · {entry.filename}
                    </p>
                    {entry.detail && (
                      <p className="mt-1 text-xs text-text-faint truncate">Instructions: {entry.detail}</p>
                    )}
                  </div>
                  <Badge variant="slate" className="shrink-0">
                    {meta.label}
                  </Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
