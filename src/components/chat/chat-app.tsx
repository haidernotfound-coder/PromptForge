"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, MessagesSquare, TriangleAlert, AudioLines } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { DashboardUserMenu } from "@/components/dashboard/user-menu";
import * as Dialog from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { ChatPanel } from "@/components/chat/chat-panel";
import { VoicePanel } from "@/components/chat/voice-panel";
import {
  createChatConversation,
  createVoiceConversation,
  loadChatConversations,
  saveChatConversations,
  titleFromMessage,
  initChatCloudSync,
  syncConversationToCloud,
  syncConversationDeleteToCloud,
  type ChatConversation,
  type ChatMessage,
} from "@/lib/chat";
import type { AppSession } from "@/lib/session";

/** Brand mark for the chat sidebar — same "icon chip + wordmark" pattern
 *  every other Forge's sidebar uses (see StudyForgeBrand / DashboardBrand),
 *  just with AI Chat's own icon so the sidebar reads as its own product
 *  surface instead of a generic panel bolted onto the app. */
function ChatBrand() {
  return (
    <Link href="/" className="flex items-center gap-2 px-1 font-display text-[15px] font-semibold tracking-tight">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-accent text-accent-foreground shadow-soft">
        <MessagesSquare className="h-3.5 w-3.5" />
      </span>
      AI Chat
    </Link>
  );
}

/** Pinned account row at the bottom of the sidebar — avatar/name/email via
 *  the existing DashboardUserMenu (profile, sign out) plus a theme toggle,
 *  kept compact (single row, small type) so it reads as a footer rather
 *  than another full-height sidebar section. */
function ChatProfileFooter({ session, configured }: { session: AppSession; configured: boolean | null }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-surface">
      <div className="flex min-w-0 items-center gap-2">
        <DashboardUserMenu session={session} />
        <div className="min-w-0 leading-tight">
          <p className="truncate text-xs font-medium text-text">{session.name}</p>
          <p className="truncate text-[11px] text-text-faint">
            {configured === false ? "Demo mode" : configured === true ? "Live" : "\u00A0"}
          </p>
        </div>
      </div>
      <ThemeToggle />
    </div>
  );
}

export function ChatApp({
  session,
  disabledReason,
}: {
  session: AppSession;
  disabledReason?: string;
}) {
  const [conversations, setConversations] = React.useState<ChatConversation[]>([]);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [hydrated, setHydrated] = React.useState(false);
  const [configured, setConfigured] = React.useState<boolean | null>(null);
  const [voiceConfigured, setVoiceConfigured] = React.useState<boolean | null>(null);
  // Which tab is selected. Normally this just mirrors the active
  // conversation's kind (selecting a voice chat in the sidebar switches
  // to the Voice tab automatically, and vice versa) -- it only becomes
  // "independent" for a moment when the user clicks the Voice tab directly
  // with a text chat active, since at that point there's no voice
  // conversation to make active yet (see handleTabChange below).
  const [tab, setTab] = React.useState<"chat" | "voice">("chat");

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
    fetch("/api/voice-token")
      .then((res) => (res.ok ? res.json() : { configured: false }))
      .then((data) => {
        if (!cancelled) setVoiceConfigured(Boolean(data.configured));
      })
      .catch(() => {
        if (!cancelled) setVoiceConfigured(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Mirrors `conversations` synchronously so the cloud-sync poll's
  // `getLocal` callback (called from outside React's render cycle) always
  // sees the latest local state instead of a stale closure over whatever
  // `conversations` was when initChatCloudSync was first called.
  const conversationsRef = React.useRef<ChatConversation[]>([]);
  React.useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  React.useEffect(() => {
    const loaded = loadChatConversations();
    // Land straight in a fresh conversation on a brand-new browser instead
    // of an empty "start a new conversation" placeholder — one less click
    // to the ChatGPT-style experience this surface is going for.
    if (loaded.length === 0) {
      const fresh = createChatConversation();
      setConversations([fresh]);
      saveChatConversations([fresh]);
      setActiveId(fresh.id);
    } else {
      setConversations(loaded);
      setActiveId(loaded[0]?.id ?? null);
    }
    setHydrated(true);

    // Real accounts only (see session.isReal) — demo mode has no
    // account-scoped server row to sync to, so it stays local-only exactly
    // as before. Pulls the server's copy, reconciles it against whatever
    // was just loaded from localStorage above (by updatedAt — see
    // reconcileConversations), and keeps polling so a second device's
    // edits show up here without a manual refresh.
    if (session.isReal) {
      void initChatCloudSync(
        () => conversationsRef.current,
        (reconciled) => {
          saveChatConversations(reconciled);
          setConversations(reconciled);
          // Keep the active selection stable across a background sync —
          // only fall back to the newest conversation if the previously
          // active one no longer exists (e.g. deleted on another device).
          setActiveId((prevActive) =>
            reconciled.some((c) => c.id === prevActive) ? prevActive : reconciled[0]?.id ?? null
          );
        }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function persist(next: ChatConversation[], changed?: ChatConversation) {
    setConversations(next);
    saveChatConversations(next);
    if (changed) syncConversationToCloud(changed);
  }

  function handleNew() {
    // Respects whichever tab is currently selected -- "New chat" while on
    // the Voice tab starts a fresh voice conversation instead of a text
    // one, and vice versa.
    const fresh = tab === "voice" ? createVoiceConversation() : createChatConversation();
    persist([fresh, ...conversations], fresh);
    setActiveId(fresh.id);
    setMobileOpen(false);
  }

  function handleSelect(id: string) {
    setActiveId(id);
    const selected = conversations.find((c) => c.id === id);
    if (selected) setTab(selected.kind === "voice" ? "voice" : "chat");
    setMobileOpen(false);
  }

  // Clicking a tab directly (not via the sidebar) switches to that kind of
  // conversation: if the active conversation is already the right kind,
  // nothing else needs to happen; otherwise jump to the most recent
  // conversation of that kind, or start a fresh one if there isn't one yet.
  function handleTabChange(next: "chat" | "voice") {
    setTab(next);
    if (active?.kind === next || (next === "chat" && !active?.kind)) return;
    const existing = conversations.find((c) => (next === "voice" ? c.kind === "voice" : c.kind !== "voice"));
    if (existing) {
      setActiveId(existing.id);
    } else {
      const fresh = next === "voice" ? createVoiceConversation() : createChatConversation();
      persist([fresh, ...conversations], fresh);
      setActiveId(fresh.id);
    }
  }

  function handleRename(id: string, title: string) {
    const now = new Date().toISOString();
    let changed: ChatConversation | undefined;
    const next = conversations.map((c) => {
      if (c.id !== id) return c;
      changed = { ...c, title, autoTitled: false, updatedAt: now };
      return changed;
    });
    persist(next, changed);
  }

  function handleDelete(id: string) {
    const deleted = conversations.find((c) => c.id === id);
    const remaining = conversations.filter((c) => c.id !== id);
    // Never leave the user staring at an empty placeholder after deleting
    // their last chat — spin up a fresh one of the same kind, same as
    // first load.
    const replacement =
      remaining.length > 0
        ? null
        : deleted?.kind === "voice"
        ? createVoiceConversation()
        : createChatConversation();
    const next = replacement ? [...remaining, replacement] : remaining;
    persist(next, replacement ?? undefined);
    syncConversationDeleteToCloud(id);
    if (activeId === id) setActiveId(next[0]?.id ?? null);
  }

  function handleMessagesChange(id: string, messages: ChatMessage[]) {
    const now = new Date().toISOString();
    let changed: ChatConversation | undefined;
    const next = conversations
      .map((c) => {
        if (c.id !== id) return c;
        const firstUser = messages.find((m) => m.role === "user");
        const title = c.autoTitled && firstUser ? titleFromMessage(firstUser.content) : c.title;
        changed = { ...c, messages, title, autoTitled: c.autoTitled && !firstUser, updatedAt: now };
        return changed;
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    persist(next, changed);
  }

  const active = conversations.find((c) => c.id === activeId) ?? null;

  const sidebarContent = (
    <>
      <ChatBrand />
      <ChatSidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={handleSelect}
        onNew={handleNew}
        onRename={handleRename}
        onDelete={handleDelete}
        className="min-h-0 flex-1"
      />
      <ChatProfileFooter session={session} configured={configured} />
    </>
  );

  const modeSwitcher = (
    <div className="flex items-center gap-0.5 rounded-full border border-border bg-surface p-0.5">
      <button
        type="button"
        onClick={() => handleTabChange("chat")}
        aria-pressed={tab === "chat"}
        className={cn(
          "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors",
          tab === "chat" ? "bg-surface-raised text-text shadow-soft" : "text-text-faint hover:text-text-muted"
        )}
      >
        <MessagesSquare className="h-3.5 w-3.5" /> Chats
      </button>
      <button
        type="button"
        onClick={() => handleTabChange("voice")}
        aria-pressed={tab === "voice"}
        className={cn(
          "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors",
          tab === "voice" ? "bg-surface-raised text-text shadow-soft" : "text-text-faint hover:text-text-muted"
        )}
      >
        <AudioLines className="h-3.5 w-3.5" /> Voice
      </button>
    </div>
  );

  const statusBadge =
    tab === "chat" && configured === false ? (
      <Badge variant="brass">Demo</Badge>
    ) : tab === "chat" && configured === true ? (
      <Badge variant="success">Live</Badge>
    ) : null;

  return (
    <div className="flex h-[calc(100vh-4rem)] min-h-0 min-w-0 overflow-hidden">
      <aside className="hidden md:flex w-64 shrink-0 flex-col gap-3 border-r border-border bg-surface-raised/40 p-3">
        {sidebarContent}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2.5 md:hidden">
          <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
            <Dialog.Trigger asChild>
              <button
                type="button"
                aria-label="Open chat history"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface hover:text-text"
              >
                <Menu className="h-[18px] w-[18px]" />
              </button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" />
              <Dialog.Content className="fixed left-0 top-0 z-50 flex h-full w-72 max-w-[85vw] flex-col gap-3 border-r border-border bg-surface-raised p-3">
                <Dialog.Title className="sr-only">Chat history</Dialog.Title>
                {sidebarContent}
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
          <span className="min-w-0 flex-1 truncate text-center text-sm font-medium text-text">
            {tab === "voice" ? active?.title ?? "Voice Mode" : active?.title ?? "AI Chat"}
          </span>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center">{statusBadge}</span>
        </header>

        {/* Mobile mode switcher gets its own row — the header row above is
            already tight with the hamburger + title + badge. */}
        <div className="flex shrink-0 items-center justify-center border-b border-border py-2 md:hidden">
          {modeSwitcher}
        </div>

        <header className="hidden shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-2.5 md:flex">
          <span className="min-w-0 truncate text-sm font-medium text-text-muted">
            {tab === "voice" ? active?.title ?? "Voice Mode" : active?.title ?? "AI Chat"}
          </span>
          <div className="flex shrink-0 items-center gap-2.5">
            {statusBadge}
            {modeSwitcher}
          </div>
        </header>

        <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
          {tab === "voice" ? (
            !hydrated || !active ? null : (
              <VoicePanel
                key={active.id}
                conversation={active}
                configured={voiceConfigured}
                onMessagesChange={(messages) => handleMessagesChange(active.id, messages)}
              />
            )
          ) : disabledReason ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
              <TriangleAlert className="h-8 w-8 text-brass" />
              <h2 className="font-display text-lg font-semibold">AI Chat is temporarily unavailable</h2>
              <p className="max-w-sm text-sm text-text-muted">{disabledReason}</p>
            </div>
          ) : !hydrated ? null : active ? (
            <ChatPanel conversation={active} onMessagesChange={(messages) => handleMessagesChange(active.id, messages)} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <p className="text-sm text-text-muted">Start a new conversation to begin.</p>
              <Button onClick={handleNew} size="sm">
                New chat
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
