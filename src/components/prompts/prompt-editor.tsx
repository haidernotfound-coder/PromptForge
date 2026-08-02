"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, History, Save, Share2, Star, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { EditorToolbar, applyWrap, extractVariables, type WrapKind } from "@/components/prompts/editor-toolbar";
import { AiPanel } from "@/components/prompts/ai-panel";
import { RecipeForge } from "@/components/prompts/recipe-forge";
import { ForgeAiPanel } from "@/components/prompts/forge-ai";
import { TagMultiselect } from "@/components/prompts/tag-multiselect";
import { TagBadge } from "@/components/prompts/tag-badge";
import { FolderSelect } from "@/components/prompts/folder-select";
import { ConfirmDialog } from "@/components/prompts/confirm-dialog";
import { ShareDialog } from "@/components/prompts/share-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useStore } from "@/lib/store";
import { trackEvent } from "@/lib/track";
import { MODELS, type Prompt } from "@/types/prompt";
import { cn } from "@/lib/utils";

export function PromptEditor({ prompt }: { prompt?: Prompt }) {
  const router = useRouter();
  const isNew = !prompt;

  const tags = useStore((s) => s.tags);
  const addPrompt = useStore((s) => s.addPrompt);
  const updatePrompt = useStore((s) => s.updatePrompt);
  const deletePrompt = useStore((s) => s.deletePrompt);
  const duplicatePrompt = useStore((s) => s.duplicatePrompt);
  const toggleFavorite = useStore((s) => s.toggleFavorite);
  const restoreVersion = useStore((s) => s.restoreVersion);
  const setPromptPublic = useStore((s) => s.setPromptPublic);

  const [title, setTitle] = React.useState(prompt?.title ?? "");
  const [body, setBody] = React.useState(prompt?.body ?? "");
  const [model, setModel] = React.useState<string>(prompt?.model ?? "none");
  const [folderId, setFolderId] = React.useState<string | null>(prompt?.folderId ?? null);
  const [tagIds, setTagIds] = React.useState<string[]>(prompt?.tagIds ?? []);
  const [dirty, setDirty] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [showVersions, setShowVersions] = React.useState(false);
  const [showShare, setShowShare] = React.useState(false);

  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => setDirty(true), [title, body, model, folderId, tagIds]);

  const variables = React.useMemo(() => extractVariables(body), [body]);
  const wordCount = React.useMemo(() => (body.trim() ? body.trim().split(/\s+/).length : 0), [body]);
  const selectedTags = tagIds.map((id) => tags.find((t) => t.id === id)).filter(Boolean);

  function handleFormat(kind: WrapKind) {
    const el = textareaRef.current;
    if (!el) return;
    const result = applyWrap(kind, body, el.selectionStart, el.selectionEnd);
    setBody(result.value);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(result.start, result.end);
    });
  }

  function save() {
    if (!title.trim()) {
      toast.error("Give your prompt a title first");
      return;
    }
    const modelValue = model === "none" ? null : model;
    if (isNew) {
      const created = addPrompt({ title, body, model: modelValue, folderId, tagIds });
      trackEvent("prompt.created", { promptId: created.id });
      toast.success("Prompt created");
      router.push(`/promptforge/prompts/${created.id}`);
    } else {
      updatePrompt(prompt!.id, { title, body, model: modelValue as Prompt["model"], folderId, tagIds }, { snapshot: true });
      setDirty(false);
      toast.success("Prompt saved");
    }
  }

  // Cmd/Ctrl+S to save
  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        save();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, body, model, folderId, tagIds]);

  return (
    <>
    <div className="mx-auto max-w-3xl space-y-6 pb-16">
      <div className="flex items-start justify-between gap-4">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Untitled prompt"
          className="h-auto border-none bg-transparent px-0 font-display text-2xl font-semibold shadow-none focus-visible:ring-0"
        />
        <div className="flex shrink-0 items-center gap-1.5">
          {!isNew && (
            <Button
              variant="ghost"
              size="icon"
              aria-label={prompt!.isFavorite ? "Remove from favorites" : "Add to favorites"}
              onClick={() => toggleFavorite(prompt!.id)}
            >
              <Star className={cn("h-4 w-4", prompt!.isFavorite && "fill-brass text-brass")} />
            </Button>
          )}
          {!isNew && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Share prompt"
              onClick={() => setShowShare(true)}
            >
              <Share2 className={cn("h-4 w-4", prompt!.isPublic && "text-accent")} />
            </Button>
          )}
          {!isNew && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Version history"
              onClick={() => setShowVersions(true)}
            >
              <History className="h-4 w-4" />
            </Button>
          )}
          {!isNew && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Duplicate prompt"
              onClick={() => {
                const copy = duplicatePrompt(prompt!.id);
                if (copy) {
                  toast.success("Prompt duplicated");
                  router.push(`/promptforge/prompts/${copy.id}`);
                }
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          )}
          {!isNew && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Delete prompt"
              className="text-danger hover:text-danger"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <Button onClick={save} size="sm" className="gap-1.5">
            <Save className="h-3.5 w-3.5" />
            {isNew ? "Create prompt" : "Save"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Model</Label>
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger>
              <SelectValue placeholder="No model set" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No model set</SelectItem>
              {MODELS.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Folder</Label>
          <FolderSelect value={folderId} onChange={setFolderId} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Tags</Label>
        <div className="flex flex-wrap items-center gap-1.5">
          {selectedTags.map((tag) => (
            <TagBadge key={tag!.id} tag={tag!} onRemove={() => setTagIds((ids) => ids.filter((id) => id !== tag!.id))} />
          ))}
          <TagMultiselect selectedIds={tagIds} onChange={setTagIds} />
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="prompt-body">Prompt body</Label>
          <span className="text-xs text-text-faint">
            {wordCount} word{wordCount === 1 ? "" : "s"} · {body.length} chars
            {dirty && !isNew && " · unsaved changes"}
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <EditorToolbar onAction={handleFormat} />
          <RecipeForge
            hasExistingContent={body.trim().length > 0}
            onInsert={(recipeBody) => {
              setBody(recipeBody);
              if (!isNew) {
                updatePrompt(prompt!.id, { body: recipeBody }, { snapshot: true, note: "Inserted from Recipe Forge" });
              }
            }}
          />
        </div>
        <Textarea
          id="prompt-body"
          ref={textareaRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={"Write your prompt here. Use {{variable_name}} for reusable placeholders."}
          className="min-h-[320px] font-mono text-sm leading-relaxed"
        />
        {variables.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-xs text-text-faint">Variables:</span>
            {variables.map((v) => (
              <span key={v} className="rounded-full bg-brass-soft px-2 py-0.5 font-mono text-xs text-brass">
                {`{{${v}}}`}
              </span>
            ))}
          </div>
        )}
      </div>

      <AiPanel
        body={body}
        onApply={(nextBody, note) => {
          setBody(nextBody);
          if (!isNew) {
            updatePrompt(prompt!.id, { body: nextBody }, { snapshot: true, note });
          }
        }}
      />

      {!isNew && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Details</CardTitle>
            <CardDescription>
              Created {new Date(prompt!.createdAt).toLocaleDateString()} · Last updated{" "}
              {new Date(prompt!.updatedAt).toLocaleString()}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {!isNew && (
        <VersionHistoryDialog
          open={showVersions}
          onOpenChange={setShowVersions}
          prompt={prompt!}
          onRestore={(versionId) => {
            restoreVersion(prompt!.id, versionId);
            const restored = prompt!.versions.find((v) => v.id === versionId);
            if (restored) setBody(restored.body);
            toast.success("Version restored");
          }}
        />
      )}

      {!isNew && (
        <ShareDialog
          open={showShare}
          onOpenChange={setShowShare}
          kind="prompt"
          isPublic={prompt!.isPublic}
          onSetPublic={(v) => {
            setPromptPublic(prompt!.id, v);
            toast.success(v ? "Prompt is now public" : "Prompt is now private");
          }}
          path={`/share/${prompt!.id}`}
          itemLabel={prompt!.title}
        />
      )}

      {!isNew && (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title={`Delete "${prompt!.title}"?`}
          description="This can't be undone."
          confirmLabel="Delete prompt"
          onConfirm={() => {
            deletePrompt(prompt!.id);
            toast.success("Prompt deleted");
            router.push("/promptforge/prompts");
          }}
        />
      )}
    </div>

      <ForgeAiPanel
        promptKey={prompt?.id ?? "new"}
        promptBody={body}
        onApply={(nextBody) => {
          setBody(nextBody);
          if (!isNew) {
            updatePrompt(prompt!.id, { body: nextBody }, { snapshot: true, note: "Applied from Forge AI" });
          }
        }}
      />
    </>
  );
}

function VersionHistoryDialog({
  open,
  onOpenChange,
  prompt,
  onRestore,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prompt: Prompt;
  onRestore: (versionId: string) => void;
}) {
  const sorted = [...prompt.versions].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <ConfirmDialogless open={open} onOpenChange={onOpenChange} title="Version history">
      <div className="max-h-80 space-y-2 overflow-y-auto">
        {sorted.map((v, i) => (
          <div key={v.id} className="flex items-start justify-between gap-3 rounded-md border border-border p-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-text">
                {i === 0 ? "Current" : v.note ?? "Edit"} · {new Date(v.createdAt).toLocaleString()}
              </p>
              <p className="mt-1 line-clamp-2 font-mono text-xs text-text-muted">{v.body}</p>
            </div>
            {i !== 0 && (
              <Button variant="outline" size="sm" onClick={() => onRestore(v.id)} className="shrink-0">
                Restore
              </Button>
            )}
          </div>
        ))}
        {sorted.length === 0 && <p className="text-sm text-text-faint">No history yet.</p>}
      </div>
    </ConfirmDialogless>
  );
}

// Lightweight wrapper so the version-history list can reuse Dialog chrome
// without the confirm/destructive button footer of ConfirmDialog.
function ConfirmDialogless({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
