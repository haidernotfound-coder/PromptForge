import { NextResponse } from "next/server";
import { isForgeAiConfigured, getForgeAiApiKeys, getForgeAiKeyLabels, isGeminiConfigured, getGeminiApiKeys, getGeminiKeyLabels } from "@/lib/supabase/config";
import { getLastGoodKeyIndex, setLastGoodKeyIndex, getLastGoodGeminiKeyIndex, setLastGoodGeminiKeyIndex } from "@/lib/admin/groq-router-state";
import { recordEvent, recordGroqUsage, getSystemSettings } from "@/lib/admin/store";
import { getAppSessionOrNull } from "@/lib/session";
import { validateAttachmentPayload, type AttachmentRequestBody } from "@/lib/server/attachment-request";
import { extractDocuments } from "@/lib/server/attachment-extract";
import { runGeminiChat, type GeminiChatTurn } from "@/lib/server/gemini";
import { detectChatIntent } from "@/lib/server/chat-intent";

/**
 * Unified AI Chat provider wiring.
 *
 * Phase 1 made this Forge AI's own route (src/app/api/forge-ai/route.ts)
 * with the <current_prompt> framing swapped for a general-purpose system
 * prompt, so the sidebar chat can talk about anything instead of only "the
 * prompt currently open in the editor". It authenticates with the exact
 * same FORGE_AI_GROQ_API_KEY_* pool (getForgeAiApiKeys) and the same
 * shared Gemini attachment pool -- no new environment variables, no
 * duplicate fallback logic. Gated behind the existing forgeAiEnabled admin
 * toggle for the same reason. This general path is still exactly what runs
 * for plain conversation and for any turn carrying attachments.
 *
 * Phase 2 (Combine All Forge Capabilities) layers lightweight intent
 * detection on top of that (see lib/server/chat-intent.ts): a text-only
 * message that looks like a coding question, a study/quiz request, a
 * "make me a slide deck" request, or an "improve/rewrite/critique this
 * prompt" request is delegated to CodeForge / StudyForge / PPTForge /
 * PromptForge respectively -- by calling that Forge's own existing route
 * (a same-origin, same-server fetch to /api/codeforge, /api/studyforge,
 * /api/pptforge, or /api/ai) instead of re-implementing any of its
 * prompts, models, key pools, or retry logic. Each Forge route still
 * authenticates with its own existing key pool (CODEFORGE_GROQ_API_KEY_*,
 * STUDYFORGE_GROQ_API_KEY_*, PPTFORGE_GROQ_API_KEY_*, GROQ_API_KEY_*) and
 * still records its own admin events/usage exactly as it does when hit
 * directly -- no new environment variables, no duplicated fallback code.
 * If a Forge is unconfigured, disabled, or its keys are exhausted,
 * delegation quietly falls through to the normal general-purpose reply
 * below instead of surfacing that Forge's error -- a wrong intent guess
 * should never break the chat.
 *
 * PPTForge delegation is the one special case: PPTForge's route streams
 * back real .pptx bytes, not JSON. Phase 4 ("Files + Web Search") owns
 * turning generated files into proper in-chat file cards, so until then
 * this route base64-encodes the bytes into a data: link inline in the
 * markdown reply -- a real, downloadable file today, just not the
 * polished file-card UI Phase 4 will add.
 */

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ configured: isForgeAiConfigured() });
}

export interface UnifiedChatMessage {
  role: "user" | "assistant";
  content: string;
}

const SYSTEM_PROMPT = [
  "You are the AI Chat inside NexPrompt, a single unified assistant for the whole platform.",
  "Answer naturally and helpfully on any topic, the way a general-purpose chat assistant would.",
  "You can discuss and help write prompts, code, study material, or presentation content — just answer in plain, well-formatted markdown; you are not restricted to one of those domains.",
  "Use markdown formatting (headings, lists, fenced code blocks with a language tag) whenever it makes a reply easier to read.",
  "Keep replies focused and no longer than the question calls for.",
].join(" ");

type GroqMessageContent =
  | string
  | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;

type GroqMessage = { role: "system" | "user" | "assistant"; content: GroqMessageContent };

type GroqCallResult =
  | { ok: true; output: string }
  | { ok: false; exhausted: true } // 401/403/429 — try the next key
  | { ok: false; exhausted: false; status: number; detail?: string }; // other failure — stop retrying

// Same models/rationale as Forge AI's own route — see the comment there.
const TEXT_MODEL = "openai/gpt-oss-20b";
const VISION_MODEL = "qwen/qwen3.6-27b";

async function callGroq(
  apiKey: string,
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
      temperature: 0.6,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      ...(opts.vision ? { reasoning_format: "hidden" } : {}),
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error("Unified AI Chat Groq API error", response.status, detail);
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

/**
 * Calls the appropriate Forge's own route in-process via a same-origin
 * fetch, matching the exact request contract that route already expects,
 * and returns the plain text/markdown to show in the unified chat -- or
 * null if this intent is not a delegate case, the delegate is not
 * configured/enabled, or the call otherwise failed, in which case the
 * caller falls back to the normal general-purpose reply.
 */
async function tryDelegateToForge(
  intent: ReturnType<typeof detectChatIntent>,
  ctx: {
    origin: string;
    cookie: string;
    cleanMessages: UnifiedChatMessage[];
    images: string[];
    documents: AttachmentRequestBody["documents"];
    contextBlocks: string[];
  }
): Promise<string | null> {
  const call = (path: string, payload: unknown) =>
    fetch(`${ctx.origin}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: ctx.cookie },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

  try {
    if (intent.kind === "code" || intent.kind === "study") {
      const path = intent.kind === "code" ? "/api/codeforge" : "/api/studyforge";
      const res = await call(path, {
        mode: "chat",
        messages: ctx.cleanMessages,
        images: ctx.images,
        documents: ctx.documents,
        contextBlocks: ctx.contextBlocks,
      });
      if (!res.ok) return null; // disabled/not configured/failed — fall back to a normal reply.
      const data = (await res.json()) as { output?: string };
      return typeof data.output === "string" && data.output.trim() ? data.output : null;
    }

    if (intent.kind === "promptforge") {
      const res = await call("/api/ai", { action: intent.action, input: intent.input });
      if (!res.ok) return null;
      const data = (await res.json()) as { output?: string };
      if (typeof data.output !== "string" || !data.output.trim()) return null;
      if (intent.action === "critique") {
        return `Here's the PromptForge critique:\n\n\`\`\`json\n${data.output.trim()}\n\`\`\``;
      }
      return `Here's the ${intent.action}d prompt (via PromptForge):\n\n${data.output.trim()}`;
    }

    if (intent.kind === "ppt") {
      const res = await call("/api/pptforge", { topic: intent.topic, slideCount: 8, style: "professional" });
      if (!res.ok) return null; // PPTForge disabled/not configured/failed — fall back to a normal reply.
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("presentation")) return null; // defensive: not actually a pptx
      const disposition = res.headers.get("content-disposition") ?? "";
      const filenameMatch = disposition.match(/filename="([^"]+)"/);
      const filename = filenameMatch?.[1] ?? "presentation.pptx";
      const buffer = Buffer.from(await res.arrayBuffer());
      const base64 = buffer.toString("base64");
      const dataUrl = `data:application/vnd.openxmlformats-officedocument.presentationml.presentation;base64,${base64}`;
      const sizeKb = (buffer.length / 1024).toFixed(0);
      return `I put together a slide deck for you on **${intent.topic}** using PPTForge's generator — [Download ${filename}](${dataUrl}) (${sizeKb} KB). Tell me if you want a different slide count or style and I'll regenerate it right here.\n\n_(Phase 4 will upgrade this into a proper in-chat file card.)_`;
    }

    return null;
  } catch (err) {
    console.error("Unified AI Chat delegate call failed", err);
    return null;
  }
}

export async function POST(request: Request) {
  if (!isForgeAiConfigured()) {
    return NextResponse.json({ error: "AI Chat provider not configured" }, { status: 501 });
  }

  const settings = await getSystemSettings();
  if (settings.maintenanceMode) {
    return NextResponse.json({ error: "AI features are temporarily in maintenance mode" }, { status: 503 });
  }
  if (!settings.forgeAiEnabled) {
    return NextResponse.json({ error: "AI Chat is currently disabled" }, { status: 403 });
  }

  let body: { messages?: UnifiedChatMessage[] } & AttachmentRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { messages } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "Missing messages" }, { status: 400 });
  }
  const validRoles = new Set(["user", "assistant"]);
  const cleanMessages = messages.filter(
    (m): m is UnifiedChatMessage => Boolean(m) && validRoles.has(m.role) && typeof m.content === "string" && m.content.trim().length > 0
  );
  if (cleanMessages.length === 0) {
    return NextResponse.json({ error: "Missing messages" }, { status: 400 });
  }
  const totalLength = cleanMessages.reduce((sum, m) => sum + m.content.length, 0);
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

  // --- Phase 3: attachment memory -----------------------------------------
  // Extract text from any inline (base64) document on *every* turn that
  // carries one — regardless of whether Gemini is configured and reading
  // the file directly for this reply — purely so the caller can persist it
  // onto the message and replay it as plain-text context on later turns,
  // even if a later turn is answered by a different provider (Groq) or a
  // delegated Forge that never sees the raw file. Large files that went
  // straight to the Gemini Files API (geminiFileUri, no base64) are
  // deliberately skipped here — re-extracting/re-uploading them just for
  // memory would defeat the point of not resending huge files; the
  // assistant's reply about them still becomes part of the replayed
  // conversation history either way.
  const attachmentContext = documents.length ? await extractDocuments(documents) : [];
  // -------------------------------------------------------------------------

  // --- Phase 2: intent routing to the existing Forge modules -------------
  // Attachment turns skip delegation and go straight to the Gemini path
  // below unchanged — attachment-aware delegation is Phase 3/4 territory.
  if (!hasAttachments) {
    const lastUserMessage = [...cleanMessages].reverse().find((m) => m.role === "user");
    const intent = lastUserMessage ? detectChatIntent(lastUserMessage.content) : { kind: "normal" as const };

    const delegated = await tryDelegateToForge(intent, {
      origin: new URL(request.url).origin,
      cookie: request.headers.get("cookie") ?? "",
      cleanMessages,
      images,
      documents,
      contextBlocks: body.contextBlocks ?? [],
    });
    if (delegated) {
      await recordEvent({
        userLabel: session?.email,
        eventType: "forge_ai.chat",
        success: true,
        metadata: { surface: "unified_chat", delegatedTo: intent.kind },
      });
      return NextResponse.json({ output: delegated });
    }
  }
  // -------------------------------------------------------------------------

  // Same reasoning as Forge AI: any turn carrying an image/document routes to
  // Gemini (native file understanding) instead of flattened Groq-vision text.
  if (hasAttachments && isGeminiConfigured()) {
    const geminiHistory: GeminiChatTurn[] = cleanMessages.map((m) => ({ role: m.role, content: m.content }));
    const extraContextText = (body.contextBlocks ?? []).join("\n\n");
    const geminiKeys = getGeminiApiKeys();
    const geminiKeyLabels = getGeminiKeyLabels();
    const startIndex = getLastGoodGeminiKeyIndex();

    const { result, goodKeyIndex, attempts } = await runGeminiChat(
      {
        keys: geminiKeys,
        systemInstruction: SYSTEM_PROMPT,
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
      await recordEvent({ userLabel: session?.email, eventType: "forge_ai.chat", success: true, metadata: { provider: "gemini", surface: "unified_chat" } });
      return NextResponse.json({ output: result.output, attachmentContext });
    }

    await recordEvent({
      userLabel: session?.email,
      eventType: "ai.error",
      success: false,
      metadata: { action: "unified_chat", provider: "gemini", reason: result.exhausted ? "rate_limited" : "provider_error" },
    });

    if (!result.exhausted) {
      const suffix = result.detail ? `: ${result.detail}` : "";
      return NextResponse.json(
        { error: `AI Chat couldn't process the attached file(s)${suffix}` },
        { status: 422 }
      );
    }
    return NextResponse.json(
      { error: "All configured Gemini attachment keys are currently rate-limited or invalid — try again shortly." },
      { status: 429 }
    );
  }

  const extractedDocs = attachmentContext;
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
      const result = await callGroq(keys[i], groqMessages, { vision: useVision });
      await recordGroqUsage({ pool: "forge_ai", keyLabel: keyLabels[i] ?? `key-${i + 1}`, success: result.ok });

      if (result.ok) {
        setLastGoodKeyIndex("forge_ai", i);
        await recordEvent({ userLabel: session?.email, eventType: "forge_ai.chat", success: true, metadata: { surface: "unified_chat" } });
        return NextResponse.json({ output: result.output, attachmentContext });
      }

      lastFailure = result.exhausted ? { exhausted: true } : { exhausted: false, status: result.status, detail: result.detail };

      if (!result.exhausted) break;
    }

    await recordEvent({
      userLabel: session?.email,
      eventType: "ai.error",
      success: false,
      metadata: { action: "unified_chat", reason: lastFailure?.exhausted ? "rate_limited" : "provider_error" },
    });

    if (lastFailure && !lastFailure.exhausted) {
      const suffix = lastFailure.detail ? `: ${lastFailure.detail}` : "";
      return NextResponse.json(
        { error: `AI Chat provider request failed (status ${lastFailure.status ?? "unknown"})${suffix}` },
        { status: lastFailure.status ?? 502 }
      );
    }
    return NextResponse.json(
      { error: "All configured AI Chat provider keys are currently rate-limited or invalid" },
      { status: 429 }
    );
  } catch (err) {
    console.error("Unified AI Chat Groq API request failed", err);
    await recordEvent({
      userLabel: session?.email,
      eventType: "ai.error",
      success: false,
      metadata: { action: "unified_chat", reason: "exception" },
    });
    return NextResponse.json({ error: "AI Chat provider request failed" }, { status: 502 });
  }
}
