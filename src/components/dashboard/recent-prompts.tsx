"use client";

import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { modelLabel } from "@/types/prompt";

export function RecentPrompts() {
  const prompts = useStore((s) => s.prompts);
  const hasHydrated = useStore((s) => s.hasHydrated);

  const recent = [...prompts]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Recent prompts</CardTitle>
          <CardDescription>Your most recently updated work.</CardDescription>
        </div>
        <Button asChild variant="ghost" size="sm" className="gap-1">
          <Link href="/dashboard/prompts">
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {!hasHydrated ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-md bg-surface" />
            ))}
          </div>
        ) : recent.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <p className="text-sm text-text-muted">No prompts yet.</p>
            <Button asChild size="sm" className="gap-1.5">
              <Link href="/dashboard/prompts/new">
                <Plus className="h-4 w-4" /> Create your first prompt
              </Link>
            </Button>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {recent.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/dashboard/prompts/${p.id}`}
                  className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-accent"
                >
                  <span className="truncate font-medium">{p.title}</span>
                  <span className="shrink-0 text-xs text-text-faint">{modelLabel(p.model)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
