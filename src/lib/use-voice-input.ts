"use client";

import * as React from "react";

/**
 * Wraps the browser's built-in SpeechRecognition (webkitSpeechRecognition
 * in Chrome/Safari, SpeechRecognition where standardized) behind one hook
 * so every chat's mic button behaves identically.
 *
 * SpeechRecognition alone is unreliable about actually prompting for mic
 * permission — in a lot of embedded/iframed contexts it just fails with
 * "not-allowed" over and over, even after the user has "allowed" the mic
 * at the OS/browser level, because:
 *   1. It never triggers a real permission prompt itself in some browsers
 *      (Chrome in particular expects an explicit getUserMedia call).
 *   2. If the page is running inside an iframe, the *embedding* page's
 *      Permissions-Policy can block the microphone feature entirely,
 *      independent of what the user allowed for the top-level site.
 *   3. Non-HTTPS (and non-localhost) origins are blocked outright.
 *
 * So `start()` here explicitly requests `getUserMedia({ audio: true })`
 * first — that's what actually surfaces the browser's permission prompt —
 * and only starts SpeechRecognition once that succeeds. This also lets us
 * tell the difference between "you haven't granted permission yet" (show
 * a real prompt) and "permission is blocked at the platform level" (tell
 * them what to do about it) instead of one generic error either way.
 */

type VoiceState = "idle" | "requesting" | "listening" | "error";

interface MinimalSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionResultEvent {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
}

interface SpeechRecognitionErrorEvent {
  error: string;
}

type SpeechRecognitionCtor = new () => MinimalSpeechRecognition;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function isSecureEnoughContext(): boolean {
  if (typeof window === "undefined") return false;
  if (window.isSecureContext) return true;
  return ["localhost", "127.0.0.1"].includes(window.location.hostname);
}

/** True only when we can positively confirm the embedding frame blocks
 *  the microphone feature — absence of the API (older browsers) is NOT
 *  treated as blocked, to avoid false positives. */
function iframeBlocksMicrophone(): boolean {
  if (typeof window === "undefined" || window.top === window.self) return false; // not framed
  const policy = (document as unknown as { featurePolicy?: { allowsFeature: (f: string) => boolean } })
    .featurePolicy;
  if (!policy) return false;
  try {
    return !policy.allowsFeature("microphone");
  } catch {
    return false;
  }
}

/** True only when we can positively confirm the TOP-LEVEL page's own
 *  response headers (e.g. a `Permissions-Policy: microphone=()` sent by
 *  the app itself) disable the microphone feature. This is a distinct
 *  failure mode from user denial or an embedding frame's policy: it
 *  blocks `getUserMedia` unconditionally, before the browser ever
 *  consults what the user allowed in the address bar, and getUserMedia
 *  throws the same `NotAllowedError` either way — so it has to be
 *  checked separately or it gets misreported as "access denied". */
function siteBlocksMicrophone(): boolean {
  if (typeof window === "undefined") return false;
  const policy = (document as unknown as { featurePolicy?: { allowsFeature: (f: string) => boolean } })
    .featurePolicy;
  if (!policy) return false;
  try {
    return !policy.allowsFeature("microphone");
  } catch {
    return false;
  }
}

function speechErrorMessage(code: string): string {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone access is blocked for this site — click the lock/camera icon in your address bar, allow the microphone, then try again.";
    case "no-speech":
      return "Didn't catch any speech — try again.";
    case "audio-capture":
      return "No microphone found — check that one is connected and not in use by another app.";
    case "network":
      return "Voice input needs a network connection.";
    default:
      return "Voice input hit an error — try again.";
  }
}

function permissionErrorMessage(err: unknown): string {
  if (err instanceof DOMException) {
    if (err.name === "NotAllowedError" || err.name === "SecurityError") {
      return "Microphone access was denied — click the lock/camera icon in your address bar, allow the microphone, then try again.";
    }
    if (err.name === "NotFoundError") {
      return "No microphone found — check that one is connected.";
    }
  }
  return "Couldn't access the microphone — check your browser and OS microphone permissions.";
}

export function useVoiceInput(onTranscript: (text: string) => void) {
  const [state, setState] = React.useState<VoiceState>("idle");
  const [error, setError] = React.useState<string | null>(null);
  const recognitionRef = React.useRef<MinimalSpeechRecognition | null>(null);
  const permissionStreamRef = React.useRef<MediaStream | null>(null);
  const onTranscriptRef = React.useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  const supported = React.useMemo(() => getSpeechRecognitionCtor() !== null, []);

  const releasePermissionStream = React.useCallback(() => {
    permissionStreamRef.current?.getTracks().forEach((t) => t.stop());
    permissionStreamRef.current = null;
  }, []);

  const stop = React.useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const start = React.useCallback(async () => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setState("error");
      setError("Voice input isn't supported in this browser — try Chrome or Edge.");
      return;
    }
    if (!isSecureEnoughContext()) {
      setState("error");
      setError("Voice input needs a secure (https) connection.");
      return;
    }
    if (iframeBlocksMicrophone()) {
      setState("error");
      setError("The microphone is blocked in this embedded view — open the app in its own tab to use voice input.");
      return;
    }
    if (siteBlocksMicrophone()) {
      setState("error");
      setError("Voice input is misconfigured on this site (microphone disabled by a Permissions-Policy header) — this isn't your browser's permission setting. Please report this.");
      return;
    }
    if (recognitionRef.current) {
      recognitionRef.current.abort();
    }

    setError(null);
    setState("requesting");

    // Explicitly request mic access first — this is what actually shows
    // the browser's "Allow microphone?" prompt the first time, and gives
    // us a real error (denied / no device / blocked) if it fails, instead
    // of SpeechRecognition's vague "not-allowed" for every possible cause.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      permissionStreamRef.current = stream;
    } catch (err) {
      setState("error");
      setError(permissionErrorMessage(err));
      return;
    }

    const recognition = new Ctor();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = typeof navigator !== "undefined" ? navigator.language || "en-US" : "en-US";

    recognition.onresult = (event) => {
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0]?.transcript ?? "";
      }
      if (finalText.trim()) onTranscriptRef.current(finalText.trim());
    };
    recognition.onerror = (event) => {
      setState("error");
      setError(speechErrorMessage(event.error));
      releasePermissionStream();
    };
    recognition.onend = () => {
      setState((prev) => (prev === "error" ? prev : "idle"));
      recognitionRef.current = null;
      releasePermissionStream();
    };

    recognitionRef.current = recognition;
    setState("listening");
    try {
      recognition.start();
    } catch {
      setState("error");
      setError("Couldn't start voice input — try again.");
      releasePermissionStream();
    }
  }, [releasePermissionStream]);

  const toggle = React.useCallback(() => {
    if (state === "listening" || state === "requesting") {
      stop();
    } else {
      void start();
    }
  }, [state, start, stop]);

  React.useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      releasePermissionStream();
    };
  }, [releasePermissionStream]);

  return { state, error, supported, start, stop, toggle };
}
