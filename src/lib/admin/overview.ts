import {
  getGroqApiKeys,
  getGroqKeyLabels,
  getForgeAiApiKeys,
  getForgeAiKeyLabels,
  getCodeForgeApiKeys,
  getCodeForgeKeyLabels,
  getStudyForgeApiKeys,
  getStudyForgeKeyLabels,
  getPptForgeKeyLabels,
  getGeminiKeyLabels,
  isAiConfigured,
  isForgeAiConfigured,
  isCodeForgeConfigured,
  isStudyForgeConfigured,
  isPptForgeConfigured,
  isGeminiConfigured,
  isSupabaseConfigured,
} from "@/lib/supabase/config";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getLastGoodKeyIndex, getLastGoodGeminiKeyIndex, type GroqPool } from "@/lib/admin/groq-router-state";
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

// Gemini's free tier is request-per-minute/day quota that varies by model
// and account, unlike Groq's flatter per-key daily budget — so its "limit"
// here is just a generic display budget for the same progress-bar UI,
// overridable independently of GROQ_DAILY_LIMIT_PER_KEY.
function geminiDailyLimitPerKey(): number {
  const raw = Number(process.env.GEMINI_DAILY_LIMIT_PER_KEY);
  return Number.isFinite(raw) && raw > 0 ? raw : 1_500;
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
  pool: "ai" | "forge_ai" | "codeforge" | "studyforge" | "pptforge" | "gemini";
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
  pool: "ai" | "forge_ai" | "codeforge" | "studyforge" | "pptforge" | "gemini",
  name: string,
  configured: boolean,
  labels: string[],
  opts: { activeIndex: number; limit: number } = { activeIndex: getLastGoodKeyIndex(pool as GroqPool), limit: dailyLimitPerKey() }
): Promise<GroqPoolStatus> {
  const usage = await getGroqUsageToday(labels.map((keyLabel) => ({ pool, keyLabel })));
  const { activeIndex, limit } = opts;

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
  const [aiPool, forgeAiPool, codeforgePool, studyforgePool, pptforgePool, geminiPool] = await Promise.all([
    buildPool("ai", "Improve / Rewrite / Expand / Shorten / Critique", isAiConfigured(), getGroqKeyLabels()),
    buildPool("forge_ai", "Forge AI chat", isForgeAiConfigured(), getForgeAiKeyLabels()),
    buildPool("codeforge", "CodeForge tools + chat", isCodeForgeConfigured(), getCodeForgeKeyLabels()),
    buildPool("studyforge", "StudyForge tools + chat", isStudyForgeConfigured(), getStudyForgeKeyLabels()),
    buildPool("pptforge", "PPTForge generation", isPptForgeConfigured(), getPptForgeKeyLabels()),
    // Gemini keeps its own "last good key" tracker (shared across all three
    // products' attachment traffic), so it's built separately rather than
    // through getLastGoodKeyIndex's GroqPool-only signature.
    buildPool("gemini", "Gemini (attachment/multimodal)", isGeminiConfigured(), getGeminiKeyLabels(), {
      activeIndex: getLastGoodGeminiKeyIndex(),
      limit: geminiDailyLimitPerKey(),
    }),
  ]);

  const pools = [aiPool, forgeAiPool, codeforgePool, studyforgePool, pptforgePool, geminiPool];
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
void getCodeForgeApiKeys;
void getStudyForgeApiKeys;

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
  "codeforge.generate",
  "codeforge.fix",
  "codeforge.optimize",
  "codeforge.explain",
  "codeforge.convert",
  "codeforge.tests",
  "codeforge.docs",
  "codeforge.review",
  "codeforge.chat",
  "studyforge.explain",
  "studyforge.notes",
  "studyforge.flashcards",
  "studyforge.quiz",
  "studyforge.homework",
  "studyforge.planner",
  "studyforge.summarize",
  "studyforge.exam",
  "studyforge.chat",
  "pptforge.generate",
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
  "codeforge.generate": "CF: Generate",
  "codeforge.fix": "CF: Fix Bugs",
  "codeforge.optimize": "CF: Optimize",
  "codeforge.explain": "CF: Explain",
  "codeforge.convert": "CF: Convert",
  "codeforge.tests": "CF: Unit Tests",
  "codeforge.docs": "CF: Docs",
  "codeforge.review": "CF: Review",
  "codeforge.chat": "CF: Chat",
  "studyforge.explain": "SF: Explain Concepts",
  "studyforge.notes": "SF: Notes Generator",
  "studyforge.flashcards": "SF: Flashcards",
  "studyforge.quiz": "SF: Quiz Generator",
  "studyforge.homework": "SF: Homework Helper",
  "studyforge.planner": "SF: Study Planner",
  "studyforge.summarize": "SF: Notes Summarizer",
  "studyforge.exam": "SF: Exam Practice",
  "studyforge.chat": "SF: Chat",
  "pptforge.generate": "PPT: Generate",
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

// --- Scoped (per-product) overview — same shape as the top overview cards,
// but computed from only one product's event types, so a product's own
// admin tab (e.g. CodeForge) can show its own "Active today" / "Requests
// today" instead of the whole platform's. ---------------------------------

export interface ScopedOverviewCounts {
  usersRecent: number;
  activeToday: number;
  requestsToday: number;
  failedToday: number;
}

export function buildScopedOverview(events: AdminEvent[], types: Set<EventType>): ScopedOverviewCounts {
  const scoped = events.filter((e) => types.has(e.eventType));
  const todays = scoped.filter((e) => isToday(e.createdAt));
  const activeUserLabels = new Set(todays.filter((e) => e.userLabel).map((e) => e.userLabel));
  const allUserLabels = new Set(scoped.filter((e) => e.userLabel).map((e) => e.userLabel));

  return {
    usersRecent: allUserLabels.size,
    activeToday: activeUserLabels.size,
    requestsToday: todays.length,
    failedToday: todays.filter((e) => !e.success).length,
  };
}

export interface ScopedTopStats {
  topTools: TopStatEntry[];
  mostActiveUsers: TopStatEntry[];
}

export function buildScopedTopStats(
  events: AdminEvent[],
  types: Set<EventType>,
  toolLabel: (type: EventType) => string
): ScopedTopStats {
  const scoped = events.filter((e) => types.has(e.eventType));

  const toolCounts = new Map<string, number>();
  for (const e of scoped) {
    const label = toolLabel(e.eventType);
    toolCounts.set(label, (toolCounts.get(label) ?? 0) + 1);
  }
  const topTools = Array.from(toolCounts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const userCounts = new Map<string, number>();
  for (const e of scoped) {
    if (!e.userLabel) continue;
    userCounts.set(e.userLabel, (userCounts.get(e.userLabel) ?? 0) + 1);
  }
  const mostActiveUsers = Array.from(userCounts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return { topTools, mostActiveUsers };
}

// --- Full bundle (used by the initial server-rendered page + the polling
// API route, so both stay perfectly in sync) --------------------------------

const CODEFORGE_EVENT_TYPES = new Set<EventType>([
  "codeforge.generate",
  "codeforge.fix",
  "codeforge.optimize",
  "codeforge.explain",
  "codeforge.convert",
  "codeforge.tests",
  "codeforge.docs",
  "codeforge.review",
  "codeforge.chat",
]);

const STUDYFORGE_EVENT_TYPES = new Set<EventType>([
  "studyforge.explain",
  "studyforge.notes",
  "studyforge.flashcards",
  "studyforge.quiz",
  "studyforge.homework",
  "studyforge.planner",
  "studyforge.summarize",
  "studyforge.exam",
  "studyforge.chat",
]);

const PPTFORGE_EVENT_TYPES = new Set<EventType>(["pptforge.generate"]);

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
  codeforgeOverview: ScopedOverviewCounts;
  codeforgeTopStats: ScopedTopStats;
  studyforgeOverview: ScopedOverviewCounts;
  studyforgeTopStats: ScopedTopStats;
  pptforgeOverview: ScopedOverviewCounts;
  pptforgeTopStats: ScopedTopStats;
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
    codeforgeOverview: buildScopedOverview(events, CODEFORGE_EVENT_TYPES),
    codeforgeTopStats: buildScopedTopStats(
      events,
      CODEFORGE_EVENT_TYPES,
      (type) => FEATURE_EVENT_LABELS[type] ?? type
    ),
    studyforgeOverview: buildScopedOverview(events, STUDYFORGE_EVENT_TYPES),
    studyforgeTopStats: buildScopedTopStats(
      events,
      STUDYFORGE_EVENT_TYPES,
      (type) => FEATURE_EVENT_LABELS[type] ?? type
    ),
    pptforgeOverview: buildScopedOverview(events, PPTFORGE_EVENT_TYPES),
    pptforgeTopStats: buildScopedTopStats(
      events,
      PPTFORGE_EVENT_TYPES,
      (type) => FEATURE_EVENT_LABELS[type] ?? type
    ),
  };
}
