import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Handles Supabase auth email links: signup confirmation, password-reset,
 * magic link. Supabase redirects here with a `code` query param; we
 * exchange it server-side for a session (setting the auth cookies), then
 * forward on to wherever the link was meant to land (`next`, e.g.
 * `/promptforge` for confirmation or `/reset-password` for a password reset).
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await getSupabaseServerClient();
    const { error } = (await supabase?.auth.exchangeCodeForSession(code)) ?? {};
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
