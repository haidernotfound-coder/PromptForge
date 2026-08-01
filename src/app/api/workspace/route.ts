import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

/**
 * Phase 7 workspace sync.
 *
 * GET  -> the signed-in user's saved workspace snapshot (or null if they've
 *         never synced one, e.g. first login on a new device).
 * PUT  -> upserts the signed-in user's workspace snapshot.
 *
 * Both are RLS-protected: `workspaces` policies only allow a row to be
 * read/written by its own `user_id`, so this route never needs to check
 * ownership itself — an authenticated request can only ever touch its own
 * row, and an unauthenticated request gets nothing back.
 */

interface WorkspaceRow {
  data: Json;
  updated_at: string;
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

  // Selected explicitly as "*" and typed via WorkspaceRow rather than a
  // select("data, updated_at") column-string generic — postgrest-js's
  // string-literal column parser can collapse to `never` on some schema/TS
  // version combinations, which is a type-inference quirk, not a real
  // narrowing of the actual runtime result.
  const { data: row, error } = await supabase
    .from("workspaces")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle<WorkspaceRow>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ workspace: row?.data ?? null, updatedAt: row?.updated_at ?? null });
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

  let body: Json;
  try {
    body = (await request.json()) as Json;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { error } = await supabase
    .from("workspaces")
    .upsert({ user_id: user.id, data: body, updated_at: new Date().toISOString() });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, updatedAt: new Date().toISOString() });
}
