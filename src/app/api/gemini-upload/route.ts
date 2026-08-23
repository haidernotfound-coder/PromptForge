import { NextResponse } from "next/server";
import { isGeminiConfigured, getGeminiApiKeys, getGeminiKeyLabels } from "@/lib/supabase/config";
import { getLastGoodGeminiKeyIndex, setLastGoodGeminiKeyIndex } from "@/lib/admin/groq-router-state";
import { recordGroqUsage, getSystemSettings } from "@/lib/admin/store";
import { uploadFileToGeminiWithRotation, GEMINI_MAX_FILE_BYTES, guessMimeType } from "@/lib/server/gemini";

/**
 * Large-attachment upload path for the Gemini attachment provider.
 *
 * The chat routes (`/api/forge-ai`, `/api/codeforge`, `/api/studyforge`)
 * accept small attachments inlined as base64 directly in their JSON body,
 * same as before. For anything over `GEMINI_INLINE_BYTES_THRESHOLD`, the
 * client instead POSTs the raw file bytes here first; this route streams
 * them straight through to the Gemini Files API (never base64-encoding
 * the file or holding a JSON copy of it) and hands back a `fileUri` the
 * client then includes in the chat request in place of the file's bytes.
 * That keeps the chat endpoint's own JSON payload small regardless of how
 * big the attachment is, and avoids the ~33% size bloat base64 adds.
 *
 * Note: this route's own request body is still subject to whatever body
 * size limit the hosting platform enforces for serverless/edge functions
 * (e.g. Vercel's platform-level function payload limit). The 100 MB figure
 * below is NexPrompt's own attachment policy, not a guarantee every host
 * will accept a request that large — on a platform with a smaller function
 * body cap, very large files may still fail before reaching this code,
 * which is a hosting constraint outside the application layer.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!isGeminiConfigured()) {
    return NextResponse.json(
      { error: "Gemini attachment provider is not configured on this server" },
      { status: 501 }
    );
  }

  const settings = await getSystemSettings();
  if (settings.maintenanceMode) {
    return NextResponse.json({ error: "AI features are temporarily in maintenance mode" }, { status: 503 });
  }

  const name = request.headers.get("x-attachment-name")?.slice(0, 512) || "attachment";
  const declaredType = request.headers.get("x-attachment-type") || request.headers.get("content-type") || "";
  const mimeType = declaredType && declaredType !== "application/octet-stream" ? declaredType : guessMimeType(name);

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > GEMINI_MAX_FILE_BYTES) {
    return NextResponse.json({ error: `${name} is over the 100 MB per-file limit.` }, { status: 413 });
  }

  let buffer: Buffer;
  try {
    const arrayBuffer = await request.arrayBuffer();
    if (arrayBuffer.byteLength > GEMINI_MAX_FILE_BYTES) {
      return NextResponse.json({ error: `${name} is over the 100 MB per-file limit.` }, { status: 413 });
    }
    if (arrayBuffer.byteLength === 0) {
      return NextResponse.json({ error: `${name} is empty.` }, { status: 400 });
    }
    buffer = Buffer.from(arrayBuffer);
  } catch {
    return NextResponse.json({ error: "Couldn't read the uploaded file" }, { status: 400 });
  }

  const keys = getGeminiApiKeys();
  const keyLabels = getGeminiKeyLabels();
  const startIndex = getLastGoodGeminiKeyIndex();

  const result = await uploadFileToGeminiWithRotation(keys, buffer, mimeType, name, startIndex);

  if (result.ok) {
    setLastGoodGeminiKeyIndex(result.goodKeyIndex);
    await recordGroqUsage({ pool: "gemini", keyLabel: keyLabels[result.goodKeyIndex] ?? `key-${result.goodKeyIndex + 1}`, success: true });
    return NextResponse.json({ fileUri: result.fileUri, mimeType: result.mimeType, name });
  }

  await recordGroqUsage({ pool: "gemini", keyLabel: "unknown", success: false });

  if (!result.exhausted) {
    const suffix = result.detail ? `: ${result.detail}` : "";
    return NextResponse.json({ error: `Gemini couldn't process ${name}${suffix}` }, { status: 422 });
  }
  return NextResponse.json(
    { error: "All configured Gemini keys are currently rate-limited or invalid — try again shortly." },
    { status: 429 }
  );
}
