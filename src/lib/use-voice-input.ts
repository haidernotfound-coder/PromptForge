"use client";

import * as React from "react";

/**
 * Wraps the browser's built-in SpeechRecognition (webkitSpeechRecognition
 * in Chrome/Safari, SpeechRecognition where standardized) behind one hook
 * so every chat's mic button behaves identically. No server round-trip —
 * this is entirely client-side, same as the browser feature itself.
 */

type VoiceState = "idle" | "listening" | "error";

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

function errorMessage(code: string): string {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone access was blocked — allow it in your browser to use voice input.";
    case "no-speech":
      return "Didn't catch any speech — try again.";
    case "audio-capture":
      return "No microphone found.";
    case "network":
      return "Voice input needs a network connection.";
    default:
      return "Voice input hit an error — try again.";
  }
}

export function useVoiceInput(onTranscript: (text: string) => void) {
  const [state, setState] = React.useState<VoiceState>("idle");
  const [error, setError] = React.useState<string | null>(null);
  const recognitionRef = React.useRef<MinimalSpeechRecognition | null>(null);
  const onTranscriptRef = React.useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  const supported = React.useMemo(() => getSpeechRecognitionCtor() !== null, []);

  const stop = React.useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const start = React.useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setState("error");
      setError("Voice input isn't supported in this browser — try Chrome or Edge.");
      return;
    }
    if (recognitionRef.current) {
      recognitionRef.current.abort();
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
      setError(errorMessage(event.error));
    };
    recognition.onend = () => {
      setState((prev) => (prev === "error" ? prev : "idle"));
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    setError(null);
    setState("listening");
    try {
      recognition.start();
    } catch {
      setState("error");
      setError("Couldn't start voice input — try again.");
    }
  }, []);

  const toggle = React.useCallback(() => {
    if (state === "listening") {
      stop();
    } else {
      start();
    }
  }, [state, start, stop]);

  React.useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  return { state, error, supported, start, stop, toggle };
}
