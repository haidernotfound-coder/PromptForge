"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { Copy, Globe2, Lock } from "lucide-react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TagBadge } from "@/components/prompts/tag-badge";
import { modelLabel } from "@/types/prompt";

/**
 * Public share view for a single prompt.
 *
 * There's still no backend (that's Phase 7), so this reads straight out of
 * the same localStorage-backed store as the dashboard. That means the link
 * only actually resolves in the same browser/device the prompt was shared
 * from — which is exactly what the "demo-mode link" notice in ShareDialog
 * tells people up front. Once Phase 7 wires up Supabase, this route swaps
 * to a real server fetch by id with no change to the UI below.
 */
export default function SharedPromptPage() {
  const params = useParams<{ id: string }>();
  const prompt = useStore((s) => s.prompts.find((p) => p.id === params.id));
  const tags = useStore((s) => s.tags);
  const hasHydrated = useStore((s) => s.hasHydrated);

  if (!hasHydrated) {
    return <div className="container py-24" />;
  }

  if (!prompt || !prompt.isPublic) {
    return (
      <div className="container flex flex-col items-center gap-3 py-32 text-center">
        <Lock className="h-8 w-8 text-text-faint" />
        <h1 className="font-display text-2xl font-semibold">This prompt isn&apos;t public</h1>
        <p className="max-w-sm text-text-muted">
          Either it was never shared, the link is wrong, or it was made private again — and (in this
          demo build) it can only be found on the browser it was shared from.
        </p>
        <Button asChild className="mt-4">
          <Link href="/">Back to NexPrompt</Link>
        </Button>
      </div>
    );
  }

  const promptTags = prompt.tagIds.map((id) => tags.find((t) => t.id === id)).filter(Boolean);

  return (
    <div className="container max-w-2xl py-16">
      <div className="mb-6 flex items-center gap-2 text-xs font-medium text-accent">
        <Globe2 className="h-3.5 w-3.5" />
        Publicly shared prompt
      </div>
      <h1 className="font-display text-3xl font-semibold tracking-tight">{prompt.title}</h1>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-text-faint">
        <span>{modelLabel(prompt.model)}</span>
        {promptTags.length > 0 && <span aria-hidden>·</span>}
        {promptTags.map((tag) => (
          <TagBadge key={tag!.id} tag={tag!} />
        ))}
      </div>

      <Card className="mt-6 p-5">
        <pre className="whitespace-pre-wrap break-words font-mono text-sm text-text">{prompt.body}</pre>
      </Card>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button
          className="gap-1.5"
          onClick={() => {
            navigator.clipboard.writeText(prompt.body);
            toast.success("Prompt copied to clipboard");
          }}
        >
          <Copy className="h-4 w-4" /> Copy prompt
        </Button>
        <Button variant="outline" asChild>
          <Link href="/signup">Sign up to save your own</Link>
        </Button>
      </div>
    </div>
  );
}
