"use client";

import * as React from "react";
import { Plus, MessageSquare, AudioLines, MoreHorizontal, Pencil, Trash2, Check, X, Search } from "lucide-react";
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

export function ChatSidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onRename,
  onDelete,
  className,
}: {
  conversations: ChatConversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  className?: string;
}) {
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editValue, setEditValue] = React.useState("");
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");

  const filtered = query.trim()
    ? conversations.filter((c) => c.title.toLowerCase().includes(query.trim().toLowerCase()))
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

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <Button onClick={onNew} className="gap-1.5" size="sm">
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
            className="h-8 pl-8 text-sm"
          />
        </div>
      )}

      <nav className="flex-1 space-y-0.5 overflow-y-auto" aria-label="Chat history">
        {conversations.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-text-faint">
            No conversations yet — start one above.
          </p>
        ) : filtered.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-text-faint">No chats match &ldquo;{query}&rdquo;.</p>
        ) : (
          filtered.map((c) => {
            const active = c.id === activeId;
            const editing = editingId === c.id;
            return (
              <div
                key={c.id}
                className={cn(
                  "group relative flex items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors",
                  active ? "bg-accent-soft text-accent" : "text-text-muted hover:bg-surface hover:text-text"
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
                      {c.kind === "voice" ? (
                        <AudioLines className="h-3.5 w-3.5 shrink-0 text-accent" />
                      ) : (
                        <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                      )}
                      <span className="truncate">{c.title}</span>
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
          })
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
