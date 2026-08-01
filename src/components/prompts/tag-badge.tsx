import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Tag, TagColor } from "@/types/prompt";
import { X } from "lucide-react";

const DOT_CLASSES: Record<TagColor, string> = {
  violet: "bg-accent",
  brass: "bg-brass",
  success: "bg-success",
  danger: "bg-danger",
  slate: "bg-text-faint",
  sky: "bg-sky-500",
};

export function TagBadge({
  tag,
  onRemove,
  className,
}: {
  tag: Tag;
  onRemove?: () => void;
  className?: string;
}) {
  return (
    <Badge variant={tag.color} className={cn("gap-1.5", className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", DOT_CLASSES[tag.color])} aria-hidden />
      {tag.name}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 rounded-full opacity-70 hover:opacity-100 focus-visible:outline-none"
          aria-label={`Remove ${tag.name} tag`}
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </Badge>
  );
}

export function TagColorDot({ color, className }: { color: TagColor; className?: string }) {
  return <span className={cn("inline-block h-2.5 w-2.5 rounded-full", DOT_CLASSES[color], className)} />;
}
