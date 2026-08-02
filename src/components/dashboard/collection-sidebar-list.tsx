"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FolderKanban, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { NameDialog } from "@/components/prompts/name-dialog";
import { ConfirmDialog } from "@/components/prompts/confirm-dialog";
import type { Collection } from "@/types/prompt";

export function CollectionSidebarList() {
  const collections = useStore((s) => s.collections);
  const addCollection = useStore((s) => s.addCollection);
  const renameCollection = useStore((s) => s.renameCollection);
  const deleteCollection = useStore((s) => s.deleteCollection);

  const pathname = usePathname();

  const [creating, setCreating] = React.useState(false);
  const [renaming, setRenaming] = React.useState<Collection | null>(null);
  const [deleting, setDeleting] = React.useState<Collection | null>(null);

  const sorted = React.useMemo(
    () => [...collections].sort((a, b) => a.name.localeCompare(b.name)),
    [collections]
  );

  return (
    <div>
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-text-faint">Collections</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          aria-label="New collection"
          onClick={() => setCreating(true)}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="mt-1 flex flex-col gap-0.5">
        {sorted.map((collection) => {
          const active = pathname === `/promptforge/collections/${collection.id}`;
          return (
            <div
              key={collection.id}
              className={cn(
                "group flex items-center gap-1 rounded-md pr-1 text-sm transition-colors",
                active ? "bg-accent-soft text-accent" : "text-text-muted hover:bg-surface hover:text-text"
              )}
            >
              <Link
                href={`/promptforge/collections/${collection.id}`}
                className="flex flex-1 min-w-0 items-center gap-2 py-1.5 pl-2"
              >
                <FolderKanban className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{collection.name}</span>
                <span className="ml-auto shrink-0 text-xs text-text-faint">
                  {collection.promptIds.length}
                </span>
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="shrink-0 rounded p-1 opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
                    aria-label={`${collection.name} options`}
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem className="gap-2" onSelect={() => setRenaming(collection)}>
                    <Pencil className="h-3.5 w-3.5" /> Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="gap-2 text-danger focus:text-danger"
                    onSelect={() => setDeleting(collection)}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        })}
        {sorted.length === 0 && <p className="px-2 py-1 text-xs text-text-faint">No collections yet.</p>}
      </div>

      <NameDialog
        open={creating}
        onOpenChange={setCreating}
        title="New collection"
        label="Collection name"
        confirmLabel="Create"
        onSubmit={(name) => addCollection(name)}
      />
      <NameDialog
        open={renaming !== null}
        onOpenChange={(o) => !o && setRenaming(null)}
        title="Rename collection"
        label="Collection name"
        initialValue={renaming?.name ?? ""}
        onSubmit={(name) => renaming && renameCollection(renaming.id, name)}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete "${deleting?.name}"?`}
        description="This removes the collection. The prompts inside it aren't deleted."
        confirmLabel="Delete collection"
        onConfirm={() => deleting && deleteCollection(deleting.id)}
      />
    </div>
  );
}
