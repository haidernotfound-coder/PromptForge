import { getAppSession, type AppSession } from "@/lib/session";
import { isAdminEmail } from "@/lib/admin/config";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export interface AdminSession extends AppSession {
  isAdmin: boolean;
}

/**
 * Resolves the current session plus whether it's an admin. An account is
 * admin if either:
 *  - its email is listed in `ADMIN_EMAILS` (works with zero DB setup), or
 *  - it's a real Supabase account whose `profiles.is_admin` flag is set.
 *
 * The env allowlist is a convenience for demo mode and initial setup; the
 * database flag is what actually gates cross-user reads (RLS policies and
 * the `admin_overview()` RPC only trust `profiles.is_admin`).
 */
export async function getAdminSession(): Promise<AdminSession> {
  const session = await getAppSession();

  if (isAdminEmail(session.email)) {
    return { ...session, isAdmin: true };
  }

  if (session.isReal && isSupabaseConfigured()) {
    const supabase = await getSupabaseServerClient();
    const {
      data: { user },
    } = (await supabase?.auth.getUser()) ?? { data: { user: null } };
    if (user) {
      const { data } = (await supabase
        ?.from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .maybeSingle()) ?? { data: null };
      if (data?.is_admin) {
        return { ...session, isAdmin: true };
      }
    }
  }

  return { ...session, isAdmin: false };
}
