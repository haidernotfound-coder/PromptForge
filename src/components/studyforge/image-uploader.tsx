"use client";

import * as React from "react";
import { ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const MAX_IMAGES = 10;

export interface StudyForgeImageUploaderProps {
  images: string[];
  onChange: (images: string[]) => void;
}

/** Lets the student attach up to 10 images (e.g. photos of a textbook page
 *  or handwritten problem) that Groq's vision model will read and base the
 *  tool's result on. Images are converted to data URLs client-side — no
 *  extra upload endpoint needed, they just ride along in the same POST the
 *  tool already sends to /api/studyforge. */
export function StudyForgeImageUploader({ images, onChange }: StudyForgeImageUploaderProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  function filesToDataUrls(files: FileList | File[]): Promise<string[]> {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    return Promise.all(
      list.map(
        (file) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
          })
      )
    );
  }

  async function handleFiles(files: FileList | File[] | null) {
    if (!files || files.length === 0) return;
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) return;
    const toAdd = Array.from(files).slice(0, remaining);
    try {
      const dataUrls = await filesToDataUrls(toAdd);
      onChange([...images, ...dataUrls]);
    } catch {
      // ignore unreadable files
    }
  }

  function removeAt(index: number) {
    onChange(images.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-text-muted">
          Images (optional — up to {MAX_IMAGES})
        </label>
        {images.length > 0 && (
          <span className="text-xs text-text-muted">{images.length}/{MAX_IMAGES}</span>
        )}
      </div>

      {images.length > 0 && (
        <div className="grid grid-cols-5 gap-2">
          {images.map((src, i) => (
            <div key={i} className="relative group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={`Attached ${i + 1}`}
                className="h-16 w-full rounded-md object-cover border border-border"
              />
              <button
                type="button"
                onClick={() => removeAt(i)}
                aria-label="Remove image"
                className="absolute -top-1.5 -right-1.5 rounded-full bg-background border border-border p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          void handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5"
        disabled={images.length >= MAX_IMAGES}
        onClick={() => inputRef.current?.click()}
      >
        <ImagePlus className="h-3.5 w-3.5" />
        {images.length >= MAX_IMAGES ? "Limit reached" : "Add images"}
      </Button>
      <p className="text-[11px] text-text-muted">
        StudyForge's Groq vision model will read these and base the result on what's actually in them.
      </p>
    </div>
  );
}
