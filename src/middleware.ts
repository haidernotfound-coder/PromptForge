import { NextResponse, type NextRequest } from "next/server";
import { DEMO_COOKIE } from "@/lib/demo-auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { updateSupabaseSession } from "@/lib/supabase/middleware";

/**
 * Route protection.
 *
 * Phase 7: when Supabase is configured (see `.env.example`), this verifies
 * a real Supabase auth session on every request to a protected path and
 * also refreshes the session cookie so it doesn't silently expire during a
 * long visit. When Supabase isn't configured, it falls back to the Phase
 * 1–6 demo cookie check so the app keeps working with zero setup.
 */
const PROTECTED_PATHS = ["/dashboard", "/prompts", "/settings"];

export async function middleware(request: NextRequest) {
  const isProtected = PROTECTED_PATHS.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  if (isSupabaseConfigured()) {
    const { response, user } = await updateSupabaseSession(request);

    if (isProtected && !user) {
      const redirectUrl = new URL("/login", request.url);
      redirectUrl.searchParams.set("next", request.nextUrl.pathname);
      return NextResponse.redirect(redirectUrl);
    }

    return response;
  }

  if (!isProtected) {
    return NextResponse.next();
  }

  const hasDemoSession = request.cookies.has(DEMO_COOKIE);

  if (!hasDemoSession) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
