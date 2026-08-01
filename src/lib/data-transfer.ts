/**
 * Phase 5 — import / export
 * --------------------------
 * A real, working JSON export/import of the workspace. No backend involved
 * — this reads/writes an actual file via the browser's File/Blob APIs, so
 * it doubles as a portable backup and a way to move data between browsers
 * ahead of Phase 7's real sync.
 */

import type { Collection, Folder, Prompt, Tag } from "@/types/prompt";

export const EXPORT_FORMAT_VERSION = 1;

export interface ExportPayload {
  format: "promptforge-export";
  version: number;
  exportedAt: string;
  data: {
    prompts: Prompt[];
    folders: Folder[];
    tags: Tag[];
    collections: Collection[];
  };
}

export function buildExportPayload(data: ExportPayload["data"]): ExportPayload {
  return {
    format: "promptforge-export",
    version: EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  };
}

export function downloadJson(payload: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export class ImportValidationError extends Error {}

/** Parses and loosely validates an uploaded export file. Throws
 *  ImportValidationError with a human-readable message on anything
 *  malformed — the caller shows it directly in a toast. */
export function parseImportPayload(raw: string): ExportPayload["data"] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ImportValidationError("That file isn't valid JSON.");
  }
  const obj = parsed as Partial<ExportPayload> & { data?: unknown };
  const data = (obj?.data ?? parsed) as Partial<ExportPayload["data"]> | undefined;

  if (!data || typeof data !== "object") {
    throw new ImportValidationError("That file doesn't look like a PromptForge export.");
  }
  const { prompts, folders, tags, collections } = data;
  if (prompts && !Array.isArray(prompts)) throw new ImportValidationError("\"prompts\" should be a list.");
  if (folders && !Array.isArray(folders)) throw new ImportValidationError("\"folders\" should be a list.");
  if (tags && !Array.isArray(tags)) throw new ImportValidationError("\"tags\" should be a list.");
  if (collections && !Array.isArray(collections))
    throw new ImportValidationError("\"collections\" should be a list.");

  return {
    prompts: (prompts as Prompt[]) ?? [],
    folders: (folders as Folder[]) ?? [],
    tags: (tags as Tag[]) ?? [],
    collections: (collections as Collection[]) ?? [],
  };
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file"));
    reader.readAsText(file);
  });
}
