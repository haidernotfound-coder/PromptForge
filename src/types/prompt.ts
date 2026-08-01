/**
 * Phase 3 domain types
 * --------------------
 * These mirror the shape of `supabase/schema.sql` / `src/types/database.ts`
 * closely on purpose — Phase 3 runs entirely against local/demo data (see
 * `src/lib/store.ts`), and Phase 7 swaps the storage layer for Supabase
 * without needing to reshape the UI.
 */

export interface Tag {
  id: string;
  name: string;
  color: TagColor;
  createdAt: string;
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
}

export interface PromptVersion {
  id: string;
  body: string;
  createdAt: string;
  note?: string;
}

export interface Prompt {
  id: string;
  title: string;
  body: string;
  model: ModelId | null;
  folderId: string | null;
  tagIds: string[];
  isFavorite: boolean;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  versions: PromptVersion[];
}

export interface Collection {
  id: string;
  name: string;
  description: string;
  promptIds: string[];
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export const TAG_COLORS = [
  "violet",
  "brass",
  "success",
  "danger",
  "slate",
  "sky",
] as const;
export type TagColor = (typeof TAG_COLORS)[number];

export const MODELS = [
  { id: "claude-opus-4-8", label: "Claude Opus 4.8", provider: "Anthropic" },
  { id: "claude-sonnet-5", label: "Claude Sonnet 5", provider: "Anthropic" },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", provider: "Anthropic" },
  { id: "claude-fable-5", label: "Claude Fable 5", provider: "Anthropic" },
  { id: "gpt-5.6-sol", label: "GPT-5.6 Sol", provider: "OpenAI" },
  { id: "gpt-5.6-terra", label: "GPT-5.6 Terra", provider: "OpenAI" },
  { id: "gpt-5.6-luna", label: "GPT-5.6 Luna", provider: "OpenAI" },
  { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash", provider: "Google" },
  { id: "gemini-3.1-pro", label: "Gemini 3.1 Pro", provider: "Google" },
  { id: "grok-4.5", label: "Grok 4.5", provider: "xAI" },
  { id: "gpt-4o", label: "GPT-4o", provider: "OpenAI" },
  { id: "gpt-4-turbo", label: "GPT-4 Turbo", provider: "OpenAI" },
  { id: "claude-3.5-sonnet", label: "Claude 3.5 Sonnet", provider: "Anthropic" },
  { id: "claude-3-opus", label: "Claude 3 Opus", provider: "Anthropic" },
  { id: "gemini-1.5-pro", label: "Gemini 1.5 Pro", provider: "Google" },
  { id: "other", label: "Other / model-agnostic", provider: "" },
] as const;
export type ModelId = (typeof MODELS)[number]["id"];

export function modelLabel(id: string | null): string {
  if (!id) return "No model set";
  return MODELS.find((m) => m.id === id)?.label ?? id;
}

export type SortKey = "updated" | "created" | "title" | "favorite";
export type ViewMode = "grid" | "list";
