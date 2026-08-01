"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LayoutTemplate, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { useStore } from "@/lib/store";
import { TEMPLATE_CATEGORIES, TEMPLATES, templatesByCategory } from "@/lib/templates";
import { modelLabel } from "@/types/prompt";
import { cn } from "@/lib/utils";

export function TemplateGallery() {
  const router = useRouter();
  const createFromTemplate = useStore((s) => s.createFromTemplate);
  const [category, setCategory] = React.useState<(typeof TEMPLATE_CATEGORIES)[number]>("All");
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    const base = templatesByCategory(category);
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (t) => t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || t.body.toLowerCase().includes(q)
    );
  }, [category, query]);

  function use(templateId: string) {
    const template = TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;
    const created = createFromTemplate({
      title: template.title,
      body: template.body,
      model: template.model,
      tagNames: template.tagNames,
    });
    toast.success("Prompt created from template");
    router.push(`/dashboard/prompts/${created.id}`);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-faint" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search templates…"
            className="pl-8"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {TEMPLATE_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                category === c
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-border text-text-muted hover:bg-surface"
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center">
          <LayoutTemplate className="mx-auto h-8 w-8 text-text-faint" />
          <p className="mt-3 text-sm text-text-muted">No templates match your search.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((t) => (
            <Card key={t.id} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline">{t.category}</Badge>
                  <span className="text-xs text-text-faint">{modelLabel(t.model)}</span>
                </div>
                <CardTitle className="text-base">{t.title}</CardTitle>
                <CardDescription>{t.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <pre className="line-clamp-4 whitespace-pre-wrap rounded-md bg-surface p-2.5 font-mono text-xs text-text-muted">
                  {t.body}
                </pre>
              </CardContent>
              <CardFooter>
                <Button size="sm" className="w-full" onClick={() => use(t.id)}>
                  Use template
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
