"use client";

import * as React from "react";
import { toast } from "sonner";
import { Paperclip, Camera, FileText, FileImage, FileCode, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ACCEPT_ATTR,
  MAX_FILES,
  formatFileSize,
  readAttachment,
  validateFile,
  type ChatAttachment,
} from "@/lib/attachments";

/** Manages the attached-file list for a chat input: picking, reading,
 *  validating, and removing files. Returned state plugs straight into
 *  `<AttachmentBar />` and into the send call. */
export function useAttachments() {
  const [attachments, setAttachments] = React.useState<ChatAttachment[]>([]);
  const [reading, setReading] = React.useState(false);

  const addFiles = React.useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      if (list.length === 0) return;

      setAttachments((prev) => {
        if (prev.length + list.length > MAX_FILES) {
          toast.error(`You can attach up to ${MAX_FILES} files at once.`);
          return prev;
        }
        return prev;
      });

      const room = Math.max(0, MAX_FILES - attachments.length);
      if (room === 0) {
        toast.error(`You can attach up to ${MAX_FILES} files at once.`);
        return;
      }
      const toRead = list.slice(0, room);

      const valid: File[] = [];
      for (const file of toRead) {
        const err = validateFile(file);
        if (err) {
          toast.error(err);
        } else {
          valid.push(file);
        }
      }
      if (valid.length === 0) return;

      setReading(true);
      try {
        const read = await Promise.all(valid.map(readAttachment));
        setAttachments((prev) => [...prev, ...read]);
        const failed = read.filter((a) => a.error);
        if (failed.length > 0) {
          toast.error(failed.map((f) => f.error).join(" "));
        }
      } finally {
        setReading(false);
      }
    },
    [attachments.length]
  );

  const removeAttachment = React.useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const clearAttachments = React.useCallback(() => setAttachments([]), []);

  return { attachments, addFiles, removeAttachment, clearAttachments, reading };
}

function iconFor(att: ChatAttachment) {
  if (att.kind === "image") return FileImage;
  if (att.kind === "text") return FileCode;
  return FileText;
}

/** The paperclip button that opens the file picker. Drop this next to the
 *  mic button / send button in any chat's composer. */
export function AttachmentButton({
  onFiles,
  disabled,
  className,
}: {
  onFiles: (files: FileList) => void;
  disabled?: boolean;
  className?: string;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT_ATTR}
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) onFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        aria-label="Attach files"
        title="Attach files (images, PDF, DOCX, ZIP, TXT, CSV, code — up to 100 MB each)"
        className={cn("h-9 w-9 shrink-0", className)}
      >
        <Paperclip className="h-4 w-4" />
      </Button>
    </>
  );
}

/** Camera-capture entry point — reuses the same file pipeline as
 *  `AttachmentButton` (validation, reading, chips) but opens straight to
 *  the device camera via `capture="environment"` instead of the general
 *  file picker, so it can sit next to it in the composer as its own
 *  affordance. Same guarantees as the attach flow — no new upload path. */
export function CameraButton({
  onFiles,
  disabled,
  className,
}: {
  onFiles: (files: FileList) => void;
  disabled?: boolean;
  className?: string;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) onFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        aria-label="Use camera"
        title="Take a photo to attach"
        className={cn("h-9 w-9 shrink-0", className)}
      >
        <Camera className="h-4 w-4" />
      </Button>
    </>
  );
}

/** Row of file chips shown above the composer once files are attached. */
export function AttachmentChips({
  attachments,
  onRemove,
  disabled,
}: {
  attachments: ChatAttachment[];
  onRemove: (id: string) => void;
  disabled?: boolean;
}) {
  if (attachments.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 px-0.5 pb-1.5">
      {attachments.map((att) => {
        const Icon = iconFor(att);
        return (
          <span
            key={att.id}
            className={cn(
              "group flex max-w-[220px] items-center gap-1.5 rounded-full border border-border bg-surface px-2 py-1 text-xs text-text-muted",
              att.error && "border-danger/40 text-danger"
            )}
            title={att.error ?? `${att.name} · ${formatFileSize(att.size)}`}
          >
            {att.kind === "image" && att.dataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={att.dataUrl} alt="" className="h-4 w-4 shrink-0 rounded-sm object-cover" />
            ) : (
              <Icon className="h-3.5 w-3.5 shrink-0" />
            )}
            <span className="truncate">{att.name}</span>
            <span className="shrink-0 text-text-faint">{formatFileSize(att.size)}</span>
            <button
              type="button"
              onClick={() => onRemove(att.id)}
              disabled={disabled}
              aria-label={`Remove ${att.name}`}
              className="shrink-0 rounded-full p-0.5 text-text-faint transition-colors hover:bg-surface-raised hover:text-text disabled:cursor-not-allowed"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        );
      })}
    </div>
  );
}

/** Convenience wrapper combining the button + chips + reading spinner —
 *  drop this above a composer and pass it the `useAttachments()` return
 *  value. Kept separate from the button/chips exports above so a chat
 *  that needs custom placement (e.g. button inline with the textarea,
 *  chips above it) can compose the pieces itself instead. */
export function AttachmentBar({
  state,
  disabled,
}: {
  state: ReturnType<typeof useAttachments>;
  disabled?: boolean;
}) {
  return (
    <>
      <AttachmentChips attachments={state.attachments} onRemove={state.removeAttachment} disabled={disabled} />
      {state.reading && (
        <div className="flex items-center gap-1.5 px-0.5 pb-1.5 text-xs text-text-faint">
          <Loader2 className="h-3 w-3 animate-spin" /> Reading files…
        </div>
      )}
    </>
  );
}
