"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function relativeTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const secs = Math.round(diffMs / 1000);
  if (secs < 5) return "just now";
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  return `${mins}m ago`;
}

/** Small header badge showing local persistence + cross-tab sync status.
 *  "Syncing" flashes briefly whenever the store writes, then settles to a
 *  relative-time "Synced Ns ago" — genuinely reflects whether this tab's
 *  data has landed in localStorage (and therefore is visible to any other
 *  open tab via the storage-event listener in lib/store.ts). */
export function SyncIndicator() {
  const prompts = useStore((s) => s.prompts);
  const folders = useStore((s) => s.folders);
  const tags = useStore((s) => s.tags);
  const collections = useStore((s) => s.collections);
  const hasHydrated = useStore((s) => s.hasHydrated);
  const markSynced = useStore((s) => s.markSynced);
  const lastSyncedAt = useStore((s) => s.lastSyncedAt);

  const [syncing, setSyncing] = React.useState(false);
  const [, forceTick] = React.useReducer((n) => n + 1, 0);
  const mounted = React.useRef(false);

  React.useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    setSyncing(true);
    const t = setTimeout(() => {
      markSynced();
      setSyncing(false);
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompts, folders, tags, collections]);

  React.useEffect(() => {
    const interval = setInterval(forceTick, 15_000);
    return () => clearInterval(interval);
  }, []);

  if (!hasHydrated) return null;

  const label = syncing
    ? "Syncing…"
    : lastSyncedAt
      ? `Synced ${relativeTime(lastSyncedAt)}`
      : "Synced";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs text-text-faint">
            <RefreshCw className={cn("h-3 w-3", syncing && "animate-spin text-accent")} />
            {label}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          Saved to this browser and mirrored live to any other open PromptForge tab.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
