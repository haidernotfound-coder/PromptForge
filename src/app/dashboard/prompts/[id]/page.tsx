"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PromptEditor } from "@/components/prompts/prompt-editor";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";

export default function EditPromptPage({ params }: { params: { id: string } }) {
  const prompt = useStore((s) => s.prompts.find((p) => p.id === params.id));
  const hasHydrated = useStore((s) => s.hasHydrated);

  if (!hasHydrated) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="h-8 w-1/2 animate-pulse rounded bg-surface" />
        <div className="h-64 animate-pulse rounded-lg border border-border bg-surface" />
      </div>
    );
  }

  if (!prompt) {
    return (
      <div className="mx-auto max-w-3xl py-16 text-center">
        <p className="font-display text-lg font-semibold">Prompt not found</p>
        <p className="mt-1 text-sm text-text-muted">
          It may have been deleted, or the link is out of date.
        </p>
        <Button asChild variant="outline" className="mt-4 gap-1.5">
          <Link href="/dashboard/prompts">
            <ArrowLeft className="h-4 w-4" /> Back to prompts
          </Link>
        </Button>
      </div>
    );
  }

  return <PromptEditor prompt={prompt} />;
}
