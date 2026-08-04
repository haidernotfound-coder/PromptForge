import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

/**
 * Phase 13 — Admin analytics store
 * ---------------------------------
 * Same "works with zero setup, upgrades when configured" shape as the rest
 * of the app: when Supabase is configured, events/usage/settings are
 * persisted to the tables added in
 * `supabase/migrations/phase13_admin_dashboard.sql` (shared across every
 * server instance and durable across restarts). When it isn't, everything
 * falls back to a per-process in-memory store — good enough for demo mode,
 * exactly like the Phase 1–6 localStorage-backed workspace falls back when
 * there's no backend.
 *
 * This module is intentionally the *only* place that knows about that
 * fallback, so every caller (API routes, admin dashboard pages) just calls
 * plain async functions without caring which backend answered.
 */

export type EventType =
  | "prompt.improved"
  | "prompt.rewritten"
  | "prompt.expanded"
  | "prompt.shortened"
  | "prompt.critiqued"
  | "forge_ai.chat"
  | "recipe.used"
  | "prompt.copied"
  | "prompt.created"
  | "ai.error"
  | "codeforge.generate"
  | "codeforge.fix"
  | "codeforge.optimize"
  | "codeforge.explain"
  | "codeforge.convert"
  | "codeforge.tests"
  | "codeforge.docs"
  | "codeforge.review"
  | "codeforge.chat"
  | "studyforge.explain"
  | "studyforge.notes"
  | "studyforge.flashcards"
  | "studyforge.quiz"
  | "studyforge.homework"
  | "studyforge.planner"
  | "studyforge.summarize"
  | "studyforge.exam"
  | "studyforge.chat";

export interface AdminEvent {
  id: string;
  userLabel: string | null;
  eventType: EventType;
  metadata: Record<string, unknown>;
  success: boolean;
  createdAt: string;
}

export interface SystemSettings {
  forgeAiEnabled: boolean;
  recipeForgeEnabled: boolean;
  criticEnabled: boolean;
  maintenanceMode: boolean;
  codeforgeEnabled: boolean;
  studyforgeEnabled: boolean;
}

const DEFAULT_SETTINGS: SystemSettings = {
  forgeAiEnabled: true,
  recipeForgeEnabled: true,
  criticEnabled: true,
  maintenanceMode: false,
  codeforgeEnabled: true,
  studyforgeEnabled: true,
};

// --- In-memory fallback (demo mode / no Supabase) --------------------------

const MEMORY_EVENT_CAP = 2000;

interface MemoryState {
  events: AdminEvent[];
  groqUsage: Map<string, { requestCount: number; successCount: number; failureCount: number }>;
  settings: SystemSettings;
}

// Module-level singleton — survives across requests within the same server
// process/lambda instance, resets on redeploy/restart. That's the same
// durability tradeoff the rest of demo mode already makes.
const memory: MemoryState = {
  events: [],
  groqUsage: new Map(),
  settings: { ...DEFAULT_SETTINGS },
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function groqMemoryKey(pool: string, label: string) {
  return `${pool}::${label}::${todayKey()}`;
}

// --- Events ------------------------------------------------------------

export interface RecordEventInput {
  userLabel?: string | null;
  eventType: EventType;
  metadata?: Record<string, unknown>;
  success?: boolean;
}

/** Best-effort: never throws, so a logging failure can't break the feature
 *  it's instrumenting. */
export async function recordEvent(input: RecordEventInput): Promise<void> {
  try {
    if (isSupabaseConfigured()) {
      const supabase = await getSupabaseServerClient();
      const {
        data: { user },
      } = (await supabase?.auth.getUser()) ?? { data: { user: null } };
      await supabase?.from("admin_events").insert({
        user_id: user?.id ?? null,
        user_label: input.userLabel ?? user?.email ?? null,
        event_type: input.eventType,
        metadata: (input.metadata ?? {}) as Json,
        success: input.success ?? true,
      });
      return;
    }
  } catch {
    // fall through to memory
  }

  memory.events.unshift({
    id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    userLabel: input.userLabel ?? null,
    eventType: input.eventType,
    metadata: input.metadata ?? {},
    success: input.success ?? true,
    createdAt: new Date().toISOString(),
  });
  if (memory.events.length > MEMORY_EVENT_CAP) {
    memory.events.length = MEMORY_EVENT_CAP;
  }
}

/** Fetches recent events (most recent first) for the admin dashboard. */
export async function getRecentEvents(limit = 500): Promise<AdminEvent[]> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = await getSupabaseServerClient();
      const { data, error } = (await supabase
        ?.from("admin_events")
        .select("id, user_label, event_type, metadata, success, created_at")
        .order("created_at", { ascending: false })
        .limit(limit)) ?? { data: null, error: null };
      if (!error && data) {
        return data.map((row) => ({
          id: row.id,
          userLabel: row.user_label,
          eventType: row.event_type as EventType,
          metadata: (row.metadata as Record<string, unknown>) ?? {},
          success: row.success,
          createdAt: row.created_at,
        }));
      }
    } catch {
      // fall through to memory below
    }
  }
  return memory.events.slice(0, limit);
}

// --- Groq key usage ------------------------------------------------------

export interface RecordGroqUsageInput {
  pool: "ai" | "forge_ai" | "codeforge" | "studyforge";
  keyLabel: string;
  success: boolean;
}

export async function recordGroqUsage(input: RecordGroqUsageInput): Promise<void> {
  try {
    if (isSupabaseConfigured()) {
      const supabase = await getSupabaseServerClient();
      const usageDate = todayKey();
      const { data: existing } = (await supabase
        ?.from("groq_key_usage")
        .select("request_count, success_count, failure_count")
        .eq("key_pool", input.pool)
        .eq("key_label", input.keyLabel)
        .eq("usage_date", usageDate)
        .maybeSingle()) ?? { data: null };

      await supabase?.from("groq_key_usage").upsert({
        key_pool: input.pool,
        key_label: input.keyLabel,
        usage_date: usageDate,
        request_count: (existing?.request_count ?? 0) + 1,
        success_count: (existing?.success_count ?? 0) + (input.success ? 1 : 0),
        failure_count: (existing?.failure_count ?? 0) + (input.success ? 0 : 1),
        updated_at: new Date().toISOString(),
      });
      return;
    }
  } catch {
    // fall through to memory
  }

  const key = groqMemoryKey(input.pool, input.keyLabel);
  const current = memory.groqUsage.get(key) ?? { requestCount: 0, successCount: 0, failureCount: 0 };
  current.requestCount += 1;
  if (input.success) current.successCount += 1;
  else current.failureCount += 1;
  memory.groqUsage.set(key, current);
}

export interface GroqKeyUsageSnapshot {
  pool: "ai" | "forge_ai" | "codeforge" | "studyforge";
  keyLabel: string;
  requestCount: number;
  successCount: number;
  failureCount: number;
}

/** Today's usage for every key in `poolKeyLabels` (zero-filled for keys
 *  that haven't been used yet today). */
export async function getGroqUsageToday(
  poolKeyLabels: { pool: "ai" | "forge_ai" | "codeforge" | "studyforge"; keyLabel: string }[]
): Promise<GroqKeyUsageSnapshot[]> {
  const usageDate = todayKey();

  if (isSupabaseConfigured()) {
    try {
      const supabase = await getSupabaseServerClient();
      const { data, error } = (await supabase
        ?.from("groq_key_usage")
        .select("key_pool, key_label, request_count, success_count, failure_count")
        .eq("usage_date", usageDate)) ?? { data: null, error: null };
      if (!error && data) {
        const byKey = new Map(data.map((row) => [`${row.key_pool}::${row.key_label}`, row]));
        return poolKeyLabels.map(({ pool, keyLabel }) => {
          const row = byKey.get(`${pool}::${keyLabel}`);
          return {
            pool,
            keyLabel,
            requestCount: row?.request_count ?? 0,
            successCount: row?.success_count ?? 0,
            failureCount: row?.failure_count ?? 0,
          };
        });
      }
    } catch {
      // fall through to memory
    }
  }

  return poolKeyLabels.map(({ pool, keyLabel }) => {
    const entry = memory.groqUsage.get(groqMemoryKey(pool, keyLabel));
    return {
      pool,
      keyLabel,
      requestCount: entry?.requestCount ?? 0,
      successCount: entry?.successCount ?? 0,
      failureCount: entry?.failureCount ?? 0,
    };
  });
}

// --- System settings -------------------------------------------------------

export async function getSystemSettings(): Promise<SystemSettings> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = await getSupabaseServerClient();
      const { data, error } = (await supabase
        ?.from("system_settings")
        .select(
          "forge_ai_enabled, recipe_forge_enabled, critic_enabled, maintenance_mode, codeforge_enabled, studyforge_enabled"
        )
        .eq("id", true)
        .maybeSingle()) ?? { data: null, error: null };
      if (!error && data) {
        return {
          forgeAiEnabled: data.forge_ai_enabled,
          recipeForgeEnabled: data.recipe_forge_enabled,
          criticEnabled: data.critic_enabled,
          maintenanceMode: data.maintenance_mode,
          codeforgeEnabled: data.codeforge_enabled ?? true,
          studyforgeEnabled: data.studyforge_enabled ?? true,
        };
      }
    } catch {
      // fall through to memory
    }
  }
  return { ...memory.settings };
}

export async function updateSystemSettings(patch: Partial<SystemSettings>): Promise<SystemSettings> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = await getSupabaseServerClient();
      const { data, error } = (await supabase
        ?.from("system_settings")
        .update({
          ...(patch.forgeAiEnabled !== undefined ? { forge_ai_enabled: patch.forgeAiEnabled } : {}),
          ...(patch.recipeForgeEnabled !== undefined ? { recipe_forge_enabled: patch.recipeForgeEnabled } : {}),
          ...(patch.criticEnabled !== undefined ? { critic_enabled: patch.criticEnabled } : {}),
          ...(patch.maintenanceMode !== undefined ? { maintenance_mode: patch.maintenanceMode } : {}),
          ...(patch.codeforgeEnabled !== undefined ? { codeforge_enabled: patch.codeforgeEnabled } : {}),
          ...(patch.studyforgeEnabled !== undefined ? { studyforge_enabled: patch.studyforgeEnabled } : {}),
        })
        .eq("id", true)
        .select(
          "forge_ai_enabled, recipe_forge_enabled, critic_enabled, maintenance_mode, codeforge_enabled, studyforge_enabled"
        )
        .maybeSingle()) ?? { data: null, error: null };
      if (!error && data) {
        return {
          forgeAiEnabled: data.forge_ai_enabled,
          recipeForgeEnabled: data.recipe_forge_enabled,
          criticEnabled: data.critic_enabled,
          maintenanceMode: data.maintenance_mode,
          codeforgeEnabled: data.codeforge_enabled ?? true,
          studyforgeEnabled: data.studyforge_enabled ?? true,
        };
      }
    } catch {
      // fall through to memory
    }
  }
  memory.settings = { ...memory.settings, ...patch };
  return { ...memory.settings };
}
