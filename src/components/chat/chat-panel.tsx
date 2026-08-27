"use client";

import * as React from "react";
import { toast } from "sonner";
import { Bot, Send, Copy, Loader2, Sparkles, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { MarkdownRenderer } from "@/components/shared/markdown-renderer";
import { AttachmentButton, AttachmentChips, useAttachments } from "@/components/shared/attachment-bar";
import { VoiceInputButton } from "@/components/shared/voice-input-button";
import { makeChatMessage, sendChatMessage, type ChatConversation, type ChatMessage } from "@/lib/chat";

const STARTERS: string[] = [
  "Improve this prompt: ",
  "Write a function that ",
  "Quiz me on ",
  "Make a slide deck about ",
];

export function ChatPanel({
  conversation,
  onMessagesChange,
}: {
  conversation: ChatConversation;
  onMessagesChange: (messages: ChatMessage[]) => void;
}) {
  const [input, setInput] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [configured, setConfigured] = React.useState<boolean | null>(null);
  const attachmentState = useAttachments();
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const messages = conversation.messages;

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/chat")
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

  async function send(text: string) {
    const trimmed = text.trim();
    if ((!trimmed && attachmentState.attachments.length === 0) || sending) return;
    const userMessage = makeChatMessage("user", trimmed, attachmentState.attachments);
    const withUser = [...messages, userMessage];
    onMessagesChange(withUser);
    const pendingAttachments = attachmentState.attachments;
    setInput("");
    attachmentState.clearAttachments();
    setSending(true);
    try {
      const { output, attachmentContext } = await sendChatMessage(withUser, pendingAttachments);
      // Phase 3 — attachment memory: fold any newly extracted document text
      // back onto the user message we just sent, so it's replayed as plain
      // context on later turns even if a later turn is answered by a
      // different provider than the one that first read the file.
      const withMemory = attachmentContext.length
        ? withUser.map((m) =>
            m.id === userMessage.id && m.attachments
              ? {
                  ...m,
                  attachments: m.attachments.map((a) => {
                    const match = attachmentContext.find((d) => d.name === a.name);
                    return match ? { ...a, contextText: match.text } : a;
                  }),
                }
              : m
          )
        : withUser;
      onMessagesChange([...withMemory, makeChatMessage("assistant", output)]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown AI error";
      toast.error(`AI Chat couldn't respond: ${message}`, { duration: 9000 });
      console.error("AI Chat request failed", error);
    } finally {
      setSending(false);
    }
  }

  function copyMessage(content: string) {
    navigator.clipboard.writeText(content).then(
      () => toast.success("Copied to clipboard"),
      () => toast.error("Couldn't copy — try selecting the text manually")
    );
  }

  return (
    <div className="flex h-[calc(100vh-8.5rem)] flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-accent" />
            <h1 className="truncate font-display text-2xl font-semibold tracking-tight">{conversation.title}</h1>
            {configured === false && <Badge variant="brass">Demo mode</Badge>}
            {configured === true && <Badge variant="success">Live</Badge>}
          </div>
          <p className="mt-1 text-sm text-text-muted">One assistant for prompts, code, studying, and slides.</p>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 space-y-4 overflow-y-auto rounded-lg border border-border bg-surface-raised p-4"
      >
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <Bot className="h-10 w-10 text-text-faint" />
            <p className="text-sm text-text-muted">Ask anything — this chat can help with prompts, code, studying, or slides.</p>
            <p className="text-xs text-text-faint">Try a starter below to get going.</p>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={cn("flex gap-2.5 animate-fade-in", m.role === "user" ? "justify-end" : "justify-start")}
            >
              {m.role === "assistant" && (
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                  <Bot className="h-4 w-4" />
                </span>
              )}
              <div
                className={cn(
                  "group relative max-w-[80%] rounded-lg px-3.5 py-2.5 text-sm leading-relaxed",
                  m.role === "user" ? "whitespace-pre-wrap bg-accent text-accent-foreground" : "bg-surface text-text"
                )}
              >
                {m.role === "assistant" ? (
                  <MarkdownRenderer content={m.content} />
                ) : (
                  <>
                    {m.content}
                    {m.attachments && m.attachments.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {m.attachments.map((a) => (
                          <span
                            key={a.name}
                            className="rounded-full bg-accent-foreground/10 px-2 py-0.5 text-[10px] text-accent-foreground/80"
                          >
                            {a.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </>
                )}
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
          <div className="flex animate-fade-in items-end gap-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
              <Bot className="h-4 w-4" />
            </span>
            <div className="flex items-center gap-1 rounded-lg bg-surface px-3.5 py-3">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-faint [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-faint [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-faint" />
            </div>
          </div>
        )}
      </div>

      {messages.length === 0 && (
        <div className="flex flex-wrap gap-1.5 pt-3">
          {STARTERS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              disabled={sending}
              onClick={() => setInput(prompt)}
              className="rounded-full border border-border px-2.5 py-1 text-xs text-text-muted transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
            >
              {prompt.trim()}
            </button>
          ))}
        </div>
      )}

      <div className="mt-2 flex flex-col gap-1">
        <AttachmentChips attachments={attachmentState.attachments} onRemove={attachmentState.removeAttachment} disabled={sending} />
        <div className="flex items-end gap-2">
          <AttachmentButton onFiles={(files) => void attachmentState.addFiles(files)} disabled={sending} />
          <VoiceInputButton onTranscript={(text) => setInput((prev) => (prev ? `${prev} ${text}` : text))} disabled={sending} />
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
            placeholder="Message AI Chat…"
            rows={2}
            className="resize-none"
          />
          <Button
            onClick={() => void send(input)}
            disabled={sending || (!input.trim() && attachmentState.attachments.length === 0)}
            className="h-10 gap-1.5"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}
