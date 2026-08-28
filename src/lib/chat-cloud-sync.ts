"use client";

/**
 * Thin fetch wrapper around /api/chat-history, used by chat.ts's cloud sync
 * (see initChatCloudSync) when Supabase is configured and the visitor is
 * signed in with a real account. Same "501/401 -> stay local" no-op
 * convention as cloud-sync.ts's workspace pull/push.
 */

import type { ChatConversation } from "@/lib/chat";

export async function pullChatConversations(): Promise<ChatConversation[] | null> {
  try {
    const res = await fetch("/api/chat-history", { method: "GET" });
    if (!res.ok) return null;
    const json = await res.json();
    return Array.isArray(json?.conversations) ? (json.conversations as ChatConversation[]) : null;
  } catch {
    return null;
  }
}

export async function pushChatConversation(conversation: ChatConversation): Promise<boolean> {
  try {
    const res = await fetch("/api/chat-history", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(conversation),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function deleteChatConversationRemote(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/chat-history?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    return res.ok;
  } catch {
    return false;
  }
}
