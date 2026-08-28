"use client";

import * as React from "react";
import { GoogleGenAI, Modality, StartSensitivity, EndSensitivity, type Session, type LiveServerMessage, type GroundingMetadata } from "@google/genai";

/**
 * Voice Mode session hook.
 *
 * Owns the whole real-time audio (+ optional video) lifecycle: requesting
 * an ephemeral token from our server (never a permanent key), opening a
 * direct browser-to-Gemini WebSocket session via the Live API, capturing
 * the microphone and streaming it as 16-bit PCM @ 16kHz, playing back the
 * model's 24kHz PCM audio with sample-accurate scheduling that can be
 * cleared instantly on a barge-in interruption, and -- when the camera is
 * turned on -- sampling video frames as JPEG stills at ~1fps (the Live
 * API's documented cap for video input) so Gemini can see and react to
 * whatever the camera is pointed at.
 *
 * State machine: idle -> connecting -> listening <-> thinking <-> speaking,
 * with "listening" being the resting state while connected (mic open,
 * nothing queued) and "thinking" being a best-effort UI-only gap between
 * end-of-user-speech and the first audio chunk coming back (the API itself
 * has no explicit "thinking" signal -- it's inferred client-side from the
 * transcription/turn events below).
 *
 * Mute and camera are both independent of the underlying session: muting
 * stops audio chunks from being sent (the mic track itself stays open, so
 * unmuting is instant with no re-prompt) and the camera can be toggled on
 * or off, or switched between front/back, at any point during a live call.
 */

export type VoiceState = "idle" | "connecting" | "listening" | "thinking" | "speaking" | "error";
export type CameraFacing = "user" | "environment";

/** `torch` is a real, widely-supported (Chrome/Android) MediaTrackConstraint
 *  for turning a camera's flashlight on/off, but it's non-standard and
 *  missing from lib.dom.d.ts's MediaTrackCapabilities -- this is just the
 *  minimal shape we read off `track.getCapabilities()` to feature-detect
 *  it before offering the flashlight button. */
interface TorchCapabilities {
  torch?: boolean;
}

export interface VoiceTurn {
  id: string;
  role: "user" | "model";
  text: string;
  final: boolean;
  /** Web Access Addon: (title, uri) pairs Gemini Live's Google Search
   *  grounding cited for this turn, when the model chose to search —
   *  undefined/empty otherwise. Rendered under the turn in voice-panel.tsx
   *  and persisted onto the saved ChatMessage exactly like a text-chat
   *  search reply's sources (see turnsToMessages in voice-panel.tsx). */
  sources?: { title: string; uri: string }[];
}

export interface UseVoiceSessionResult {
  state: VoiceState;
  error: string | null;
  turns: VoiceTurn[];
  /** True once the browser has granted mic access for this session. */
  micGranted: boolean;
  /** True while the mic is muted (no audio sent to Gemini). */
  muted: boolean;
  /** True while the camera is on and streaming frames to Gemini. */
  cameraOn: boolean;
  /** Which physical camera is active when cameraOn is true. */
  cameraFacing: CameraFacing;
  /** True if the active camera track supports a flashlight/torch. Only
   *  meaningful while cameraOn is true -- most front/selfie cameras and
   *  most desktop webcams don't support this at all. */
  torchSupported: boolean;
  /** True while the flashlight is on. */
  torchOn: boolean;
  /** Attach to a <video> element to show the local camera preview. */
  videoRef: React.RefObject<HTMLVideoElement>;
  start: (initialTurns?: VoiceTurn[]) => Promise<void>;
  stop: () => void;
  toggleMute: () => void;
  toggleCamera: () => Promise<void>;
  switchCamera: () => Promise<void>;
  toggleTorch: () => Promise<void>;
}

const INPUT_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;
// ScriptProcessorNode buffer size, in samples at the *input device's*
// sample rate (before downsampling to 16kHz) -- this fires
// onaudioprocess and ships a chunk to Gemini every time it fills. Google's
// Live API best-practices guide is explicit: send small 20-40ms chunks,
// not up to a full second of buffering, since every extra millisecond
// buffered here is added latency before the model even sees the audio.
// The previous value (4096) was actually ~256ms at 16kHz -- nowhere near
// the recommended range despite the comment that used to be here -- and
// was very likely the dominant contributor to the "5 seconds before my
// own transcript even shows up" symptom, compounding with the model's
// own end-of-speech silence detection below. 512 samples is exactly 32ms
// at 16kHz, inside Google's documented sweet spot. Some browsers may
// only support power-of-two sizes >= 256 for ScriptProcessorNode; 512 is
// safe everywhere this app targets.
const PROCESSOR_BUFFER_SIZE = 512;
// The Live API documents video input as capped at roughly 1 frame/sec --
// sending faster wastes bandwidth without adding anything the model uses.
const VIDEO_FRAME_INTERVAL_MS = 1000;
const VIDEO_MAX_DIMENSION = 768;
const VIDEO_JPEG_QUALITY = 0.7;

function floatTo16BitPCM(float32: Float32Array): Int16Array {
  const out = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

function downsampleTo16k(input: Float32Array, inputSampleRate: number): Float32Array {
  if (inputSampleRate === INPUT_SAMPLE_RATE) return input;
  const ratio = inputSampleRate / INPUT_SAMPLE_RATE;
  const newLength = Math.round(input.length / ratio);
  const result = new Float32Array(newLength);
  let offsetResult = 0;
  let offsetInput = 0;
  while (offsetResult < newLength) {
    const nextOffsetInput = Math.round((offsetResult + 1) * ratio);
    let accum = 0;
    let count = 0;
    for (let i = offsetInput; i < nextOffsetInput && i < input.length; i++) {
      accum += input[i];
      count++;
    }
    result[offsetResult] = count > 0 ? accum / count : 0;
    offsetResult++;
    offsetInput = nextOffsetInput;
  }
  return result;
}

function base64ToInt16(base64: string): Int16Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Int16Array(bytes.buffer);
}

function int16ToBase64(int16: Int16Array): string {
  const bytes = new Uint8Array(int16.buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

let turnIdCounter = 0;
function nextTurnId() {
  turnIdCounter += 1;
  return `voice-turn-${Date.now()}-${turnIdCounter}`;
}

/** Pulls (title, uri) pairs out of Gemini Live's groundingMetadata — same
 *  groundingChunks[].web.{uri,title} shape extractSearchSources in
 *  lib/server/gemini.ts reads for the text-chat search path, just sourced
 *  from the Live API's streamed serverContent instead of a single
 *  generateContent response. Best-effort/never-throws, same as that
 *  function, since grounding metadata's shape is additive/optional. */
function extractGroundingSources(metadata: GroundingMetadata): { title: string; uri: string }[] {
  try {
    const chunks = metadata.groundingChunks ?? [];
    const seen = new Set<string>();
    const sources: { title: string; uri: string }[] = [];
    for (const chunk of chunks) {
      const uri = chunk.web?.uri;
      const title = chunk.web?.title;
      if (!uri || seen.has(uri)) continue;
      seen.add(uri);
      sources.push({ title: title || uri, uri });
    }
    return sources;
  } catch {
    return [];
  }
}

/** Merges newly-arrived sources onto a turn's existing ones, deduped by
 *  uri -- grounding metadata can arrive across more than one server
 *  message for a single turn (e.g. the model runs more than one search
 *  before finishing its answer). */
function mergeSources(
  existing: { title: string; uri: string }[] | undefined,
  incoming: { title: string; uri: string }[]
): { title: string; uri: string }[] {
  if (!existing?.length) return incoming;
  const seen = new Set(existing.map((s) => s.uri));
  const merged = [...existing];
  for (const s of incoming) {
    if (seen.has(s.uri)) continue;
    seen.add(s.uri);
    merged.push(s);
  }
  return merged;
}

/** Returns the stream's video track if it exists and reports torch support
 *  via getCapabilities(), or null otherwise. getCapabilities() itself is
 *  unsupported on some browsers (notably iOS Safari) and just throws or
 *  returns {} there, which we treat the same as "no torch". */
function getTorchTrack(stream: MediaStream | null): MediaStreamTrack | null {
  const track = stream?.getVideoTracks()[0];
  if (!track) return null;
  try {
    const caps = track.getCapabilities?.() as TorchCapabilities | undefined;
    return caps?.torch ? track : null;
  } catch {
    return null;
  }
}

export function useVoiceSession(): UseVoiceSessionResult {
  const [state, setState] = React.useState<VoiceState>("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [turns, setTurns] = React.useState<VoiceTurn[]>([]);
  const [micGranted, setMicGranted] = React.useState(false);
  const [muted, setMuted] = React.useState(false);
  const [cameraOn, setCameraOn] = React.useState(false);
  const [cameraFacing, setCameraFacing] = React.useState<CameraFacing>("user");
  const [torchOn, setTorchOn] = React.useState(false);
  const [torchSupported, setTorchSupported] = React.useState(false);

  const sessionRef = React.useRef<Session | null>(null);
  const micStreamRef = React.useRef<MediaStream | null>(null);
  const inputAudioCtxRef = React.useRef<AudioContext | null>(null);
  const processorRef = React.useRef<ScriptProcessorNode | null>(null);
  const sourceNodeRef = React.useRef<MediaStreamAudioSourceNode | null>(null);
  const mutedRef = React.useRef(false);

  const outputAudioCtxRef = React.useRef<AudioContext | null>(null);
  // Scheduling cursor (in AudioContext time) for gapless sequential
  // playback of incoming 24kHz PCM chunks.
  const playCursorRef = React.useRef(0);
  const scheduledSourcesRef = React.useRef<Set<AudioBufferSourceNode>>(new Set());

  const videoRef = React.useRef<HTMLVideoElement>(null);
  const cameraStreamRef = React.useRef<MediaStream | null>(null);
  const videoCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const videoIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const cameraFacingRef = React.useRef<CameraFacing>("user");

  const currentModelTurnIdRef = React.useRef<string | null>(null);
  const currentUserTurnIdRef = React.useRef<string | null>(null);
  // Tracks whether an audio chunk has already been scheduled for the
  // in-progress model turn -- deliberately separate from
  // currentModelTurnIdRef (which outputTranscription sets) because audio
  // and transcription can arrive as separate onmessage events in either
  // order (per the Live API docs: "a single event can contain multiple
  // content parts"). If transcription happened to arrive first,
  // currentModelTurnIdRef would already be non-null by the time the
  // first real audio chunk shows up, which would wrongly read as "not
  // the first chunk" and skip the playback-cursor resync in
  // playAudioChunk. Reset alongside currentModelTurnIdRef wherever a
  // turn ends or is interrupted.
  const audioStartedForTurnRef = React.useRef(false);
  const stoppedRef = React.useRef(false);

  // How many times start() has retried the *connection* itself (fresh
  // token + fresh ai.live.connect()) after a quota-flavored rejection.
  // Separate from the /api/voice-token route's own key rotation: that
  // route only rotates across keys while minting a token, so a key that
  // mints fine but is actually out of Live-session quota only reveals
  // that once the WebSocket handshake is rejected -- which happens after
  // the token response already came back "successful". This ref lets the
  // retry loop below survive across the async gap without racing a
  // second concurrent start() call (guarded by the sessionRef.current
  // check at the top of start()).
  const connectRetriesRef = React.useRef(0);
  // Hard cap independent of the current key-pool size so a future config
  // change can't accidentally spin through dozens of connect attempts in
  // a row; a handful of tries is enough to skip past a couple of
  // exhausted keys without the user waiting too long for an error.
  const MAX_CONNECT_RETRIES = 6;
  // A session must stay open this long past onopen before we trust it
  // enough to reset the retry counter. Without this delay, a key that
  // passes the WebSocket handshake but then gets killed by server-side
  // quota validation a moment later would refill the retry budget on
  // every single attempt -- exactly the "connecting -> listening ->
  // connecting" loop this guards against.
  const OPEN_STABLE_RESET_MS = 4000;
  const openResetTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  function isQuotaLikeCloseOrError(reasonOrMessage: string | undefined): boolean {
    if (!reasonOrMessage) return false;
    const s = reasonOrMessage.toLowerCase();
    return (
      s.includes("resource_exhausted") ||
      s.includes("quota") ||
      s.includes("429") ||
      s.includes("rate limit") ||
      s.includes("unavailable") ||
      s.includes("503")
    );
  }

  const stopVideoCapture = React.useCallback(() => {
    if (videoIntervalRef.current) {
      clearInterval(videoIntervalRef.current);
      videoIntervalRef.current = null;
    }
    cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
    cameraStreamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.style.transform = "none";
    }
    setCameraOn(false);
    setTorchOn(false);
    setTorchSupported(false);
  }, []);

  const cleanupAudioIO = React.useCallback(() => {
    processorRef.current?.disconnect();
    processorRef.current = null;
    sourceNodeRef.current?.disconnect();
    sourceNodeRef.current = null;
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    if (inputAudioCtxRef.current && inputAudioCtxRef.current.state !== "closed") {
      inputAudioCtxRef.current.close().catch(() => {});
    }
    inputAudioCtxRef.current = null;

    scheduledSourcesRef.current.forEach((src) => {
      try {
        src.stop();
      } catch {
        // already stopped
      }
    });
    scheduledSourcesRef.current.clear();
    if (outputAudioCtxRef.current && outputAudioCtxRef.current.state !== "closed") {
      outputAudioCtxRef.current.close().catch(() => {});
    }
    outputAudioCtxRef.current = null;
    playCursorRef.current = 0;

    stopVideoCapture();
  }, [stopVideoCapture]);

  const stop = React.useCallback(() => {
    stoppedRef.current = true;
    if (openResetTimerRef.current) {
      clearTimeout(openResetTimerRef.current);
      openResetTimerRef.current = null;
    }
    sessionRef.current?.close();
    sessionRef.current = null;
    cleanupAudioIO();
    setState("idle");
    setMuted(false);
    mutedRef.current = false;
    currentModelTurnIdRef.current = null;
    currentUserTurnIdRef.current = null;
    audioStartedForTurnRef.current = false;
  }, [cleanupAudioIO]);

  const toggleMute = React.useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      mutedRef.current = next;
      return next;
    });
  }, []);

  // Grabs one frame from the live <video> preview, downscales it onto a
  // hidden canvas, and JPEG-encodes it for sendRealtimeInput. Runs on an
  // interval while the camera is on -- capped at ~1fps per the Live API's
  // documented video input guidance.
  const captureAndSendFrame = React.useCallback(() => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || !sessionRef.current) return;

    let canvas = videoCanvasRef.current;
    if (!canvas) {
      canvas = document.createElement("canvas");
      videoCanvasRef.current = canvas;
    }
    const scale = Math.min(1, VIDEO_MAX_DIMENSION / Math.max(video.videoWidth, video.videoHeight));
    const width = Math.max(1, Math.round(video.videoWidth * scale));
    const height = Math.max(1, Math.round(video.videoHeight * scale));
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, width, height);

    const dataUrl = canvas.toDataURL("image/jpeg", VIDEO_JPEG_QUALITY);
    const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);

    try {
      sessionRef.current.sendRealtimeInput({
        video: { data: base64, mimeType: "image/jpeg" },
      });
    } catch {
      // Session may have just closed -- drop this frame.
    }
  }, []);

  const openCamera = React.useCallback(async (facing: CameraFacing) => {
    // Release the current camera track *before* requesting the new facing
    // mode. This was the actual bug behind "switch camera doesn't work":
    // most browsers only let one active MediaStream hold a given camera
    // device at a time, so if the old track is still live when the new
    // getUserMedia() call goes out, the browser either hands back the same
    // physical camera or silently ignores the facingMode hint entirely.
    cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
    cameraStreamRef.current = null;

    let stream: MediaStream;
    try {
      // `exact` actually forces the switch (rather than being a hint the
      // browser can ignore) on devices that do have both cameras.
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { exact: facing }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
    } catch (err) {
      // No camera matching that exact facing mode (common on laptops/
      // desktops, which only expose one camera reported as "user") --
      // fall back to an unconstrained request rather than failing the
      // whole switch outright.
      if (err instanceof DOMException && (err.name === "OverconstrainedError" || err.name === "NotFoundError")) {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
      } else {
        throw err;
      }
    }

    if (stoppedRef.current) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    cameraStreamRef.current = stream;
    cameraFacingRef.current = facing;
    setCameraFacing(facing);
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      // Front camera is mirrored for a natural "selfie" preview, same as
      // every other camera app; the back camera is shown unmirrored so
      // what Gemini sees on screen matches reality.
      videoRef.current.style.transform = facing === "user" ? "scaleX(-1)" : "none";
      await videoRef.current.play().catch(() => {});
    }
    setTorchOn(false);
    setTorchSupported(getTorchTrack(stream) !== null);
  }, []);

  const toggleCamera = React.useCallback(async () => {
    if (cameraOn) {
      stopVideoCapture();
      return;
    }
    try {
      await openCamera(cameraFacingRef.current);
      setCameraOn(true);
      videoIntervalRef.current = setInterval(captureAndSendFrame, VIDEO_FRAME_INTERVAL_MS);
    } catch (err) {
      console.error("Camera start failed", err);
      let message = "Couldn't start the camera.";
      if (err instanceof DOMException) {
        if (err.name === "NotAllowedError") {
          message = "Camera access was denied. Allow camera access in your browser's site settings and try again.";
        } else if (err.name === "NotFoundError" || err.name === "OverconstrainedError") {
          message = "No camera was found on this device.";
        } else if (err.name === "NotReadableError") {
          message = "The camera is already in use by another app.";
        } else if (err.name === "SecurityError") {
          // Thrown when the Permissions-Policy header (or an iframe's
          // `allow` attribute) blocks the Camera API outright -- the
          // browser never even shows a permission prompt in this case,
          // so "denied" would be misleading here.
          message = "Camera access is blocked for this site (security policy). Contact the site admin.";
        }
      }
      setError(message);
    }
  }, [cameraOn, openCamera, stopVideoCapture, captureAndSendFrame]);

  const switchCamera = React.useCallback(async () => {
    if (!cameraOn) return;
    const next: CameraFacing = cameraFacingRef.current === "user" ? "environment" : "user";
    try {
      await openCamera(next);
    } catch (err) {
      console.error("Camera switch failed", err);
      // Some devices only expose one camera -- keep the existing stream
      // running rather than leaving the user with no video at all.
    }
  }, [cameraOn, openCamera]);

  const toggleTorch = React.useCallback(async () => {
    const track = getTorchTrack(cameraStreamRef.current);
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      setTorchOn(next);
    } catch (err) {
      console.error("Torch toggle failed", err);
      // Leave torchOn as-is -- most likely cause is the browser reporting
      // torch support via getCapabilities() but rejecting applyConstraints
      // anyway (seen on some Android/Chrome versions when the camera was
      // just opened), so surface nothing rather than a misleading error
      // for what's a minor, non-essential feature.
    }
  }, [torchOn]);

  // Stop any queued playback immediately -- used both for barge-in
  // (interrupted signal) and for cleanup.
  const clearPlaybackQueue = React.useCallback(() => {
    scheduledSourcesRef.current.forEach((src) => {
      try {
        src.stop();
      } catch {
        // already stopped
      }
    });
    scheduledSourcesRef.current.clear();
    if (outputAudioCtxRef.current) {
      playCursorRef.current = outputAudioCtxRef.current.currentTime;
    }
  }, []);

  const playAudioChunk = React.useCallback((base64Data: string, isFirstChunkOfTurn: boolean) => {
    let ctx = outputAudioCtxRef.current;
    if (!ctx || ctx.state === "closed") {
      ctx = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE });
      outputAudioCtxRef.current = ctx;
      playCursorRef.current = ctx.currentTime;
    } else if (isFirstChunkOfTurn) {
      // Resync the scheduling cursor to real "now" at the start of every
      // new model turn, not just on barge-in (clearPlaybackQueue) or full
      // session teardown. Without this, playCursorRef only ever moves
      // forward (see the Math.max below) and is never pulled back to
      // ctx.currentTime between turns. If a turn's audio chunks ever
      // arrive from the server even slightly faster than they play back
      // -- entirely plausible, since the whole reply can be generated and
      // streamed down in a burst -- the cursor ends up sitting ahead of
      // real time by the time that turn ends. The next turn's first
      // chunk then gets scheduled onto that already-advanced cursor
      // instead of "now", producing silent dead air before playback
      // starts even though the chunk was received right away -- and
      // because nothing ever resyncs it, this drift compounds turn after
      // turn within one call (matches the reported symptom: first reply
      // fast, every reply after it progressively more delayed). Only
      // resyncing on the first chunk of a turn (not every chunk) is
      // deliberate -- mid-turn chunks must stay scheduled back-to-back
      // via the existing Math.max logic below for gapless playback
      // within a single reply. This is a forced assignment, NOT
      // Math.max(playCursorRef.current, ctx.currentTime) -- if the
      // cursor has drifted ahead of real time, it's the drifted value
      // that's wrong and needs correcting back down; taking the max of
      // the two would just keep the already-drifted (larger) value and
      // silently no-op this entire fix.
      playCursorRef.current = ctx.currentTime;
    }

    const pcm16 = base64ToInt16(base64Data);
    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 0x8000;

    const buffer = ctx.createBuffer(1, float32.length, OUTPUT_SAMPLE_RATE);
    buffer.copyToChannel(float32, 0);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    const startAt = Math.max(playCursorRef.current, ctx.currentTime);
    if (isFirstChunkOfTurn) {
      // Direct measurement, not inference: how far in the future (in ms
      // of AudioContext time, which runs independently of
      // performance.now() but at the same rate) this turn's first chunk
      // is actually scheduled to start relative to ctx.currentTime right
      // now. If the playCursorRef-drift theory is right, this should be
      // ~0ms after the resync fix and would have been large/growing
      // turn-over-turn before it. If this stays near 0 and the person
      // still hears/reports a delay, the drift theory is ruled out and
      // the real cause is upstream of playback scheduling entirely (the
      // network/model-generation latency measured by the existing
      // "first model audio chunk received" log, which is a separate,
      // already-confirmed source of the delay this fix was never meant
      // to address).
      console.log(`[VoiceMode timing] first chunk of turn scheduled ${((startAt - ctx.currentTime) * 1000).toFixed(0)}ms ahead of real time (ctx.currentTime=${ctx.currentTime.toFixed(3)}s) @ ${performance.now().toFixed(0)}ms`);
    }
    source.start(startAt);
    playCursorRef.current = startAt + buffer.duration;

    scheduledSourcesRef.current.add(source);
    source.onended = () => {
      scheduledSourcesRef.current.delete(source);
    };
  }, []);

  const handleServerMessage = React.useCallback(
    (message: LiveServerMessage) => {
      // As of March 2026, some Live API native-audio models stopped
      // resolving Grounding-with-Google-Search server-side in some
      // regions and instead surface it to the client as an ordinary
      // function call (see Google AI forum reports for
      // gemini-live-2.5-flash-native-audio). This app has no real
      // search backend to answer that call with, but the Live API
      // protocol expects *some* FunctionResponse before it will
      // continue the turn -- without one, the session can stall
      // waiting on a reply that never comes. Responding with an empty
      // result lets the model gracefully fall back to answering from
      // its own knowledge instead of the call hanging silently, which
      // is the best available behavior until this app adds a real
      // search tool implementation for voice.
      if (message.toolCall?.functionCalls?.length && sessionRef.current) {
        console.warn(
          "[VoiceMode] Received an unexpected tool/function call from the Live session -- this model may not be resolving Grounding with Google Search server-side. Responding empty so the turn doesn't stall.",
          message.toolCall.functionCalls.map((c) => c.name)
        );
        try {
          sessionRef.current.sendToolResponse({
            functionResponses: message.toolCall.functionCalls.map((call) => ({
              id: call.id,
              name: call.name,
              response: { result: "" },
            })),
          });
        } catch {
          // Session may have just closed -- nothing more to do.
        }
      }

      const content = message.serverContent;
      if (!content) return;

      if (content.interrupted) {
        clearPlaybackQueue();
        setState("listening");
        currentModelTurnIdRef.current = null;
        audioStartedForTurnRef.current = false;
      }

      if (content.modelTurn?.parts) {
        let playedAudio = false;
        for (const part of content.modelTurn.parts) {
          if (part.inlineData?.data) {
            const isFirstChunkOfTurn = !audioStartedForTurnRef.current;
            audioStartedForTurnRef.current = true;
            if (!playedAudio) {
              console.log(`[VoiceMode timing] first model audio chunk received @ ${performance.now().toFixed(0)}ms`);
            }
            playAudioChunk(part.inlineData.data, isFirstChunkOfTurn);
            playedAudio = true;
          }
        }
        if (playedAudio) setState("speaking");
      }

      if (content.outputTranscription?.text) {
        const text = content.outputTranscription.text;
        setState("speaking");
        setTurns((prev) => {
          let id = currentModelTurnIdRef.current;
          if (!id) {
            id = nextTurnId();
            currentModelTurnIdRef.current = id;
            return [...prev, { id, role: "model", text, final: false }];
          }
          return prev.map((t) => (t.id === id ? { ...t, text: t.text + text } : t));
        });
      }

      // Web Access Addon: grounding metadata arrives independently of
      // transcription/audio ordering (same as the Gemini docs note for
      // input/output transcription above), so this only attaches sources
      // if a model turn is already in progress -- if it arrives before
      // any transcription text for this turn, the sources are simply
      // attached to the empty in-progress turn and show up once text
      // starts filling in. Extraction mirrors extractSearchSources in
      // lib/server/gemini.ts (same groundingChunks[].web.{uri,title}
      // shape) since it's the same Gemini API concept, just delivered via
      // the Live API's streamed serverContent instead of one
      // generateContent response.
      if (content.groundingMetadata) {
        const sources = extractGroundingSources(content.groundingMetadata);
        if (sources.length && currentModelTurnIdRef.current) {
          const id = currentModelTurnIdRef.current;
          setTurns((prev) =>
            prev.map((t) => (t.id === id ? { ...t, sources: mergeSources(t.sources, sources) } : t))
          );
        }
      }

      if (content.inputTranscription?.text) {
        const text = content.inputTranscription.text;
        if (!currentUserTurnIdRef.current) {
          console.log(`[VoiceMode timing] first inputTranscription chunk received @ ${performance.now().toFixed(0)}ms:`, JSON.stringify(text));
        }
        setTurns((prev) => {
          let id = currentUserTurnIdRef.current;
          if (!id) {
            id = nextTurnId();
            currentUserTurnIdRef.current = id;
            return [...prev, { id, role: "user", text, final: false }];
          }
          return prev.map((t) => (t.id === id ? { ...t, text: t.text + text } : t));
        });
        // Heard the user talking -- if we were mid-reply that's the model
        // getting interrupted (handled above); otherwise this is the
        // approximate "thinking" gap start once they stop.
      }

      if (content.turnComplete) {
        setTurns((prev) =>
          prev.map((t) =>
            t.id === currentModelTurnIdRef.current || t.id === currentUserTurnIdRef.current
              ? { ...t, final: true }
              : t
          )
        );
        currentModelTurnIdRef.current = null;
        currentUserTurnIdRef.current = null;
        audioStartedForTurnRef.current = false;
        setState((s) => (s === "speaking" ? "listening" : s));
      }

      if (content.generationComplete && !content.turnComplete) {
        // Model finished generating but is still waiting for playback to
        // drain -- keep showing "speaking" (handled by the scheduled
        // sources already queued) rather than snapping back early.
      }
    },
    [clearPlaybackQueue, playAudioChunk]
  );

  // Key indices that minted a token successfully but whose Live
  // connection then failed for this call -- sent to /api/voice-token so
  // it routes around them instead of handing back the same known-bad key
  // (see the route's excludeKeyIndices handling). Reset per start().
  const failedKeyIndicesRef = React.useRef<number[]>([]);

  // Mints a fresh ephemeral token and opens the Live session. Pulled out
  // of start() so a quota-flavored rejection at connect time can call this
  // again with a brand new token -- which, via /api/voice-token's own
  // rotation, is very likely minted from a *different* key in the pool --
  // instead of the whole call just dying on whichever single key it
  // happened to draw first.
  const connectSession = React.useCallback(async (): Promise<Session> => {
    const tokenRes = await fetch("/api/voice-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ excludeKeyIndices: failedKeyIndicesRef.current }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.token) {
      throw new Error(tokenData.error || "Couldn't start Voice Mode.");
    }
    const usedKeyIndex: number | undefined = tokenData.keyIndex;

    const ai = new GoogleGenAI({
      apiKey: tokenData.token,
      // Ephemeral auth tokens (see api/voice-token/route.ts) are only
      // supported under the v1alpha API surface -- without this, the
      // WebSocket handshake still succeeds (onopen fires) but the server
      // rejects the token a few seconds in once it's actually validated,
      // which looks like the call silently hanging up on its own.
      httpOptions: { apiVersion: "v1alpha" },
    });

    return ai.live.connect({
      model: tokenData.model,
      config: {
        responseModalities: [Modality.AUDIO],
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        // Mirrors the zero thinking budget locked into the token
        // server-side (see api/voice-token/route.ts) -- keeps this
        // description accurate to what the session actually runs with.
        thinkingConfig: { thinkingBudget: 0 },
        // Mirrors the hybrid-VAD config locked into the token server-side
        // (see api/voice-token/route.ts) so this description matches
        // what the session actually runs with -- server VAD is
        // deliberately LOW/LOW + short silenceDurationMs here, acting
        // only as a fallback, because end-of-speech is now decided
        // client-side (audioStreamEnd, sent from the RMS-based detector
        // further down this file) per Google's documented Hybrid VAD
        // pattern.
        realtimeInputConfig: {
          automaticActivityDetection: {
            startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_LOW,
            endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW,
            prefixPaddingMs: 20,
            silenceDurationMs: 100,
          },
        },
        // Web Access Addon: mirrors the googleSearch tool already locked
        // into this token server-side (see api/voice-token/route.ts).
        // Declaring it again here isn't strictly required -- the token's
        // liveConnectConstraints is what actually enforces it -- but
        // keeps this client-side config an accurate description of the
        // session it's opening rather than silently relying on a value
        // the client never states.
        tools: [{ googleSearch: {} }],
      },
      callbacks: {
        onopen: () => {
          if (stoppedRef.current) return;
          // NOTE: deliberately NOT resetting connectRetriesRef here.
          // onopen only means the WebSocket handshake succeeded -- Gemini
          // Live can still reject the session a few seconds later once it
          // actually validates quota server-side, which looks exactly
          // like a fresh "connecting -> listening -> connecting" cycle.
          // Resetting the counter on every onopen let a fully-exhausted
          // key pool retry forever (each attempt got just far enough to
          // hit onopen before being killed, refilling the budget every
          // time) instead of ever reaching MAX_CONNECT_RETRIES and
          // surfacing an error. The counter (and the failed-key list
          // below) only reset in start() for a brand new call, plus once
          // here after a session has stayed open long enough to trust it.
          setState("listening");
          if (openResetTimerRef.current) clearTimeout(openResetTimerRef.current);
          openResetTimerRef.current = setTimeout(() => {
            if (stoppedRef.current) return;
            connectRetriesRef.current = 0;
            failedKeyIndicesRef.current = [];
          }, OPEN_STABLE_RESET_MS);
        },
        onmessage: (message: LiveServerMessage) => {
          if (stoppedRef.current) return;
          handleServerMessage(message);
        },
        onerror: (e) => {
          if (stoppedRef.current) return;
          console.error("[VoiceMode] Live session onerror", { message: e.message, keyIndex: usedKeyIndex });
          if (usedKeyIndex !== undefined && !failedKeyIndicesRef.current.includes(usedKeyIndex)) {
            failedKeyIndicesRef.current = [...failedKeyIndicesRef.current, usedKeyIndex];
          }
          void handleDisconnect(e.message);
        },
        onclose: (e) => {
          if (stoppedRef.current) return;
          // Reaching here means the server closed the socket without the
          // user hanging up (stop() always sets stoppedRef first).
          console.error("[VoiceMode] Live session onclose", {
            code: e?.code,
            reason: e?.reason,
            wasClean: e?.wasClean,
            keyIndex: usedKeyIndex,
          });
          if (usedKeyIndex !== undefined && !failedKeyIndicesRef.current.includes(usedKeyIndex)) {
            failedKeyIndicesRef.current = [...failedKeyIndicesRef.current, usedKeyIndex];
          }
          void handleDisconnect(e?.reason);
        },
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleServerMessage]);

  // Guards against onerror and onclose both firing for the same
  // WebSocket failure (a very common pattern -- onerror fires, then
  // onclose fires immediately after for the same underlying rejection)
  // and each independently calling handleDisconnect. Without this, two
  // concurrent retry chains can run at once, each with its own backoff
  // delay, making the *combined* stream of connect attempts look like it
  // has no backoff at all even though each individual chain does.
  const handlingDisconnectRef = React.useRef(false);

  // Shared onerror/onclose handler: retries the connection (new token,
  // likely a new key) on anything that looks like a quota/transient
  // rejection, up to MAX_CONNECT_RETRIES; otherwise surfaces the error as
  // before. Defined with function (not useCallback) so it can be declared
  // after connectSession while still being referenced from inside it via
  // closure -- both are stable for the lifetime of a single start() call.
  async function handleDisconnect(reasonOrMessage: string | undefined) {
    if (stoppedRef.current) return;
    if (handlingDisconnectRef.current) return;
    handlingDisconnectRef.current = true;
    try {
      await handleDisconnectInner(reasonOrMessage);
    } finally {
      handlingDisconnectRef.current = false;
    }
  }

  async function handleDisconnectInner(reasonOrMessage: string | undefined) {
    if (stoppedRef.current) return;
    if (openResetTimerRef.current) {
      clearTimeout(openResetTimerRef.current);
      openResetTimerRef.current = null;
    }
    const canRetry =
      connectRetriesRef.current < MAX_CONNECT_RETRIES && isQuotaLikeCloseOrError(reasonOrMessage);
    if (!canRetry) {
      setError(reasonOrMessage || "Voice call ended unexpectedly.");
      setState("error");
      sessionRef.current = null;
      return;
    }
    // Backoff before retrying. Without this, a real per-minute rate limit
    // gets hammered with a fresh connect the instant the previous one is
    // rejected -- which can itself look like abusive traffic to the
    // limiter and keep every key looking "exhausted" even when the
    // underlying quota would have recovered within a second or two.
    // Exponential with a little jitter so a burst of users hitting the
    // same limit at once don't all retry in lockstep.
    const attempt = connectRetriesRef.current; // 0 on first retry
    const backoffMs = Math.min(1000 * 2 ** attempt, 15000) + Math.floor(Math.random() * 300);
    connectRetriesRef.current += 1;
    sessionRef.current = null;
    setState("connecting");
    await new Promise((resolve) => setTimeout(resolve, backoffMs));
    if (stoppedRef.current) return;
    try {
      const session = await connectSession();
      if (stoppedRef.current) {
        session.close();
        return;
      }
      sessionRef.current = session;
    } catch (err) {
      if (stoppedRef.current) return;
      // The retried connect attempt itself failed outright (e.g. the
      // fetch to /api/voice-token failed, or every key in the pool is
      // exhausted) -- treat it as one more quota-like failure and either
      // retry again or give up per the same cap, rather than a distinct
      // error path. Calls the inner function directly (not the guarded
      // wrapper) since we're already inside a single handleDisconnect
      // invocation -- this is a sequential continuation of it, not a
      // second concurrent event.
      const message = err instanceof Error ? err.message : "Couldn't start Voice Mode.";
      await handleDisconnectInner(message);
    }
  }

  const start = React.useCallback(async (initialTurns?: VoiceTurn[]) => {
    if (sessionRef.current) return;
    stoppedRef.current = false;
    connectRetriesRef.current = 0;
    failedKeyIndicesRef.current = [];
    setError(null);
    // Resuming a previously-saved voice conversation preloads its
    // transcript so it's visible immediately, rather than starting the
    // panel blank and only showing turns from this new call onward. New
    // turns from this call are simply appended onto it as they arrive.
    setTurns(initialTurns ?? []);
    setMuted(false);
    mutedRef.current = false;
    setState("connecting");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      if (stoppedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      micStreamRef.current = stream;
      setMicGranted(true);

      const session = await connectSession();
      if (stoppedRef.current) {
        session.close();
        return;
      }
      sessionRef.current = session;

      // Mic capture pipeline: MediaStream -> ScriptProcessorNode (grabs raw
      // float samples) -> downsample to 16kHz if needed -> 16-bit PCM ->
      // base64 -> sendRealtimeInput. AudioWorklet would avoid the main
      // thread hop ScriptProcessorNode requires, but ScriptProcessorNode
      // needs no separate worklet module file and is supported everywhere
      // this app targets; the callback work here is cheap enough that the
      // deprecation's main downside (occasional jank on a busy main
      // thread) isn't a practical issue for a voice UI.
      const inputCtx = new AudioContext();
      inputAudioCtxRef.current = inputCtx;
      const source = inputCtx.createMediaStreamSource(stream);
      sourceNodeRef.current = source;
      const processor = inputCtx.createScriptProcessor(PROCESSOR_BUFFER_SIZE, 1, 1);
      processorRef.current = processor;

      // Hybrid VAD, matching Google's own documented pattern for this
      // exact latency problem (see "Hybrid VAD" in the Live API
      // capabilities guide): server-side automaticActivityDetection
      // (configured below, now LOW sensitivity / short silenceDurationMs)
      // is kept on only as a fallback for robust start-of-speech
      // detection, while THIS client-side detector owns end-of-speech and
      // sends audioStreamEnd -- which the docs describe as bypassing the
      // server's own (slower, and per multiple open upstream bug reports,
      // unreliable at honoring its own configured silenceDurationMs)
      // end-of-turn decision.
      //
      // History of what was tried before this that DIDN'T work:
      // 1) A 350ms client hangover with a single 0.01 RMS threshold --
      //    fired on ordinary mid-sentence pauses, fragmenting utterances.
      // 2) Removing audioStreamEnd entirely -- avoided fragmentation but
      //    reintroduced multi-second delays from unreliable server VAD.
      // 3) A 700ms hangover, still with a single 0.01 threshold -- this
      //    was expected to fix it but a real session still showed
      //    2.9-3.3s onset-to-audioStreamEnd gaps. Root cause: a SINGLE
      //    RMS threshold has no hysteresis. Real speech trails off
      //    gradually rather than cutting off cleanly, so as it decays the
      //    RMS flickers back and forth across 0.01 several times --  and
      //    every uptick above 0.01, even a single stray sample, reset
      //    silenceStartedAt to null and restarted the whole 700ms count
      //    from zero. The visible 700ms hangover was actually being
      //    re-triggered 3-4x per utterance before it ever ran
      //    uninterrupted, which is exactly what produced multi-second
      //    real-world delays out of a 700ms setting.
      // Fix: two thresholds (hysteresis). SPEECH_RMS_THRESHOLD marks the
      // onset of real speech; a lower SILENCE_RMS_THRESHOLD is what's
      // required to count as truly silent enough to start/continue the
      // hangover countdown. The gap between them absorbs trailing-decay
      // flicker without needing a long, latency-costly hangover to paper
      // over it.
      const SPEECH_RMS_THRESHOLD = 0.01; // empirical: crossing this counts as "started talking"
      const SILENCE_RMS_THRESHOLD = 0.004; // deliberately lower than SPEECH_RMS_THRESHOLD -- trailing voice decay stays above this long enough that it no longer bounces the hangover timer
      const SILENCE_HANGOVER_MS = 500; // now safe to shorten again since it's no longer being restarted by decay flicker
      let hasHeardSpeech = false;
      let silenceStartedAt: number | null = null;
      let streamEndSent = true; // starts "ended" -- nothing to flush until real speech begins

      processor.onaudioprocess = (event) => {
        if (stoppedRef.current || !sessionRef.current || mutedRef.current) return;
        const input = event.inputBuffer.getChannelData(0);

        let sumSquares = 0;
        for (let i = 0; i < input.length; i++) sumSquares += input[i] * input[i];
        const rms = Math.sqrt(sumSquares / input.length);
        const now = performance.now();

        if (rms >= SPEECH_RMS_THRESHOLD) {
          if (!hasHeardSpeech) {
            console.log(`[VoiceMode timing] speech onset detected (mic RMS crossed threshold) @ ${performance.now().toFixed(0)}ms`);
          }
          hasHeardSpeech = true;
          silenceStartedAt = null;
          streamEndSent = false;
        } else if (hasHeardSpeech && !streamEndSent && rms < SILENCE_RMS_THRESHOLD) {
          if (silenceStartedAt === null) silenceStartedAt = now;
          if (now - silenceStartedAt >= SILENCE_HANGOVER_MS) {
            streamEndSent = true;
            hasHeardSpeech = false;
            try {
              sessionRef.current.sendRealtimeInput({ audioStreamEnd: true });
              console.log(`[VoiceMode timing] audioStreamEnd sent @ ${performance.now().toFixed(0)}ms`);
            } catch {
              // Session may have just closed -- nothing more to signal.
            }
            // Stream is considered ended as of this callback -- skip
            // sending this (silent) chunk too. Speech resuming crosses
            // the RMS threshold again on the very next callback, which
            // reopens the stream naturally via the branch above.
            return;
          }
        }
        // Note: RMS values in the dead zone between SILENCE_RMS_THRESHOLD
        // and SPEECH_RMS_THRESHOLD intentionally do nothing -- they
        // neither reset nor advance the hangover countdown, which is the
        // whole point of the gap between the two thresholds.

        const resampled = downsampleTo16k(input, inputCtx.sampleRate);
        const pcm16 = floatTo16BitPCM(resampled);
        const base64 = int16ToBase64(pcm16);
        try {
          sessionRef.current.sendRealtimeInput({
            audio: { data: base64, mimeType: `audio/pcm;rate=${INPUT_SAMPLE_RATE}` },
          });
        } catch {
          // Session may have just closed between the check above and
          // this call -- drop the chunk rather than throw from inside
          // the audio callback.
        }
      };

      source.connect(processor);
      // ScriptProcessorNode only fires onaudioprocess while connected to a
      // destination; a silent gain-zero node keeps it running without
      // actually routing mic audio to the speakers (which would echo).
      const silentSink = inputCtx.createGain();
      silentSink.gain.value = 0;
      processor.connect(silentSink);
      silentSink.connect(inputCtx.destination);
    } catch (err) {
      console.error("Voice Mode start failed", err);
      const message =
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Microphone access was denied. Allow microphone access to use Voice Mode."
          : err instanceof Error
            ? err.message
            : "Couldn't start Voice Mode.";
      setError(message);
      setState("error");
      cleanupAudioIO();
      sessionRef.current?.close();
      sessionRef.current = null;
    }
  }, [cleanupAudioIO, connectSession]);

  React.useEffect(() => {
    return () => {
      stoppedRef.current = true;
      if (openResetTimerRef.current) clearTimeout(openResetTimerRef.current);
      sessionRef.current?.close();
      cleanupAudioIO();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    state,
    error,
    turns,
    micGranted,
    muted,
    cameraOn,
    cameraFacing,
    torchSupported,
    torchOn,
    videoRef,
    start,
    stop,
    toggleMute,
    toggleCamera,
    switchCamera,
    toggleTorch,
  };
}
