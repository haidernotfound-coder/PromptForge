"use client";

import * as React from "react";
import { Mic, MicOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useVoiceInput } from "@/lib/use-voice-input";

/** Mic button that inserts its transcription into the caller's input via
 *  `onTranscript`. Self-contained — the caller doesn't need to know
 *  anything about the SpeechRecognition API. */
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
    if (state === "error" && error) toast.error(error);
  }, [state, error]);

  if (!supported) return null;

  const listening = state === "listening";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      disabled={disabled}
      onClick={toggle}
      aria-label={listening ? "Stop voice input" : "Start voice input"}
      aria-pressed={listening}
      title={listening ? "Listening… click to stop" : "Voice input"}
      className={cn(
        "h-9 w-9 shrink-0",
        listening && "text-danger",
        className
      )}
    >
      {listening ? (
        <span className="relative flex items-center justify-center">
          <span className="absolute h-2.5 w-2.5 animate-ping rounded-full bg-danger/60" />
          <Mic className="h-4 w-4" />
        </span>
      ) : state === "error" ? (
        <MicOff className="h-4 w-4" />
      ) : (
        <Mic className="h-4 w-4" />
      )}
    </Button>
  );
}
