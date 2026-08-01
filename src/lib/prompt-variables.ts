/**
 * Smart input types for {{variable}} placeholders. Infers a sensible field
 * (dropdown, number, date, etc.) from the variable's name so the AI-assist
 * variable modal doesn't just show a wall of plain text inputs.
 */

export type VariableFieldType = "text" | "textarea" | "select" | "number" | "date" | "email" | "url";

export interface VariableFieldConfig {
  name: string;
  type: VariableFieldType;
  options?: string[];
  placeholder?: string;
}

const SELECT_PRESETS: { pattern: RegExp; options: string[] }[] = [
  { pattern: /^(length|size)$/i, options: ["Short", "Medium", "Long"] },
  { pattern: /^tone$/i, options: ["Professional", "Casual", "Confident", "Friendly", "Concise"] },
  { pattern: /^format$/i, options: ["Plain text", "Markdown", "JSON", "HTML", "Bullet points"] },
  {
    pattern: /^language$/i,
    options: ["English", "Spanish", "French", "German", "Portuguese", "Japanese", "Mandarin"],
  },
  { pattern: /^(difficulty|level)$/i, options: ["Beginner", "Intermediate", "Advanced"] },
  { pattern: /^priority$/i, options: ["Low", "Medium", "High", "Urgent"] },
  { pattern: /^status$/i, options: ["Draft", "In progress", "Review", "Done"] },
];

/** Infers a field type + config from a {{variable}} name. */
export function inferVariableField(name: string): VariableFieldConfig {
  const preset = SELECT_PRESETS.find((p) => p.pattern.test(name));
  if (preset) {
    return { name, type: "select", options: preset.options };
  }
  if (/^(count|number|num|quantity|amount|age|qty|years?|days?|minutes?|hours?)$/i.test(name)) {
    return { name, type: "number", placeholder: "0" };
  }
  if (/^(date|deadline|due_?date|start_?date|end_?date)$/i.test(name)) {
    return { name, type: "date" };
  }
  if (/^(email|e_?mail)$/i.test(name)) {
    return { name, type: "email", placeholder: "name@example.com" };
  }
  if (/^(url|link|website)$/i.test(name)) {
    return { name, type: "url", placeholder: "https://" };
  }
  if (/(description|summary|notes?|context|details|body|message)/i.test(name)) {
    return { name, type: "textarea", placeholder: `Enter ${humanizeVariableName(name)}…` };
  }
  return { name, type: "text", placeholder: `Enter ${humanizeVariableName(name)}…` };
}

/** "target_audience" -> "target audience" for placeholders/labels. */
export function humanizeVariableName(name: string): string {
  return name.replace(/[_.-]+/g, " ").trim().toLowerCase();
}

/** Replaces every {{name}} occurrence (all repeats) with its entered value. */
export function substituteVariables(body: string, values: Record<string, string>): string {
  return body.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (match, name) => {
    const value = values[name];
    return value && value.trim() ? value : match;
  });
}
