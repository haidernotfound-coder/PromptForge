"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, PhoneOff, TriangleAlert, Loader2, Video, VideoOff, SwitchCamera, Zap, ZapOff, Link as LinkIcon } from "lucide-react";
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
 *  tied loosely to a faux-amplitude beat via CSS animation timing).
 *  Hidden once the camera is on, since the video preview takes its place
 *  as the visual focus (same idea as ChatGPT/Gemini's own voice+video UI). */
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

/** Small round icon button used for the secondary controls (mute, camera,
 *  switch camera) that sit alongside the main call/hang-up button. */
function ControlButton({
  active,
  danger,
  disabled,
  label,
  onClick,
  children,
}: {
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "flex h-12 w-12 items-center justify-center rounded-full border transition-all duration-200 ease-smooth active:scale-95 disabled:opacity-40",
        danger
          ? "border-transparent bg-danger text-white hover:bg-danger/90"
          : active
            ? "border-transparent bg-surface-raised text-text shadow-soft"
            : "border-border bg-surface text-text-muted hover:border-border-strong hover:text-text"
      )}
    >
      {children}
    </button>
  );
}

export function VoicePanel({ configured }: { configured: boolean | null }) {
  const {
    state,
    error,
    turns,
    muted,
    cameraOn,
    torchSupported,
    torchOn,
    videoRef,
    start,
    stop,
    toggleMute,
    toggleCamera,
    switchCamera,
    toggleTorch,
  } = useVoiceSession();
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
              interrupt it any time by just talking. Turn on your camera to show it what you&apos;re
              looking at.
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
              {turn.role === "model" && turn.sources && turn.sources.length > 0 && (
                <div className="mt-2 flex flex-col gap-1 border-t border-border pt-2">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-text-faint">Sources</span>
                  {turn.sources.map((s) => (
                    <a
                      key={s.uri}
                      href={s.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 truncate text-xs text-accent hover:underline"
                    >
                      <LinkIcon className="h-3 w-3 shrink-0" />
                      <span className="truncate">{s.title}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex w-full shrink-0 flex-col items-center gap-5 border-t border-border px-6 py-8 sm:py-10">
        {/* Camera preview replaces the orb as the visual focus while
            video is on; the orb (with its state animation) still shows
            when the camera is off. The <video> element itself is always
            mounted (just visually hidden) so the hook's videoRef and the
            frame-capture canvas always have a live element to read from
            the instant the camera is toggled on. */}
        <div className={cn("relative", !cameraOn && "h-48 w-48 sm:h-56 sm:w-56")}>
          <video
            ref={videoRef}
            muted
            playsInline
            className={cn(
              "aspect-[3/4] w-56 rounded-2xl bg-black object-cover shadow-soft sm:w-64",
              !cameraOn && "hidden"
            )}
          />
          {!cameraOn && <VoiceOrb state={state} />}
          {cameraOn && (
            <span
              className={cn(
                "absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full",
                state === "speaking" ? "animate-pulse bg-accent" : "bg-accent/50"
              )}
            />
          )}
        </div>

        <div className="flex flex-col items-center gap-1">
          <p className="text-sm font-medium text-text">{error ? error : STATE_LABEL[state]}</p>
          {live && !error && (
            <p className="text-xs text-text-faint">Interrupt any time by speaking — Gemini will stop and listen.</p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4">
          {live && (
            <ControlButton
              label={muted ? "Unmute microphone" : "Mute microphone"}
              onClick={toggleMute}
              active={!muted}
            >
              {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </ControlButton>
          )}

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

          {live && (
            <ControlButton
              label={cameraOn ? "Turn camera off" : "Turn camera on"}
              onClick={() => toggleCamera()}
              active={cameraOn}
            >
              {cameraOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
            </ControlButton>
          )}

          {live && cameraOn && (
            <ControlButton label="Switch camera" onClick={() => switchCamera()}>
              <SwitchCamera className="h-5 w-5" />
            </ControlButton>
          )}

          {live && cameraOn && torchSupported && (
            <ControlButton
              label={torchOn ? "Turn flashlight off" : "Turn flashlight on"}
              onClick={() => toggleTorch()}
              active={torchOn}
            >
              {torchOn ? <Zap className="h-5 w-5" /> : <ZapOff className="h-5 w-5" />}
            </ControlButton>
          )}
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
