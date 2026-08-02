import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getDemoSession, getDemoSessionOrDefault } from "@/lib/demo-auth-server";

export interface AppSession {
  name: string;
  email: string;
  /** true when this is a real Supabase account, false for the Phase 1–6
   *  local demo account. Lets the UI show "Sign out" vs a demo-account
   *  badge without every caller re-deriving it. */
  isReal: boolean;
}

function nameFromEmail(email: string) {
  return email.split("@")[0]?.replace(/[._-]/g, " ") || "there";
}

/** Reads the current session for use in Server Components/layouts. Prefers
 *  a real Supabase session when configured, and falls back to the demo
 *  cookie session otherwise (or if nobody is signed in via Supabase but the
 *  route is reachable in demo mode). */
export async function getAppSession(): Promise<AppSession> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = await getSupabaseServerClient();
      const {
        data: { user },
      } = (await supabase?.auth.getUser()) ?? { data: { user: null } };

      if (user) {
        const fullName =
          (user.user_metadata?.full_name as string | undefined) ||
          nameFromEmail(user.email ?? "");
        return { name: fullName, email: user.email ?? "", isReal: true };
      }
    } catch {
      // Supabase reachable-but-erroring (or transiently unreachable) —
      // fall through to the demo session rather than throwing through the
      // Server Component tree and tripping the app's error boundary.
    }
  }

  const demo = await getDemoSessionOrDefault();
  return { ...demo, isReal: false };
}

/** Like getAppSession, but for public/marketing pages: returns null when
 *  nobody is actually signed in, instead of falling back to a default demo
 *  identity. Use this anywhere you need to distinguish "signed in" from
 *  "not signed in" (e.g. the navbar), rather than assuming a session like
 *  route-protected pages do. */
export async function getAppSessionOrNull(): Promise<AppSession | null> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = await getSupabaseServerClient();
      const {
        data: { user },
      } = (await supabase?.auth.getUser()) ?? { data: { user: null } };

      if (user) {
        const fullName =
          (user.user_metadata?.full_name as string | undefined) ||
          nameFromEmail(user.email ?? "");
        return { name: fullName, email: user.email ?? "", isReal: true };
      }
      return null;
    } catch {
      // Fall through to demo mode below rather than throwing.
    }
  }

  const demo = await getDemoSession();
  return demo ? { ...demo, isReal: false } : null;
}
