"use client";

/**
 * PPTForge history + preferences
 * -------------------------------
 * PPTForge streams the generated .pptx straight back as a file response —
 * nothing is persisted server-side (no deck storage table, see
 * `api/pptforge/route.ts`). So "History" and "Settings" live in the
 * browser: a small localStorage-backed log of what was generated (so the
 * user can see/re-run recent decks) and a set of default preferences
 * (style + slide count) applied the next time they open Generate.
 */

export interface PptForgeHistoryEntry {
  id: string;
  topic: string;
  filename: string;
  style: string;
  slideCount: number;
  detail?: string;
  createdAt: string;
}

const HISTORY_KEY = "pptforge:history";
const PREFS_KEY = "pptforge:prefs";
const HISTORY_CAP = 30;

export interface PptForgePrefs {
  defaultStyle: string;
  defaultSlideCount: number;
}

const DEFAULT_PREFS: PptForgePrefs = {
  defaultStyle: "professional",
  defaultSlideCount: 8,
};

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function getPptForgeHistory(): PptForgeHistoryEntry[] {
  if (typeof window === "undefined") return [];
  return safeParse<PptForgeHistoryEntry[]>(window.localStorage.getItem(HISTORY_KEY), []);
}

export function addPptForgeHistoryEntry(entry: Omit<PptForgeHistoryEntry, "id" | "createdAt">): void {
  if (typeof window === "undefined") return;
  const existing = getPptForgeHistory();
  const next: PptForgeHistoryEntry[] = [
    { ...entry, id: crypto.randomUUID(), createdAt: new Date().toISOString() },
    ...existing,
  ].slice(0, HISTORY_CAP);
  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
}

export function clearPptForgeHistory(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(HISTORY_KEY);
}

export function getPptForgePrefs(): PptForgePrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  return { ...DEFAULT_PREFS, ...safeParse<Partial<PptForgePrefs>>(window.localStorage.getItem(PREFS_KEY), {}) };
}

export function setPptForgePrefs(prefs: PptForgePrefs): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}
