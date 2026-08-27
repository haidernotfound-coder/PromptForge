import { NextResponse } from "next/server";
import { isForgeAiConfigured, getForgeAiApiKeys, getForgeAiKeyLabels, isGeminiConfigured, getGeminiApiKeys, getGeminiKeyLabels } from "@/lib/supabase/config";
import { getLastGoodKeyIndex, setLastGoodKeyIndex, getLastGoodGeminiKeyIndex, setLastGoodGeminiKeyIndex } from "@/lib/admin/groq-router-state";
import { recordEvent, recordGroqUsage, getSystemSettings } from "@/lib/admin/store";
import { getAppSessionOrNull } from "@/lib/session";
import { validateAttachmentPayload, type AttachmentRequestBody } from "@/lib/server/attachment-request";
import { extractDocuments } from "@/lib/server/attachment-extract";
import { runGeminiChat, type GeminiChatTurn } from "@/lib/server/gemini";
import { detectChatIntent } from "@/lib/server/chat-intent";
import { buildFileFromText, toGeneratedFile, type GeneratedFile } from "@/lib/server/file-builder";

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
 * Phase 4 (Files + Web Search) adds two more delegate-style branches on top
 * of Phase 2's:
 *  - PPTForge delegation now returns its .pptx bytes as a structured
 *    `files: GeneratedFile[]` entry (see lib/server/file-builder.ts)
 *    instead of a base64 data: link inlined into the markdown reply, so
 *    the client renders a real in-chat file card.
 *  - A "file" intent ("zip this up", "give me that as a file") packages
 *    the fenced code blocks in the most recent assistant reply (or, with
 *    nothing to package, the reply's own text) into a downloadable
 *    .zip/code/.md file the same way -- purely local packaging (jszip,
 *    already a dependency), no extra model call.
 *  - A "search" intent ("search the web for…", "what's the latest on…")
 *    routes to Gemini with its built-in Google Search grounding tool
 *    enabled, reusing the exact same Gemini key pool every attachment
 *    turn already authenticates with -- no new search API, no new
 *    environment variable. Cited sources are returned as `sources` and
 *    rendered under the reply.
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
  "You are fully capable of viewing and reading attached images, PDFs, DOCX, ZIP, and text/code files whenever the user attaches one — this happens routinely and works well. If the user's message refers to an image or file (e.g. \"read this image\", \"what does this file say\") but no attachment came through with this message, do not claim you are unable to view images or files in general — that would be false. Instead, simply let them know you don't see an attachment on this message and ask them to attach the image or file using the attachment button.",
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
interface DelegateResult {
  output: string;
  files?: GeneratedFile[];
}

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
): Promise<DelegateResult | null> {
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
      return typeof data.output === "string" && data.output.trim() ? { output: data.output } : null;
    }

    if (intent.kind === "promptforge") {
      const res = await call("/api/ai", { action: intent.action, input: intent.input });
      if (!res.ok) return null;
      const data = (await res.json()) as { output?: string };
      if (typeof data.output !== "string" || !data.output.trim()) return null;
      if (intent.action === "critique") {
        return { output: `Here's the PromptForge critique:\n\n\`\`\`json\n${data.output.trim()}\n\`\`\`` };
      }
      return { output: `Here's the ${intent.action}d prompt (via PromptForge):\n\n${data.output.trim()}` };
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
      const file = toGeneratedFile(
        buffer,
        filename,
        "application/vnd.openxmlformats-officedocument.presentationml.presentation"
      );
      return {
        output: `I put together a slide deck for you on **${intent.topic}** using PPTForge's generator — see the file below. Tell me if you want a different slide count or style and I'll regenerate it right here.`,
        files: [file],
      };
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
  // A single message this large (a giant paste) is the one case still worth
  // rejecting outright rather than silently truncating — trimming *within*
  // one message would risk cutting off the very thing the user just asked
  // about.
  const longestMessage = Math.max(...cleanMessages.map((m) => m.content.length));
  if (longestMessage > 200_000) {
    return NextResponse.json({ error: "That message is too long — try trimming it and sending again." }, { status: 413 });
  }
  // A long-running conversation used to hit a hard "Conversation is too
  // long" wall once its *total* content crossed 40,000 chars — and since
  // every request always resends the full history, that wall never went
  // away again: every future message in that conversation failed forever.
  // Instead, keep only as much of the tail of the conversation as fits a
  // generous context budget, dropping the oldest turns first. The newest
  // user message (the one actually being answered) is always kept even if
  // it alone were somehow close to the budget.
  const MAX_CONVERSATION_CHARS = 120_000;
  const windowedMessages = ((): UnifiedChatMessage[] => {
    if (totalLength <= MAX_CONVERSATION_CHARS) return cleanMessages;
    const kept = [...cleanMessages];
    let remaining = totalLength;
    while (kept.length > 1 && remaining > MAX_CONVERSATION_CHARS) {
      const dropped = kept.shift();
      remaining -= dropped?.content.length ?? 0;
    }
    return kept;
  })();

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

  // --- Phase 2/4: intent routing to the existing Forge modules -----------
  // Attachment turns skip delegation and go straight to the Gemini path
  // below unchanged — attachment-aware delegation is Phase 3/4 territory.
  if (!hasAttachments) {
    const reversedUserMessages = [...windowedMessages].reverse().filter((m) => m.role === "user");
    const lastUserMessage = reversedUserMessages[0];
    // Second-most-recent user message — used as a topic fallback when the
    // latest message is a bare "send me .pptx file"/"make me a ppt" with
    // no topic of its own (see detectChatIntent's ppt branch).
    const priorUserMessage = reversedUserMessages[1]?.content;
    const intent = lastUserMessage ? detectChatIntent(lastUserMessage.content, priorUserMessage) : { kind: "normal" as const };

    // --- Phase 4: "package this as a file" — purely local, no model call.
    // Packages the most recent assistant reply (what "this"/"that" refers
    // to in "zip this up") into real bytes via lib/server/file-builder.ts.
    // Falls through to a normal reply if there's nothing yet to package.
    if (intent.kind === "file") {
      const lastAssistantMessage = [...windowedMessages].reverse().find((m) => m.role === "assistant");
      if (lastAssistantMessage) {
        const file = await buildFileFromText(lastAssistantMessage.content, intent.topic);
        await recordEvent({
          userLabel: session?.email,
          eventType: "forge_ai.chat",
          success: true,
          metadata: { surface: "unified_chat", delegatedTo: "file" },
        });
        return NextResponse.json({
          output: `Here's **${file.name}** — packaged from my last reply.`,
          files: [file],
        });
      }
      // Nothing to package yet — fall through to a normal reply below.
    }

    // --- Phase 4: web search — grounds the reply in live Google Search
    // results via Gemini's own search tool (see lib/server/gemini.ts).
    // Falls through to the normal reply below if Gemini isn't configured
    // or the grounded call fails, same "never break the chat" contract as
    // every other delegate.
    if (intent.kind === "search" && isGeminiConfigured()) {
      const geminiHistory: GeminiChatTurn[] = windowedMessages.map((m) => ({ role: m.role, content: m.content }));
      const geminiKeys = getGeminiApiKeys();
      const geminiKeyLabels = getGeminiKeyLabels();
      const startIndex = getLastGoodGeminiKeyIndex();

      const { result, goodKeyIndex, attempts } = await runGeminiChat(
        {
          keys: geminiKeys,
          systemInstruction: `${SYSTEM_PROMPT} You have live web search available for this reply — use it to answer with current information, and briefly mention when something is time-sensitive.`,
          history: geminiHistory,
          extraContextText: (body.contextBlocks ?? []).join("\n\n"),
          enableWebSearch: true,
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
        await recordEvent({
          userLabel: session?.email,
          eventType: "forge_ai.chat",
          success: true,
          metadata: { surface: "unified_chat", delegatedTo: "search" },
        });
        return NextResponse.json({ output: result.output, sources: result.sources ?? [] });
      }
      // Search call failed — fall through to the normal reply below rather
      // than surfacing a search-specific error for what's still just chat.
    }

    const delegated = await tryDelegateToForge(intent, {
      origin: new URL(request.url).origin,
      cookie: request.headers.get("cookie") ?? "",
      cleanMessages: windowedMessages,
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
      return NextResponse.json({ output: delegated.output, files: delegated.files });
    }
  }
  // -------------------------------------------------------------------------

  // Same reasoning as Forge AI: any turn carrying an image/document routes to
  // Gemini (native file understanding) instead of flattened Groq-vision text.
  if (hasAttachments && isGeminiConfigured()) {
    const geminiHistory: GeminiChatTurn[] = windowedMessages.map((m) => ({ role: m.role, content: m.content }));
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

  const groqMessages: GroqMessage[] = windowedMessages.map((m, idx) => {
    const isLastUser = idx === windowedMessages.length - 1 && m.role === "user";
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
