/**
 * Demo auth
 * ---------
 * Phase 1–2 of PromptForge ship with no backend wired up yet. Rather than
 * leaving the login/signup screens dead, "signing in" or "signing up" opens
 * a local demo account: a small session object stashed in a cookie so both
 * the browser and `middleware.ts` can see it.
 *
 * Nothing here talks to a network. There's no password check, no real user
 * table — just enough state to make the protected dashboard routes feel
 * real. Swapping this for real auth (Supabase or otherwise) is scoped to
 * a later phase — see the roadmap in README.md.
 */

export const DEMO_COOKIE = "pf_demo_session";

export interface DemoSession {
  name: string;
  email: string;
}

export const DEFAULT_DEMO_SESSION: DemoSession = {
  name: "Demo User",
  email: "demo@promptforge.app",
};

const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

function setCookie(value: DemoSession) {
  document.cookie = `${DEMO_COOKIE}=${encodeURIComponent(
    JSON.stringify(value)
  )}; path=/; max-age=${MAX_AGE_SECONDS}; SameSite=Lax`;
}

/** Logs into the shared demo account. Any name/email supplied in a form is
 *  kept for display purposes only — it isn't validated against anything. */
export function loginDemo(session: Partial<DemoSession> = {}): DemoSession {
  const value: DemoSession = {
    name: session.name?.trim() || DEFAULT_DEMO_SESSION.name,
    email: session.email?.trim() || DEFAULT_DEMO_SESSION.email,
  };
  setCookie(value);
  return value;
}

export function logoutDemo() {
  document.cookie = `${DEMO_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

export function getDemoSessionClient(): DemoSession | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${DEMO_COOKIE}=`));
  if (!match) return null;
  try {
    return JSON.parse(decodeURIComponent(match.split("=").slice(1).join("=")));
  } catch {
    return null;
  }
}
