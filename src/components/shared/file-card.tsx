"use client";

import * as React from "react";
import { Download, FileArchive, FileCode, FileText, Presentation } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatFileSize } from "@/lib/attachments";
import type { ChatMessage } from "@/lib/chat";

/**
 * Unified AI Chat — in-chat file card (Phase 4).
 *
 * Renders a generated file (PPTForge's .pptx output, a packaged code .zip,
 * or a plain text/markdown file) as a proper download card instead of the
 * inline `[Download foo.pptx](data:...)` markdown link Phase 2/3 used as a
 * stopgap. The file is already a `data:` URL by the time it gets here (see
 * `lib/server/file-builder.ts`), so this is just presentation — no new
 * upload/storage system, and the same download-via-anchor mechanism every
 * browser already handles natively.
 */

type GeneratedFile = NonNullable<ChatMessage["files"]>[number];

function iconFor(mimeType: string) {
  if (mimeType.includes("presentation")) return Presentation;
  if (mimeType === "application/zip") return FileArchive;
  if (mimeType.startsWith("text/") || mimeType === "application/json") return FileCode;
  return FileText;
}

function kindLabel(mimeType: string): string {
  if (mimeType.includes("presentation")) return "PowerPoint presentation";
  if (mimeType === "application/zip") return "ZIP archive";
  if (mimeType === "text/markdown") return "Markdown document";
  if (mimeType === "application/json") return "JSON file";
  if (mimeType.startsWith("text/")) return "Text file";
  return "File";
}

export function FileCard({ file, className }: { file: GeneratedFile; className?: string }) {
  const Icon = iconFor(file.mimeType);
  return (
    <a
      href={file.dataUrl}
      download={file.name}
      className={cn(
        "group flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5 transition-colors hover:border-accent/50 hover:bg-surface-raised",
        className
      )}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-text">{file.name}</span>
        <span className="block text-xs text-text-faint">
          {kindLabel(file.mimeType)} · {formatFileSize(file.size)}
        </span>
      </span>
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-text-muted transition-colors group-hover:text-accent">
        <Download className="h-4 w-4" />
      </span>
    </a>
  );
}

/** Stacked list of file cards — drop under an assistant message's markdown
 *  when `message.files` is populated. */
export function FileCardList({ files, className }: { files: GeneratedFile[]; className?: string }) {
  if (files.length === 0) return null;
  return (
    <div className={cn("mt-2 flex flex-col gap-1.5", className)}>
      {files.map((file) => (
        <FileCard key={file.name} file={file} />
      ))}
    </div>
  );
}
