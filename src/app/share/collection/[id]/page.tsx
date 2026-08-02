"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Globe2, Lock } from "lucide-react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { modelLabel } from "@/types/prompt";

export default function SharedCollectionPage() {
  const params = useParams<{ id: string }>();
  const collection = useStore((s) => s.collections.find((c) => c.id === params.id));
  const prompts = useStore((s) => s.prompts);
  const hasHydrated = useStore((s) => s.hasHydrated);

  if (!hasHydrated) {
    return <div className="container py-24" />;
  }

  if (!collection || !collection.isPublic) {
    return (
      <div className="container flex flex-col items-center gap-3 py-32 text-center">
        <Lock className="h-8 w-8 text-text-faint" />
        <h1 className="font-display text-2xl font-semibold">This collection isn&apos;t public</h1>
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

  const items = collection.promptIds
    .map((id) => prompts.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  return (
    <div className="container max-w-2xl py-16">
      <div className="mb-6 flex items-center gap-2 text-xs font-medium text-accent">
        <Globe2 className="h-3.5 w-3.5" />
        Publicly shared collection
      </div>
      <h1 className="font-display text-3xl font-semibold tracking-tight">{collection.name}</h1>
      {collection.description && (
        <p className="mt-2 text-text-muted">{collection.description}</p>
      )}
      <p className="mt-1 text-sm text-text-faint">
        {items.length} prompt{items.length === 1 ? "" : "s"}
      </p>

      <div className="mt-6 space-y-3">
        {items.map((prompt) => (
          <Card key={prompt.id} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-display text-sm font-semibold">{prompt.title}</h2>
              <span className="shrink-0 text-xs text-text-faint">{modelLabel(prompt.model)}</span>
            </div>
            <p className="mt-1.5 line-clamp-3 font-mono text-xs text-text-muted">{prompt.body}</p>
          </Card>
        ))}
        {items.length === 0 && (
          <p className="text-sm text-text-faint">This collection doesn&apos;t have any prompts yet.</p>
        )}
      </div>

      <Button asChild variant="outline" className="mt-8">
        <Link href="/signup">Sign up to build your own</Link>
      </Button>
    </div>
  );
}
