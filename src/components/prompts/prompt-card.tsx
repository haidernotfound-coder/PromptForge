"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Copy,
  FolderClosed,
  Globe2,
  MoreHorizontal,
  Share2,
  Star,
  Trash2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { TagBadge } from "@/components/prompts/tag-badge";
import { ConfirmDialog } from "@/components/prompts/confirm-dialog";
import { ShareDialog } from "@/components/prompts/share-dialog";
import { useStore } from "@/lib/store";
import { modelLabel, type Prompt } from "@/types/prompt";
import { folderPath } from "@/lib/folders";
import { cn } from "@/lib/utils";

function relativeTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  return `${months}mo ago`;
}

export function PromptCard({ prompt, view = "grid" }: { prompt: Prompt; view?: "grid" | "list" }) {
  const router = useRouter();
  const tags = useStore((s) => s.tags);
  const folders = useStore((s) => s.folders);
  const toggleFavorite = useStore((s) => s.toggleFavorite);
  const duplicatePrompt = useStore((s) => s.duplicatePrompt);
  const deletePrompt = useStore((s) => s.deletePrompt);
  const setPromptPublic = useStore((s) => s.setPromptPublic);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showShare, setShowShare] = useState(false);

  const promptTags = prompt.tagIds.map((id) => tags.find((t) => t.id === id)).filter(Boolean);

  return (
    <Card
      className={cn(
        "group relative flex cursor-pointer flex-col gap-3 p-4 transition-shadow hover:shadow-md",
        view === "list" && "sm:flex-row sm:items-center sm:gap-4"
      )}
      onClick={() => router.push(`/dashboard/prompts/${prompt.id}`)}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/dashboard/prompts/${prompt.id}`}
            onClick={(e) => e.stopPropagation()}
            className="font-display text-sm font-semibold leading-tight text-text hover:text-accent line-clamp-1"
          >
            {prompt.title}
          </Link>
          {prompt.isPublic && (
            <Globe2 className="mt-0.5 h-3 w-3 shrink-0 text-accent" aria-label="Public prompt" />
          )}
          <div className="flex shrink-0 items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label={prompt.isFavorite ? "Remove from favorites" : "Add to favorites"}
              onClick={() => toggleFavorite(prompt.id)}
            >
              <Star className={cn("h-3.5 w-3.5", prompt.isFavorite && "fill-brass text-brass")} />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Prompt options">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="gap-2"
                  onSelect={() => {
                    navigator.clipboard.writeText(prompt.body);
                    toast.success("Prompt copied to clipboard");
                  }}
                >
                  <Copy className="h-3.5 w-3.5" /> Copy body
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="gap-2"
                  onSelect={() => {
                    const copy = duplicatePrompt(prompt.id);
                    if (copy) {
                      toast.success("Prompt duplicated");
                      router.push(`/dashboard/prompts/${copy.id}`);
                    }
                  }}
                >
                  <Copy className="h-3.5 w-3.5" /> Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2" onSelect={() => setShowShare(true)}>
                  <Share2 className="h-3.5 w-3.5" /> Share
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="gap-2 text-danger focus:text-danger"
                  onSelect={() => setConfirmDelete(true)}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <p className="mt-1.5 text-xs text-text-muted line-clamp-2 font-mono">{prompt.body || "Empty prompt"}</p>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {promptTags.slice(0, 3).map((tag) => (
            <TagBadge key={tag!.id} tag={tag!} />
          ))}
          {promptTags.length > 3 && (
            <span className="text-xs text-text-faint">+{promptTags.length - 3}</span>
          )}
        </div>
      </div>

      <div
        className={cn(
          "flex items-center gap-3 text-xs text-text-faint",
          view === "grid" && "mt-1 border-t border-border pt-3",
          view === "list" && "shrink-0 sm:w-56 sm:justify-end"
        )}
      >
        <span className="flex items-center gap-1 truncate">
          <FolderClosed className="h-3 w-3 shrink-0" />
          <span className="truncate">{folderPath(folders, prompt.folderId)}</span>
        </span>
        <span className="ml-auto shrink-0">{modelLabel(prompt.model)}</span>
        <span className="shrink-0">{relativeTime(prompt.updatedAt)}</span>
      </div>

      <ShareDialog
        open={showShare}
        onOpenChange={setShowShare}
        kind="prompt"
        isPublic={prompt.isPublic}
        onSetPublic={(v) => {
          setPromptPublic(prompt.id, v);
          toast.success(v ? "Prompt is now public" : "Prompt is now private");
        }}
        path={`/share/${prompt.id}`}
        itemLabel={prompt.title}
      />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete "${prompt.title}"?`}
        description="This can't be undone."
        confirmLabel="Delete prompt"
        onConfirm={() => {
          deletePrompt(prompt.id);
          toast.success("Prompt deleted");
        }}
      />
    </Card>
  );
}
