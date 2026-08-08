/**
 * PPTForge — shared module
 * ------------------------
 * Talks to `/api/pptforge` (its own Groq key pool — see `getPptForgeApiKeys`
 * in `lib/supabase/config.ts`), fully independent of `lib/ai.ts`,
 * `lib/forge-ai.ts`, `lib/codeforge.ts`, and `lib/studyforge.ts`.
 *
 * Flow: the client posts a topic/slide-count/style here, the API asks Groq
 * for a structured slide *plan* (JSON — title, layout, bullets, table/chart
 * data, etc, no design decisions left to prose), then renders that plan to
 * a real .pptx with PptxGenJS server-side (see `lib/pptforge-builder.ts`)
 * and streams the file back for direct download. There is no "local
 * fallback" like StudyForge/CodeForge have — a real file needs a real
 * model call, so PPTForge simply surfaces a clear error when it isn't
 * configured or the request fails.
 */

export type PptForgeStyle = "professional" | "modern" | "minimal" | "bold" | "academic";

export interface PptForgeStyleMeta {
  id: PptForgeStyle;
  label: string;
  description: string;
}

export const PPTFORGE_STYLES: PptForgeStyleMeta[] = [
  {
    id: "professional",
    label: "Professional",
    description: "Navy & slate, clean sans-serif — safe for business and client decks.",
  },
  {
    id: "modern",
    label: "Modern",
    description: "Bold accent color on dark slides, big type — pitch-deck energy.",
  },
  {
    id: "minimal",
    label: "Minimal",
    description: "Mostly white space, thin rules, small accents — understated and calm.",
  },
  {
    id: "bold",
    label: "Bold",
    description: "High-contrast color blocks and oversized headings — hard to ignore.",
  },
  {
    id: "academic",
    label: "Academic",
    description: "Deep green & cream, serif headings — lectures, research, classroom use.",
  },
];

export function pptForgeStyleMeta(style: PptForgeStyle): PptForgeStyleMeta {
  return PPTFORGE_STYLES.find((s) => s.id === style) ?? PPTFORGE_STYLES[0];
}

export const PPTFORGE_MIN_SLIDES = 4;
export const PPTFORGE_MAX_SLIDES = 20;

export interface GeneratePptForgeOptions {
  topic: string;
  slideCount: number;
  style: PptForgeStyle;
  /** Optional extra instructions — audience, tone, must-include points. */
  detail?: string;
}

export interface GeneratePptForgeResult {
  ok: boolean;
  /** Populated when ok — a Blob ready to be downloaded as a .pptx. */
  blob?: Blob;
  filename?: string;
  error?: string;
}

function slugifyFilename(topic: string): string {
  const slug = topic
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return (slug || "presentation").slice(0, 60);
}

/** Posts to `/api/pptforge`, which returns the .pptx binary directly (or a
 *  JSON `{error}` body on failure) — no local fallback, see module docs. */
export async function generatePptForge(opts: GeneratePptForgeOptions): Promise<GeneratePptForgeResult> {
  try {
    const res = await fetch("/api/pptforge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(opts),
    });

    if (!res.ok) {
      let message = "PPTForge could not generate that presentation";
      try {
        const data = await res.json();
        if (typeof data?.error === "string") message = data.error;
      } catch {
        // response wasn't JSON — keep the default message
      }
      return { ok: false, error: message };
    }

    const blob = await res.blob();
    return { ok: true, blob, filename: `${slugifyFilename(opts.topic)}.pptx` };
  } catch {
    return { ok: false, error: "Network error reaching PPTForge — please try again." };
  }
}

/** Triggers a browser download for a generated deck without leaving a
 *  dangling object URL behind. */
export function downloadPptForgeBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
