import { isSupabaseConfigured, isAiConfigured, isForgeAiConfigured } from "@/lib/supabase/config";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type HealthState = "operational" | "degraded" | "down" | "not_configured";

export interface HealthCheck {
  name: string;
  state: HealthState;
  detail: string;
  latencyMs: number | null;
}

export interface ServerHealth {
  checks: HealthCheck[];
  overall: HealthState;
}

async function checkSupabase(): Promise<HealthCheck> {
  if (!isSupabaseConfigured()) {
    return { name: "Supabase", state: "not_configured", detail: "Not configured — running in demo mode", latencyMs: null };
  }
  const start = Date.now();
  try {
    const supabase = await getSupabaseServerClient();
    const { error } = (await supabase?.from("system_settings").select("id").limit(1)) ?? { error: null };
    const latencyMs = Date.now() - start;
    if (error) {
      return { name: "Supabase", state: "degraded", detail: error.message, latencyMs };
    }
    return {
      name: "Supabase",
      state: latencyMs > 1500 ? "degraded" : "operational",
      detail: `Database reachable (${latencyMs}ms)`,
      latencyMs,
    };
  } catch (err) {
    return {
      name: "Supabase",
      state: "down",
      detail: err instanceof Error ? err.message : "Connection failed",
      latencyMs: Date.now() - start,
    };
  }
}

function checkGroqPool(name: string, configured: boolean): HealthCheck {
  return configured
    ? { name, state: "operational", detail: "API key(s) configured", latencyMs: null }
    : { name, state: "not_configured", detail: "No API key configured — using local simulation", latencyMs: null };
}

function checkRuntime(): HealthCheck {
  const onVercel = Boolean(process.env.VERCEL);
  return {
    name: "Application runtime",
    state: "operational",
    detail: onVercel
      ? `Vercel (${process.env.VERCEL_ENV ?? "unknown environment"})`
      : "Self-hosted / local",
    latencyMs: null,
  };
}

export async function getServerHealth(): Promise<ServerHealth> {
  const checks = [
    checkRuntime(),
    await checkSupabase(),
    checkGroqPool("Groq — AI actions", isAiConfigured()),
    checkGroqPool("Groq — Forge AI", isForgeAiConfigured()),
  ];

  const overall: HealthState = checks.some((c) => c.state === "down")
    ? "down"
    : checks.some((c) => c.state === "degraded")
      ? "degraded"
      : "operational";

  return { checks, overall };
}
