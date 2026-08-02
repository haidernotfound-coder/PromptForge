"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { LayoutGrid, List, Plus, Search, Star, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PromptCard } from "@/components/prompts/prompt-card";
import { useStore } from "@/lib/store";
import { buildFolderTree, flattenFolderTree, folderAndDescendantIds } from "@/lib/folders";
import type { SortKey, ViewMode } from "@/types/prompt";
import { cn } from "@/lib/utils";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "updated", label: "Last updated" },
  { value: "created", label: "Date created" },
  { value: "title", label: "Title (A–Z)" },
  { value: "favorite", label: "Favorites first" },
];

export function PromptsBrowser({
  favoritesOnly = false,
  title,
  description,
}: {
  favoritesOnly?: boolean;
  title: string;
  description: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const prompts = useStore((s) => s.prompts);
  const folders = useStore((s) => s.folders);
  const tags = useStore((s) => s.tags);
  const hasHydrated = useStore((s) => s.hasHydrated);

  const [query, setQuery] = React.useState(searchParams.get("q") ?? "");
  const [view, setView] = React.useState<ViewMode>("grid");
  const sort = (searchParams.get("sort") as SortKey) || "updated";
  const folderFilter = searchParams.get("folder");
  const tagFilter = searchParams.get("tag");

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  // Debounce search into the URL so it's shareable without thrashing history.
  React.useEffect(() => {
    const handle = setTimeout(() => setParam("q", query || null), 250);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const folderOptions = React.useMemo(() => flattenFolderTree(buildFolderTree(folders)), [folders]);
  const sortedTags = React.useMemo(() => [...tags].sort((a, b) => a.name.localeCompare(b.name)), [tags]);

  const scopedFolderIds = folderFilter ? folderAndDescendantIds(folders, folderFilter) : null;

  const filtered = prompts
    .filter((p) => (favoritesOnly ? p.isFavorite : true))
    .filter((p) => (scopedFolderIds ? (p.folderId ? scopedFolderIds.has(p.folderId) : false) : true))
    .filter((p) => (tagFilter ? p.tagIds.includes(tagFilter) : true))
    .filter((p) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        p.body.toLowerCase().includes(q) ||
        p.tagIds.some((tid) => tags.find((t) => t.id === tid)?.name.toLowerCase().includes(q))
      );
    });

  const sorted = [...filtered].sort((a, b) => {
    switch (sort) {
      case "title":
        return a.title.localeCompare(b.title);
      case "created":
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case "favorite":
        return Number(b.isFavorite) - Number(a.isFavorite) || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      case "updated":
      default:
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    }
  });

  const activeFolderName = folderFilter ? folders.find((f) => f.id === folderFilter)?.name : null;
  const activeTagName = tagFilter ? tags.find((t) => t.id === tagFilter)?.name : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-text-muted">{description}</p>
        </div>
        <Button asChild size="sm" className="gap-1.5">
          <Link href="/promptforge/prompts/new">
            <Plus className="h-4 w-4" /> New prompt
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-faint" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search prompts, bodies, tags…"
            className="pl-9"
          />
        </div>

        {!favoritesOnly && (
          <Select value={folderFilter ?? "all"} onValueChange={(v) => setParam("folder", v === "all" ? null : v)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All folders" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All folders</SelectItem>
              {folderOptions.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {"\u00A0\u00A0".repeat(f.depth)}
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select value={tagFilter ?? "all"} onValueChange={(v) => setParam("tag", v === "all" ? null : v)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All tags" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tags</SelectItem>
            {sortedTags.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sort} onValueChange={(v) => setParam("sort", v)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-0.5 rounded-md border border-border p-0.5">
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-8 w-8", view === "grid" && "bg-surface")}
            aria-label="Grid view"
            aria-pressed={view === "grid"}
            onClick={() => setView("grid")}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-8 w-8", view === "list" && "bg-surface")}
            aria-label="List view"
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {(activeFolderName || activeTagName) && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
          Filtered by:
          {activeFolderName && (
            <button
              onClick={() => setParam("folder", null)}
              className="flex items-center gap-1 rounded-full bg-surface px-2 py-1 hover:bg-border"
            >
              {activeFolderName} <X className="h-3 w-3" />
            </button>
          )}
          {activeTagName && (
            <button
              onClick={() => setParam("tag", null)}
              className="flex items-center gap-1 rounded-full bg-surface px-2 py-1 hover:bg-border"
            >
              {activeTagName} <X className="h-3 w-3" />
            </button>
          )}
        </div>
      )}

      {!hasHydrated ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-lg border border-border bg-surface" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState favoritesOnly={favoritesOnly} hasQuery={!!query || !!folderFilter || !!tagFilter} />
      ) : (
        <div
          className={cn(
            view === "grid"
              ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
              : "flex flex-col gap-3"
          )}
        >
          {sorted.map((p) => (
            <PromptCard key={p.id} prompt={p} view={view} />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ favoritesOnly, hasQuery }: { favoritesOnly: boolean; hasQuery: boolean }) {
  if (favoritesOnly) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-16 text-center">
        <Star className="h-8 w-8 text-text-faint" />
        <div>
          <p className="font-medium">No favorites yet</p>
          <p className="text-sm text-text-muted">Star a prompt to pin it here for quick access.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-16 text-center">
      <Search className="h-8 w-8 text-text-faint" />
      <div>
        <p className="font-medium">{hasQuery ? "No prompts match your filters" : "No prompts yet"}</p>
        <p className="text-sm text-text-muted">
          {hasQuery ? "Try a different search or clear your filters." : "Create your first prompt to get started."}
        </p>
      </div>
      {!hasQuery && (
        <Button asChild size="sm" className="gap-1.5 mt-1">
          <Link href="/promptforge/prompts/new">
            <Plus className="h-4 w-4" /> New prompt
          </Link>
        </Button>
      )}
    </div>
  );
}
