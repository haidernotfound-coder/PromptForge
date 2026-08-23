import { NextResponse } from "next/server";
import { isForgeAiConfigured, getForgeAiApiKeys, getForgeAiKeyLabels, isGeminiConfigured, getGeminiApiKeys, getGeminiKeyLabels } from "@/lib/supabase/config";
import { getLastGoodKeyIndex, setLastGoodKeyIndex, getLastGoodGeminiKeyIndex, setLastGoodGeminiKeyIndex } from "@/lib/admin/groq-router-state";
import { recordEvent, recordGroqUsage, getSystemSettings } from "@/lib/admin/store";
import { getAppSessionOrNull } from "@/lib/session";
import { validateAttachmentPayload, type AttachmentRequestBody } from "@/lib/server/attachment-request";
import { extractDocuments } from "@/lib/server/attachment-extract";
import { runGeminiChat, type GeminiChatTurn } from "@/lib/server/gemini";

/**
 * Forge AI provider wiring — the floating chat panel's own endpoint.
 *
 * This is a deliberate sibling of `src/app/api/ai/route.ts`, not a
 * refactor of it: Forge AI is multi-turn chat about a prompt (arbitrary
 * back-and-forth, full message history sent each call) rather than a
 * single fire-and-forget transform, and per your request it authenticates
 * with its own `FORGE_AI_GROQ_API_KEY_1`..`_5` key pool (see
 * `getForgeAiApiKeys` in `lib/supabase/config.ts`) instead of the
 * `GROQ_API_KEY_*` pool the Improve/Rewrite/Expand/Shorten/Critique
 * actions use — so the two features can be configured, rotated, and
 * rate-limited independently. The request/response shape and the
 * same-key-pool multi-key retry-on-429/401/403 logic are intentionally
 * mirrored from that route, since that behavior is exactly what's wanted
 * here too — only the key source and payload shape differ.
 */

export const runtime = "nodejs";

/** Lets the client show real-chat vs demo-mode copy without ever exposing
 *  the keys themselves. */
export async function GET() {
  return NextResponse.json({ configured: isForgeAiConfigured() });
}

export interface ForgeAiChatMessage {
  role: "user" | "assistant";
  content: string;
}

const SYSTEM_PROMPT = [
  "You are Forge AI, a focused prompt-engineering assistant embedded in NexPrompt's prompt editor.",
  "You're chatting with the user about ONE specific prompt they're currently editing, provided below as <current_prompt>.",
  "Help them refine, debug, extend, or think through this prompt: answer questions about it, suggest concrete improvements, or produce a revised version when asked.",
  "The prompt may contain {{variable}} placeholders — treat those as intentional reusable slots. If you propose a revised prompt, preserve every {{variable}} placeholder that should stay, exactly as written.",
  "When you propose a full revised version of the prompt, put ONLY that revised prompt text inside a fenced code block (```) so the app can offer it as a one-click Apply — don't wrap explanation text in the code block, just the prompt itself.",
  "Keep replies focused and concise. This is a working session, not an essay.",
].join(" ");

type GroqMessageContent =
  | string
  | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;

type GroqMessage = { role: "system" | "user" | "assistant"; content: GroqMessageContent };

type GroqCallResult =
  | { ok: true; output: string }
  | { ok: false; exhausted: true } // 401/403/429 — try the next key
  | { ok: false; exhausted: false; status: number; detail?: string }; // other failure — stop retrying

// Text-only model as before; switched to a vision-capable one when the
// user has attached images, same approach as StudyForge's route.
// llama-3.1-8b-instant and meta-llama/llama-4-scout-17b-16e-instruct were
// deprecated by Groq (announced 2026-06-17, see console.groq.com/docs/deprecations)
// and now fail every request with a non-2xx "model_decommissioned" error.
// Groq's own recommended replacements:
const TEXT_MODEL = "openai/gpt-oss-20b";
const VISION_MODEL = "qwen/qwen3.6-27b";

async function callGroq(
  apiKey: string,
  promptBody: string,
  messages: GroqMessage[],
  opts: { vision?: boolean } = {}
): Promise<GroqCallResult> {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: opts.vision ? VISION_MODEL : TEXT_MODEL,
      max_tokens: 2000,
      temperature: 0.5,
      messages: [
        { role: "system", content: `${SYSTEM_PROMPT}\n\n<current_prompt>\n${promptBody || "(empty — nothing written yet)"}\n</current_prompt>` },
        ...messages,
      ],
      // Qwen models emit inline <think> reasoning by default — hide it so
      // it never leaks into the response content.
      ...(opts.vision ? { reasoning_format: "hidden" } : {}),
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error("Forge AI Groq API error", response.status, detail);
    if (response.status === 429 || response.status === 401 || response.status === 403) {
      return { ok: false, exhausted: true };
    }
    return { ok: false, exhausted: false, status: response.status, detail: detail.slice(0, 500) };
  }

  const data = await response.json();
  const output = (data.choices?.[0]?.message?.content ?? "").trim();
  if (!output) {
    return { ok: false, exhausted: false, status: 502 };
  }
  return { ok: true, output };
}

export async function POST(request: Request) {
  if (!isForgeAiConfigured()) {
    return NextResponse.json({ error: "Forge AI provider not configured" }, { status: 501 });
  }

  const settings = await getSystemSettings();
  if (settings.maintenanceMode) {
    return NextResponse.json({ error: "AI features are temporarily in maintenance mode" }, { status: 503 });
  }
  if (!settings.forgeAiEnabled) {
    return NextResponse.json({ error: "Forge AI is currently disabled" }, { status: 403 });
  }

  let body: { promptBody?: string; messages?: ForgeAiChatMessage[] } & AttachmentRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { promptBody, messages } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "Missing messages" }, { status: 400 });
  }
  if (typeof promptBody !== "string") {
    return NextResponse.json({ error: "Missing promptBody" }, { status: 400 });
  }
  const validRoles = new Set(["user", "assistant"]);
  const cleanMessages = messages.filter(
    (m): m is ForgeAiChatMessage => Boolean(m) && validRoles.has(m.role) && typeof m.content === "string" && m.content.trim().length > 0
  );
  if (cleanMessages.length === 0) {
    return NextResponse.json({ error: "Missing messages" }, { status: 400 });
  }
  const totalLength = promptBody.length + cleanMessages.reduce((sum, m) => sum + m.content.length, 0);
  if (totalLength > 40_000) {
    return NextResponse.json({ error: "Conversation is too long" }, { status: 413 });
  }

  const attachmentError = validateAttachmentPayload(body);
  if (attachmentError) {
    return NextResponse.json({ error: attachmentError }, { status: 413 });
  }

  const images = body.images ?? [];
  const documents = body.documents ?? [];
  const hasAttachments = images.length > 0 || documents.length > 0;
  const session = await getAppSessionOrNull();

  // Any turn carrying an image or document is routed to Gemini instead of
  // Groq — it can actually read PDFs/DOCX/ZIPs/images natively, rather than
  // a flattened text extraction plus a single vision model. Plain text/code
  // attachments (already extracted client-side into contextBlocks) don't
  // need this — they stay on the normal Groq path either way.
  if (hasAttachments && isGeminiConfigured()) {
    const geminiHistory: GeminiChatTurn[] = cleanMessages.map((m) => ({ role: m.role, content: m.content }));
    const extraContextText = (body.contextBlocks ?? []).join("\n\n");
    const geminiKeys = getGeminiApiKeys();
    const geminiKeyLabels = getGeminiKeyLabels();
    const startIndex = getLastGoodGeminiKeyIndex();

    const { result, goodKeyIndex, attempts } = await runGeminiChat(
      {
        keys: geminiKeys,
        systemInstruction: `${SYSTEM_PROMPT}\n\n<current_prompt>\n${promptBody || "(empty — nothing written yet)"}\n</current_prompt>`,
        history: geminiHistory,
        images: images.map((dataUrl) => ({ dataUrl })),
        documents: documents.map((d) => ({ name: d.name, mimeType: d.mimeType, base64: d.base64, geminiFileUri: d.geminiFileUri })),
        extraContextText,
      },
      startIndex
    );

    for (const attempt of attempts) {
      await recordGroqUsage({ pool: "gemini", keyLabel: geminiKeyLabels[attempt.keyIndex] ?? `key-${attempt.keyIndex + 1}`, success: false });
    }

    if (result.ok) {
      if (goodKeyIndex !== undefined) {
        setLastGoodGeminiKeyIndex(goodKeyIndex);
        await recordGroqUsage({ pool: "gemini", keyLabel: geminiKeyLabels[goodKeyIndex] ?? `key-${goodKeyIndex + 1}`, success: true });
      }
      await recordEvent({ userLabel: session?.email, eventType: "forge_ai.chat", success: true, metadata: { provider: "gemini" } });
      return NextResponse.json({ output: result.output });
    }

    await recordEvent({
      userLabel: session?.email,
      eventType: "ai.error",
      success: false,
      metadata: { action: "forge_ai_chat", provider: "gemini", reason: result.exhausted ? "rate_limited" : "provider_error" },
    });

    if (!result.exhausted) {
      const suffix = result.detail ? `: ${result.detail}` : "";
      return NextResponse.json(
        { error: `Forge AI couldn't process the attached file(s)${suffix}` },
        { status: 422 }
      );
    }
    return NextResponse.json(
      { error: "All configured Gemini attachment keys are currently rate-limited or invalid — try again shortly." },
      { status: 429 }
    );
  }

  // No attachments (or Gemini isn't configured — fall back to the local
  // text-extraction + Groq-vision path so attachments still work in
  // reduced form on a Groq-only install).
  const extractedDocs = documents.length ? await extractDocuments(documents) : [];
  const contextText = [
    ...(body.contextBlocks ?? []),
    ...extractedDocs.map((d) => `<file name="${d.name}">\n${d.text}\n</file>`),
  ].join("\n\n");

  const useVision = images.length > 0;

  const groqMessages: GroqMessage[] = cleanMessages.map((m, idx) => {
    const isLastUser = idx === cleanMessages.length - 1 && m.role === "user";
    if (!isLastUser || (!contextText && images.length === 0)) {
      return { role: m.role, content: m.content };
    }
    const textPart = contextText ? `${m.content}\n\n${contextText}` : m.content;
    if (images.length === 0) {
      return { role: m.role, content: textPart };
    }
    return {
      role: m.role,
      content: [
        { type: "text", text: textPart },
        ...images.map((url) => ({ type: "image_url" as const, image_url: { url } })),
      ],
    };
  });

  const keyLabels = getForgeAiKeyLabels();

  try {
    const keys = getForgeAiApiKeys();
    const startIndex = getLastGoodKeyIndex("forge_ai");
    const order = keys.map((_, i) => (startIndex + i) % keys.length);

    let lastFailure: { exhausted: boolean; status?: number; detail?: string } | null = null;

    for (const i of order) {
      const result = await callGroq(keys[i], promptBody, groqMessages, { vision: useVision });
      await recordGroqUsage({ pool: "forge_ai", keyLabel: keyLabels[i] ?? `key-${i + 1}`, success: result.ok });

      if (result.ok) {
        setLastGoodKeyIndex("forge_ai", i);
        await recordEvent({ userLabel: session?.email, eventType: "forge_ai.chat", success: true });
        return NextResponse.json({ output: result.output });
      }

      lastFailure = result.exhausted ? { exhausted: true } : { exhausted: false, status: result.status, detail: result.detail };

      if (!result.exhausted) break;
    }

    await recordEvent({
      userLabel: session?.email,
      eventType: "ai.error",
      success: false,
      metadata: { action: "forge_ai_chat", reason: lastFailure?.exhausted ? "rate_limited" : "provider_error" },
    });

    if (lastFailure && !lastFailure.exhausted) {
      const suffix = lastFailure.detail ? `: ${lastFailure.detail}` : "";
      return NextResponse.json(
        { error: `Forge AI provider request failed (status ${lastFailure.status ?? "unknown"})${suffix}` },
        { status: lastFailure.status ?? 502 }
      );
    }
    return NextResponse.json(
      { error: "All configured Forge AI provider keys are currently rate-limited or invalid" },
      { status: 429 }
    );
  } catch (err) {
    console.error("Forge AI Groq API request failed", err);
    await recordEvent({
      userLabel: session?.email,
      eventType: "ai.error",
      success: false,
      metadata: { action: "forge_ai_chat", reason: "exception" },
    });
    return NextResponse.json({ error: "Forge AI provider request failed" }, { status: 502 });
  }
}
