"use client";

import * as React from "react";
import { toast } from "sonner";
import { UploadCloud, Bot, Send, Copy, Loader2, Sparkles, User, Link as LinkIcon, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
  const attachmentState = useAttachments();
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const [showJumpToLatest, setShowJumpToLatest] = React.useState(false);
  const [isDraggingFile, setIsDraggingFile] = React.useState(false);
  // Counts nested dragenter/dragleave pairs across child elements so the
  // drop overlay doesn't flicker off when the cursor crosses from the
  // outer container onto a message bubble or the composer underneath it.
  const dragCounter = React.useRef(0);
  const messages = conversation.messages;

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

  // Only meaningful while a drag carries actual files (not, say, dragging
  // selected message text around the page) — checking dataTransfer.types
  // lets the overlay stay hidden for ordinary text-selection drags.
  function isFileDrag(e: React.DragEvent) {
    return Array.from(e.dataTransfer.types).includes("Files");
  }

  function handleDragEnter(e: React.DragEvent) {
    if (!isFileDrag(e) || sending) return;
    e.preventDefault();
    dragCounter.current += 1;
    setIsDraggingFile(true);
  }

  function handleDragOver(e: React.DragEvent) {
    if (!isFileDrag(e) || sending) return;
    e.preventDefault();
  }

  function handleDragLeave(e: React.DragEvent) {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    dragCounter.current = Math.max(0, dragCounter.current - 1);
    if (dragCounter.current === 0) setIsDraggingFile(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDraggingFile(false);
    if (sending) return;
    const files = e.dataTransfer.files;
    if (files && files.length > 0) void attachmentState.addFiles(files);
  }

  return (
    <div
      className="relative flex h-full min-h-0 flex-col"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDraggingFile && (
        <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-accent bg-surface/90 backdrop-blur-sm">
          <UploadCloud className="h-8 w-8 text-accent" />
          <p className="text-sm font-medium text-text">Drop files to attach them</p>
          <p className="text-xs text-text-faint">Images, PDF, DOCX, ZIP, TXT, CSV, code — up to 100 MB each</p>
        </div>
      )}

      <div className="relative min-h-0 flex-1">
      <div
        ref={scrollRef}
        className="h-full space-y-5 overflow-y-auto px-3 py-5 sm:px-6"
      >
        {messages.length === 0 ? (
          <div className="mx-auto flex h-full max-w-lg flex-col items-center justify-center gap-3 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent">
              <Sparkles className="h-6 w-6" />
            </span>
            <h2 className="font-display text-xl font-semibold tracking-tight">How can I help today?</h2>
            <p className="text-sm text-text-muted">
              Ask anything — this chat can help with prompts, code, studying, or slides.
            </p>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={cn("flex gap-3 animate-fade-in", m.role === "user" ? "justify-end" : "justify-start")}
            >
              {m.role === "assistant" && (
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-sm">
                  <Bot className="h-4 w-4" />
                </span>
              )}
              <div
                className={cn(
                  "group relative max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed sm:max-w-[75%]",
                  m.role === "user"
                    ? "whitespace-pre-wrap rounded-tr-sm bg-accent text-accent-foreground"
                    : "rounded-tl-sm bg-surface-raised text-text shadow-sm"
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
                    className="absolute -top-2 -right-2 hidden h-6 w-6 items-center justify-center rounded-full border border-border bg-surface-raised text-text-muted opacity-0 shadow-sm transition-opacity group-hover:flex group-hover:opacity-100"
                    aria-label="Copy message"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                )}
              </div>
              {m.role === "user" && (
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-raised text-text-muted shadow-sm">
                  <User className="h-4 w-4" />
                </span>
              )}
            </div>
          ))
        )}
        {sending && (
          <div className="flex animate-fade-in items-end gap-3" role="status" aria-live="polite">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-sm">
              <Bot className="h-4 w-4" />
            </span>
            <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-surface-raised px-4 py-3 shadow-sm">
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

      <div className="border-t border-border bg-bg px-3 pb-3 pt-3 sm:px-6">
        {messages.length === 0 && (
          <div className="mb-2 flex flex-wrap justify-center gap-1.5">
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
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-1">
          <AttachmentChips attachments={attachmentState.attachments} onRemove={attachmentState.removeAttachment} disabled={sending} />
          <div className="flex items-end gap-1.5 rounded-2xl border border-border bg-surface-raised p-1.5 shadow-sm focus-within:border-accent/50 focus-within:ring-2 focus-within:ring-accent/20">
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
              className="min-h-[36px] max-h-[200px] flex-1 resize-none overflow-y-auto border-0 bg-transparent px-1.5 py-1.5 shadow-none focus-visible:ring-0"
              aria-label="Message AI Chat"
            />
            <Button
              onClick={() => void send(input)}
              disabled={sending || (!input.trim() && attachmentState.attachments.length === 0)}
              size="icon"
              className="h-9 w-9 shrink-0 gap-1.5 rounded-xl"
              aria-label="Send message"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          <p className="hidden text-center text-[11px] text-text-faint sm:block">
            Enter to send · Shift+Enter for a new line
          </p>
        </div>
      </div>
    </div>
  );
}
