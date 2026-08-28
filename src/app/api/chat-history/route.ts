import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { ChatConversation, ChatMessage } from "@/lib/chat";

/**
 * Phase 17 chat history sync.
 *
 * Unlike /api/workspace (Phase 7's single-JSON-blob sync), chat history is
 * stored per-row (`chat_conversations` + `chat_messages`, see
 * supabase/migrations/phase17_chat_sync.sql) so one device's edit to
 * conversation A can never clobber another device's concurrent edit to
 * conversation B — each PUT/DELETE here only ever touches the one
 * conversation it names.
 *
 * GET    -> every conversation + its messages for the signed-in user,
 *           newest-updated first (same shape loadChatConversations used to
 *           read out of localStorage).
 * PUT    -> upserts one conversation's metadata and replaces its message
 *           list wholesale (a conversation's messages are always saved
 *           together from the client, so a delete-then-insert per save is
 *           simpler and safe: it's scoped to that conversation's own rows).
 * DELETE -> removes one conversation (?id=...) and its messages (cascade).
 *
 * All three are RLS-protected the same way every other per-user table in
 * this schema is: policies only allow a row to be read/written by its own
 * user_id, so this route never needs to check ownership itself.
 */

interface ConversationRow {
  id: string;
  title: string;
  auto_titled: boolean;
  kind: string;
  created_at: string;
  updated_at: string;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  attachments: ChatMessage["attachments"] | null;
  files: ChatMessage["files"] | null;
  sources: ChatMessage["sources"] | null;
  created_at: string;
}

export async function GET() {
  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Backend not configured" }, { status: 501 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const [{ data: convRows, error: convErr }, { data: msgRows, error: msgErr }] = await Promise.all([
    supabase
      .from("chat_conversations")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .returns<ConversationRow[]>(),
    supabase
      .from("chat_messages")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .returns<MessageRow[]>(),
  ]);

  if (convErr) return NextResponse.json({ error: convErr.message }, { status: 500 });
  if (msgErr) return NextResponse.json({ error: msgErr.message }, { status: 500 });

  const messagesByConversation = new Map<string, ChatMessage[]>();
  for (const m of msgRows ?? []) {
    const list = messagesByConversation.get(m.conversation_id) ?? [];
    list.push({
      id: m.id,
      role: m.role as ChatMessage["role"],
      content: m.content,
      createdAt: m.created_at,
      attachments: m.attachments ?? undefined,
      files: m.files ?? undefined,
      sources: m.sources ?? undefined,
    });
    messagesByConversation.set(m.conversation_id, list);
  }

  const conversations: ChatConversation[] = (convRows ?? []).map((c) => ({
    id: c.id,
    title: c.title,
    autoTitled: c.auto_titled,
    kind: (c.kind as ChatConversation["kind"]) ?? "text",
    messages: messagesByConversation.get(c.id) ?? [],
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  }));

  return NextResponse.json({ conversations });
}

export async function PUT(request: Request) {
  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Backend not configured" }, { status: 501 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let body: ChatConversation;
  try {
    body = (await request.json()) as ChatConversation;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body.id !== "string" || typeof body.title !== "string" || !Array.isArray(body.messages)) {
    return NextResponse.json({ error: "Malformed conversation payload" }, { status: 400 });
  }

  const { error: convError } = await supabase.from("chat_conversations").upsert({
    id: body.id,
    user_id: user.id,
    title: body.title,
    auto_titled: body.autoTitled,
    kind: body.kind ?? "text",
    created_at: body.createdAt,
    updated_at: body.updatedAt,
  });
  if (convError) return NextResponse.json({ error: convError.message }, { status: 500 });

  // Messages are always saved as a full list from the client (see
  // saveConversation in src/lib/chat.ts) — replace this conversation's rows
  // wholesale rather than diffing. Scoped to conversation_id + user_id, so
  // it can never touch another conversation's rows even under a race.
  const { error: delError } = await supabase
    .from("chat_messages")
    .delete()
    .eq("conversation_id", body.id)
    .eq("user_id", user.id);
  if (delError) return NextResponse.json({ error: delError.message }, { status: 500 });

  if (body.messages.length > 0) {
    const { error: insError } = await supabase.from("chat_messages").insert(
      body.messages.map((m) => ({
        id: m.id,
        conversation_id: body.id,
        user_id: user.id,
        role: m.role,
        content: m.content,
        attachments: m.attachments ?? null,
        files: m.files ?? null,
        sources: m.sources ?? null,
        created_at: m.createdAt,
      }))
    );
    if (insError) return NextResponse.json({ error: insError.message }, { status: 500 });
  }

  // Re-touch updated_at explicitly to the client's timestamp — the DB
  // trigger already bumps it to now() on message insert, but the client's
  // own updatedAt (used for its own conflict resolution) should win here
  // so a rename with no message change still reflects the right time.
  await supabase
    .from("chat_conversations")
    .update({ updated_at: body.updatedAt })
    .eq("id", body.id)
    .eq("user_id", user.id);

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Backend not configured" }, { status: 501 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  // Messages cascade-delete via the FK, so deleting the conversation row is
  // enough — scoped by user_id too, belt-and-suspenders with RLS.
  const { error } = await supabase.from("chat_conversations").delete().eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
