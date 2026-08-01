import { cookies } from "next/headers";
import { DEMO_COOKIE, DEFAULT_DEMO_SESSION, type DemoSession } from "@/lib/demo-auth";

/** Reads the demo session cookie from a Server Component / layout. */
export async function getDemoSession(): Promise<DemoSession | null> {
  const store = await cookies();
  const raw = store.get(DEMO_COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(decodeURIComponent(raw)) as DemoSession;
  } catch {
    return null;
  }
}

/** Same as getDemoSession, but falls back to the default demo identity
 *  instead of null — handy in places that are already route-protected
 *  by middleware and so can assume a session exists. */
export async function getDemoSessionOrDefault(): Promise<DemoSession> {
  return (await getDemoSession()) ?? DEFAULT_DEMO_SESSION;
}
