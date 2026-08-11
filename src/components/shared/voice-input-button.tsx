"use client";

import * as React from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useVoiceInput } from "@/lib/use-voice-input";

/** Mic button that inserts its transcription into the caller's input via
 *  `onTranscript`. Self-contained — the caller doesn't need to know
 *  anything about the SpeechRecognition API. Clicking it always triggers
 *  a fresh permission request the first time (or if permission was
 *  previously denied), rather than silently failing. */
export function VoiceInputButton({
  onTranscript,
  disabled,
  className,
}: {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const { state, error, supported, toggle } = useVoiceInput(onTranscript);

  React.useEffect(() => {
    if (state === "error" && error) toast.error(error, { duration: 8000 });
  }, [state, error]);

  if (!supported) return null;

  const listening = state === "listening";
  const requesting = state === "requesting";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      disabled={disabled || requesting}
      onClick={toggle}
      aria-label={listening ? "Stop voice input" : "Start voice input (asks for microphone access)"}
      aria-pressed={listening}
      title={
        listening
          ? "Listening… click to stop"
          : requesting
            ? "Requesting microphone access…"
            : "Voice input — click to allow microphone access"
      }
      className={cn("h-9 w-9 shrink-0", listening && "text-danger", className)}
    >
      {listening ? (
        <span className="relative flex items-center justify-center">
          <span className="absolute h-2.5 w-2.5 animate-ping rounded-full bg-danger/60" />
          <Mic className="h-4 w-4" />
        </span>
      ) : requesting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : state === "error" ? (
        <MicOff className="h-4 w-4" />
      ) : (
        <Mic className="h-4 w-4" />
      )}
    </Button>
  );
}
