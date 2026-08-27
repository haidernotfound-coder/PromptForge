"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, PhoneOff, TriangleAlert, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useVoiceSession, type VoiceState } from "@/lib/use-voice-session";

const STATE_LABEL: Record<VoiceState, string> = {
  idle: "Tap to start talking",
  connecting: "Connecting…",
  listening: "Listening…",
  thinking: "Thinking…",
  speaking: "Speaking…",
  error: "Something went wrong",
};

/** The animated orb -- ChatGPT-voice-style pulsing core, with distinct
 *  motion per state (idle breathing, listening ripple, speaking pulse
 *  tied loosely to a faux-amplitude beat via CSS animation timing). */
function VoiceOrb({ state }: { state: VoiceState }) {
  const active = state === "listening" || state === "speaking" || state === "thinking";

  return (
    <div className="relative flex h-48 w-48 items-center justify-center sm:h-56 sm:w-56">
      {/* Outer ripples, only while a session is live */}
      <AnimatePresence>
        {active && (
          <>
            <motion.span
              key="ripple-1"
              className={cn(
                "absolute inset-0 rounded-full",
                state === "speaking" ? "bg-accent/15" : "bg-accent/10"
              )}
              initial={{ scale: 0.7, opacity: 0.6 }}
              animate={{ scale: [0.7, 1.25, 0.7], opacity: [0.6, 0, 0.6] }}
              exit={{ opacity: 0 }}
              transition={{ duration: state === "speaking" ? 1.6 : 2.6, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.span
              key="ripple-2"
              className="absolute inset-3 rounded-full bg-accent/10"
              initial={{ scale: 0.8, opacity: 0.5 }}
              animate={{ scale: [0.8, 1.15, 0.8], opacity: [0.5, 0, 0.5] }}
              exit={{ opacity: 0 }}
              transition={{ duration: state === "speaking" ? 1.3 : 2.2, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
            />
          </>
        )}
      </AnimatePresence>

      {/* Core orb */}
      <motion.div
        className={cn(
          "relative flex h-28 w-28 items-center justify-center rounded-full bg-gradient-accent shadow-glow sm:h-32 sm:w-32",
          state === "error" && "bg-danger shadow-none"
        )}
        animate={
          state === "speaking"
            ? { scale: [1, 1.08, 0.97, 1.05, 1] }
            : state === "listening"
              ? { scale: [1, 1.04, 1] }
              : state === "thinking"
                ? { scale: [1, 1.02, 1], rotate: [0, 4, -4, 0] }
                : { scale: 1 }
        }
        transition={
          state === "speaking"
            ? { duration: 1.1, repeat: Infinity, ease: "easeInOut" }
            : state === "listening"
              ? { duration: 2.4, repeat: Infinity, ease: "easeInOut" }
              : state === "thinking"
                ? { duration: 1.4, repeat: Infinity, ease: "easeInOut" }
                : { duration: 0.3 }
        }
      >
        {state === "connecting" || state === "thinking" ? (
          <Loader2 className="h-9 w-9 animate-spin text-accent-foreground" />
        ) : state === "error" ? (
          <TriangleAlert className="h-9 w-9 text-white" />
        ) : (
          <Mic className={cn("h-9 w-9 text-accent-foreground", state === "idle" && "opacity-70")} />
        )}
      </motion.div>
    </div>
  );
}

export function VoicePanel({ configured }: { configured: boolean | null }) {
  const { state, error, turns, start, stop } = useVoiceSession();
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [turns]);

  const live = state !== "idle" && state !== "error";

  async function handleToggle() {
    if (live) {
      stop();
    } else {
      await start();
    }
  }

  if (configured === false) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <TriangleAlert className="h-8 w-8 text-brass" />
        <h2 className="font-display text-lg font-semibold">Voice Mode isn&apos;t configured yet</h2>
        <p className="max-w-sm text-sm text-text-muted">
          Set <code className="rounded bg-surface px-1.5 py-0.5 text-xs">GEMINI_VOICE_API_KEY</code> in your
          environment to turn on real-time voice conversations.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col items-center">
      <div ref={scrollRef} className="w-full min-h-0 flex-1 overflow-y-auto px-4 pt-6 sm:px-8">
        <div className="mx-auto flex max-w-lg flex-col gap-3 pb-4">
          {turns.length === 0 && !live && (
            <p className="pt-10 text-center text-sm text-text-faint">
              Start a conversation and speak naturally — Gemini will respond in real time and you can
              interrupt it any time by just talking.
            </p>
          )}
          {turns.map((turn) => (
            <div
              key={turn.id}
              className={cn(
                "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                turn.role === "user"
                  ? "ml-auto bg-accent text-accent-foreground"
                  : "mr-auto bg-surface text-text",
                !turn.final && "opacity-70"
              )}
            >
              {turn.text || "…"}
            </div>
          ))}
        </div>
      </div>

      <div className="flex w-full shrink-0 flex-col items-center gap-5 border-t border-border px-6 py-8 sm:py-10">
        <VoiceOrb state={state} />

        <div className="flex flex-col items-center gap-1">
          <p className="text-sm font-medium text-text">{error ? error : STATE_LABEL[state]}</p>
          {live && !error && (
            <p className="text-xs text-text-faint">Interrupt any time by speaking — Gemini will stop and listen.</p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleToggle}
            disabled={state === "connecting"}
            aria-label={live ? "End voice call" : "Start voice call"}
            className={cn(
              "flex h-16 w-16 items-center justify-center rounded-full shadow-soft transition-all duration-200 ease-smooth active:scale-95 disabled:opacity-60",
              live ? "bg-danger text-white hover:bg-danger/90" : "bg-gradient-accent text-accent-foreground hover:shadow-glow-sm"
            )}
          >
            {state === "connecting" ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : live ? (
              <PhoneOff className="h-6 w-6" />
            ) : (
              <Mic className="h-6 w-6" />
            )}
          </button>
        </div>

        {state === "error" && (
          <button
            type="button"
            onClick={() => start()}
            className="flex items-center gap-1.5 text-xs font-medium text-accent hover:underline"
          >
            <MicOff className="h-3.5 w-3.5" /> Try again
          </button>
        )}
      </div>
    </div>
  );
}
