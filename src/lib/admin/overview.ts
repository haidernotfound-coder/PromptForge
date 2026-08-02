import {
  getGroqApiKeys,
  getGroqKeyLabels,
  getForgeAiApiKeys,
  getForgeAiKeyLabels,
  isAiConfigured,
  isForgeAiConfigured,
  isSupabaseConfigured,
} from "@/lib/supabase/config";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getLastGoodKeyIndex } from "@/lib/admin/groq-router-state";
import {
  getRecentEvents,
  getGroqUsageToday,
  getSystemSettings,
  type AdminEvent,
  type EventType,
} from "@/lib/admin/store";

/** Free-tier Groq daily request budget per key, used only to render a
 *  progress bar / "remaining" estimate — override with
 *  `GROQ_DAILY_LIMIT_PER_KEY` if your plan differs. Not authoritative:
 *  Groq doesn't expose a quota-remaining API, so this is a best-effort
 *  visualization, not a billing source of truth. */
function dailyLimitPerKey(): number {
  const raw = Number(process.env.GROQ_DAILY_LIMIT_PER_KEY);
  return Number.isFinite(raw) && raw > 0 ? raw : 14_400;
}

export interface GroqKeyStatus {
  label: string;
  masked: string;
  requestCount: number;
  successCount: number;
  failureCount: number;
  limit: number;
  percentUsed: number;
  isActive: boolean;
}

export interface GroqPoolStatus {
  pool: "ai" | "forge_ai";
  name: string;
  configured: boolean;
  keys: GroqKeyStatus[];
  totalRequests: number;
  totalSuccess: number;
  totalFailure: number;
}

export interface GroqMonitorData {
  pools: GroqPoolStatus[];
  combined: {
    totalRequests: number;
    totalSuccess: number;
    totalFailure: number;
    totalKeys: number;
  };
}

function maskKeyLabel(label: string): string {
  return `••••${label.slice(-4).padStart(4, "•")}`;
}

async function buildPool(
  pool: "ai" | "forge_ai",
  name: string,
  configured: boolean,
  labels: string[]
): Promise<GroqPoolStatus> {
  const usage = await getGroqUsageToday(labels.map((keyLabel) => ({ pool, keyLabel })));
  const activeIndex = getLastGoodKeyIndex(pool);
  const limit = dailyLimitPerKey();

  const keys: GroqKeyStatus[] = labels.map((label, i) => {
    const u = usage.find((row) => row.keyLabel === label);
    const requestCount = u?.requestCount ?? 0;
    return {
      label,
      masked: maskKeyLabel(label),
      requestCount,
      successCount: u?.successCount ?? 0,
      failureCount: u?.failureCount ?? 0,
      limit,
      percentUsed: Math.min(100, Math.round((requestCount / limit) * 100)),
      isActive: i === activeIndex,
    };
  });

  return {
    pool,
    name,
    configured,
    keys,
    totalRequests: keys.reduce((s, k) => s + k.requestCount, 0),
    totalSuccess: keys.reduce((s, k) => s + k.successCount, 0),
    totalFailure: keys.reduce((s, k) => s + k.failureCount, 0),
  };
}

export async function getGroqMonitorData(): Promise<GroqMonitorData> {
  const [aiPool, forgeAiPool] = await Promise.all([
    buildPool("ai", "Improve / Rewrite / Expand / Shorten / Critique", isAiConfigured(), getGroqKeyLabels()),
    buildPool("forge_ai", "Forge AI chat", isForgeAiConfigured(), getForgeAiKeyLabels()),
  ]);

  const pools = [aiPool, forgeAiPool];
  return {
    pools,
    combined: {
      totalRequests: pools.reduce((s, p) => s + p.totalRequests, 0),
      totalSuccess: pools.reduce((s, p) => s + p.totalSuccess, 0),
      totalFailure: pools.reduce((s, p) => s + p.totalFailure, 0),
      totalKeys: pools.reduce((s, p) => s + p.keys.length, 0),
    },
  };
}

// Note: unlike getGroqApiKeys/getForgeAiApiKeys (which return secret key
// values, server-only, never sent to the admin UI), this module only ever
// deals in labels/masked strings — kept as separate imports above purely
// so the "configured" checks stay in sync with the routes that actually
// call Groq.
void getGroqApiKeys;
void getForgeAiApiKeys;

// --- Overview ----------------------------------------------------------

export interface OverviewCounts {
  totalUsers: number | null;
  activeToday: number;
  aiRequestsToday: number;
  promptsCreatedToday: number;
  failedRequestsToday: number;
  newUsersToday: number | null;
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

const AI_REQUEST_EVENTS: EventType[] = [
  "prompt.improved",
  "prompt.rewritten",
  "prompt.expanded",
  "prompt.shortened",
  "prompt.critiqued",
  "forge_ai.chat",
];

export async function getOverviewCounts(events: AdminEvent[]): Promise<OverviewCounts> {
  const todays = events.filter((e) => isToday(e.createdAt));
  const activeUserLabels = new Set(todays.filter((e) => e.userLabel).map((e) => e.userLabel));

  let totalUsers: number | null = null;
  let newUsersToday: number | null = null;

  if (isSupabaseConfigured()) {
    try {
      const supabase = await getSupabaseServerClient();
      const { data, error } = (await supabase?.rpc("admin_overview")) ?? { data: null, error: null };
      if (!error && data) {
        const overview = data as Record<string, number>;
        totalUsers = overview.total_users ?? null;
        newUsersToday = overview.new_users_today ?? null;
      }
    } catch {
      // RPC unavailable or caller isn't DB-flagged as admin — leave null,
      // the UI shows "—" rather than a wrong number.
    }
  }

  return {
    totalUsers,
    activeToday: activeUserLabels.size,
    aiRequestsToday: todays.filter((e) => AI_REQUEST_EVENTS.includes(e.eventType)).length,
    promptsCreatedToday: todays.filter((e) => e.eventType === "prompt.created").length,
    failedRequestsToday: todays.filter((e) => !e.success).length,
    newUsersToday,
  };
}

// --- Feature usage (for charts) ------------------------------------------

export interface DailyFeatureUsage {
  date: string; // YYYY-MM-DD
  counts: Record<string, number>;
}

const FEATURE_EVENT_LABELS: Partial<Record<EventType, string>> = {
  "prompt.improved": "Improve",
  "prompt.rewritten": "Rewrite",
  "prompt.expanded": "Expand",
  "prompt.shortened": "Shorten",
  "prompt.critiqued": "Critic",
  "forge_ai.chat": "Forge AI",
  "recipe.used": "Recipe Forge",
};

export function buildFeatureUsageSeries(events: AdminEvent[], days: number): DailyFeatureUsage[] {
  const buckets = new Map<string, Record<string, number>>();
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    buckets.set(d.toISOString().slice(0, 10), {});
  }

  for (const e of events) {
    const label = FEATURE_EVENT_LABELS[e.eventType];
    if (!label) continue;
    const key = e.createdAt.slice(0, 10);
    const bucket = buckets.get(key);
    if (!bucket) continue; // outside the requested window
    bucket[label] = (bucket[label] ?? 0) + 1;
  }

  return Array.from(buckets.entries()).map(([date, counts]) => ({ date, counts }));
}

export function featureLabels(): string[] {
  return Array.from(new Set(Object.values(FEATURE_EVENT_LABELS)));
}

// --- Top statistics --------------------------------------------------------

export interface TopStatEntry {
  label: string;
  count: number;
}

export interface TopStatistics {
  topRecipes: TopStatEntry[];
  topCopiedPrompts: TopStatEntry[];
  mostActiveUsers: TopStatEntry[];
  mostImprovedPrompts: TopStatEntry[];
}

function tally(events: AdminEvent[], eventType: EventType, labelOf: (e: AdminEvent) => string | null): TopStatEntry[] {
  const counts = new Map<string, number>();
  for (const e of events) {
    if (e.eventType !== eventType) continue;
    const label = labelOf(e);
    if (!label) continue;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

export function buildTopStatistics(events: AdminEvent[]): TopStatistics {
  const topRecipes = tally(events, "recipe.used", (e) => (e.metadata.title as string) ?? (e.metadata.recipeId as string) ?? null);
  const topCopiedPrompts = tally(events, "prompt.copied", (e) => (e.metadata.promptId as string) ?? null);
  const mostImprovedPrompts = tally(events, "prompt.improved", (e) => (e.metadata.promptId as string) ?? null);

  const userCounts = new Map<string, number>();
  for (const e of events) {
    if (!e.userLabel) continue;
    userCounts.set(e.userLabel, (userCounts.get(e.userLabel) ?? 0) + 1);
  }
  const mostActiveUsers = Array.from(userCounts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return { topRecipes, topCopiedPrompts, mostActiveUsers, mostImprovedPrompts };
}

// --- Full bundle (used by the initial server-rendered page + the polling
// API route, so both stay perfectly in sync) --------------------------------

export interface AdminOverviewBundle {
  overview: OverviewCounts;
  featureUsageDaily: DailyFeatureUsage[];
  featureLabels: string[];
  groq: GroqMonitorData;
  activity: AdminEvent[];
  errors: AdminEvent[];
  topStats: TopStatistics;
  settings: Awaited<ReturnType<typeof getSystemSettings>>;
  generatedAt: string;
}

export async function getAdminOverviewBundle(): Promise<AdminOverviewBundle> {
  const events = await getRecentEvents(1000);
  const [overview, groq, settings] = await Promise.all([
    getOverviewCounts(events),
    getGroqMonitorData(),
    getSystemSettings(),
  ]);

  return {
    overview,
    featureUsageDaily: buildFeatureUsageSeries(events, 14),
    featureLabels: featureLabels(),
    groq,
    activity: events.slice(0, 40),
    errors: events.filter((e) => !e.success).slice(0, 40),
    topStats: buildTopStatistics(events),
    settings,
    generatedAt: new Date().toISOString(),
  };
}
