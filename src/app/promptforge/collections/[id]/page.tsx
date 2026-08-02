"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Plus, Share2, Trash2, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ShareDialog } from "@/components/prompts/share-dialog";
import { ConfirmDialog } from "@/components/prompts/confirm-dialog";
import { modelLabel } from "@/types/prompt";

export default function CollectionDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const collection = useStore((s) => s.collections.find((c) => c.id === params.id));
  const prompts = useStore((s) => s.prompts);
  const hasHydrated = useStore((s) => s.hasHydrated);
  const renameCollection = useStore((s) => s.renameCollection);
  const deleteCollection = useStore((s) => s.deleteCollection);
  const addPromptToCollection = useStore((s) => s.addPromptToCollection);
  const removePromptFromCollection = useStore((s) => s.removePromptFromCollection);
  const setCollectionPublic = useStore((s) => s.setCollectionPublic);

  const [name, setName] = React.useState(collection?.name ?? "");
  const [description, setDescription] = React.useState(collection?.description ?? "");
  const [showAdd, setShowAdd] = React.useState(false);
  const [showShare, setShowShare] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [query, setQuery] = React.useState("");

  React.useEffect(() => {
    if (collection) {
      setName(collection.name);
      setDescription(collection.description);
    }
  }, [collection?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!hasHydrated) return null;

  if (!collection) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-center">
        <p className="text-text-muted">This collection doesn&apos;t exist, or was deleted.</p>
        <Button asChild variant="outline">
          <Link href="/promptforge/collections">Back to collections</Link>
        </Button>
      </div>
    );
  }

  const items = collection.promptIds
    .map((id) => prompts.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  const addable = prompts.filter(
    (p) =>
      !collection.promptIds.includes(p.id) &&
      p.title.toLowerCase().includes(query.trim().toLowerCase())
  );

  function saveMeta() {
    if (!collection) return;
    renameCollection(collection.id, name, description);
    toast.success("Collection updated");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-16">
      <Button variant="ghost" size="sm" className="gap-1.5 -ml-2" asChild>
        <Link href="/promptforge/collections">
          <ArrowLeft className="h-3.5 w-3.5" /> Collections
        </Link>
      </Button>

      <div className="flex items-start justify-between gap-4">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={saveMeta}
          placeholder="Untitled collection"
          className="h-auto border-none bg-transparent px-0 font-display text-2xl font-semibold shadow-none focus-visible:ring-0"
        />
        <div className="flex shrink-0 items-center gap-1.5">
          <Button variant="ghost" size="icon" aria-label="Share collection" onClick={() => setShowShare(true)}>
            <Share2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Delete collection"
            className="text-danger hover:text-danger"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="collection-description">Description</Label>
        <Textarea
          id="collection-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={saveMeta}
          placeholder="What is this collection for?"
          rows={2}
        />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text-muted">
            {items.length} prompt{items.length === 1 ? "" : "s"}
          </h2>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowAdd(true)}>
            <Plus className="h-3.5 w-3.5" /> Add prompt
          </Button>
        </div>

        <div className="mt-3 space-y-2">
          {items.map((prompt) => (
            <Card key={prompt.id} className="flex items-start justify-between gap-3 p-4">
              <div className="min-w-0 flex-1">
                <Link
                  href={`/promptforge/prompts/${prompt.id}`}
                  className="font-display text-sm font-semibold hover:text-accent"
                >
                  {prompt.title}
                </Link>
                <p className="mt-1 line-clamp-2 font-mono text-xs text-text-muted">{prompt.body}</p>
                <p className="mt-1 text-xs text-text-faint">{modelLabel(prompt.model)}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                aria-label={`Remove ${prompt.title} from collection`}
                onClick={() => removePromptFromCollection(collection.id, prompt.id)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </Card>
          ))}
          {items.length === 0 && (
            <Card className="p-6 text-center text-sm text-text-faint">
              No prompts yet — add some from your library.
            </Card>
          )}
        </div>
      </div>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add prompts</DialogTitle>
            <DialogDescription>Search your library and add prompts to this collection.</DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search prompts…"
          />
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {addable.map((prompt) => (
              <button
                key={prompt.id}
                type="button"
                onClick={() => {
                  addPromptToCollection(collection.id, prompt.id);
                  toast.success(`Added "${prompt.title}"`);
                }}
                className="flex w-full items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-left text-sm hover:border-accent hover:bg-accent-soft"
              >
                <span className="min-w-0 flex-1 truncate">{prompt.title}</span>
                <Plus className="h-3.5 w-3.5 shrink-0 text-text-faint" />
              </button>
            ))}
            {addable.length === 0 && (
              <p className="py-4 text-center text-sm text-text-faint">No matching prompts.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ShareDialog
        open={showShare}
        onOpenChange={setShowShare}
        kind="collection"
        isPublic={collection.isPublic}
        onSetPublic={(v) => {
          setCollectionPublic(collection.id, v);
          toast.success(v ? "Collection is now public" : "Collection is now private");
        }}
        path={`/share/collection/${collection.id}`}
        itemLabel={collection.name}
      />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete "${collection.name}"?`}
        description="This can't be undone. The prompts inside it won't be deleted."
        confirmLabel="Delete collection"
        onConfirm={() => {
          deleteCollection(collection.id);
          toast.success("Collection deleted");
          router.push("/promptforge/collections");
        }}
      />
    </div>
  );
}
