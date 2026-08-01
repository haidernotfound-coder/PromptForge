"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { MoreHorizontal, Pencil, TagsIcon, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { TagColorDot } from "@/components/prompts/tag-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { NameDialog } from "@/components/prompts/name-dialog";
import { ConfirmDialog } from "@/components/prompts/confirm-dialog";
import { TAG_COLORS, type Tag } from "@/types/prompt";

export function TagSidebarList() {
  const tags = useStore((s) => s.tags);
  const prompts = useStore((s) => s.prompts);
  const addTag = useStore((s) => s.addTag);
  const renameTag = useStore((s) => s.renameTag);
  const recolorTag = useStore((s) => s.recolorTag);
  const deleteTag = useStore((s) => s.deleteTag);

  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTag = searchParams.get("tag");

  const [creating, setCreating] = React.useState(false);
  const [renaming, setRenaming] = React.useState<Tag | null>(null);
  const [deleting, setDeleting] = React.useState<Tag | null>(null);

  const counts = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const p of prompts) for (const tid of p.tagIds) map.set(tid, (map.get(tid) ?? 0) + 1);
    return map;
  }, [prompts]);

  const sorted = React.useMemo(() => [...tags].sort((a, b) => a.name.localeCompare(b.name)), [tags]);

  return (
    <div>
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-text-faint">Tags</span>
        <Button variant="ghost" size="icon" className="h-6 w-6" aria-label="New tag" onClick={() => setCreating(true)}>
          <TagsIcon className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="mt-1 flex flex-col gap-0.5">
        {sorted.map((tag) => {
          const active = pathname === "/dashboard/prompts" && activeTag === tag.id;
          return (
            <div
              key={tag.id}
              className={cn(
                "group flex items-center gap-1 rounded-md pr-1 text-sm transition-colors",
                active ? "bg-accent-soft text-accent" : "text-text-muted hover:bg-surface hover:text-text"
              )}
            >
              <Link href={`/dashboard/prompts?tag=${tag.id}`} className="flex flex-1 min-w-0 items-center gap-2 py-1.5 pl-2">
                <TagColorDot color={tag.color} />
                <span className="truncate">{tag.name}</span>
                {(counts.get(tag.id) ?? 0) > 0 && (
                  <span className="ml-auto shrink-0 text-xs text-text-faint">{counts.get(tag.id)}</span>
                )}
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="shrink-0 rounded p-1 opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
                    aria-label={`${tag.name} tag options`}
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem className="gap-2" onSelect={() => setRenaming(tag)}>
                    <Pencil className="h-3.5 w-3.5" /> Rename
                  </DropdownMenuItem>
                  <div className="flex items-center gap-1.5 px-2 py-1.5">
                    {TAG_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        aria-label={`Set color ${c}`}
                        onClick={() => recolorTag(tag.id, c)}
                        className={cn(
                          "h-4 w-4 rounded-full ring-offset-1 ring-offset-surface-raised transition-shadow",
                          tag.color === c && "ring-2 ring-accent"
                        )}
                      >
                        <TagColorDot color={c} className="h-4 w-4" />
                      </button>
                    ))}
                  </div>
                  <DropdownMenuItem className="gap-2 text-danger focus:text-danger" onSelect={() => setDeleting(tag)}>
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        })}
        {sorted.length === 0 && <p className="px-2 py-1 text-xs text-text-faint">No tags yet.</p>}
      </div>

      <NameDialog
        open={creating}
        onOpenChange={setCreating}
        title="New tag"
        label="Tag name"
        confirmLabel="Create"
        onSubmit={(name) => addTag(name)}
      />
      <NameDialog
        open={renaming !== null}
        onOpenChange={(o) => !o && setRenaming(null)}
        title="Rename tag"
        label="Tag name"
        initialValue={renaming?.name ?? ""}
        onSubmit={(name) => renaming && renameTag(renaming.id, name)}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete "${deleting?.name}"?`}
        description="This removes the tag from every prompt. This can't be undone."
        confirmLabel="Delete tag"
        onConfirm={() => deleting && deleteTag(deleting.id)}
      />
    </div>
  );
}
