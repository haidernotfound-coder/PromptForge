"use client";

import * as React from "react";
import { Check, Plus, Tags } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TagColorDot } from "@/components/prompts/tag-badge";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export function TagMultiselect({
  selectedIds,
  onChange,
}: {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const tags = useStore((s) => s.tags);
  const addTag = useStore((s) => s.addTag);
  const [query, setQuery] = React.useState("");

  const sorted = React.useMemo(() => [...tags].sort((a, b) => a.name.localeCompare(b.name)), [tags]);
  const filtered = sorted.filter((t) => t.name.toLowerCase().includes(query.trim().toLowerCase()));
  const exactMatch = tags.some((t) => t.name.toLowerCase() === query.trim().toLowerCase());

  function toggle(id: string) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-1.5">
          <Tags className="h-3.5 w-3.5" />
          Add tags
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-2">
        <Input
          autoFocus
          placeholder="Search or create a tag…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-8 text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter" && query.trim() && !exactMatch) {
              e.preventDefault();
              const tag = addTag(query.trim());
              onChange([...selectedIds, tag.id]);
              setQuery("");
            }
          }}
        />
        <div className="mt-2 max-h-56 overflow-y-auto">
          {filtered.map((tag) => {
            const active = selectedIds.includes(tag.id);
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggle(tag.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-surface",
                  active && "bg-accent-soft"
                )}
              >
                <TagColorDot color={tag.color} />
                <span className="flex-1 truncate">{tag.name}</span>
                {active && <Check className="h-3.5 w-3.5 text-accent" />}
              </button>
            );
          })}
          {filtered.length === 0 && query.trim() && (
            <button
              type="button"
              onClick={() => {
                const tag = addTag(query.trim());
                onChange([...selectedIds, tag.id]);
                setQuery("");
              }}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm text-accent hover:bg-surface"
            >
              <Plus className="h-3.5 w-3.5" />
              Create &quot;{query.trim()}&quot;
            </button>
          )}
          {filtered.length === 0 && !query.trim() && (
            <p className="px-2 py-1.5 text-xs text-text-faint">No tags yet — type to create one.</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
