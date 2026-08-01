import type { ModelId } from "@/types/prompt";

export interface PromptTemplate {
  id: string;
  title: string;
  description: string;
  category: string;
  model: ModelId | null;
  body: string;
  tagNames: string[];
}

export const TEMPLATE_CATEGORIES = [
  "All",
  "Support",
  "Marketing",
  "Engineering",
  "Writing",
  "Productivity",
] as const;

export const TEMPLATES: PromptTemplate[] = [
  {
    id: "tpl-support-triage",
    title: "Support ticket triage",
    description: "Classify severity, root cause, and draft a first response.",
    category: "Support",
    model: "claude-3.5-sonnet",
    tagNames: ["system-prompt"],
    body:
      "You are a senior support engineer triaging inbound tickets.\n\nGiven the ticket below, respond with:\n1. Severity (P0–P3)\n2. Likely root cause\n3. A first response to send the customer\n\nTicket:\n{{ticket_text}}",
  },
  {
    id: "tpl-refund-decline",
    title: "Refund decline (empathetic)",
    description: "Warm, short email declining a refund while offering goodwill.",
    category: "Support",
    model: "gpt-4o",
    tagNames: [],
    body:
      "Write a short, warm email declining a refund request outside the policy window, while offering {{alternative_offer}} as a goodwill gesture. Keep it under 120 words.",
  },
  {
    id: "tpl-tweet-thread",
    title: "Launch announcement thread",
    description: "5-tweet thread announcing a product with a clear CTA.",
    category: "Marketing",
    model: "gpt-4o",
    tagNames: ["brainstorm"],
    body:
      "Write a 5-tweet thread announcing {{product_name}}, a {{one_line_pitch}}. Tone: confident, a little playful, no hashtags. End with a call to action to {{cta}}.",
  },
  {
    id: "tpl-landing-hero",
    title: "Landing page hero copy",
    description: "Five headline + subheadline pairs for a landing page.",
    category: "Marketing",
    model: "claude-3-opus",
    tagNames: [],
    body:
      "Generate 5 headline + subheadline pairs for a landing page selling {{product}}. Audience: {{audience}}. Each headline under 8 words.",
  },
  {
    id: "tpl-email-subjects",
    title: "Email subject line A/B set",
    description: "Ten subject lines across curiosity, urgency, and value angles.",
    category: "Marketing",
    model: "gpt-4o",
    tagNames: [],
    body:
      "Write 10 email subject lines for {{campaign}}, split across three angles: curiosity, urgency, and clear value. Max 60 characters each. Present as a table with the angle labeled.",
  },
  {
    id: "tpl-code-review-security",
    title: "Security-only PR review",
    description: "Reviews a diff strictly for auth, injection, and secrets issues.",
    category: "Engineering",
    model: "claude-3.5-sonnet",
    tagNames: ["system-prompt"],
    body:
      "Review the diff below for security issues only (auth, injection, secrets, unsafe deserialization). Ignore style. Output a bullet list, or \"No issues found.\"\n\n{{diff}}",
  },
  {
    id: "tpl-unit-tests",
    title: "Unit test generator",
    description: "Generates tests covering happy path, edge cases, and errors.",
    category: "Engineering",
    model: "gpt-4-turbo",
    tagNames: ["needs-eval"],
    body:
      "Write unit tests for the function below using {{test_framework}}. Cover the happy path, edge cases, and error handling.\n\n```\n{{function_code}}\n```",
  },
  {
    id: "tpl-commit-message",
    title: "Commit message polish",
    description: "Rewrites a commit message to Conventional Commits format.",
    category: "Engineering",
    model: "other",
    tagNames: [],
    body: "Rewrite this commit message to follow Conventional Commits. Keep the summary under 50 chars.\n\n{{raw_message}}",
  },
  {
    id: "tpl-bug-report",
    title: "Bug report normalizer",
    description: "Turns a messy report into repro steps, expected vs actual.",
    category: "Engineering",
    model: "claude-3.5-sonnet",
    tagNames: [],
    body:
      "Rewrite the raw bug report below into a clean format with: Summary, Steps to reproduce, Expected behavior, Actual behavior, Environment. If a field is missing, write \"Not provided.\"\n\n{{raw_report}}",
  },
  {
    id: "tpl-blog-outline",
    title: "Blog post outline",
    description: "Structured outline with headings and a suggested word count.",
    category: "Writing",
    model: "claude-3-opus",
    tagNames: ["draft"],
    body:
      "Create a blog post outline for \"{{topic}}\" aimed at {{audience}}. Include a working title, 4–6 H2 headings with one-line descriptions, and a suggested total word count.",
  },
  {
    id: "tpl-summarize",
    title: "Executive summary",
    description: "Condenses a long document into a tight, skimmable summary.",
    category: "Writing",
    model: "claude-3.5-sonnet",
    tagNames: [],
    body:
      "Summarize the text below into an executive summary: 3 bullet takeaways, then a 2-sentence overview. No more than 120 words total.\n\n{{source_text}}",
  },
  {
    id: "tpl-meal-plan",
    title: "Weekly meal plan",
    description: "7 dinners plus a consolidated, aisle-grouped grocery list.",
    category: "Productivity",
    model: "gemini-1.5-pro",
    tagNames: ["brainstorm"],
    body:
      "Plan 7 dinners for a {{household_size}}-person household. Constraints: {{dietary_constraints}}. Include a consolidated grocery list at the end, grouped by aisle.",
  },
  {
    id: "tpl-meeting-notes",
    title: "Meeting notes → action items",
    description: "Extracts decisions and owned action items from raw notes.",
    category: "Productivity",
    model: "gpt-4o",
    tagNames: [],
    body:
      "Turn the raw meeting notes below into: 1) Key decisions, 2) Action items with an owner and due date if mentioned, 3) Open questions.\n\n{{raw_notes}}",
  },
];

export function templatesByCategory(category: string): PromptTemplate[] {
  if (category === "All") return TEMPLATES;
  return TEMPLATES.filter((t) => t.category === category);
}
