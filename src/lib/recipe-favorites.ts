"use client";

import * as React from "react";

/**
 * Recipe favorites are a small, purely-client preference (which of the
 * built-in recipes a user has starred), so they're kept in their own
 * localStorage key rather than routed through the main Zustand store in
 * `store.ts` — that store models real workspace data (prompts, folders,
 * tags) that syncs to Supabase, and recipes aren't workspace data at all.
 */
const STORAGE_KEY = "nexprompt:recipe-favorites";

function readFavorites(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((v): v is string => typeof v === "string"));
  } catch {
    return new Set();
  }
}

function writeFavorites(ids: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // Storage unavailable (private browsing, quota) — favoriting silently no-ops.
  }
}

export function useRecipeFavorites(): {
  favoriteIds: Set<string>;
  isFavorite: (id: string) => boolean;
  toggleFavorite: (id: string) => void;
} {
  // Lazy-init reads localStorage on the client only; on the server (and the
  // first client render, before hydration) this starts empty, matching SSR
  // output. Recipe Forge's list only renders inside a closed-by-default
  // Dialog, so there's no hydration-mismatch risk in practice.
  const [favoriteIds, setFavoriteIds] = React.useState<Set<string>>(() => readFavorites());

  React.useEffect(() => {
    setFavoriteIds(readFavorites());
  }, []);

  const toggleFavorite = React.useCallback((id: string) => {
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      writeFavorites(next);
      return next;
    });
  }, []);

  const isFavorite = React.useCallback((id: string) => favoriteIds.has(id), [favoriteIds]);

  return { favoriteIds, isFavorite, toggleFavorite };
}
