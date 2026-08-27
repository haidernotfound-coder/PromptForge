"use client";

import * as React from "react";
import { Plus, MessageSquare, MoreHorizontal, Pencil, Trash2, Check, X } from "lucide-react";
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

      <nav className="flex-1 space-y-0.5 overflow-y-auto" aria-label="Chat history">
        {conversations.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-text-faint">
            No conversations yet — start one above.
          </p>
        ) : (
          conversations.map((c) => {
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
                      <MessageSquare className="h-3.5 w-3.5 shrink-0" />
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
