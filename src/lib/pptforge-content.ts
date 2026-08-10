/**
 * PPTForge content heuristics
 * ---------------------------
 * The model plan only ever says `layout: "bullets"` — it never knows about
 * design. These helpers look at what's actually *in* a bullets slide (short
 * numbers vs. short phrases vs. long sentences) so the builder can pick a
 * richer, purpose-built layout (big stat callouts, icon cards) instead of
 * rendering every "bullets" slide as the same dot-point list.
 */

export type BulletVariant = "singleStat" | "stats" | "timeline" | "headline" | "icons" | "list";

const STAT_RE = /^(\$?-?\d[\d,]*(?:\.\d+)?\s?[%xX]?[kKmMbB]?\+?)\s*[-:–—]?\s*(.*)$/;

export interface ParsedStat {
  value: string;
  label: string;
}

/** Recognizes bullets shaped like "42% — faster onboarding" or
 *  "$2.4M: new pipeline" — a leading number/currency/percentage token
 *  followed by a short label. */
export function parseStatBullet(text: string): ParsedStat | null {
  const trimmed = text.trim();
  const m = trimmed.match(STAT_RE);
  if (!m) return null;
  const [, value, label] = m;
  if (!label || label.trim().length === 0) return null;
  // Guard against false positives like "3 things every team needs" being
  // read as a stat — require the label to be reasonably short, like a caption.
  if (label.trim().split(/\s+/).length > 9) return null;
  return { value: value.trim(), label: label.trim() };
}

const SEQUENCE_RE = /^(step|phase|stage|week|month|quarter|day)\s*\d/i;
const SEQUENCE_TITLE_RE = /roadmap|timeline|journey|process|steps|phases|milestones/i;

/** Decides how a "bullets" plan should actually be rendered. Checked in
 *  order of specificity: one dominant number, a clear step/phase sequence,
 *  several numbers (highlights), a couple of long sentences (better as a
 *  headline treatment than a cramped list), short punchy phrases (icon
 *  cards), and only then a plain — but still styled — list. */
export function pickBulletVariant(bullets: string[], title: string): BulletVariant {
  const clean = bullets.filter((b) => b && b.trim());
  if (clean.length === 0) return "list";

  if (clean.length === 1) {
    const stat = parseStatBullet(clean[0]);
    if (stat) return "singleStat";
  }

  const sequenceHits = clean.filter((b) => SEQUENCE_RE.test(b.trim())).length;
  if (
    clean.length >= 3 &&
    clean.length <= 6 &&
    (sequenceHits >= Math.ceil(clean.length * 0.5) || SEQUENCE_TITLE_RE.test(title))
  ) {
    return "timeline";
  }

  const statHits = clean.filter((b) => parseStatBullet(b) !== null).length;
  if (statHits >= Math.max(2, Math.ceil(clean.length * 0.6)) && clean.length <= 6) {
    return "stats";
  }

  const avgWords = clean.reduce((sum, b) => sum + b.trim().split(/\s+/).length, 0) / clean.length;
  if (clean.length <= 2 && avgWords > 12) {
    return "headline";
  }

  if (clean.length <= 6 && avgWords <= 9) {
    return "icons";
  }

  return "list";
}

/** Splits a longer sentence into a short bold "lead" phrase (first clause,
 *  capped at ~7 words) and the remaining supporting text — used to give
 *  paragraph-shaped bullets real visual hierarchy instead of dumping them
 *  on the slide as a flat sentence. */
export function splitLead(text: string): { lead: string; rest: string } {
  const trimmed = text.trim();
  const clauseMatch = trimmed.match(/^(.+?)([,:;–—-]\s+)(.+)$/);
  if (clauseMatch && clauseMatch[1].split(/\s+/).length <= 8) {
    return { lead: clauseMatch[1].trim(), rest: clauseMatch[3].trim() };
  }
  const words = trimmed.split(/\s+/);
  if (words.length <= 7) return { lead: trimmed, rest: "" };
  return { lead: words.slice(0, 6).join(" "), rest: words.slice(6).join(" ") };
}

export type IconKind =
  | "growth" | "decline" | "money" | "users" | "time" | "security" | "idea"
  | "target" | "global" | "data" | "quality" | "product" | "tech"
  | "communication" | "success" | "partnership" | "education" | "health"
  | "environment" | "strategy" | "default";

const ICON_KIND_MAP: [RegExp, IconKind][] = [
  [/growth|scale|increase|expand|trend|revenue up|retention|improve/i, "growth"],
  [/decline|decrease|drop|churn/i, "decline"],
  [/money|cost|revenue|budget|price|financ|roi|profit|pipeline/i, "money"],
  [/user|customer|audience|people|team|hiring|talent|enterprise|logo|account|client/i, "users"],
  [/time|speed|fast|schedule|deadline|launch date/i, "time"],
  [/secur|privacy|protect|risk|compliance|safety/i, "security"],
  [/idea|innovat|creativ|concept|brainstorm/i, "idea"],
  [/target|goal|objective|focus|milestone/i, "target"],
  [/global|world|region|market|international/i, "global"],
  [/data|analytic|metric|report|insight|dashboard/i, "data"],
  [/quality|excellen|premium|best|award/i, "quality"],
  [/product|feature|build|ship|release/i, "product"],
  [/tech|software|platform|system|engineering|ai|automation/i, "tech"],
  [/communicat|message|chat|support|feedback/i, "communication"],
  [/success|win|achieve|result|outcome/i, "success"],
  [/partner|collab|integrat|connect/i, "partnership"],
  [/education|learn|training|course|student/i, "education"],
  [/health|medical|wellness|care/i, "health"],
  [/environment|sustain|climate|green|energy/i, "environment"],
  [/strategy|plan|roadmap|vision|mission/i, "strategy"],
  [/remote|flexible|distributed|hybrid/i, "global"],
  [/cross-functional|collaborat|agile|cross functional/i, "partnership"],
  [/culture|value|mission-driven|purpose/i, "quality"],
];

export function iconKindFor(text: string): IconKind {
  for (const [re, kind] of ICON_KIND_MAP) {
    if (re.test(text)) return kind;
  }
  return "default";
}

