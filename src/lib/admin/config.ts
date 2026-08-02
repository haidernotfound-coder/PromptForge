/**
 * Phase 13 — Admin Dashboard access control
 * ------------------------------------------
 * Mirrors the rest of the app's "works with zero setup, upgrades when
 * configured" pattern (see `lib/supabase/config.ts`): admin access is
 * granted by an `ADMIN_EMAILS` env var (comma-separated, case-insensitive)
 * so it works in demo mode with no database at all, and — when Supabase is
 * configured — is additionally honored via `profiles.is_admin` in the
 * database (see `supabase/migrations/phase13_admin_dashboard.sql`), which
 * is what actually gates the cross-user data the dashboard reads (RLS +
 * the `admin_overview()` RPC only trust that flag, not this env var).
 */

export function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS || "";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const admins = getAdminEmails();
  if (admins.length === 0) return false;
  return admins.includes(email.trim().toLowerCase());
}

export function isAdminConfigured(): boolean {
  return getAdminEmails().length > 0;
}
