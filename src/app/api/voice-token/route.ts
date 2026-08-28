import { NextResponse } from "next/server";
import { GoogleGenAI, ApiError, Modality, StartSensitivity, EndSensitivity } from "@google/genai";
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
// Reverted back to 3.1 Flash Live: an earlier pass swapped this to a 2.5
// native-audio snapshot after a one-off GET /v1alpha/models check didn't
// list 3.1 for this project, but 3.1 was minting and connecting fine in
// practice, and the 2.5 native-audio family has widely-reported, still-
// open upstream issues with inputTranscription lag/truncation (e.g.
// googleapis/python-genai#2117, and the Gemini API forum thread
// "Significant delay with Gemini Live 2.5 Flash (native audio)") -- that
// lag is exactly what showed up as ~20s-to-transcript in this app after
// the swap. 3.1 Flash Live has no such reports and is the model that was
// actually fast for this project. If 3.1 ever genuinely stops being
// available (a real 404/"model not found" on connect, not just an
// incomplete models-list snapshot), that's the trigger to reconsider --
// not a single listing check.
const VOICE_MODEL = "gemini-live-2.5-flash";

// A session must be *started* within this window of minting the token.
// Kept short since the token is normally consumed within a second or two
// of the client requesting it.
const NEW_SESSION_EXPIRE_MINUTES = 2;
// Once a session has started, it may keep sending/receiving for this long
// before the token itself expires (session resumption can extend an
// individual call beyond this, but a fresh token is needed for a new call
// after this window).
const SESSION_EXPIRE_MINUTES = 30;

// 401/403 are auth/config problems (bad key, API not enabled for that
// project, billing not set up, key restricted to other APIs) -- NOT
// quota. They're still worth moving on to the next key for (this key is
// broken, try another), but they must not be reported to the user as
// "rate limited": that hides a config mistake behind a message telling
// the person to just wait, when actually the key needs to be fixed.
function isAuthOrConfigError(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 401 || err.status === 403);
}

function isQuotaError(err: unknown): boolean {
  return err instanceof ApiError && err.status === 429;
}

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
  // Tracks *why* keys failed across this pass so the final error message
  // reflects reality: auth/config problems (bad key, API not enabled,
  // billing missing) look identical to quota exhaustion from the outer
  // retry loop's perspective, but they need a completely different fix
  // and telling the person to "try again shortly" for a config mistake
  // just wastes their time.
  let anyAuthOrConfigFailure = false;
  let anyQuotaFailure = false;
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
              // Text transcripts of both sides of the call -- without
              // these, the client's onmessage handler never receives
              // content.inputTranscription / outputTranscription events,
              // so the transcript panel in voice-panel.tsx stays empty
              // even though audio plays fine. Must be locked here (not
              // only requested client-side in use-voice-session.ts's
              // connectSession config) because liveConnectConstraints is
              // what the server actually enforces for a token-authed
              // session -- the client-side config passed to
              // ai.live.connect() is only honored insofar as the token
              // doesn't already pin the relevant fields. Some Live models
              // silently drop transcription if it's only requested
              // client-side instead of being part of the locked config.
              inputAudioTranscription: {},
              outputAudioTranscription: {},
              // gemini-2.5-flash-native-audio-latest uses thinkingBudget
              // (not 3.1's thinkingLevel) and, left unset, can default to
              // a non-zero thinking budget -- adding a real chunk of
              // silent "thinking" time before the first audio token comes
              // back, which is what was showing up as a flat 2-3s delay
              // on every turn. Voice Mode wants the lowest-latency
              // response over deeper reasoning, so this pins it to zero.
              thinkingConfig: { thinkingBudget: 0 },
              // VAD config. Two things previously believed about this
              // setting turned out to be wrong, confirmed by a captured
              // session's raw server messages (RAW onmessage logging in
              // use-voice-session.ts): with silenceDurationMs: 100, the
              // server went SILENT for 66 seconds across 15+ onset/
              // audioStreamEnd cycles, then finally responded to a
              // "Hello" with promptTokenCount: 460 -- i.e. it was not
              // dropping those turns, it was silently ACCUMULATING every
              // fragment into one giant buffered prompt instead of
              // treating each as a complete, respondable utterance.
              // Google's own Live API capabilities guide explains exactly
              // this failure mode: "the server's internal default is
              // approximately 800ms... too low (100-200ms): the system
              // ends speech turns during natural pauses, splitting a
              // single utterance into multiple small audio fragments...
              // resulting in lower transcription and response quality."
              // This setting was mis-modeled here as purely an "end of
              // turn, respond now" trigger to minimize per the earlier
              // Hybrid VAD idea -- it's actually what the server uses to
              // decide whether it has a COMPLETE utterance worth
              // responding to at all, which is a different job. Restored
              // to Google's own recommended range. Sensitivity stays LOW
              // (fine either way -- it wasn't implicated by the captured
              // evidence) so the client-side hangover in
              // use-voice-session.ts still owns perceived end-of-turn
              // timing for the UI/audioStreamEnd call; this setting is
              // solely about the server's own utterance-completeness
              // buffering, which needs the value Google documents.
              realtimeInputConfig: {
                automaticActivityDetection: {
                  startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_LOW,
                  endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW,
                  prefixPaddingMs: 200,
                  silenceDurationMs: 800,
                },
              },
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
      if (isAuthOrConfigError(err)) anyAuthOrConfigFailure = true;
      if (isQuotaError(err)) anyQuotaFailure = true;
      if (!isRetryableTokenError(err)) break;
    }
  }

  // Every key in the pool failed. Quota exhaustion and "this model isn't
  // actually available on your tier/project" both surface from Google as
  // 429 RESOURCE_EXHAUSTED, but they need completely different fixes --
  // waiting does nothing for the latter. If literally every key failed
  // with the same 429 and zero of them ever got past minting, that's the
  // classic signature of a preview/Live model not being enabled for a
  // free-tier project rather than real per-key usage exhaustion (real
  // exhaustion usually staggers across keys created at different times).
  const likelyTierOrEligibilityIssue = anyQuotaFailure && !anyAuthOrConfigFailure;
  const message = likelyTierOrEligibilityIssue
    ? `Voice Mode couldn't get a session on any configured key (${VOICE_MODEL}). If your Gemini API keys are on the free tier, check that this model actually appears in GET /v1alpha/models for your key -- if it's missing there, that confirms an eligibility/availability issue rather than real quota use, and switching VOICE_MODEL to a model that does appear in that list is the fix (not waiting for a daily reset). Raw error: ${lastDetail}`
    : "Couldn't start Voice Mode right now. " + lastDetail;

  return NextResponse.json({ error: message }, { status: 502 });
}
