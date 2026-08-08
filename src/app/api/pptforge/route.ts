import { NextResponse } from "next/server";
import { isPptForgeConfigured, getPptForgeApiKeys, getPptForgeKeyLabels } from "@/lib/supabase/config";
import { getLastGoodKeyIndex, setLastGoodKeyIndex } from "@/lib/admin/groq-router-state";
import { recordEvent, recordGroqUsage, getSystemSettings } from "@/lib/admin/store";
import { getAppSessionOrNull } from "@/lib/session";
import {
  PPTFORGE_JSON_INSTRUCTIONS,
  type PptForgeDeckPlan,
  type PptForgeSlidePlan,
} from "@/lib/pptforge-schema";
import { buildPptx } from "@/lib/pptforge-builder";
import { PPTFORGE_MAX_SLIDES, PPTFORGE_MIN_SLIDES, type PptForgeStyle } from "@/lib/pptforge";

/**
 * PPTForge provider wiring — the fourth NexPrompt product's API surface.
 *
 * A sibling of `api/studyforge/route.ts` and `api/codeforge/route.ts`, not a
 * refactor of either: same multi-key retry-on-429/401/403 shape, same
 * admin-store event/usage recording, but its own `PPTFORGE_GROQ_API_KEY_*`
 * pool (falls back to the shared `GROQ_API_KEY_*` pool — see
 * `getPptForgeApiKeys`). Unlike StudyForge/CodeForge there's no local
 * fallback: this route asks Groq for a structured slide *plan* (JSON), then
 * renders that plan to a real .pptx server-side with PptxGenJS
 * (`lib/pptforge-builder.ts`) and streams the file back directly instead of
 * returning JSON.
 */

export const runtime = "nodejs";

const STYLES: PptForgeStyle[] = ["professional", "modern", "minimal", "bold", "academic"];

/** Lets the client show real vs unavailable copy without exposing keys. */
export async function GET() {
  return NextResponse.json({ configured: isPptForgeConfigured() });
}

const SYSTEM_PROMPT = [
  "You are PPTForge, an expert presentation designer and content strategist embedded in NexPrompt.",
  "Given a topic, produce a complete, well-organized slide deck PLAN as JSON — content only, no",
  "markup or design. Keep every slide focused and readable: short phrases, not paragraphs. Never",
  "invent facts presented as precise statistics; if you include numbers for a chart/table, treat",
  "them as reasonable illustrative estimates that support the topic, not as claimed real-world data.",
  PPTFORGE_JSON_INSTRUCTIONS,
].join(" ");

interface GroqCallResult {
  ok: boolean;
  output?: string;
  exhausted?: boolean;
  status?: number;
}

async function callGroqForPlan(apiKey: string, userPrompt: string): Promise<GroqCallResult> {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      max_tokens: 8000,
      temperature: 0.6,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    console.error("PPTForge Groq API error", response.status, await response.text());
    if (response.status === 429 || response.status === 401 || response.status === 403) {
      return { ok: false, exhausted: true };
    }
    return { ok: false, exhausted: false, status: response.status };
  }

  const data = await response.json();
  const output = (data.choices?.[0]?.message?.content ?? "").trim();
  if (!output) return { ok: false, exhausted: false, status: 502 };
  return { ok: true, output };
}

/** Validates + sanitizes the model's JSON into a `PptForgeDeckPlan`,
 *  clamping slide count and stripping malformed slides rather than trusting
 *  the model to have followed every instruction exactly. Returns null (never
 *  throws) on unrecoverable shapes. */
function parseDeckPlan(raw: string, requestedSlides: number, fallbackTitle: string): PptForgeDeckPlan | null {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as Record<string, unknown>;
  const slidesRaw = Array.isArray(obj.slides) ? obj.slides : null;
  if (!slidesRaw || slidesRaw.length === 0) return null;

  const VALID_LAYOUTS = new Set([
    "title",
    "section",
    "bullets",
    "two_column",
    "image",
    "chart",
    "table",
    "quote",
    "comparison",
    "closing",
  ]);

  const slides: PptForgeSlidePlan[] = [];
  for (const entry of slidesRaw) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const layout = typeof e.layout === "string" && VALID_LAYOUTS.has(e.layout) ? (e.layout as PptForgeSlidePlan["layout"]) : "bullets";

    const asStringArray = (v: unknown): string[] | undefined =>
      Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0) : undefined;

    const asColumn = (v: unknown) => {
      if (!v || typeof v !== "object") return undefined;
      const c = v as Record<string, unknown>;
      return {
        heading: typeof c.heading === "string" ? c.heading : "",
        bullets: asStringArray(c.bullets) ?? [],
      };
    };

    const asSeries = (v: unknown) => {
      if (!Array.isArray(v)) return undefined;
      const out = v
        .map((s) => {
          if (!s || typeof s !== "object") return null;
          const so = s as Record<string, unknown>;
          const values = Array.isArray(so.values) ? so.values.filter((n): n is number => typeof n === "number") : [];
          return { name: typeof so.name === "string" ? so.name : "Series", values };
        })
        .filter((s): s is { name: string; values: number[] } => s !== null && s.values.length > 0);
      return out.length > 0 ? out : undefined;
    };

    const asRows = (v: unknown): string[][] | undefined =>
      Array.isArray(v)
        ? v
            .filter((row): row is unknown[] => Array.isArray(row))
            .map((row) => row.map((cell) => (typeof cell === "string" ? cell : String(cell ?? ""))))
        : undefined;

    slides.push({
      layout,
      title: typeof e.title === "string" ? e.title.trim() : undefined,
      subtitle: typeof e.subtitle === "string" ? e.subtitle.trim() : undefined,
      bullets: asStringArray(e.bullets),
      left: asColumn(e.left),
      right: asColumn(e.right),
      imageCaption: typeof e.imageCaption === "string" ? e.imageCaption : undefined,
      chartType: e.chartType === "line" || e.chartType === "pie" ? e.chartType : "bar",
      categories: asStringArray(e.categories),
      series: asSeries(e.series),
      headers: asStringArray(e.headers),
      rows: asRows(e.rows),
      quote: typeof e.quote === "string" ? e.quote : undefined,
      attribution: typeof e.attribution === "string" ? e.attribution : undefined,
      notes: typeof e.notes === "string" ? e.notes.slice(0, 500) : undefined,
    });
  }

  if (slides.length === 0) return null;

  // Guarantee a title slide first and a closing slide last regardless of
  // what the model produced, and clamp to a sane slide-count range.
  if (slides[0].layout !== "title") {
    slides.unshift({ layout: "title", title: fallbackTitle });
  }
  if (slides[slides.length - 1].layout !== "closing") {
    slides.push({ layout: "closing", title: "Thank you" });
  }

  const clampedLen = Math.min(Math.max(slides.length, PPTFORGE_MIN_SLIDES), Math.max(requestedSlides + 2, PPTFORGE_MIN_SLIDES));
  const trimmed = slides.length > clampedLen ? [...slides.slice(0, clampedLen - 1), slides[slides.length - 1]] : slides;

  const title = typeof obj.title === "string" && obj.title.trim() ? obj.title.trim() : fallbackTitle;
  return { title, slides: trimmed };
}

interface RequestBody {
  topic?: string;
  slideCount?: number;
  style?: string;
  detail?: string;
}

export async function POST(request: Request) {
  if (!isPptForgeConfigured()) {
    return NextResponse.json({ error: "PPTForge provider not configured" }, { status: 501 });
  }

  const settings = await getSystemSettings();
  if (settings.maintenanceMode) {
    return NextResponse.json({ error: "AI features are temporarily in maintenance mode" }, { status: 503 });
  }
  if (!settings.pptforgeEnabled) {
    return NextResponse.json({ error: "PPTForge is temporarily disabled" }, { status: 503 });
  }

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const topic = typeof body.topic === "string" ? body.topic.trim() : "";
  if (!topic) {
    return NextResponse.json({ error: "Missing topic" }, { status: 400 });
  }
  if (topic.length > 2000) {
    return NextResponse.json({ error: "Topic is too long" }, { status: 413 });
  }

  const slideCount = Number.isFinite(body.slideCount)
    ? Math.min(PPTFORGE_MAX_SLIDES, Math.max(PPTFORGE_MIN_SLIDES, Math.round(body.slideCount as number)))
    : 8;

  const style: PptForgeStyle = STYLES.includes(body.style as PptForgeStyle) ? (body.style as PptForgeStyle) : "professional";
  const detail = typeof body.detail === "string" ? body.detail.trim().slice(0, 1000) : "";

  const userPrompt = [
    `Topic: ${topic}`,
    `Target slide count: ${slideCount} (including the title and closing slides).`,
    detail ? `Additional instructions from the user: ${detail}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const session = await getAppSessionOrNull();
  const keyLabels = getPptForgeKeyLabels();

  try {
    const keys = getPptForgeApiKeys();
    const startIndex = getLastGoodKeyIndex("pptforge");
    const order = keys.map((_, i) => (startIndex + i) % keys.length);

    let lastFailure: { exhausted: boolean; status?: number } | null = null;
    let plan: PptForgeDeckPlan | null = null;

    for (const i of order) {
      const result = await callGroqForPlan(keys[i], userPrompt);
      await recordGroqUsage({ pool: "pptforge", keyLabel: keyLabels[i] ?? `key-${i + 1}`, success: result.ok });

      if (result.ok && result.output) {
        plan = parseDeckPlan(result.output, slideCount, topic);
        if (!plan) {
          // Valid HTTP response but unusable JSON shape — try the next key
          // rather than failing outright, since a retry can succeed.
          lastFailure = { exhausted: false, status: 502 };
          continue;
        }
        setLastGoodKeyIndex("pptforge", i);
        break;
      }

      lastFailure = result.exhausted ? { exhausted: true } : { exhausted: false, status: result.status };
      if (!result.exhausted) break;
    }

    if (!plan) {
      await recordEvent({
        userLabel: session?.email,
        eventType: "ai.error",
        success: false,
        metadata: { source: "pptforge", reason: lastFailure?.exhausted ? "rate_limited" : "provider_error" },
      });
      if (lastFailure && !lastFailure.exhausted) {
        return NextResponse.json({ error: "PPTForge could not generate a usable slide plan — please try again" }, { status: lastFailure.status ?? 502 });
      }
      return NextResponse.json(
        { error: "All configured PPTForge provider keys are currently rate-limited or invalid" },
        { status: 429 }
      );
    }

    let pptxBuffer: Buffer;
    try {
      pptxBuffer = await buildPptx(plan, style);
    } catch (err) {
      console.error("PPTForge pptx build failed", err);
      await recordEvent({
        userLabel: session?.email,
        eventType: "ai.error",
        success: false,
        metadata: { source: "pptforge", reason: "build_failed" },
      });
      return NextResponse.json({ error: "PPTForge generated a plan but failed to build the .pptx file" }, { status: 500 });
    }

    await recordEvent({ userLabel: session?.email, eventType: "pptforge.generate", success: true });

    const filenameSafe = plan.title.replace(/[^a-zA-Z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60) || "presentation";

    return new NextResponse(new Uint8Array(pptxBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="${filenameSafe}.pptx"`,
        "Content-Length": String(pptxBuffer.length),
      },
    });
  } catch (err) {
    console.error("PPTForge request failed", err);
    await recordEvent({
      userLabel: session?.email,
      eventType: "ai.error",
      success: false,
      metadata: { source: "pptforge", reason: "exception" },
    });
    return NextResponse.json({ error: "PPTForge request failed" }, { status: 502 });
  }
}
