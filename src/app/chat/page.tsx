"use client";

import * as React from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import * as Dialog from "@radix-ui/react-dialog";
import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { ChatPanel } from "@/components/chat/chat-panel";
import {
  createChatConversation,
  loadChatConversations,
  saveChatConversations,
  titleFromMessage,
  type ChatConversation,
  type ChatMessage,
} from "@/lib/chat";

export default function ChatPage() {
  const [conversations, setConversations] = React.useState<ChatConversation[]>([]);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    const loaded = loadChatConversations();
    // Land straight in a fresh conversation on a brand-new browser instead
    // of an empty "start a new conversation" placeholder — one less click
    // to the ChatGPT-style experience Phase 5 calls for.
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
  }, []);

  function persist(next: ChatConversation[]) {
    setConversations(next);
    saveChatConversations(next);
  }

  function handleNew() {
    const fresh = createChatConversation();
    persist([fresh, ...conversations]);
    setActiveId(fresh.id);
    setMobileOpen(false);
  }

  function handleSelect(id: string) {
    setActiveId(id);
    setMobileOpen(false);
  }

  function handleRename(id: string, title: string) {
    persist(conversations.map((c) => (c.id === id ? { ...c, title, autoTitled: false } : c)));
  }

  function handleDelete(id: string) {
    const remaining = conversations.filter((c) => c.id !== id);
    // Never leave the user staring at an empty placeholder after deleting
    // their last chat — spin up a fresh one, same as first load.
    const next = remaining.length > 0 ? remaining : [createChatConversation()];
    persist(next);
    if (activeId === id) setActiveId(next[0].id);
  }

  function handleMessagesChange(id: string, messages: ChatMessage[]) {
    const now = new Date().toISOString();
    persist(
      conversations
        .map((c) => {
          if (c.id !== id) return c;
          const firstUser = messages.find((m) => m.role === "user");
          const title = c.autoTitled && firstUser ? titleFromMessage(firstUser.content) : c.title;
          return { ...c, messages, title, autoTitled: c.autoTitled && !firstUser, updatedAt: now };
        })
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    );
  }

  const active = conversations.find((c) => c.id === activeId) ?? null;

  if (!hydrated) return null;

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border p-4">
        <ChatSidebar
          conversations={conversations}
          activeId={activeId}
          onSelect={handleSelect}
          onNew={handleNew}
          onRename={handleRename}
          onDelete={handleDelete}
        />
      </aside>

      <div className="flex-1 flex flex-col min-w-0 p-6">
        <div className="mb-2 md:hidden">
          <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
            <Dialog.Trigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Menu className="h-4 w-4" /> Chats
              </Button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" />
              <Dialog.Content className="fixed left-0 top-0 z-50 h-full w-72 bg-surface-raised border-r border-border p-4">
                <Dialog.Title className="sr-only">Chat history</Dialog.Title>
                <ChatSidebar
                  conversations={conversations}
                  activeId={activeId}
                  onSelect={handleSelect}
                  onNew={handleNew}
                  onRename={handleRename}
                  onDelete={handleDelete}
                  className="h-full"
                />
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </div>

        {active ? (
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
  );
}
