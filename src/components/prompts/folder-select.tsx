"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStore } from "@/lib/store";
import { buildFolderTree, flattenFolderTree } from "@/lib/folders";
import { useMemo } from "react";

export function FolderSelect({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (folderId: string | null) => void;
}) {
  const folders = useStore((s) => s.folders);
  const flat = useMemo(() => flattenFolderTree(buildFolderTree(folders)), [folders]);

  return (
    <Select value={value ?? "none"} onValueChange={(v) => onChange(v === "none" ? null : v)}>
      <SelectTrigger>
        <SelectValue placeholder="No folder" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">No folder</SelectItem>
        {flat.map((f) => (
          <SelectItem key={f.id} value={f.id}>
            {"\u00A0\u00A0".repeat(f.depth)}
            {f.depth > 0 ? "└ " : ""}
            {f.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
