"use client";

import * as React from "react";
import { GoogleGenAI, Modality, type Session, type LiveServerMessage } from "@google/genai";

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
// ScriptProcessorNode buffer size -- 4096 frames is the standard tradeoff
// between latency and avoiding audio glitches/dropped callbacks; at 16kHz
// that's a 20-40ms-scale chunk once resampled, in the range Gemini's docs
// recommend for realtime streaming.
const PROCESSOR_BUFFER_SIZE = 4096;
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
  const stoppedRef = React.useRef(false);

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
    sessionRef.current?.close();
    sessionRef.current = null;
    cleanupAudioIO();
    setState("idle");
    setMuted(false);
    mutedRef.current = false;
    currentModelTurnIdRef.current = null;
    currentUserTurnIdRef.current = null;
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

  const playAudioChunk = React.useCallback((base64Data: string) => {
    let ctx = outputAudioCtxRef.current;
    if (!ctx || ctx.state === "closed") {
      ctx = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE });
      outputAudioCtxRef.current = ctx;
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
    source.start(startAt);
    playCursorRef.current = startAt + buffer.duration;

    scheduledSourcesRef.current.add(source);
    source.onended = () => {
      scheduledSourcesRef.current.delete(source);
    };
  }, []);

  const handleServerMessage = React.useCallback(
    (message: LiveServerMessage) => {
      const content = message.serverContent;
      if (!content) return;

      if (content.interrupted) {
        clearPlaybackQueue();
        setState("listening");
        currentModelTurnIdRef.current = null;
      }

      if (content.modelTurn?.parts) {
        let playedAudio = false;
        for (const part of content.modelTurn.parts) {
          if (part.inlineData?.data) {
            playAudioChunk(part.inlineData.data);
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

      if (content.inputTranscription?.text) {
        const text = content.inputTranscription.text;
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

  const start = React.useCallback(async (initialTurns?: VoiceTurn[]) => {
    if (sessionRef.current) return;
    stoppedRef.current = false;
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
      const tokenRes = await fetch("/api/voice-token", { method: "POST" });
      const tokenData = await tokenRes.json();
      if (!tokenRes.ok || !tokenData.token) {
        throw new Error(tokenData.error || "Couldn't start Voice Mode.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      if (stoppedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      micStreamRef.current = stream;
      setMicGranted(true);

      const ai = new GoogleGenAI({ apiKey: tokenData.token });

      const session = await ai.live.connect({
        model: tokenData.model,
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            if (stoppedRef.current) return;
            setState("listening");
          },
          onmessage: (message: LiveServerMessage) => {
            if (stoppedRef.current) return;
            handleServerMessage(message);
          },
          onerror: (e) => {
            if (stoppedRef.current) return;
            setError(e.message || "Voice connection error");
            setState("error");
          },
          onclose: () => {
            if (stoppedRef.current) return;
            setState((s) => (s === "error" ? s : "idle"));
          },
        },
      });
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

      processor.onaudioprocess = (event) => {
        if (stoppedRef.current || !sessionRef.current || mutedRef.current) return;
        const input = event.inputBuffer.getChannelData(0);
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
  }, [cleanupAudioIO, handleServerMessage]);

  React.useEffect(() => {
    return () => {
      stoppedRef.current = true;
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
