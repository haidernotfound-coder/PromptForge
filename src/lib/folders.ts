import type { Folder } from "@/types/prompt";

export interface FolderNode extends Folder {
  children: FolderNode[];
  depth: number;
}

/** Builds a nested tree from the flat folder list, sorted alphabetically at each level. */
export function buildFolderTree(folders: Folder[]): FolderNode[] {
  const byParent = new Map<string | null, Folder[]>();
  for (const f of folders) {
    const key = f.parentId;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(f);
  }
  for (const list of Array.from(byParent.values())) list.sort((a, b) => a.name.localeCompare(b.name));

  function build(parentId: string | null, depth: number): FolderNode[] {
    return (byParent.get(parentId) ?? []).map((f) => ({
      ...f,
      depth,
      children: build(f.id, depth + 1),
    }));
  }

  return build(null, 0);
}

/** Flattens the tree back into a depth-annotated list, useful for <select> options. */
export function flattenFolderTree(nodes: FolderNode[]): FolderNode[] {
  const out: FolderNode[] = [];
  const walk = (list: FolderNode[]) => {
    for (const n of list) {
      out.push(n);
      walk(n.children);
    }
  };
  walk(nodes);
  return out;
}

export function folderPath(folders: Folder[], folderId: string | null): string {
  if (!folderId) return "No folder";
  const byId = new Map(folders.map((f) => [f.id, f]));
  const parts: string[] = [];
  let current = byId.get(folderId);
  const seen = new Set<string>();
  while (current && !seen.has(current.id)) {
    parts.unshift(current.name);
    seen.add(current.id);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return parts.join(" / ") || "No folder";
}

/** All descendant folder ids (inclusive) — used to scope "everything in this folder". */
export function folderAndDescendantIds(folders: Folder[], folderId: string): Set<string> {
  const ids = new Set<string>([folderId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const f of folders) {
      if (f.parentId && ids.has(f.parentId) && !ids.has(f.id)) {
        ids.add(f.id);
        changed = true;
      }
    }
  }
  return ids;
}
