/**
 * PPTForge slide-plan schema
 * --------------------------
 * Groq is asked to return JSON matching this shape — a *structured plan*,
 * not prose — so slide layout/design is decided by the builder
 * (`pptforge-builder.ts`), not left to the model. Kept in its own file
 * (no pptxgenjs import) so it's safe to import from client components too.
 */

export type PptForgeLayout =
  | "title"
  | "section"
  | "bullets"
  | "two_column"
  | "image"
  | "chart"
  | "table"
  | "quote"
  | "comparison"
  | "closing";

export interface PptForgeColumn {
  heading: string;
  bullets: string[];
}

export interface PptForgeChartSeries {
  name: string;
  values: number[];
}

export interface PptForgeSlidePlan {
  layout: PptForgeLayout;
  title?: string;
  subtitle?: string;
  /** Short bullets — the builder enforces a sane per-slide cap so slides
   *  don't get overcrowded regardless of what the model returns. */
  bullets?: string[];
  left?: PptForgeColumn;
  right?: PptForgeColumn;
  /** Short label describing the image a real placeholder should suggest,
   *  e.g. "team collaborating around a laptop". */
  imageCaption?: string;
  chartType?: "bar" | "line" | "pie";
  categories?: string[];
  series?: PptForgeChartSeries[];
  headers?: string[];
  rows?: string[][];
  quote?: string;
  attribution?: string;
  /** Optional speaker notes, kept off-slide. */
  notes?: string;
}

export interface PptForgeDeckPlan {
  title: string;
  slides: PptForgeSlidePlan[];
}

/** The exact JSON-shape instructions given to the model — kept next to the
 *  types above so they can't drift apart. */
export const PPTFORGE_JSON_INSTRUCTIONS = `Return ONLY a JSON object, no prose, no markdown fences, matching this shape:
{
  "title": "Deck title",
  "slides": [
    {
      "layout": "title" | "section" | "bullets" | "two_column" | "image" | "chart" | "table" | "quote" | "comparison" | "closing",
      "title": "Slide title (omit for quote)",
      "subtitle": "Optional short subtitle (title/section/closing only)",
      "bullets": ["Short bullet", "Short bullet"],
      "left": { "heading": "...", "bullets": ["...", "..."] },
      "right": { "heading": "...", "bullets": ["...", "..."] },
      "imageCaption": "short description of a fitting image (image layout only)",
      "chartType": "bar" | "line" | "pie",
      "categories": ["Q1", "Q2", "Q3"],
      "series": [{ "name": "Revenue", "values": [10, 20, 30] }],
      "headers": ["Column A", "Column B"],
      "rows": [["a1", "b1"], ["a2", "b2"]],
      "quote": "A short quote",
      "attribution": "Who said it",
      "notes": "Optional short speaker notes"
    }
  ]
}
Rules:
- The FIRST slide must be layout "title" and the LAST slide must be layout "closing".
- Use "section" slides sparingly to break the deck into 2-4 parts for longer decks.
- Vary layouts — do not use "bullets" for every slide. Use "chart" or "table" when the
  content is naturally numeric/comparative, "two_column" or "comparison" for contrasts,
  "image" when a visual would help, "quote" for a strong statement.
- Bullets: max 5 per list, each under 12 words. Never write paragraphs into a bullet.
- "chart".series[].values must have the same length as "categories".
- "table" needs at least 2 columns and 2 data rows, headers included separately from rows.
- Every slide's content must be directly about the requested topic — do not pad with
  generic filler slides unrelated to it.`;
