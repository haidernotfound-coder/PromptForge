/**
 * Phase 5 — local backups
 * ------------------------
 * There's still no backend, so a "backup" is a manual snapshot of the
 * store's data, timestamped and stashed under a separate localStorage key
 * (never overwritten by normal saves). It's genuinely restorable — this is
 * a real point-in-time copy, not a cosmetic feature — it just lives in the
 * same browser rather than off-device. Phase 7 can point this at real
 * server-side backups without changing the calling UI.
 */

import type { Collection, Folder, Prompt, Tag } from "@/types/prompt";

const BACKUPS_KEY = "nexprompt-backups";
const MAX_BACKUPS = 10;

export interface BackupSnapshot {
  id: string;
  createdAt: string;
  label: string;
  data: {
    prompts: Prompt[];
    folders: Folder[];
    tags: Tag[];
    collections: Collection[];
  };
}

function readAll(): BackupSnapshot[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(BACKUPS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(backups: BackupSnapshot[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(BACKUPS_KEY, JSON.stringify(backups));
}

export function listBackups(): BackupSnapshot[] {
  return readAll().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function createBackup(
  data: BackupSnapshot["data"],
  label?: string
): BackupSnapshot {
  const backup: BackupSnapshot = {
    id: `bk_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    label: label?.trim() || "Manual backup",
    data,
  };
  const backups = [backup, ...readAll()].slice(0, MAX_BACKUPS);
  writeAll(backups);
  return backup;
}

export function deleteBackup(id: string) {
  writeAll(readAll().filter((b) => b.id !== id));
}

export function getBackup(id: string): BackupSnapshot | null {
  return readAll().find((b) => b.id === id) ?? null;
}
