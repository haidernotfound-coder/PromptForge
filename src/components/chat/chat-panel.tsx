"use client";

import * as React from "react";
import { toast } from "sonner";
import { Bot, Send, Copy, Loader2, Sparkles, User, Link as LinkIcon, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { MarkdownRenderer } from "@/components/shared/markdown-renderer";
import { AttachmentButton, AttachmentChips, useAttachments } from "@/components/shared/attachment-bar";
import { VoiceInputButton } from "@/components/shared/voice-input-button";
import { FileCardList } from "@/components/shared/file-card";
import { makeChatMessage, sendChatMessage, type ChatConversation, type ChatMessage } from "@/lib/chat";

const STARTERS: string[] = [
  "Improve this prompt: ",
  "Write a function that ",
  "Quiz me on ",
  "Make a slide deck about ",
  "Search the web for ",
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
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const [showJumpToLatest, setShowJumpToLatest] = React.useState(false);
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

  const scrollToBottom = React.useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  // Jump straight to the bottom on a conversation switch (no animation —
  // it should feel instant, not like the reply just arrived), but keep the
  // smooth scroll for new messages/typing within the same conversation.
  React.useEffect(() => {
    scrollToBottom("auto");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id]);

  React.useEffect(() => {
    scrollToBottom("smooth");
  }, [messages, sending, scrollToBottom]);

  // Only show the "jump to latest" affordance once the user has actually
  // scrolled away from the bottom (e.g. to reread an earlier answer) — not
  // on every keystroke while they're already at the bottom typing.
  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    function handleScroll() {
      const distanceFromBottom = el!.scrollHeight - el!.scrollTop - el!.clientHeight;
      setShowJumpToLatest(distanceFromBottom > 240);
    }
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  // Auto-grow the composer as the user types (up to a sane cap), matching
  // the ChatGPT-style composer called for in Phase 5 instead of a fixed
  // 2-row box that scrolls internally for longer messages.
  React.useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [input]);

  React.useEffect(() => {
    if (!sending) textareaRef.current?.focus();
  }, [sending, conversation.id]);

  async function send(text: string) {
    const trimmed = text.trim();
    if ((!trimmed && attachmentState.attachments.length === 0) || sending) return;
    const userMessage = makeChatMessage("user", trimmed, attachmentState.attachments);
    const withUser = [...messages, userMessage];
    onMessagesChange(withUser);
    const pendingAttachments = attachmentState.attachments;
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    attachmentState.clearAttachments();
    setSending(true);
    try {
      const { output, attachmentContext, files, sources } = await sendChatMessage(withUser, pendingAttachments);
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
      onMessagesChange([...withMemory, makeChatMessage("assistant", output, undefined, { files, sources })]);
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

      <div className="relative flex-1 min-h-0">
      <div
        ref={scrollRef}
        className="h-full space-y-4 overflow-y-auto rounded-lg border border-border bg-surface-raised p-4"
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
                  <>
                    <MarkdownRenderer content={m.content} />
                    {m.files && m.files.length > 0 && <FileCardList files={m.files} />}
                    {m.sources && m.sources.length > 0 && (
                      <div className="mt-2 flex flex-col gap-1 border-t border-border pt-2">
                        <span className="text-[10px] font-medium uppercase tracking-wide text-text-faint">Sources</span>
                        {m.sources.map((s) => (
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
                  </>
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
          <div className="flex animate-fade-in items-end gap-2.5" role="status" aria-live="polite">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
              <Bot className="h-4 w-4" />
            </span>
            <div className="flex items-center gap-1 rounded-lg bg-surface px-3.5 py-3">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-faint [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-faint [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-faint" />
              <span className="sr-only">AI Chat is thinking…</span>
            </div>
          </div>
        )}
      </div>

      {showJumpToLatest && (
        <button
          type="button"
          onClick={() => scrollToBottom()}
          className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-border bg-surface-raised px-3 py-1.5 text-xs font-medium text-text-muted shadow-md transition-colors hover:bg-surface hover:text-text"
        >
          <ArrowDown className="h-3.5 w-3.5" /> Jump to latest
        </button>
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
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
            placeholder="Message AI Chat…"
            rows={1}
            className="min-h-[44px] max-h-[200px] resize-none overflow-y-auto py-2.5"
            aria-label="Message AI Chat"
          />
          <Button
            onClick={() => void send(input)}
            disabled={sending || (!input.trim() && attachmentState.attachments.length === 0)}
            className="h-10 shrink-0 gap-1.5"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            <span className="hidden sm:inline">Send</span>
          </Button>
        </div>
        <p className="hidden text-center text-[11px] text-text-faint sm:block">
          Enter to send · Shift+Enter for a new line
        </p>
      </div>
    </div>
  );
}
