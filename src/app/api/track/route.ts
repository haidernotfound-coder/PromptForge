import { NextResponse } from "next/server";
import { recordEvent, type EventType } from "@/lib/admin/store";
import { getAppSessionOrNull } from "@/lib/session";

export const runtime = "nodejs";

/**
 * Records a client-originated product event (recipe used, prompt copied,
 * prompt created, ...) for the admin dashboard's Live Activity Feed and
 * Top Statistics. Deliberately tiny: a fixed allow-list of event types, no
 * PII beyond the signed-in session's own email, best-effort (never blocks
 * the UI action it's attached to).
 */
const ALLOWED_EVENTS: EventType[] = ["recipe.used", "prompt.copied", "prompt.created"];

export async function POST(request: Request) {
  let body: { eventType?: string; metadata?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const eventType = body.eventType as EventType;
  if (!ALLOWED_EVENTS.includes(eventType)) {
    return NextResponse.json({ error: "Unsupported event type" }, { status: 400 });
  }

  const session = await getAppSessionOrNull();
  await recordEvent({
    userLabel: session?.email,
    eventType,
    metadata: body.metadata ?? {},
  });

  return NextResponse.json({ ok: true });
}
