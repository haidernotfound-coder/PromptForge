"use client";

/**
 * Phase 3 data store
 * -------------------
 * There's still no backend (that's Phase 7). Instead, Phase 3 introduces a
 * real client-side data layer: a Zustand store, persisted to
 * `localStorage`, that models prompts/folders/tags against the same shape
 * as `supabase/schema.sql`. Every CRUD/search/filter/sort feature in the UI
 * reads and writes through this store, so swapping it for real Supabase
 * calls later is a matter of replacing the actions' bodies, not the UI.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Collection, Folder, Prompt, PromptVersion, Tag, TagColor } from "@/types/prompt";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { pullWorkspace, pushWorkspace } from "@/lib/cloud-sync";

function id(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function now(): string {
  return new Date().toISOString();
}

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

// ---------------------------------------------------------------------------
// Seed data — gives the demo workspace something real to look at instead of
// a blank slate on first load.
// ---------------------------------------------------------------------------

const seedFolders: Folder[] = [
  { id: "f-support", name: "Customer Support", parentId: null, createdAt: daysAgo(30) },
  { id: "f-marketing", name: "Marketing Copy", parentId: null, createdAt: daysAgo(30) },
  { id: "f-code", name: "Code & Engineering", parentId: null, createdAt: daysAgo(29) },
  { id: "f-code-review", name: "Code Review", parentId: "f-code", createdAt: daysAgo(20) },
  { id: "f-personal", name: "Personal", parentId: null, createdAt: daysAgo(14) },
];

const seedTags: Tag[] = [
  { id: "t-system", name: "system-prompt", color: "violet", createdAt: daysAgo(30) },
  { id: "t-fewshot", name: "few-shot", color: "brass", createdAt: daysAgo(28) },
  { id: "t-eval", name: "needs-eval", color: "danger", createdAt: daysAgo(18) },
  { id: "t-shipped", name: "shipped", color: "success", createdAt: daysAgo(10) },
  { id: "t-draft", name: "draft", color: "slate", createdAt: daysAgo(5) },
  { id: "t-brainstorm", name: "brainstorm", color: "sky", createdAt: daysAgo(2) },
];

function versionsFor(body: string, created: string): PromptVersion[] {
  return [{ id: id(), body, createdAt: created, note: "Initial version" }];
}

const seedPrompts: Prompt[] = [
  {
    id: "p-1",
    title: "Support ticket triage",
    body:
      "You are a senior support engineer triaging inbound tickets.\n\nGiven the ticket below, respond with:\n1. Severity (P0–P3)\n2. Likely root cause\n3. A first response to send the customer\n\nTicket:\n{{ticket_text}}",
    model: "claude-3.5-sonnet",
    folderId: "f-support",
    tagIds: ["t-system", "t-shipped"],
    isFavorite: true,
    isPublic: false,
    createdAt: daysAgo(25),
    updatedAt: daysAgo(1),
    versions: versionsFor("You are a support engineer triaging tickets…", daysAgo(25)),
  },
  {
    id: "p-2",
    title: "Empathetic refund response",
    body:
      "Write a short, warm email declining a refund request outside the policy window, while offering {{alternative_offer}} as a goodwill gesture. Keep it under 120 words.",
    model: "gpt-4o",
    folderId: "f-support",
    tagIds: ["t-shipped"],
    isFavorite: false,
    isPublic: false,
    createdAt: daysAgo(22),
    updatedAt: daysAgo(6),
    versions: versionsFor("Write a short refund decline email…", daysAgo(22)),
  },
  {
    id: "p-3",
    title: "Launch announcement tweet thread",
    body:
      "Write a 5-tweet thread announcing {{product_name}}, a {{one_line_pitch}}. Tone: confident, a little playful, no hashtags. End with a call to action to {{cta}}.",
    model: "gpt-4o",
    folderId: "f-marketing",
    tagIds: ["t-brainstorm", "t-draft"],
    isFavorite: true,
    isPublic: false,
    createdAt: daysAgo(12),
    updatedAt: daysAgo(2),
    versions: versionsFor("Write a 5-tweet thread announcing…", daysAgo(12)),
  },
  {
    id: "p-4",
    title: "Landing page hero copy",
    body:
      "Generate 5 headline + subheadline pairs for a landing page selling {{product}}. Audience: {{audience}}. Each headline under 8 words.",
    model: "claude-3-opus",
    folderId: "f-marketing",
    tagIds: ["t-fewshot"],
    isFavorite: false,
    isPublic: false,
    createdAt: daysAgo(19),
    updatedAt: daysAgo(19),
    versions: versionsFor("Generate 5 headline + subheadline pairs…", daysAgo(19)),
  },
  {
    id: "p-5",
    title: "PR review — security pass",
    body:
      "Review the diff below for security issues only (auth, injection, secrets, unsafe deserialization). Ignore style. Output a bullet list, or \"No issues found.\"\n\n{{diff}}",
    model: "claude-3.5-sonnet",
    folderId: "f-code-review",
    tagIds: ["t-system", "t-shipped"],
    isFavorite: true,
    isPublic: false,
    createdAt: daysAgo(15),
    updatedAt: daysAgo(3),
    versions: versionsFor("Review the diff below for security issues…", daysAgo(15)),
  },
  {
    id: "p-6",
    title: "Unit test generator",
    body:
      "Write unit tests for the function below using {{test_framework}}. Cover the happy path, edge cases, and error handling.\n\n```\n{{function_code}}\n```",
    model: "gpt-4-turbo",
    folderId: "f-code",
    tagIds: ["t-eval", "t-draft"],
    isFavorite: false,
    isPublic: false,
    createdAt: daysAgo(9),
    updatedAt: daysAgo(9),
    versions: versionsFor("Write unit tests for the function below…", daysAgo(9)),
  },
  {
    id: "p-7",
    title: "Weekly meal plan",
    body:
      "Plan 7 dinners for a {{household_size}}-person household. Constraints: {{dietary_constraints}}. Include a consolidated grocery list at the end, grouped by aisle.",
    model: "gemini-1.5-pro",
    folderId: "f-personal",
    tagIds: ["t-brainstorm"],
    isFavorite: false,
    isPublic: false,
    createdAt: daysAgo(4),
    updatedAt: daysAgo(4),
    versions: versionsFor("Plan 7 dinners for a household…", daysAgo(4)),
  },
  {
    id: "p-8",
    title: "Commit message polish",
    body:
      "Rewrite this commit message to follow Conventional Commits. Keep the summary under 50 chars.\n\n{{raw_message}}",
    model: "other",
    folderId: null,
    tagIds: ["t-draft"],
    isFavorite: false,
    isPublic: false,
    createdAt: daysAgo(1),
    updatedAt: daysAgo(1),
    versions: versionsFor("Rewrite this commit message…", daysAgo(1)),
  },
];

const seedCollections: Collection[] = [
  {
    id: "c-support-starter",
    name: "Support starter kit",
    description: "The prompts we hand every new support hire on day one.",
    promptIds: ["p-1", "p-2"],
    isPublic: true,
    createdAt: daysAgo(10),
    updatedAt: daysAgo(2),
  },
  {
    id: "c-launch",
    name: "Launch week",
    description: "Marketing prompts queued up for the next launch.",
    promptIds: ["p-3", "p-4"],
    isPublic: false,
    createdAt: daysAgo(6),
    updatedAt: daysAgo(1),
  },
];

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface StoreState {
  prompts: Prompt[];
  folders: Folder[];
  tags: Tag[];
  collections: Collection[];
  hasHydrated: boolean;
  setHasHydrated: (v: boolean) => void;
  lastSyncedAt: string | null;

  // prompts
  addPrompt: (input: {
    title: string;
    body: string;
    model: string | null;
    folderId: string | null;
    tagIds: string[];
  }) => Prompt;
  updatePrompt: (
    id: string,
    patch: Partial<Pick<Prompt, "title" | "body" | "model" | "folderId" | "tagIds" | "isPublic">>,
    opts?: { snapshot?: boolean; note?: string }
  ) => void;
  deletePrompt: (id: string) => void;
  duplicatePrompt: (id: string) => Prompt | null;
  toggleFavorite: (id: string) => void;
  restoreVersion: (promptId: string, versionId: string) => void;

  createFromTemplate: (input: {
    title: string;
    body: string;
    model: string | null;
    tagNames: string[];
  }) => Prompt;

  // folders
  addFolder: (name: string, parentId?: string | null) => Folder;
  renameFolder: (id: string, name: string) => void;
  deleteFolder: (id: string) => void;

  // tags
  addTag: (name: string, color?: TagColor) => Tag;
  renameTag: (id: string, name: string) => void;
  recolorTag: (id: string, color: TagColor) => void;
  deleteTag: (id: string) => void;

  // collections
  addCollection: (name: string, description?: string) => Collection;
  renameCollection: (id: string, name: string, description?: string) => void;
  deleteCollection: (id: string) => void;
  addPromptToCollection: (collectionId: string, promptId: string) => void;
  removePromptFromCollection: (collectionId: string, promptId: string) => void;
  setCollectionPublic: (id: string, isPublic: boolean) => void;
  setPromptPublic: (id: string, isPublic: boolean) => void;

  // data transfer / sync
  exportSnapshot: () => { prompts: Prompt[]; folders: Folder[]; tags: Tag[]; collections: Collection[] };
  importSnapshot: (
    data: Partial<{ prompts: Prompt[]; folders: Folder[]; tags: Tag[]; collections: Collection[] }>,
    mode: "merge" | "replace"
  ) => void;
  resetWorkspace: () => void;
  clearWorkspace: () => void;
  markSynced: () => void;
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      prompts: seedPrompts,
      folders: seedFolders,
      tags: seedTags,
      collections: seedCollections,
      hasHydrated: false,
      setHasHydrated: (v) => set({ hasHydrated: v }),
      lastSyncedAt: null,
      markSynced: () => set({ lastSyncedAt: now() }),

      addPrompt: (input) => {
        const prompt: Prompt = {
          id: id(),
          title: input.title.trim() || "Untitled prompt",
          body: input.body,
          model: (input.model as Prompt["model"]) ?? null,
          folderId: input.folderId,
          tagIds: input.tagIds,
          isFavorite: false,
          isPublic: false,
          createdAt: now(),
          updatedAt: now(),
          versions: input.body.trim() ? versionsFor(input.body, now()) : [],
        };
        set((s) => ({ prompts: [prompt, ...s.prompts] }));
        return prompt;
      },

      updatePrompt: (id, patch, opts) => {
        set((s) => ({
          prompts: s.prompts.map((p) => {
            if (p.id !== id) return p;
            const bodyChanged = patch.body !== undefined && patch.body !== p.body;
            const versions =
              bodyChanged && opts?.snapshot
                ? [
                    ...p.versions,
                    {
                      id: crypto.randomUUID?.() ?? `${Date.now()}`,
                      body: patch.body!,
                      createdAt: now(),
                      note: opts?.note,
                    },
                  ]
                : p.versions;
            return { ...p, ...patch, versions, updatedAt: now() };
          }),
        }));
      },

      deletePrompt: (id) => {
        set((s) => ({ prompts: s.prompts.filter((p) => p.id !== id) }));
      },

      duplicatePrompt: (id) => {
        const source = get().prompts.find((p) => p.id === id);
        if (!source) return null;
        const copy: Prompt = {
          ...source,
          id: id + "-copy-" + Math.random().toString(36).slice(2, 6),
          title: `${source.title} (copy)`,
          isFavorite: false,
          createdAt: now(),
          updatedAt: now(),
          versions: versionsFor(source.body, now()),
        };
        set((s) => ({ prompts: [copy, ...s.prompts] }));
        return copy;
      },

      toggleFavorite: (id) => {
        set((s) => ({
          prompts: s.prompts.map((p) => (p.id === id ? { ...p, isFavorite: !p.isFavorite } : p)),
        }));
      },

      restoreVersion: (promptId, versionId) => {
        set((s) => ({
          prompts: s.prompts.map((p) => {
            if (p.id !== promptId) return p;
            const version = p.versions.find((v) => v.id === versionId);
            if (!version) return p;
            return {
              ...p,
              body: version.body,
              updatedAt: now(),
              versions: [...p.versions, { id: id(), body: version.body, createdAt: now(), note: "Restored" }],
            };
          }),
        }));
      },

      createFromTemplate: (input) => {
        const tagIds = input.tagNames.map((name) => get().addTag(name).id);
        const prompt: Prompt = {
          id: id(),
          title: input.title,
          body: input.body,
          model: (input.model as Prompt["model"]) ?? null,
          folderId: null,
          tagIds,
          isFavorite: false,
          isPublic: false,
          createdAt: now(),
          updatedAt: now(),
          versions: versionsFor(input.body, now()),
        };
        set((s) => ({ prompts: [prompt, ...s.prompts] }));
        return prompt;
      },

      addFolder: (name, parentId = null) => {
        const folder: Folder = { id: id(), name: name.trim() || "New folder", parentId, createdAt: now() };
        set((s) => ({ folders: [...s.folders, folder] }));
        return folder;
      },

      renameFolder: (id, name) => {
        set((s) => ({
          folders: s.folders.map((f) => (f.id === id ? { ...f, name: name.trim() || f.name } : f)),
        }));
      },

      deleteFolder: (id) => {
        set((s) => {
          const toDelete = new Set<string>([id]);
          let changed = true;
          while (changed) {
            changed = false;
            for (const f of s.folders) {
              if (f.parentId && toDelete.has(f.parentId) && !toDelete.has(f.id)) {
                toDelete.add(f.id);
                changed = true;
              }
            }
          }
          return {
            folders: s.folders.filter((f) => !toDelete.has(f.id)),
            prompts: s.prompts.map((p) => (p.folderId && toDelete.has(p.folderId) ? { ...p, folderId: null } : p)),
          };
        });
      },

      addTag: (name, color = "violet") => {
        const existing = get().tags.find((t) => t.name.toLowerCase() === name.trim().toLowerCase());
        if (existing) return existing;
        const tag: Tag = { id: id(), name: name.trim(), color, createdAt: now() };
        set((s) => ({ tags: [...s.tags, tag] }));
        return tag;
      },

      renameTag: (id, name) => {
        set((s) => ({ tags: s.tags.map((t) => (t.id === id ? { ...t, name: name.trim() || t.name } : t)) }));
      },

      recolorTag: (id, color) => {
        set((s) => ({ tags: s.tags.map((t) => (t.id === id ? { ...t, color } : t)) }));
      },

      deleteTag: (id) => {
        set((s) => ({
          tags: s.tags.filter((t) => t.id !== id),
          prompts: s.prompts.map((p) => ({ ...p, tagIds: p.tagIds.filter((tid) => tid !== id) })),
        }));
      },

      addCollection: (name, description = "") => {
        const collection: Collection = {
          id: id(),
          name: name.trim() || "Untitled collection",
          description: description.trim(),
          promptIds: [],
          isPublic: false,
          createdAt: now(),
          updatedAt: now(),
        };
        set((s) => ({ collections: [collection, ...s.collections] }));
        return collection;
      },

      renameCollection: (id, name, description) => {
        set((s) => ({
          collections: s.collections.map((c) =>
            c.id === id
              ? {
                  ...c,
                  name: name.trim() || c.name,
                  description: description !== undefined ? description.trim() : c.description,
                  updatedAt: now(),
                }
              : c
          ),
        }));
      },

      deleteCollection: (id) => {
        set((s) => ({ collections: s.collections.filter((c) => c.id !== id) }));
      },

      addPromptToCollection: (collectionId, promptId) => {
        set((s) => ({
          collections: s.collections.map((c) =>
            c.id === collectionId && !c.promptIds.includes(promptId)
              ? { ...c, promptIds: [...c.promptIds, promptId], updatedAt: now() }
              : c
          ),
        }));
      },

      removePromptFromCollection: (collectionId, promptId) => {
        set((s) => ({
          collections: s.collections.map((c) =>
            c.id === collectionId
              ? { ...c, promptIds: c.promptIds.filter((pid) => pid !== promptId), updatedAt: now() }
              : c
          ),
        }));
      },

      setCollectionPublic: (id, isPublic) => {
        set((s) => ({
          collections: s.collections.map((c) => (c.id === id ? { ...c, isPublic, updatedAt: now() } : c)),
        }));
      },

      setPromptPublic: (id, isPublic) => {
        set((s) => ({
          prompts: s.prompts.map((p) => (p.id === id ? { ...p, isPublic, updatedAt: now() } : p)),
        }));
      },

      exportSnapshot: () => {
        const s = get();
        return { prompts: s.prompts, folders: s.folders, tags: s.tags, collections: s.collections };
      },

      importSnapshot: (data, mode) => {
        set((s) => {
          if (mode === "replace") {
            return {
              prompts: data.prompts ?? s.prompts,
              folders: data.folders ?? s.folders,
              tags: data.tags ?? s.tags,
              collections: data.collections ?? s.collections,
            };
          }
          // merge: incoming records win on id collision, everything else is kept
          const mergeById = <T extends { id: string }>(existing: T[], incoming?: T[]): T[] => {
            if (!incoming || incoming.length === 0) return existing;
            const map = new Map(existing.map((item) => [item.id, item]));
            for (const item of incoming) map.set(item.id, item);
            return Array.from(map.values());
          };
          return {
            prompts: mergeById(s.prompts, data.prompts),
            folders: mergeById(s.folders, data.folders),
            tags: mergeById(s.tags, data.tags),
            collections: mergeById(s.collections, data.collections),
          };
        });
      },

      resetWorkspace: () => {
        set({ prompts: seedPrompts, folders: seedFolders, tags: seedTags, collections: seedCollections });
      },

      clearWorkspace: () => {
        set({ prompts: [], folders: [], tags: [], collections: [] });
      },
    }),
    {
      name: "nexprompt-demo-store",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        prompts: s.prompts,
        folders: s.folders,
        tags: s.tags,
        collections: s.collections,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

// Environments where onRehydrateStorage might not fire (e.g. no persisted
// data yet) still resolve hydration on mount.
if (typeof window !== "undefined") {
  queueMicrotask(() => {
    if (!useStore.getState().hasHydrated) useStore.getState().setHasHydrated(true);
  });
}

// ---------------------------------------------------------------------------
// Cross-tab sync (Phase 5)
// ---------------------------------------------------------------------------
// There's still no backend/server, so "real-time sync" here means real
// browser-to-browser sync between tabs on the same device: this store is
// backed by localStorage, and localStorage writes fire a `storage` event in
// every *other* tab with the same origin. We listen for that event, and if
// it's our persisted key, pull the fresh state in. It's genuinely real sync
// — just scoped to "this browser, multiple tabs" instead of "any device",
// which is what Phase 7's backend will extend it to.
const STORAGE_KEY = "nexprompt-demo-store";

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try {
      const parsed = JSON.parse(event.newValue);
      const state = parsed?.state;
      if (!state) return;
      useStore.setState({
        prompts: state.prompts ?? useStore.getState().prompts,
        folders: state.folders ?? useStore.getState().folders,
        tags: state.tags ?? useStore.getState().tags,
        collections: state.collections ?? useStore.getState().collections,
        lastSyncedAt: now(),
      });
    } catch {
      // ignore malformed payloads from a stray write
    }
  });
}

// ---------------------------------------------------------------------------
// Cloud sync (Phase 7)
// ---------------------------------------------------------------------------
// When Supabase is configured and the visitor has a real, signed-in account,
// this store's data is no longer just a local demo — it's synced to that
// account's `workspaces` row (see supabase/schema.sql), RLS-scoped so only
// they can read or write it. On init: pull the saved snapshot (if any) down
// over the local seed data, then push any further local change back up,
// debounced, so multiple devices signed into the same account converge.
let cloudSyncStarted = false;
let pushTimer: ReturnType<typeof setTimeout> | null = null;

/** Call once from a client component mounted behind auth (the dashboard
 *  layout) to turn on cloud sync for the current session. Safe to call
 *  repeatedly — only the first call does anything. No-ops entirely in demo
 *  mode (Supabase not configured) or when signed out. */
export async function initCloudSync() {
  if (cloudSyncStarted || typeof window === "undefined") return;
  if (!isSupabaseConfigured()) return;

  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  cloudSyncStarted = true;

  // The local store persists to a single, unscoped localStorage key, so at
  // this point it may still hold another account's data (or the demo seed)
  // left over from a previous session in this browser. Clear to a genuinely
  // empty state first — not the seed/demo data — so that if this is a
  // brand-new real account with no `workspaces` row yet, we push a true
  // clean slate instead of stale leftovers or sample prompts.
  useStore.getState().clearWorkspace();

  const remote = await pullWorkspace();
  if (remote) {
    useStore.setState({
      prompts: (remote.prompts as Prompt[]) ?? useStore.getState().prompts,
      folders: (remote.folders as Folder[]) ?? useStore.getState().folders,
      tags: (remote.tags as Tag[]) ?? useStore.getState().tags,
      collections: (remote.collections as Collection[]) ?? useStore.getState().collections,
      lastSyncedAt: now(),
    });
  } else {
    // First time this account has ever synced — it's a brand-new account,
    // so push the empty state we just cleared to, rather than any local
    // demo/leftover data.
    await pushWorkspace(useStore.getState().exportSnapshot());
  }

  useStore.subscribe((state, prevState) => {
    if (
      state.prompts === prevState.prompts &&
      state.folders === prevState.folders &&
      state.tags === prevState.tags &&
      state.collections === prevState.collections
    ) {
      return;
    }
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(async () => {
      const ok = await pushWorkspace(useStore.getState().exportSnapshot());
      if (ok) useStore.getState().markSynced();
    }, 1200);
  });
}
