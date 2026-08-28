"use client";

import * as React from "react";
import {
  Plus,
  MessageSquare,
  AudioLines,
  MoreHorizontal,
  Pencil,
  Trash2,
  Check,
  X,
  Search,
  Pin,
  PinOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/prompts/confirm-dialog";
import { cn } from "@/lib/utils";
import type { ChatConversation } from "@/lib/chat";

function groupLabel(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days <= 7) return "Previous 7 days";
  if (days <= 30) return "Previous 30 days";
  return "Older";
}

const GROUP_ORDER = [
  "Today",
  "Yesterday",
  "Previous 7 days",
  "Previous 30 days",
  "Older",
];

export function ChatSidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onRename,
  onDelete,
  onTogglePin,
  className,
}: {
  conversations: ChatConversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  /** Toggles `pinned` on the given conversation — persisted and synced
   *  through the same channel as rename/delete (see chat-app.tsx), so a
   *  pin follows the account across devices instead of staying local to
   *  this browser. */
  onTogglePin: (id: string) => void;
  className?: string;
}) {
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editValue, setEditValue] = React.useState("");
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(
    null,
  );
  const [query, setQuery] = React.useState("");

  const filtered = query.trim()
    ? conversations.filter((c) =>
        c.title.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : conversations;

  function startEdit(c: ChatConversation) {
    setEditingId(c.id);
    setEditValue(c.title);
  }

  function commitEdit() {
    if (editingId) {
      const trimmed = editValue.trim();
      if (trimmed) onRename(editingId, trimmed);
    }
    setEditingId(null);
    setEditValue("");
  }

  const deleteTarget = conversations.find((c) => c.id === confirmDeleteId);

  // Pinned conversations are pulled out and shown in their own section up
  // top (already-newest-first order preserved); everything else is grouped
  // into ChatGPT-style date buckets below it.
  const pinned = filtered.filter((c) => c.pinned);
  const unpinned = filtered.filter((c) => !c.pinned);

  const groups = React.useMemo(() => {
    const buckets = new Map<string, ChatConversation[]>();
    for (const c of unpinned) {
      const label = groupLabel(c.updatedAt);
      const list = buckets.get(label);
      if (list) list.push(c);
      else buckets.set(label, [c]);
    }
    return GROUP_ORDER.map((label) => ({
      label,
      items: buckets.get(label) ?? [],
    })).filter((g) => g.items.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unpinned]);

  function renderRow(c: ChatConversation) {
    const active = c.id === activeId;
    const editing = editingId === c.id;
    const isPinned = Boolean(c.pinned);
    return (
      <div
        key={c.id}
        className={cn(
          "group relative flex min-w-0 items-center gap-1 rounded-lg px-2 py-1.5 text-[13px] leading-tight transition-colors",
          active
            ? "bg-accent-soft text-accent"
            : "text-text-muted hover:bg-surface hover:text-text",
        )}
      >
        {editing ? (
          <div className="flex flex-1 items-center gap-1">
            <Input
              autoFocus
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitEdit();
                if (e.key === "Escape") setEditingId(null);
              }}
              className="h-7 text-sm"
            />
            <button
              type="button"
              onClick={commitEdit}
              aria-label="Save name"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-text-muted hover:bg-surface hover:text-text"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setEditingId(null)}
              aria-label="Cancel rename"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-text-muted hover:bg-surface hover:text-text"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => onSelect(c.id)}
              className="flex flex-1 items-center gap-2 overflow-hidden text-left"
            >
              {isPinned ? (
                <Pin className="h-3.5 w-3.5 shrink-0 fill-accent/20 text-accent" />
              ) : c.kind === "voice" ? (
                <AudioLines className="h-3.5 w-3.5 shrink-0 text-accent/80" />
              ) : (
                <MessageSquare className="h-3.5 w-3.5 shrink-0 text-text-faint" />
              )}
              <span className="truncate">{c.title}</span>
            </button>

            {/* Pin toggle sits next to (not inside) the overflow menu — a
                one-click affordance for the most common action, same way
                ChatGPT-style sidebars surface it. */}
            <button
              type="button"
              onClick={() => onTogglePin(c.id)}
              aria-label={isPinned ? `Unpin ${c.title}` : `Pin ${c.title}`}
              title={isPinned ? "Unpin" : "Pin"}
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded text-text-muted hover:bg-surface hover:text-text",
                isPinned
                  ? "opacity-100 text-accent"
                  : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
              )}
            >
              {isPinned ? (
                <PinOff className="h-3.5 w-3.5" />
              ) : (
                <Pin className="h-3.5 w-3.5" />
              )}
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={`Options for ${c.title}`}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-text-muted opacity-0 hover:bg-surface hover:text-text group-hover:opacity-100 data-[state=open]:opacity-100"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => startEdit(c)}>
                  <Pencil className="h-3.5 w-3.5" /> Rename
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setConfirmDeleteId(c.id)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex min-w-0 flex-col gap-2.5", className)}>
      <Button
        onClick={onNew}
        className="w-full justify-start gap-2 rounded-lg"
        size="sm"
      >
        <Plus className="h-4 w-4" /> New chat
      </Button>

      {conversations.length > 6 && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-faint" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats…"
            aria-label="Search chats"
            className="h-8 rounded-lg pl-8 text-xs"
          />
        </div>
      )}

      <nav
        className="flex min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto pr-0.5"
        aria-label="Chat history"
      >
        {conversations.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-text-faint">
            No conversations yet — start one above.
          </p>
        ) : filtered.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-text-faint">
            No chats match &ldquo;{query}&rdquo;.
          </p>
        ) : (
          <>
            {pinned.length > 0 && (
              <div className="mb-2">
                <p className="flex items-center gap-1 px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-text-faint">
                  <Pin className="h-3 w-3" /> Pinned
                </p>
                <div className="flex flex-col gap-0.5">
                  {pinned.map(renderRow)}
                </div>
              </div>
            )}
            {groups.map((group) => (
              <div key={group.label} className="mb-2 last:mb-0">
                <p className="px-2 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-text-faint first:pt-0">
                  {group.label}
                </p>
                <div className="flex flex-col gap-0.5">
                  {group.items.map(renderRow)}
                </div>
              </div>
            ))}
          </>
        )}
      </nav>

      <ConfirmDialog
        open={confirmDeleteId !== null}
        onOpenChange={(open) => !open && setConfirmDeleteId(null)}
        title="Delete this chat?"
        description={`"${deleteTarget?.title ?? "This chat"}" will be permanently removed from this browser. This can't be undone.`}
        confirmLabel="Delete"
        onConfirm={() => confirmDeleteId && onDelete(confirmDeleteId)}
      />
    </div>
  );
}
