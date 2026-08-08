"use client";

import * as React from "react";
import { motion, useDragControls } from "framer-motion";
import { toast } from "sonner";
import { Bot, X, Send, Copy, RotateCcw, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/prompts/confirm-dialog";
import {
  type ForgeChatMessage,
  loadConversation,
  saveConversation,
  clearConversation,
  makeMessage,
  sendForgeAiMessage,
  extractApplicableText,
} from "@/lib/forge-ai";
import { MarkdownRenderer } from "@/components/shared/markdown-renderer";
import { cn } from "@/lib/utils";

/**
 * Phase 11 — Forge AI
 * -------------------
 * A floating chat panel for talking through the prompt currently open in
 * the editor — separate from `AiPanel`'s one-shot Improve/Rewrite/Expand/
 * Shorten transforms and the Critic's structured score. Reuses the same
 * "apply back to the editor" callback shape those already use, and the
 * same `ConfirmDialog` component for the destructive Reset confirmation,
 * but talks to its own `/api/forge-ai` endpoint (own Groq key pool, own
 * conversation state) rather than `lib/ai.ts` / `/api/ai`.
 */

const QUICK_ACTIONS: { label: string; prompt: string }[] = [
  { label: "Explain this prompt", prompt: "Explain what this prompt is asking the model to do, in plain language." },
  { label: "Suggest improvements", prompt: "What are 3 concrete ways I could improve this prompt?" },
  { label: "Find edge cases", prompt: "What edge cases or ambiguous inputs might trip this prompt up?" },
  { label: "Make it stricter", prompt: "Rewrite this prompt to be stricter and less open to misinterpretation." },
];

const MIN_WIDTH = 360;
const MIN_HEIGHT = 420;
const DEFAULT_WIDTH = 480;
const DEFAULT_HEIGHT = 640;

export function ForgeAiPanel({
  promptKey,
  promptBody,
  onApply,
}: {
  /** Stable identity for the conversation — the prompt's id, or a shared
   *  "new" key before it's first saved. */
  promptKey: string;
  promptBody: string;
  onApply: (nextBody: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [messages, setMessages] = React.useState<ForgeChatMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [size, setSize] = React.useState({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
  const [confirmReset, setConfirmReset] = React.useState(false);

  const dragControls = useDragControls();
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const resizeStateRef = React.useRef<{ startX: number; startY: number; startWidth: number; startHeight: number } | null>(
    null
  );

  // Conversations are per-prompt: reload whenever the panel is pointed at a
  // different prompt (e.g. navigating from one prompt to another).
  React.useEffect(() => {
    setMessages(loadConversation(promptKey));
  }, [promptKey]);

  React.useEffect(() => {
    if (!open) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending, open]);

  function persist(next: ForgeChatMessage[]) {
    setMessages(next);
    saveConversation(promptKey, next);
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    const withUser = [...messages, makeMessage("user", trimmed)];
    persist(withUser);
    setInput("");
    setSending(true);
    try {
      const reply = await sendForgeAiMessage(promptBody, withUser);
      persist([...withUser, makeMessage("assistant", reply)]);
    } catch {
      toast.error("Forge AI couldn't respond — try again.");
    } finally {
      setSending(false);
    }
  }

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");

  function handleApply() {
    if (!lastAssistant) return;
    onApply(extractApplicableText(lastAssistant.content));
    toast.success("Applied to prompt");
  }

  function handleCopy() {
    if (!lastAssistant) return;
    navigator.clipboard.writeText(lastAssistant.content).then(
      () => toast.success("Copied to clipboard"),
      () => toast.error("Couldn't copy — try selecting the text manually")
    );
  }

  function handleReset() {
    clearConversation(promptKey);
    setMessages([]);
    setConfirmReset(false);
  }

  const onResizeMove = React.useCallback((e: PointerEvent) => {
    const st = resizeStateRef.current;
    if (!st) return;
    const maxWidth = window.innerWidth - 32;
    const maxHeight = window.innerHeight - 32;
    setSize({
      width: Math.min(maxWidth, Math.max(MIN_WIDTH, st.startWidth + (e.clientX - st.startX))),
      height: Math.min(maxHeight, Math.max(MIN_HEIGHT, st.startHeight + (e.clientY - st.startY))),
    });
  }, []);

  const stopResize = React.useCallback(() => {
    resizeStateRef.current = null;
    window.removeEventListener("pointermove", onResizeMove);
    window.removeEventListener("pointerup", stopResize);
  }, [onResizeMove]);

  function startResize(e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    resizeStateRef.current = { startX: e.clientX, startY: e.clientY, startWidth: size.width, startHeight: size.height };
    window.addEventListener("pointermove", onResizeMove);
    window.addEventListener("pointerup", stopResize);
  }

  React.useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", onResizeMove);
      window.removeEventListener("pointerup", stopResize);
    };
  }, [onResizeMove, stopResize]);

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close Forge AI" : "Open Forge AI"}
        className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full p-0 shadow-lg"
      >
        {open ? <X className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
      </Button>

      {open && (
        <motion.div
          drag
          dragControls={dragControls}
          dragListener={false}
          dragMomentum={false}
          dragElastic={0}
          style={{ width: size.width, height: size.height }}
          className="fixed bottom-24 right-6 z-40 flex flex-col overflow-hidden rounded-lg border border-border bg-surface-raised shadow-2xl"
        >
          <div
            onPointerDown={(e) => dragControls.start(e)}
            className="flex shrink-0 cursor-grab items-center justify-between gap-2 border-b border-border bg-surface px-3 py-2 active:cursor-grabbing"
          >
            <div className="flex items-center gap-1.5 text-sm font-medium text-text">
              <Sparkles className="h-3.5 w-3.5 text-accent" /> Forge AI
            </div>
            <div className="flex items-center gap-0.5" onPointerDown={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                aria-label="Reset conversation"
                disabled={messages.length === 0}
                onClick={() => setConfirmReset(true)}
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6" aria-label="Close Forge AI" onClick={() => setOpen(false)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-3">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                <Bot className="h-8 w-8 text-text-faint" />
                <p className="text-sm text-text-muted">Ask Forge AI anything about this prompt.</p>
                <p className="text-xs text-text-faint">Try a quick action below to get started.</p>
              </div>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={cn("flex animate-fade-in", m.role === "user" ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed",
                      m.role === "user"
                        ? "whitespace-pre-wrap bg-accent text-accent-foreground"
                        : "bg-surface text-text"
                    )}
                  >
                    {m.role === "assistant" ? (
                      <MarkdownRenderer content={m.content} />
                    ) : (
                      m.content
                    )}
                  </div>
                </div>
              ))
            )}
            {sending && (
              <div className="flex animate-fade-in justify-start">
                <div className="flex items-center gap-1 rounded-lg bg-surface px-3 py-2.5">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-faint [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-faint [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-faint" />
                </div>
              </div>
            )}
          </div>

          <div className="flex shrink-0 flex-wrap gap-1.5 border-t border-border px-3 py-2">
            {QUICK_ACTIONS.map((qa) => (
              <button
                key={qa.label}
                type="button"
                disabled={sending}
                onClick={() => void send(qa.prompt)}
                className="rounded-full border border-border px-2.5 py-1 text-xs text-text-muted transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
              >
                {qa.label}
              </button>
            ))}
          </div>

          <div className="flex shrink-0 items-center gap-1.5 border-t border-border px-3 py-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              disabled={!lastAssistant}
              onClick={handleApply}
            >
              <Check className="h-3 w-3" /> Apply
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              disabled={!lastAssistant}
              onClick={handleCopy}
            >
              <Copy className="h-3 w-3" /> Copy
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              disabled={messages.length === 0}
              onClick={() => setConfirmReset(true)}
            >
              <RotateCcw className="h-3 w-3" /> Reset
            </Button>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
            className="flex shrink-0 items-end gap-2 border-t border-border p-2"
          >
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              placeholder="Ask about this prompt…"
              className="min-h-[40px] flex-1 resize-none text-sm"
              rows={1}
            />
            <Button type="submit" size="icon" className="h-9 w-9 shrink-0" disabled={sending || !input.trim()} aria-label="Send message">
              <Send className="h-4 w-4" />
            </Button>
          </form>

          <div
            onPointerDown={startResize}
            className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize"
            aria-hidden
            title="Drag to resize"
          >
            <svg viewBox="0 0 16 16" className="h-full w-full text-text-faint">
              <path d="M14 2 2 14M14 8 8 14M14 14 14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
            </svg>
          </div>
        </motion.div>
      )}

      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Reset this conversation?"
        description="This clears Forge AI's chat history for this prompt. It can't be undone."
        confirmLabel="Reset"
        onConfirm={handleReset}
      />
    </>
  );
}
