/**
 * Fire-and-forget client event tracking for the admin dashboard's Live
 * Activity Feed / Top Statistics. Never throws and never awaited by
 * callers — a tracking failure must never affect the user-facing action
 * it's attached to.
 */
export function trackEvent(eventType: "recipe.used" | "prompt.copied" | "prompt.created", metadata?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  try {
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventType, metadata }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // ignore — tracking must never break the UI
  }
}
