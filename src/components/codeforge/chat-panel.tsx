"use client";

import * as React from "react";
import { toast } from "sonner";
import { Bot, Send, Copy, RotateCcw, Loader2, MessagesSquare, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/prompts/confirm-dialog";
import { cn } from "@/lib/utils";
import {
  type CodeForgeChatMessage,
  loadCodeForgeChat,
  saveCodeForgeChat,
  clearCodeForgeChat,
  makeCodeForgeMessage,
  sendCodeForgeChatMessage,
  extractCodeBlock,
} from "@/lib/codeforge";

const QUICK_ACTIONS: { label: string; prompt: string }[] = [
  { label: "Write a function", prompt: "Write a function that " },
  { label: "Debug this error", prompt: "I'm getting this error, help me debug it: " },
  { label: "Explain a concept", prompt: "Explain how " },
  { label: "Design a data structure", prompt: "What's a good data structure for " },
];

export function CodeForgeChatPanel() {
  const [messages, setMessages] = React.useState<CodeForgeChatMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [confirmReset, setConfirmReset] = React.useState(false);
  const [configured, setConfigured] = React.useState<boolean | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setMessages(loadCodeForgeChat());
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/codeforge")
      .then((res) => (res.ok ? res.json() : { configured: false }))
      .then((data) => {
        if (!cancelled) setConfigured(Boolean(data.configured));
      })
      .catch(() => {
        if (!cancelled) setConfigured(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  function persist(next: CodeForgeChatMessage[]) {
    setMessages(next);
    saveCodeForgeChat(next);
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    const withUser = [...messages, makeCodeForgeMessage("user", trimmed)];
    persist(withUser);
    setInput("");
    setSending(true);
    try {
      const reply = await sendCodeForgeChatMessage(withUser);
      persist([...withUser, makeCodeForgeMessage("assistant", reply)]);
    } catch {
      toast.error("AI Coding Chat couldn't respond — try again.");
    } finally {
      setSending(false);
    }
  }

  function handleReset() {
    clearCodeForgeChat();
    setMessages([]);
    setConfirmReset(false);
  }

  function copyMessage(content: string) {
    navigator.clipboard.writeText(extractCodeBlock(content)).then(
      () => toast.success("Copied to clipboard"),
      () => toast.error("Couldn't copy — try selecting the text manually")
    );
  }

  return (
    <div className="flex h-[calc(100vh-8.5rem)] flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <MessagesSquare className="h-5 w-5 text-accent" />
            <h1 className="font-display text-2xl font-semibold tracking-tight">AI Coding Chat</h1>
            {configured === false && <Badge variant="brass">Demo mode</Badge>}
            {configured === true && <Badge variant="success">Live</Badge>}
          </div>
          <p className="mt-1 text-sm text-text-muted">
            A free-form chat for anything code-related — debugging, design, or just thinking out loud.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={messages.length === 0}
          onClick={() => setConfirmReset(true)}
        >
          <RotateCcw className="h-3.5 w-3.5" /> Reset conversation
        </Button>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 space-y-4 overflow-y-auto rounded-lg border border-border bg-surface-raised p-4"
      >
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <Bot className="h-10 w-10 text-text-faint" />
            <p className="text-sm text-text-muted">Ask CodeForge anything about code.</p>
            <p className="text-xs text-text-faint">Try a quick starter below to get going.</p>
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={cn("flex gap-2.5", m.role === "user" ? "justify-end" : "justify-start")}>
              {m.role === "assistant" && (
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                  <Bot className="h-4 w-4" />
                </span>
              )}
              <div
                className={cn(
                  "group relative max-w-[80%] whitespace-pre-wrap rounded-lg px-3.5 py-2.5 text-sm leading-relaxed",
                  m.role === "user" ? "bg-accent text-accent-foreground" : "bg-surface text-text"
                )}
              >
                {m.content}
                {m.role === "assistant" && (
                  <button
                    type="button"
                    onClick={() => copyMessage(m.content)}
                    className="absolute -top-2 -right-2 hidden h-6 w-6 items-center justify-center rounded-full border border-border bg-surface-raised text-text-muted opacity-0 transition-opacity group-hover:flex group-hover:opacity-100"
                    aria-label="Copy message"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                )}
              </div>
              {m.role === "user" && (
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface text-text-muted">
                  <User className="h-4 w-4" />
                </span>
              )}
            </div>
          ))
        )}
        {sending && (
          <div className="flex items-center gap-1.5 text-xs text-text-faint">
            <Loader2 className="h-3 w-3 animate-spin" /> CodeForge is thinking…
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 pt-3">
        {QUICK_ACTIONS.map((qa) => (
          <button
            key={qa.label}
            type="button"
            disabled={sending}
            onClick={() => setInput(qa.prompt)}
            className="rounded-full border border-border px-2.5 py-1 text-xs text-text-muted transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
          >
            {qa.label}
          </button>
        ))}
      </div>

      <div className="mt-2 flex items-end gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(input);
            }
          }}
          placeholder="Ask about a bug, a design, a language feature…"
          rows={2}
          className="resize-none"
        />
        <Button onClick={() => void send(input)} disabled={sending || !input.trim()} className="h-10 gap-1.5">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Send
        </Button>
      </div>

      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Reset conversation?"
        description="This clears the entire AI Coding Chat history in this browser. This can't be undone."
        confirmLabel="Reset"
        onConfirm={handleReset}
      />
    </div>
  );
}
