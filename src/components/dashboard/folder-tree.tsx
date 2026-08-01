"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { FolderClosed, FolderPlus, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { buildFolderTree, type FolderNode } from "@/lib/folders";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { NameDialog } from "@/components/prompts/name-dialog";
import { ConfirmDialog } from "@/components/prompts/confirm-dialog";

export function FolderTree() {
  const folders = useStore((s) => s.folders);
  const prompts = useStore((s) => s.prompts);
  const addFolder = useStore((s) => s.addFolder);
  const renameFolder = useStore((s) => s.renameFolder);
  const deleteFolder = useStore((s) => s.deleteFolder);

  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeFolder = searchParams.get("folder");

  const [creatingUnder, setCreatingUnder] = React.useState<string | null | "root">(null);
  const [renaming, setRenaming] = React.useState<FolderNode | null>(null);
  const [deleting, setDeleting] = React.useState<FolderNode | null>(null);

  const tree = React.useMemo(() => buildFolderTree(folders), [folders]);
  const counts = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const p of prompts) {
      if (p.folderId) map.set(p.folderId, (map.get(p.folderId) ?? 0) + 1);
    }
    return map;
  }, [prompts]);

  return (
    <div>
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-text-faint">Folders</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          aria-label="New folder"
          onClick={() => setCreatingUnder("root")}
        >
          <FolderPlus className="h-3.5 w-3.5" />
        </Button>
      </div>

      <nav className="mt-1 flex flex-col gap-0.5" aria-label="Folders">
        {tree.map((node) => (
          <FolderRow
            key={node.id}
            node={node}
            counts={counts}
            pathname={pathname}
            activeFolder={activeFolder}
            onCreateChild={(id) => setCreatingUnder(id)}
            onRename={(n) => setRenaming(n)}
            onDelete={(n) => setDeleting(n)}
          />
        ))}
        {tree.length === 0 && (
          <p className="px-2 py-1 text-xs text-text-faint">No folders yet.</p>
        )}
      </nav>

      <NameDialog
        open={creatingUnder !== null}
        onOpenChange={(o) => !o && setCreatingUnder(null)}
        title="New folder"
        label="Folder name"
        confirmLabel="Create"
        onSubmit={(name) => addFolder(name, creatingUnder === "root" ? null : creatingUnder)}
      />

      <NameDialog
        open={renaming !== null}
        onOpenChange={(o) => !o && setRenaming(null)}
        title="Rename folder"
        label="Folder name"
        initialValue={renaming?.name ?? ""}
        confirmLabel="Save"
        onSubmit={(name) => renaming && renameFolder(renaming.id, name)}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete "${deleting?.name}"?`}
        description="Prompts inside will move to No folder. Subfolders are deleted too. This can't be undone."
        confirmLabel="Delete folder"
        onConfirm={() => deleting && deleteFolder(deleting.id)}
      />
    </div>
  );
}

function FolderRow({
  node,
  counts,
  pathname,
  activeFolder,
  onCreateChild,
  onRename,
  onDelete,
}: {
  node: FolderNode;
  counts: Map<string, number>;
  pathname: string;
  activeFolder: string | null;
  onCreateChild: (parentId: string) => void;
  onRename: (n: FolderNode) => void;
  onDelete: (n: FolderNode) => void;
}) {
  const active = pathname === "/dashboard/prompts" && activeFolder === node.id;
  const count = counts.get(node.id) ?? 0;

  return (
    <div>
      <div
        className={cn(
          "group flex items-center gap-1 rounded-md pr-1 text-sm transition-colors",
          active ? "bg-accent-soft text-accent" : "text-text-muted hover:bg-surface hover:text-text"
        )}
        style={{ paddingLeft: `${8 + node.depth * 14}px` }}
      >
        <Link
          href={`/dashboard/prompts?folder=${node.id}`}
          className="flex flex-1 min-w-0 items-center gap-2 py-1.5"
        >
          <FolderClosed className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{node.name}</span>
          {count > 0 && <span className="ml-auto shrink-0 text-xs text-text-faint">{count}</span>}
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="shrink-0 rounded p-1 opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
              aria-label={`${node.name} folder options`}
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem className="gap-2" onSelect={() => onCreateChild(node.id)}>
              <Plus className="h-3.5 w-3.5" /> New subfolder
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2" onSelect={() => onRename(node)}>
              <Pencil className="h-3.5 w-3.5" /> Rename
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2 text-danger focus:text-danger" onSelect={() => onDelete(node)}>
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {node.children.map((child) => (
        <FolderRow
          key={child.id}
          node={child}
          counts={counts}
          pathname={pathname}
          activeFolder={activeFolder}
          onCreateChild={onCreateChild}
          onRename={onRename}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
