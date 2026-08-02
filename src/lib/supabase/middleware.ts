import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "./config";

/**
 * Refreshes the Supabase auth session on every request and returns both the
 * (possibly updated) response and the current user, so `middleware.ts` can
 * make a routing decision without a second round trip.
 */
export async function updateSupabaseSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (!isSupabaseConfigured()) {
    return { response, user: null };
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  let user: User | null = null;
  try {
    const {
      data: { user: authedUser },
    } = await supabase.auth.getUser();
    user = authedUser;
  } catch {
    // Treat an unreachable/erroring auth check as unauthenticated — the
    // caller redirects protected paths to /login, which is the safe
    // default here, rather than throwing and taking the request down.
  }

  return { response, user };
}
