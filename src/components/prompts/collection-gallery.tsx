"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { FolderKanban, Globe2, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NameDialog } from "@/components/prompts/name-dialog";
import { ConfirmDialog } from "@/components/prompts/confirm-dialog";
import { useStore } from "@/lib/store";
import type { Collection } from "@/types/prompt";

export function CollectionGallery() {
  const collections = useStore((s) => s.collections);
  const addCollection = useStore((s) => s.addCollection);
  const renameCollection = useStore((s) => s.renameCollection);
  const deleteCollection = useStore((s) => s.deleteCollection);

  const [creating, setCreating] = React.useState(false);
  const [renaming, setRenaming] = React.useState<Collection | null>(null);
  const [deleting, setDeleting] = React.useState<Collection | null>(null);

  const sorted = [...collections].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-end">
        <Button size="sm" className="gap-1.5" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> New collection
        </Button>
      </div>

      {sorted.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <FolderKanban className="h-8 w-8 text-text-faint" />
          <p className="text-sm text-text-muted">
            Collections group prompts together so you can share a curated set with one link.
          </p>
          <Button size="sm" onClick={() => setCreating(true)}>
            Create your first collection
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sorted.map((collection) => (
            <Card key={collection.id} className="group relative flex flex-col gap-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <Link
                  href={`/promptforge/collections/${collection.id}`}
                  className="min-w-0 flex-1 font-display text-sm font-semibold leading-tight hover:text-accent"
                >
                  <span className="line-clamp-1">{collection.name}</span>
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-label="Collection options">
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </Button>
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
              <Link href={`/promptforge/collections/${collection.id}`} className="flex-1">
                <p className="line-clamp-2 text-xs text-text-muted">
                  {collection.description || "No description yet."}
                </p>
              </Link>
              <div className="mt-1 flex items-center gap-3 border-t border-border pt-3 text-xs text-text-faint">
                <span>
                  {collection.promptIds.length} prompt{collection.promptIds.length === 1 ? "" : "s"}
                </span>
                {collection.isPublic && (
                  <span className="ml-auto flex items-center gap-1 text-accent">
                    <Globe2 className="h-3 w-3" /> Public
                  </span>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <NameDialog
        open={creating}
        onOpenChange={setCreating}
        title="New collection"
        label="Collection name"
        confirmLabel="Create"
        onSubmit={(name) => {
          const c = addCollection(name);
          toast.success("Collection created");
          return c;
        }}
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
        onConfirm={() => {
          if (!deleting) return;
          deleteCollection(deleting.id);
          toast.success("Collection deleted");
        }}
      />
    </div>
  );
}
