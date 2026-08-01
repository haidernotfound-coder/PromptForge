"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { isSupabaseConfigured } from "./config";

let cached: ReturnType<typeof createBrowserClient<Database>> | null = null;

/**
 * Browser-side Supabase client (anon key, RLS-protected). Returns null when
 * Supabase isn't configured so callers can fall back to demo mode instead
 * of crashing.
 */
export function getSupabaseBrowserClient() {
  if (!isSupabaseConfigured()) return null;
  if (!cached) {
    cached = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return cached;
}
