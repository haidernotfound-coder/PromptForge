import { NextResponse } from "next/server";
import { GoogleGenAI, ApiError, Modality } from "@google/genai";
import { getAppSessionOrNull } from "@/lib/session";
import { getGeminiVoiceApiKeys, isVoiceModeConfigured } from "@/lib/supabase/config";
import { getLastGoodGeminiVoiceKeyIndex, setLastGoodGeminiVoiceKeyIndex } from "@/lib/admin/groq-router-state";

/**
 * Voice Mode token minting.
 *
 * The browser never sees a permanent Gemini API key. Instead, this route
 * (server-side only) uses one of the GEMINI_VOICE_API_KEY_* keys to mint a
 * short-lived ephemeral token via the Gemini API's `authTokens.create`
 * endpoint, and hands *that* back to the client. The client then opens its
 * own direct WebSocket session to the Live API using the ephemeral token
 * as if it were an API key -- audio streams client-to-server directly
 * (lower latency, no audio proxied through this backend), but the token
 * expires quickly and is locked to this app's model/config, so extracting
 * it from the browser is far less damaging than leaking a real key.
 *
 * Same rotation contract as every other key pool in this app
 * (see lib/server/gemini.ts): start from whichever key last worked, retry
 * the next key on a transient/quota/auth failure, remember whichever key
 * succeeded as the new starting point.
 *
 * Web Access Addon (post-Phase-5): the locked session config below also
 * declares Gemini Live's built-in Google Search grounding tool, so Voice
 * Mode can answer with current information mid-call the same way text
 * chat can (see the "search" intent in src/app/api/chat/route.ts) —
 * different provider/mechanism per surface (Groq Compound for text,
 * Gemini Live grounding for voice), same idea.
 */

export const runtime = "nodejs";

// Tokens are locked to this model/config server-side (liveConnectConstraints)
// so the client can never renegotiate a different, unintended configuration
// even if the token value were somehow tampered with.
const VOICE_MODEL = "gemini-3.1-flash-live-preview";

// A session must be *started* within this window of minting the token.
// Kept short since the token is normally consumed within a second or two
// of the client requesting it.
const NEW_SESSION_EXPIRE_MINUTES = 2;
// Once a session has started, it may keep sending/receiving for this long
// before the token itself expires (session resumption can extend an
// individual call beyond this, but a fresh token is needed for a new call
// after this window).
const SESSION_EXPIRE_MINUTES = 30;

function isRetryableTokenError(err: unknown): boolean {
  if (err instanceof ApiError) {
    const status = err.status;
    return status === 429 || status === 401 || status === 403 || status >= 500;
  }
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return msg.includes("fetch failed") || msg.includes("network") || msg.includes("timeout") || msg.includes("econnreset");
  }
  return false;
}

export async function GET() {
  return NextResponse.json({ configured: isVoiceModeConfigured() });
}

export async function POST(request: Request) {
  const session = await getAppSessionOrNull();
  if (!session) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const keys = getGeminiVoiceApiKeys();
  if (keys.length === 0) {
    return NextResponse.json(
      { error: "Voice Mode isn't configured yet. Set GEMINI_VOICE_API_KEY in your environment." },
      { status: 503 }
    );
  }

  // Indices the client already tried this call and had rejected *after*
  // minting succeeded -- i.e. the Live connection itself failed for
  // quota, not the token mint. setLastGoodGeminiVoiceKeyIndex only
  // reflects "minted a token," which isn't the same as "the key actually
  // works," since Live-session quota is checked at connect time, not
  // mint time. Without this, a retry that starts back at the persisted
  // "last good" cursor lands on the exact same already-known-bad key
  // every time, looping forever instead of ever reaching a fresh one.
  let excludeIndices: number[] = [];
  try {
    const body = await request.json();
    if (Array.isArray(body?.excludeKeyIndices)) {
      excludeIndices = body.excludeKeyIndices.filter((n: unknown) => typeof n === "number");
    }
  } catch {
    // No body / not JSON -- normal for the first call of a session.
  }
  const excludeSet = new Set(excludeIndices);

  const startIndex = getLastGoodGeminiVoiceKeyIndex();
  const order = keys
    .map((_, i) => (startIndex + i) % keys.length)
    .filter((i) => !excludeSet.has(i));

  // Every key has already failed this call -- don't bother retrying any
  // of them again, since we already know none currently work.
  if (order.length === 0) {
    return NextResponse.json(
      { error: "All Voice Mode keys are currently rate-limited or unavailable. Please try again shortly." },
      { status: 503 }
    );
  }

  const now = Date.now();
  const expireTime = new Date(now + SESSION_EXPIRE_MINUTES * 60 * 1000).toISOString();
  const newSessionExpireTime = new Date(now + NEW_SESSION_EXPIRE_MINUTES * 60 * 1000).toISOString();

  let lastDetail = "Unknown error";
  for (const i of order) {
    try {
      const client = new GoogleGenAI({
        apiKey: keys[i],
        // authTokens.create (ephemeral tokens for the Live API) is a
        // v1alpha-only feature -- see use-voice-session.ts's connect call,
        // which must match this for the minted token to validate.
        httpOptions: { apiVersion: "v1alpha" },
      });
      const token = await client.authTokens.create({
        config: {
          uses: 1,
          expireTime,
          newSessionExpireTime,
          liveConnectConstraints: {
            model: VOICE_MODEL,
            config: {
              responseModalities: [Modality.AUDIO],
              // Web Access Addon: Gemini Live's own Grounding with Google
              // Search tool, enabled the same way the text-chat attachment
              // path enables it for plain generateContent calls (see
              // lib/server/gemini.ts) -- just set at session-connect time
              // instead of per-request, since a Live session is one
              // long-lived connection rather than one-shot calls. The
              // model decides per-turn whether to actually search;
              // nothing here forces every reply through it. Locked
              // server-side in the token (not left for the client to
              // request) for the same reason the model itself is locked
              // here -- the client can't renegotiate a different tool set
              // even if the token value were tampered with. This is safe
              // to combine with the rest of this config because it's the
              // *only* tool declared for this session: the Gemini API
              // does not support mixing search tools with non-search
              // tools (e.g. function calling) in the same session, and
              // Voice Mode declares no function-calling tools.
              tools: [{ googleSearch: {} }],
              // Keep system-instruction customization possible without
              // trusting the client to supply it -- locked server-side.
              // (Left unset here: the session's default persona is fine
              // for Voice Mode; see use-voice-session.ts for per-call
              // greeting/context text sent as the first realtime input.)
            },
          },
        },
      });

      // Advance the shared cursor to the *next* key, not back to the one
      // that just minted. Minting (authTokens.create) almost always
      // succeeds even for a key whose Live-session quota is actually
      // exhausted -- that's only discovered later, once the client tries
      // to open the WebSocket session (see use-voice-session.ts's
      // excludeKeyIndices retry). If we pinned the cursor to `i` here,
      // every subsequent call -- from every user, since this cursor is
      // shared server-wide -- would start the scan at the same key again,
      // hand it out again, and just keep re-discovering the same quota
      // failure at connect time instead of ever reaching a fresh key.
      // Moving the cursor forward regardless of mint outcome makes the
      // pool actually round-robin across calls.
      setLastGoodGeminiVoiceKeyIndex((i + 1) % keys.length);
      return NextResponse.json({
        token: token.name,
        model: VOICE_MODEL,
        expireTime,
        keyIndex: i,
      });
    } catch (err) {
      console.error("Gemini Live ephemeral token error", err);
      lastDetail = err instanceof Error ? err.message.slice(0, 300) : "Unknown error";
      if (!isRetryableTokenError(err)) break;
    }
  }

  return NextResponse.json(
    { error: "Couldn't start Voice Mode right now. " + lastDetail },
    { status: 502 }
  );
}
