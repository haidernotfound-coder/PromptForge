# NexPrompt 2.0

A production-grade AI prompt management platform. Write, organize, refine, and
share prompts for ChatGPT, Claude, Gemini, and Grok — all from one workspace.

Built with **Next.js 14 (App Router)**, **TypeScript**, **Tailwind CSS**,
**shadcn/ui-style primitives on Radix**, and **Framer Motion**.

> **This build runs in demo mode.** There's no backend wired up yet — signing
> in or signing up just opens a local demo account (a cookie, no network
> calls, no real credentials). Every screen behind `/dashboard` works, but
> nothing persists across a fresh browser. Real auth, a database, and any AI
> provider APIs are scoped to the **Backend & API Integration** phase at the
> end of the roadmap below.

---

## Roadmap

The project is built in seven phases. Each phase ships a fully working,
`npm run build`-passing increment — nothing is left half-wired between phases.

| Phase | Name | Status |
|---|---|---|
| 1 | **Foundation** — project setup, UI system, responsive layout, theming, navigation, architecture | ✅ Complete |
| 2 | **Demo Authentication** — demo login/signup, protected routes, dashboard shell, session management (no backend) | ✅ Complete |
| 3 | **Core Features** — prompt CRUD, folders, tags, favorites, search, filters, sorting, rich editor (against local/demo data) | ✅ Complete |
| 4 | **AI Features** — improve / rewrite / expand / shorten, history, version control, templates | ✅ Complete |
| 5 | **Cloud Features** — real-time sync, import/export, backups, public sharing, collections, settings | ✅ Complete |
| 6 | **Final Polish** — performance, animation pass, accessibility, SEO, testing, deployment readiness | ✅ Complete |
| 7 | **Backend & API Integration** — wire up Supabase (or another backend) for real accounts, persistence, row-level security, and any AI provider API keys; replace the demo cookie session with real auth end-to-end | ✅ Complete |

---

## Phase 1–2 — Foundation & Demo Auth (this build)

### What's in this phase

- **Project setup** — Next.js 14 App Router, TypeScript (strict), Tailwind CSS,
  ESLint, path aliases (`@/*`).
- **Design system** — a custom token system (see [Design system](#design-system)
  below) driving color, type, radius, and motion across the app, in both light
  and dark mode.
- **Responsive layout** — mobile-first throughout; the marketing nav collapses
  into a slide-out drawer, the dashboard sidebar collapses into a dialog-based
  drawer on small screens.
- **Theme system** — light/dark/system via `next-themes`, persisted, with a
  toggle in both the marketing nav and dashboard header. Respects
  `prefers-reduced-motion`.
- **Navigation** — marketing site (home, pricing, about, contact, privacy,
  terms), auth routes (`/login`, `/signup`), and a dashboard shell
  (`/dashboard`) with sidebar navigation, all wired with Next.js `Link`s and
  active-state styling.
- **Demo authentication** — `/login` and `/signup` open a shared demo
  account: no backend, no network call, just a small session cookie (see
  `src/lib/demo-auth.ts`). `middleware.ts` checks for that cookie and
  protects `/dashboard`, `/prompts`, and `/settings`, redirecting to `/login`
  (with a `?next=` redirect back) when it's missing. The dashboard header
  reads the session server-side (`src/lib/demo-auth-server.ts`) to greet the
  user by name and offer a working "Sign out."
- **Future database schema** — a full Supabase schema (`supabase/schema.sql`)
  already exists for profiles, folders, tags, prompts, prompt↔tag joins, and
  prompt version history, with row-level security policies scoped to
  `auth.uid()`, a trigger that provisions a `profiles` row on signup, and
  `updated_at` triggers. It isn't connected to anything yet — it's there
  ready for Phase 7. TypeScript types for the schema live in
  `src/types/database.ts`.
- **Clean architecture** — UI primitives live under `src/components/ui`,
  feature areas are split into `layout/`, `marketing/`, `dashboard/`, and
  `theme/`, and demo-auth logic is isolated in `src/lib/demo-auth.ts` /
  `src/lib/demo-auth-server.ts` so it's a small, obvious swap for real auth
  in Phase 7.
- **Accessibility & quality floor** — skip-to-content link, visible focus
  rings, semantic landmarks, `sr-only` labels on icon-only buttons and dialog
  titles, a real 404 page, and reduced-motion support baked into the CSS
  layer, not bolted on later.

### Design system

Since NexPrompt is a tool for a very literal act of *crafting*, the design
leans on a forge/tempering metaphor without being a costume: a calm ink/graphite
base, a signal-violet accent for interactive/AI moments, and a muted brass
secondary for anything that reads as "in progress" or "process."

- **Color** — `bg`, `surface`, `surface-raised`, `border`, `text` scale, plus
  `accent` (violet, primary actions & AI features), `brass` (secondary,
  process/step accents), `danger`, `success`. All expressed as HSL CSS
  variables in `globals.css` so light/dark mode is a single variable swap.
- **Type** — Space Grotesk (display/headings), Inter (body/UI), JetBrains Mono
  (prompt bodies, code-like content) — self-hosted via `@fontsource/*` so the
  app builds and renders correctly with zero external network calls at
  runtime or build time.
- **Signature element** — the "temper line," a slow-drifting brass→violet
  gradient rule used as a divider and hero accent, and the animated "prompt
  console" on the homepage hero, which types out a raw prompt and morphs it
  into a tempered, structured version — dramatizing the product's actual job
  instead of a generic stat block.

## Phase 3 — Core Features (this build)

Still no backend (that's Phase 7) — but the dashboard is no longer a shell.
Everything below runs against a real client-side data layer
(`src/lib/store.ts`, a Zustand store persisted to `localStorage`) modeled on
the same shape as `supabase/schema.sql`, so swapping in Supabase later is a
matter of replacing the store's actions, not the UI.

- **Prompt CRUD** — create, edit, duplicate, and delete prompts at
  `/dashboard/prompts/new` and `/dashboard/prompts/[id]`. Every save takes a
  version snapshot; a "Version history" panel lets you preview and restore
  any prior version.
- **Folders** — a nestable folder tree in the sidebar (`FolderTree`), with
  create/rename/delete and per-folder prompt counts. Deleting a folder moves
  its prompts to "No folder" and cascades to subfolders.
- **Tags** — a sidebar tag list with create/rename/recolor/delete, plus an
  in-editor tag multiselect that can create a new tag on the fly.
- **Favorites** — star any prompt from its card or the editor; `/dashboard/favorites`
  is the same browser UI pre-filtered to starred prompts.
- **Search, filters, sorting** — the prompts browser (`PromptsBrowser`)
  supports full-text search (title, body, tag names), folder and tag
  filters, and sorting by last updated, date created, title, or favorites
  first. Filters and search live in the URL query string, so a filtered
  view is shareable/bookmarkable and survives a refresh.
- **Rich editor** — `PromptEditor` pairs a plain-text body with a small
  formatting toolbar (bold, italic, code block, quote, list, `{{variable}}`
  insertion) that operates on the actual text selection, plus live word/char
  counts and automatic detection of `{{variable}}` placeholders used in the
  prompt. Cmd/Ctrl+S saves.
- **Grid/list views** — the prompts browser toggles between a card grid and
  a denser list, both reusing the same `PromptCard`.
- **Demo data** — the store seeds a handful of realistic folders, tags, and
  prompts on first load so the workspace isn't empty out of the box; it's
  ordinary local data from then on (editable, deletable, persists across
  reloads, cleared if the browser storage is cleared).

### Project structure — Phase 3 additions

```
src/
  types/prompt.ts                      # Prompt/Folder/Tag types, model list
  lib/
    store.ts                           # Zustand store (prompts/folders/tags), persisted + seeded
    folders.ts                         # folder-tree build/flatten/path helpers
  components/
    prompts/
      prompt-card.tsx                  # grid/list card with quick actions
      prompts-browser.tsx              # search/filter/sort/view, used by /prompts and /favorites
      prompt-editor.tsx                # create/edit form, version history
      editor-toolbar.tsx               # markdown formatting + variable insertion
      tag-multiselect.tsx              # popover tag picker, create-on-the-fly
      tag-badge.tsx                    # tag chip + color dot
      folder-select.tsx                # indented folder <Select>
      name-dialog.tsx                  # shared create/rename dialog
      confirm-dialog.tsx               # shared delete confirmation
    dashboard/
      folder-tree.tsx                  # sidebar folder CRUD
      tag-sidebar-list.tsx             # sidebar tag CRUD
      dashboard-stats.tsx              # live prompt/folder/tag counts
      recent-prompts.tsx               # dashboard overview recent list
  app/dashboard/
    prompts/page.tsx                   # prompt list/grid
    prompts/new/page.tsx               # create
    prompts/[id]/page.tsx              # edit
    favorites/page.tsx                 # favorites view
```

### Project structure

```
src/
  app/
    (auth)/login, (auth)/signup      # auth routes, shared AuthLayout
    dashboard/                       # protected app shell (sidebar + topbar)
    pricing/ about/ contact/ privacy/ terms/
    layout.tsx                       # root layout: fonts, theme, nav, footer
    page.tsx                         # marketing homepage
    not-found.tsx                    # styled 404
    globals.css                      # design tokens (light + dark)
  components/
    ui/                              # button, card, input, dialog, dropdown, etc.
    layout/                          # navbar, footer
    marketing/                       # hero, feature grid, workflow, prompt console
    dashboard/                       # sidebar nav, mobile drawer
    theme/                           # ThemeProvider, ThemeToggle
  lib/
    demo-auth.ts                     # client-side demo session (cookie get/set)
    demo-auth-server.ts              # server-side demo session reader
    utils.ts                         # cn() helper
  types/
    database.ts                      # generated-style types for the future Supabase schema
  middleware.ts                      # protects /dashboard, /prompts, /settings via demo cookie
supabase/
  schema.sql                         # future schema + RLS policies + triggers (not wired up yet)
```

## Phase 4 — AI Features (this build)

Still no backend/provider wiring (that's Phase 7). Instead, `src/lib/ai.ts`
simulates the model calls locally — real latency-shaped delay, real text
transforms, `{{variable}}` placeholders locked so they're never mangled —
so every bit of surrounding UI (loading state, diff preview, accept/discard,
history) is real and ready to point at an actual provider later.

- **AI assist panel** — every prompt (new or existing) gets an "AI assist"
  card in the editor (`AiPanel`) with four actions: **Improve** (tighten
  wording), **Rewrite** (in a chosen tone: professional, casual, confident,
  friendly, concise), **Expand** (adds guidance), and **Shorten**. Each run
  opens a before/after diff preview dialog — nothing touches the prompt
  until you hit "Apply to prompt."
- **History** — applying an AI action on an existing prompt takes a version
  snapshot labeled with what ran (e.g. "Rewritten (confident)"), reusing and
  extending the Phase 3 version-history panel/store action so AI edits and
  manual edits share one timeline.
- **Templates** — a new `/dashboard/templates` gallery (`TemplateGallery`,
  `src/lib/templates.ts`) of 13 ready-made prompts across Support,
  Marketing, Engineering, Writing, and Productivity, searchable and
  filterable by category. "Use template" creates an editable copy via a new
  `createFromTemplate` store action (creating any missing tags on the fly)
  and drops you into the editor. The blank "New prompt" page links to the
  gallery as an alternative starting point.

### Project structure — Phase 4 additions

```
src/
  lib/
    ai.ts                              # simulated AI actions (improve/rewrite/expand/shorten)
    templates.ts                       # template library + category filter helper
  components/prompts/
    ai-panel.tsx                       # AI assist card + diff preview dialog
    template-gallery.tsx               # searchable/filterable template grid
  app/dashboard/templates/page.tsx     # template gallery route
```

## Phase 5 — Cloud Features (this build)

Still no backend/provider wiring (that's Phase 7). Instead, Phase 5 makes the
most of what a browser can genuinely do on its own: real cross-tab sync via
`localStorage`, real JSON export/import, real local backups, and shareable
public links — all backed by the same store, ready to point at Supabase
later without reshaping the UI.

- **Real-time sync** — `lib/store.ts` now listens for the browser's native
  `storage` event, so any change saved in one tab is picked up live by
  every other open NexPrompt tab in the same browser (open
  `/dashboard/prompts` twice to see it). A `SyncIndicator` in the dashboard
  header shows live "Synced Ns ago" / "Syncing…" status, and a new
  **Sync** tab in Settings explains the scope (this device, multiple tabs —
  multi-device sync is Phase 7).
- **Import / export** — `lib/data-transfer.ts` exports the whole workspace
  (prompts, folders, tags, collections) as a downloadable JSON file, and
  imports one back in with validation and an id-based merge, from the new
  **Data** tab in Settings.
- **Backups** — `lib/backup.ts` keeps up to 10 manual, timestamped
  snapshots in a separate `localStorage` key, listable and restorable from
  Settings without touching your current workspace until you confirm.
- **Public sharing** — any prompt or collection can be flipped public from
  a new `ShareDialog` (prompt editor, prompt card menu, collection page),
  producing a `/share/[id]` or `/share/collection/[id]` link with a
  read-only view and a copy-to-clipboard action.
- **Collections** — a new `Collection` type (`promptIds`, `isPublic`)
  backed by `addCollection` / `renameCollection` / `deleteCollection` /
  `addPromptToCollection` / `removePromptFromCollection` /
  `setCollectionPublic` store actions. A sidebar list (mirroring the tags
  list), a `/dashboard/collections` gallery, and a
  `/dashboard/collections/[id]` detail page (rename, description, add/remove
  prompts, share, delete) round it out.
- **Settings** — a new `/dashboard/settings` page (linked from the sidebar
  since Phase 1, previously a dead link) with **Account** (demo display
  name, sign out), **Appearance** (theme), **Sync**, and **Data** tabs.

### Project structure — Phase 5 additions

```
src/
  lib/
    backup.ts                          # local snapshot backups (create/list/restore/delete)
    data-transfer.ts                   # JSON export/import (download, parse, validate)
  components/
    dashboard/
      sync-indicator.tsx                # header "Synced Ns ago" / "Syncing…" badge
      collection-sidebar-list.tsx       # sidebar collection CRUD
      settings-panel.tsx                # Account / Appearance / Sync / Data tabs
    prompts/
      share-dialog.tsx                  # public/private toggle + copyable link
      collection-gallery.tsx            # collections grid, used by /dashboard/collections
  app/
    dashboard/
      collections/page.tsx              # collections gallery
      collections/[id]/page.tsx         # collection detail — manage prompts, share
      settings/page.tsx                 # settings route
    share/[id]/page.tsx                 # public read-only prompt view
    share/collection/[id]/page.tsx      # public read-only collection view
```

## Phase 6 — Final Polish (this build)

No feature or UI work changes here — Phase 6 hardens what's already built for
production and search engines.

- **SEO** — `app/sitemap.ts` and `app/robots.ts` generate a real sitemap and
  robots policy (dashboard routes disallowed, marketing routes allowed);
  `app/manifest.ts` adds a web app manifest. Every marketing page
  (`/`, `/pricing`, `/about`, `/contact`, `/privacy`, `/terms`) now ships a
  real `description` and canonical URL alongside its existing title, on top
  of the title template and Open Graph tags already set in the root layout.
  The `(auth)` route group and `/dashboard` are marked `noindex` since
  they're either transient or behind the demo session gate; `/share/*`
  keeps a public, indexable title/description.
- **Performance** — `next.config.mjs` turns on `reactStrictMode`,
  `compress`, disables the `X-Powered-By` header, and opts
  `lucide-react`/`framer-motion` into `optimizePackageImports` so only the
  icons/variants actually used are bundled. Route-level `loading.tsx`
  skeletons (`Skeleton` UI primitive) were added for `/dashboard`,
  `/dashboard/prompts`, `/dashboard/collections`, and
  `/dashboard/templates` so navigating between data-backed views shows an
  immediate, accessible (`aria-busy`, `aria-live`) loading state instead of
  a blank screen.
- **Resilience** — a route-level `error.tsx` (styled to match the rest of
  the app, with a "Try again" / "Back to dashboard" recovery path) and a
  root-level `global-error.tsx` (plain inline styles, since it replaces the
  entire root layout on a fatal error) now catch render errors instead of
  showing Next's default error screen.
- **Security headers** — `next.config.mjs` sets
  `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, and a
  conservative `Permissions-Policy` on every response.
- **Accessibility** — audited against the Phase 1 floor (skip link, focus
  rings, landmarks, `sr-only` labeling): all icon-only buttons across the
  dashboard and marketing UI carry `aria-label`s, loading states are
  announced via `aria-live`, and heading order was checked page-by-page.
- **Deployment readiness** — production build verified clean
  (`npm run build`); see [Getting started](#getting-started) below.

### Project structure — Phase 6 additions

```
src/
  app/
    sitemap.ts                         # generated sitemap.xml
    robots.ts                          # generated robots.txt
    manifest.ts                        # web app manifest
    error.tsx                          # route-level error boundary
    global-error.tsx                   # root-level error boundary
    share/layout.tsx                   # metadata for /share/* routes
    dashboard/loading.tsx              # dashboard overview skeleton
    dashboard/prompts/loading.tsx      # prompts browser skeleton
    dashboard/collections/loading.tsx  # collections gallery skeleton
    dashboard/templates/loading.tsx    # template gallery skeleton
  components/ui/skeleton.tsx           # shared loading-state primitive
next.config.mjs                        # perf flags + security headers
```

## Phase 7 — Backend & API Integration (this build)

NexPrompt still runs with **zero configuration** — every Phase 1–6 feature
keeps working exactly as before (demo cookie session, localStorage store,
simulated AI) when no environment variables are set. Setting the variables
below switches individual pieces over to the real thing; each is independent.

- **Real auth (Supabase)** — `/login` and `/signup` use
  `supabase.auth.signInWithPassword` / `signUp` when
  `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set,
  including email confirmation (`/auth/callback`), and **forgot-password**
  (`/forgot-password` sends a reset email → `/auth/callback` exchanges the
  link's code for a temporary session → `/reset-password` sets the new
  password via `supabase.auth.updateUser`). `middleware.ts` verifies a real
  session for protected routes instead of the demo cookie, and refreshes it
  on every request. `src/lib/session.ts` gives the rest of the app one
  `getAppSession()` call that returns a real user or the demo fallback
  without branching everywhere.
- **Persistence + RLS** — `supabase/schema.sql` gained `collections`,
  `collection_prompts`, and a `workspaces` table (a JSONB snapshot per user)
  on top of the Phase 1 schema, all row-level-security scoped to
  `auth.uid()` so a user can only ever read/write their own data. Phase 3–5
  built the whole UI against one Zustand store; rather than re-plumb every
  component to individual per-row Supabase calls, Phase 7 syncs that same
  store shape to `workspaces` via `/api/workspace` (GET/PUT, RLS-enforced) —
  `initCloudSync()` pulls a signed-in user's snapshot on dashboard load and
  pushes local changes back up, debounced. The fully normalized tables
  remain in the schema as the target shape for a follow-up migration to
  live per-row sync/real-time subscriptions.
- **AI provider (Groq)** — `POST /api/ai` runs Improve/Rewrite/
  Expand/Shorten against the real Groq API (Llama 3.1 8B Instant) using a server-only
  `GROQ_API_KEY` (never sent to the browser); `src/lib/ai.ts` tries
  this route first and transparently falls back to the Phase 4 local
  simulation if the key isn't set or the request fails, so the AI panel
  never breaks.
- **Terms of Service & Privacy Policy** — `/terms` and `/privacy` now have
  full policies covering account data, content ownership, public sharing,
  AI-provider data flow, retention, and user rights, replacing the Phase 1
  placeholders.

### Project structure — Phase 7 additions

```
src/
  lib/
    supabase/
      client.ts                        # browser Supabase client (anon key)
      server.ts                        # server Supabase client (cookies)
      middleware.ts                    # session-refresh helper for middleware.ts
      config.ts                        # isSupabaseConfigured() / isAiConfigured()
    session.ts                          # unified real-or-demo session reader
    cloud-sync.ts                       # pull/push workspace snapshot
  app/
    api/
      workspace/route.ts               # GET/PUT workspace snapshot (RLS)
      ai/route.ts                      # real Improve/Rewrite/Expand/Shorten
    auth/
      callback/route.ts                # exchanges emailed code for a session
      auth-code-error/page.tsx         # expired/used-link fallback
    (auth)/
      forgot-password/page.tsx         # request a reset link
      reset-password/page.tsx          # set a new password
  components/dashboard/cloud-sync-boot.tsx  # fires initCloudSync() on mount
supabase/schema.sql                     # + collections, collection_prompts, workspaces
```

### Setting up a real backend

1. Create a project at [supabase.com](https://supabase.com).
2. Run `supabase/schema.sql` in its SQL editor.
3. In your Supabase project's auth email templates, the default
   "Confirm signup" / "Reset password" links already point at
   `{{ .SiteURL }}/auth/v1/verify?...redirect_to={{ .RedirectTo }}`, which
   this app sets to `/auth/callback` — no template changes needed.
4. Copy `.env.example` to `.env.local` and fill in
   `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
5. Optionally add `GROQ_API_KEY` (free at console.groq.com) for real AI assist calls using Llama 3.1 8B Instant.
6. `npm install && npm run dev`.

> **A note on this build's verification:** the sandbox this build was
> produced in has no network access, so `npm install` / `npm run build`
> could not actually be executed here — every new/changed file was
> syntax-checked with the TypeScript compiler instead. Because of that,
> `package-lock.json` has been removed rather than hand-edited (it can't be
> regenerated correctly without hitting the registry) — run plain
> `npm install` (not `npm ci`) once to generate a fresh one from
> `package.json`, then `npm run build` to catch any type errors across
> module boundaries (the one thing a per-file syntax check can't see).

### Getting started

```bash
npm install
npm run dev
```

No environment variables or backend are required — the app runs entirely in
demo mode out of the box. `.env.example` documents the variables that will
matter once Phase 7 wires up a real backend.

```bash
npm run build   # production build — passes cleanly
npm run start   # serve the production build
```

### Notes for reviewers

- Auth pages (`/login`, `/signup`) and the dashboard are fully styled and
  functional against a **demo account** — any credentials (or the "Continue
  with demo account" button) sign you in, no validation, no persistence
  beyond a cookie. Real accounts, a database, and any AI provider keys are
  the explicit scope of Phase 7 ("Backend & API Integration").
- `middleware.ts` protects `/dashboard`, `/prompts`, and `/settings` by
  checking for the demo session cookie set in `src/lib/demo-auth.ts`.
- `supabase/schema.sql` and `src/types/database.ts` are kept in the repo as
  the target shape for Phase 7, but nothing currently reads or writes to
  them.
- Fonts are self-hosted via `@fontsource` rather than `next/font/google`
  specifically so the project builds in network-restricted environments
  (CI runners, sandboxes) without depending on `fonts.googleapis.com`.



## Unified AI Chat refactor

The platform is being refactored into one unified, ChatGPT-style AI Chat per
the plan below. Progress is tracked here; the original brief follows
unchanged as the working checklist.

> **PPTForge retired as a standalone product.** The `/pptforge` and
> `/products/pptforge` pages, their sidebar/mobile nav, and every marketing
> link to them have been removed — AI Chat (`/chat`) is now the only
> user-facing way to generate a slide deck, per Phase 2's "make me a slide
> deck about X" delegation below. PPTForge's generation engine itself
> (`lib/pptforge*.ts`, `POST /api/pptforge`) is untouched and keeps running
> exactly as before — it's simply an internal implementation detail of AI
> Chat now, the same way CodeForge's and StudyForge's chat modes are.

| Phase | Name | Status |
|---|---|---|
| 1 | Unified AI Chat (interface) | ✅ Complete |
| 2 | Combine All Forge Capabilities | ✅ Complete |
| 3 | Attachment Memory | ✅ Complete |
| 4 | Files + Web Search | ✅ Complete |
| 5 | Final UI/UX + Testing | ✅ Complete |

### Phase 1 — Unified AI Chat (this build) ✅

- Added `/chat`, a new top-level protected route with a ChatGPT-style
  interface: a left sidebar of conversations plus a message panel on the
  right (mobile gets the same sidebar in a slide-over drawer).
- **New Chat + persistent history** — `src/lib/chat.ts` stores an array of
  conversations (id, title, messages, timestamps) in `localStorage`, the
  same "local chat scratch space" pattern StudyForge's and CodeForge's
  chat panels already use. Starting a new chat, switching between chats,
  and reloading the page all work against this store.
- **Rename / delete** — `ChatSidebar` (`src/components/chat/chat-sidebar.tsx`)
  gives each conversation a hover menu with inline rename and a delete
  action gated behind the existing `ConfirmDialog` component. New chats
  auto-title themselves from the first message (like most chat apps) until
  the user renames one manually.
- **Markdown, code blocks, copy, loading state** — `ChatPanel`
  (`src/components/chat/chat-panel.tsx`) reuses the exact message-list
  patterns from `StudyForgeChatPanel`: `MarkdownRenderer` for assistant
  replies (so fenced code blocks render properly), a per-message copy
  button, and an animated three-dot "typing" indicator while a reply is
  in flight. No new chat-UI primitives were invented — this is the same
  layout/styling StudyForge and CodeForge chat already ship.
- **Attachments + voice** — wired to the existing `useAttachments` /
  `AttachmentButton` / `AttachmentChips` and `VoiceInputButton` components,
  unchanged.
- **Backend** — added `src/app/api/chat/route.ts`. This is intentionally
  *not* a new provider system: it's Forge AI's own route
  (`src/app/api/forge-ai/route.ts`) with the `<current_prompt>` framing
  swapped for a general-purpose system prompt, so it authenticates with
  the exact same `FORGE_AI_GROQ_API_KEY_1`..`_5` pool and the same shared
  Gemini attachment pool/fallback logic — no new environment variables,
  no duplicated key-rotation code. It's gated behind the existing
  `forgeAiEnabled` / `maintenanceMode` admin settings for the same reason.
- **Navigation** — the "PPTForge" entry in the main navbar (desktop links,
  the "Open PPTForge" quick-action button, and the mobile menu) now points
  to "AI Chat" → `/chat`. PPTForge itself (`/pptforge`, `/products/pptforge`,
  its settings/history pages, and its API route) is untouched and still
  fully reachable directly — Phase 2 is what teaches the unified chat to
  call into it, per the brief ("keep PPTForge functionality internally").
- `/chat` was added to `middleware.ts`'s protected-path list, same as the
  other product routes.
- `npm run build` passes cleanly with this change (verified in this
  environment — network access allowed a real `npm install` + `npm run
  build`, unlike some earlier phases).

### Phase 2 — Combine All Forge Capabilities (this build) ✅

- **Intent detection** — `src/lib/server/chat-intent.ts` looks at the
  newest user message with a handful of cheap regexes (no extra model call
  spent classifying) and returns one of `code` / `study` / `ppt` /
  `promptforge` / `normal`. A fenced code block counts as a strong `code`
  signal on its own. This is deliberately conservative: it only ever
  *suggests* a delegate, never blocks a reply.
- **Delegation, not duplication** — `src/app/api/chat/route.ts` now calls
  `tryDelegateToForge()` before falling back to its own general-purpose
  reply. That function makes a normal same-origin `fetch()` to the Forge's
  *own* existing route — `/api/codeforge` (`mode: "chat"`), `/api/studyforge`
  (`mode: "chat"`), `/api/ai` (improve/rewrite/expand/shorten/critique), or
  `/api/pptforge` — forwarding the session cookie so each keeps using its
  own key pool, its own admin enable/disable flag, and its own
  event/usage tracking exactly as if the user had used that product
  directly. Nothing about those routes changed and no new environment
  variables were added.
  - Cross-importing those route handler modules directly (instead of
    `fetch`) was tried first and reverted: Next.js bundles every
    `app/api/.../route.ts` as its own isolated server entry, and importing
    one from another breaks that bundling at build time. A same-origin
    `fetch` avoids that while still hitting the exact same code path.
- **"Write some code" / "quiz me on X"** → routed to CodeForge's / StudyForge's
  existing multi-turn chat mode, attachments (images/documents) included,
  so their Gemini-attachment-first, Groq-fallback behavior is reused as-is.
- **"Improve/rewrite/expand/shorten/critique this prompt"** → routed to the
  existing `/api/ai` route with the extracted action + prompt text.
- **"Make me a slide deck about X"** → routed to the real `/api/pptforge`
  route, which still generates a real `.pptx` (structured plan → PptxGenJS)
  exactly as it does on the PPTForge page. The unified chat receives that
  file back and links it inline as a downloadable `data:` URI (e.g. **[deck
  title.pptx](...)**) — a real, working download today, ahead of Phase 4's
  planned proper file-card UI, since generation was already delegating a
  real binary anyway.
- **Always-safe fallback** — if a delegate is unconfigured, disabled
  (admin toggle), rate-limited, or errors for any reason, `/api/chat` falls
  straight through to its own Phase 1 general-purpose reply. A wrong or
  unavailable intent guess never surfaces as a chat failure.
- `npm run build` passes cleanly with this change.

**Next phase (Phase 3 — Attachment Memory):** fix the provider-switching
memory problem — persist attachment references/extracted content/summaries
in the existing chat/history store so a later message ("now make a PPT from
that PDF") keeps working even when it routes to a different provider/Forge
than the message before it.

---

### Phase 3 — Attachment Memory (this build) ✅

- **The problem** — before this phase, an attachment's raw content only
  ever lived in the single request it was sent with. `sendChatMessage`
  stored just `{ name, size, kind }` for each attachment in
  `localStorage`, so once a message with a PDF scrolled into history, a
  later message like "now make a PPT from that" had nothing to go on
  except whatever the assistant happened to say about it the first
  time — and if that first reply came from Gemini (attachments) and the
  follow-up got answered by Groq or a delegated Forge, there was no
  shared memory of the file at all.
- **Persisted attachment context** — `ChatMessage.attachments` (`src/lib/chat.ts`)
  now carries an optional `contextText` per attachment alongside
  `name`/`size`/`kind`: for text/code files this is the same
  client-read `textContent` already available at send time; for
  PDF/DOCX/ZIP documents it's the extracted text the server sends back
  after processing the turn (see below). Images are intentionally not
  given a persisted `contextText` — see "What's deliberately not
  persisted" below.
- **Server-side extraction, every attachment turn** — `POST /api/chat`
  (`src/app/api/chat/route.ts`) now runs the existing local extractor
  (`lib/server/attachment-extract.ts` — the same `pdf-parse`/`mammoth`/`jszip`
  code already used as the Gemini-unconfigured fallback) on every inline
  (`base64`) document on *every* turn that carries one, regardless of
  whether Gemini is configured and reading the file directly for that
  reply. The result is returned to the client as `attachmentContext:
  { name, text }[]` alongside the normal `output`, purely so it can be
  persisted — this doesn't change what the model sees for that turn.
  Documents large enough to have gone straight to the Gemini Files API
  (`geminiFileUri`, no `base64`) are deliberately skipped here — re-
  uploading/re-extracting a huge file just for memory would defeat the
  point of not resending it; the assistant's own reply about it still
  becomes part of the replayed history either way (see below).
- **Replaying memory on later turns** — `sendChatMessage` now calls a new
  `buildAttachmentMemoryBlocks()` helper before every request, which scans
  every earlier message in the conversation for attachments with a
  persisted `contextText`, de-duplicates by filename (most recent
  upload of a given name wins), and caps the result (6 files max, 6,000
  chars/file, 20,000 chars total) to keep later requests from growing
  unbounded. These blocks are merged into the same `contextBlocks` field
  the route already threads through to Gemini, the Groq fallback, *and*
  every delegated Forge (`/api/codeforge`, `/api/studyforge`, `/api/ai`
  all already read `body.contextBlocks` — no changes needed there), so a
  file's content is available no matter which provider ends up answering
  a given turn.
- **Client-side wiring** — `ChatPanel` (`src/components/chat/chat-panel.tsx`)
  patches the just-sent user message's attachments with the
  `attachmentContext` the server returns, then persists the updated
  conversation — so the extraction only has to happen once per document,
  the same way the version-history/store patterns elsewhere in the app
  update one immutable snapshot at a time.
- **What's deliberately not persisted** — raw image bytes and large
  (Files-API-uploaded) documents are never written back into
  `localStorage`. Re-describing an image to build a text summary would
  cost an extra model call on every single image attachment just to
  enable a memory feature most conversations won't need; instead, the
  assistant's own description of an image (in its reply, right after
  the image was sent) is already part of the conversation history that
  gets resent on every later turn, which is what actually carries an
  image forward today. Phase 4 ("Files + Web Search") is a more natural
  place to revisit richer image memory once real file cards exist.
- Manually exercised: attach a PDF → ask for a summary (Gemini path) →
  ask a follow-up that routes to CodeForge or the Groq fallback instead
  → the reply still reflects the PDF's content, confirmed by inspecting
  the `contextBlocks` sent on that second request.
- `npm install && npm run build` passes cleanly with this change.

### Post-Phase-3 bug fixes (this build) ✅

Two issues reported after Phase 3 shipped:

- **"AI Chat couldn't respond: Conversation is too long"** — `POST
  /api/chat` used to hard-reject any request once the conversation's total
  character count crossed 40,000. Because every request always resends the
  *entire* history (`sendChatMessage` in `lib/chat.ts`), that limit was a
  one-way door: the very first message that pushed a conversation over it
  failed, and every message after that failed too, forever — the
  conversation was permanently bricked with no way to recover short of
  starting a new chat. Fixed in `src/app/api/chat/route.ts`: instead of
  rejecting, the route now keeps a sliding window of the most recent
  messages that fits a generous 120,000-character budget, silently
  dropping the oldest turns first, and applies that same windowed history
  to the delegate call, the Gemini path, and the Groq fallback alike. The
  only remaining hard rejection is a single message over 200,000
  characters (a giant paste) — a case genuinely worth asking the user to
  trim, since truncating *inside* one message risks cutting off the very
  thing they just asked about.
- **"I can't view images" even though attaching one works fine** — asking
  "read this image and tell me what's in it" *without* attaching anything
  routed correctly to the plain-text Groq model (there's nothing to send
  vision-wise if no image came through), but the model had no way to know
  it's normally capable of reading attachments, so it answered as if it
  could never view images or files at all — misleading, since attaching
  one works. Fixed by adding an explicit line to `SYSTEM_PROMPT` (shared by
  the Groq and Gemini paths) telling the model it can view attached
  images/PDFs/DOCX/ZIP/text files whenever one is actually attached, and
  that if the user references an image/file with nothing attached on that
  message, it should say so and ask them to attach it — not claim a
  blanket inability.
- `npm install && npm run build` passes cleanly with both fixes.

---

### Phase 4 — Files + Web Search (this build) ✅

- **Real file cards, not a markdown data: link** — the PPTForge delegate
  branch in `POST /api/chat` (`src/app/api/chat/route.ts`) now returns its
  generated `.pptx` bytes as a structured `files: GeneratedFile[]` field
  on the JSON response instead of base64-encoding them into a
  `[Download foo.pptx](data:...)` link inlined in the markdown reply. A new
  `ChatMessage.files` field (`src/lib/chat.ts`) carries these onto the
  assistant message, and a new `<FileCard />` / `<FileCardList />`
  component (`src/components/shared/file-card.tsx`) renders each one as a
  proper download card — icon, filename, kind, size, download button —
  under the reply in `ChatPanel`. `GeneratedFile` is a small, reusable
  `{ name, mimeType, dataUrl, size }` shape (`src/lib/server/file-builder.ts`)
  so any future generator (or a future real upload/storage backend) can
  slot into the same file-card UI without another round of client changes.
- **Packaging code/text into a downloadable file, on request** — a new
  `"file"` intent in `lib/server/chat-intent.ts` recognizes phrasing like
  "zip this up", "package that", "give me this as a file/download", or
  "save that as a document" and — purely locally, no extra model call —
  packages the fenced code blocks in the assistant's most recent reply
  into real bytes via `src/lib/server/file-builder.ts`: one file with the
  right extension when there's a single code block, a `.zip` (via
  `jszip`, already a dependency for reading `.zip` attachments) when
  there are several, or a `.md` of the reply's own text when there's no
  code to package. This intent is checked before the code/study/ppt
  regexes in `detectChatIntent` so "zip up that code" packages what
  already exists in the conversation instead of asking CodeForge to
  regenerate it. If there's no prior assistant reply yet to package, the
  turn falls through to a normal chat reply instead of erroring.
- **Web search, reusing the existing Gemini key pool** — a new `"search"`
  intent recognizes explicit lookup phrasing ("search the web for…",
  "look up…", "what's the latest on…", "current news about…") and, when
  Gemini is configured, calls it with its own built-in Google Search
  grounding tool enabled (`enableWebSearch` on `runGeminiChat` in
  `src/lib/server/gemini.ts`, which adds `tools: [{ googleSearch: {} }]`
  to the Gemini request). This authenticates with the exact same
  `GEMINI_API_KEY_*` pool every attachment turn already uses — no new
  search API, no new environment variable, no duplicate provider/fallback
  system. Cited sources are pulled out of Gemini's `groundingMetadata` and
  returned as `sources: { title, uri }[]`, persisted on the assistant
  message and rendered as a short "Sources" list under the reply in
  `ChatPanel`. Kept deliberately conservative/regex-based (like every
  other intent in this file) rather than firing on any question that
  might benefit from freshness, so an ordinary question never silently
  costs an extra grounded call; if Gemini isn't configured or the grounded
  call fails, the turn falls through to a normal reply exactly like every
  other delegate here.
- **What's deliberately not built here** — no new file storage/upload
  backend (generated files stay `data:` URLs in the message, same
  transport PPTForge's inline link already used, just structured now
  instead of embedded in markdown); no duplicate search provider (Gemini's
  own grounding tool is the entire "web search" implementation); packaging
  only ever operates on text already in the conversation, it doesn't
  generate new code/content on its own — that's still CodeForge/PromptForge's
  job via the existing Phase 2 delegation.
- `npm install && npm run build` passes cleanly with this change.

---

### Phase 5 — Final UI/UX + Testing (this build) ✅

**Post-Phase-5 redesign (this build) ✅**

- **Real app shell instead of a page-in-a-page** — `/chat` is now its own
  full-height application shell (`src/components/chat/chat-app.tsx`),
  mounted straight from a new `src/app/chat/layout.tsx` server layout
  (session/admin/settings fetched once, same pattern `studyforge/layout.tsx`
  and `dashboard/layout.tsx` already use) instead of being assembled inside
  a client `page.tsx`. `page.tsx` is now a no-op — every pixel of the route
  comes from the layout's `<ChatApp />`.
- **Persistent left sidebar** — a proper `AI Chat` brand mark, the
  conversation list, and an account footer (avatar/name, live-or-demo
  status, theme toggle) live in a fixed `w-72` sidebar on desktop and the
  same content in a slide-over drawer on mobile, matching the
  sidebar-plus-account-footer shape of every real chat app (and of this
  app's own dashboard/Forge sidebars) instead of the plain vertical stack
  the first cut of `/chat` shipped with.
- **Profile, front and center** — `ChatProfileFooter` puts the existing
  `DashboardUserMenu` (profile, sign out) at the bottom of the sidebar
  with the account name and a live/demo status line, so accessing/managing
  the signed-in account no longer relies solely on the top site navbar.
- **Cleaner message surface** — bubbles now use fully rounded corners with
  a single "sharp" corner on the side facing their avatar (a common chat-
  app tell for "this one's from me/them"), assistant bubbles sit on
  `surface-raised` with a soft shadow instead of a flat `surface` fill, and
  the empty state reads like a real assistant's landing screen ("How can I
  help today?") instead of a muted placeholder paragraph.
- **Composer redesigned as a single pill** — the attach/voice/textarea/send
  controls now live inside one rounded, bordered input group that
  highlights on focus, instead of four separate controls loosely spaced
  along a row; Send collapses to an icon-only button at every width now
  that it sits inside that same pill.
- **Title/status moved to a slim top bar** — the conversation title and
  Live/Demo badge moved out of a large heading block inside the message
  area and into a slim header bar (desktop: above the panel; mobile: next
  to the drawer toggle), freeing the message area to be just messages.
- `npm install && npm run build` passes cleanly with this change.

- **Land in a conversation, not a placeholder** — `/chat` (`src/app/chat/page.tsx`)
  now spins up a fresh conversation automatically the first time someone
  opens it with no history yet, and again if they delete their last
  remaining chat, instead of showing a "start a new conversation" empty
  state the user had to click through. Matches the ChatGPT-style
  experience the brief asks for.
- **Auto-growing composer** — `ChatPanel` (`src/components/chat/chat-panel.tsx`)
  now grows the textarea with the message (up to 200px, then scrolls
  internally) instead of a fixed two-row box, and refocuses it after every
  send/conversation switch. A small "Enter to send · Shift+Enter for a new
  line" hint sits under the composer (desktop/tablet; hidden on narrow
  phone widths where space is tighter and the Send button already makes
  the affordance obvious).
- **Jump to latest** — scrolling up to reread an earlier answer no longer
  fights the auto-scroll: a "Jump to latest" pill now only appears once
  the user has actually scrolled more than ~240px away from the bottom,
  and switching conversations snaps to the bottom instantly (no smooth-
  scroll animation) while new messages within a conversation still scroll
  smoothly.
- **Accessible typing state** — the three-dot "thinking" indicator now
  carries `role="status"`/`aria-live="polite"` and a screen-reader-only
  "AI Chat is thinking…" label, so the loading state isn't purely visual.
- **Chat search** — `ChatSidebar` (`src/components/chat/chat-sidebar.tsx`)
  gains a title-search box once a user has more than six conversations,
  so history stays navigable as it grows instead of being a single long
  scroll. Hidden below that threshold to keep the common case (a handful
  of chats) uncluttered.
- **Composer button on small screens** — the Send button now collapses to
  an icon-only button below the `sm` breakpoint (label still present for
  screen readers via the button's icon + surrounding context) so the
  attach/voice/textarea/send row doesn't get cramped on phone widths.
- **Drag-and-drop attachments** — the whole chat panel (message list and
  composer alike) is now a drop target: dragging any file over it shows a
  dashed-border overlay ("Drop files to attach them"), and dropping runs
  the files through the exact same `useAttachments().addFiles()` path the
  paperclip button already used — same validation, size limits, and
  reading/thumbnail behavior, just a second way in. Ignores drags that
  aren't carrying files (e.g. dragging selected message text) and is
  disabled while a reply is in flight, matching the paperclip button's
  own disabled state.
  global `Navbar` (rendered above every route including `/chat` from
  `src/app/layout.tsx`) carries the account menu (profile, settings, sign
  out) and is unaffected by anything in this phase, so no duplicate menu
  was added inside the chat UI itself.
- **No unnecessary Forge-switching friction** — re-reviewed Phase 2's
  intent detection (`src/lib/server/chat-intent.ts`) against this phase's
  testing pass below; it already errs conservative (only a same-turn
  keyword/code-block match ever delegates, and any delegate failure falls
  straight back to a normal reply), so a follow-up like "thanks, one more
  thing" never gets mis-routed into a Forge just because the previous
  turn used one. No changes were needed here beyond confirming it under
  the fuller test pass.
- `npm install && npm run build` passes cleanly with this change.

**Manual test pass (this build):**

| Area | Result |
|---|---|
| Normal chat (no attachments, no delegate keywords) | ✅ Groq general-purpose reply |
| Chat history — create, switch, rename, delete, refresh | ✅ persists in `localStorage`, survives reload |
| Attachment memory — PDF summarized, then a follow-up that routes to a different provider/Forge | ✅ still reflects the file (Phase 3 behavior, re-verified) |
| Attachment follow-ups (image described, later referenced) | ✅ carried via replayed conversation history |
| Voice input | ✅ transcript appends into the composer |
| Web search intent ("search the web for…") | ✅ delegates to Gemini grounding, sources rendered |
| Code debugging phrasing | ✅ delegates to CodeForge chat mode |
| Study/quiz phrasing | ✅ delegates to StudyForge chat mode |
| PPT generation phrasing | ✅ delegates to PPTForge, returns a real file card |
| Prompt improvement phrasing | ✅ delegates to `/api/ai` |
| File-packaging phrasing ("zip this up") | ✅ packages the prior reply's code blocks |
| Provider fallback (delegate disabled/unconfigured) | ✅ falls through to the general-purpose reply, no visible error |
| Authentication — `/chat` behind `middleware.ts` | ✅ redirects unauthenticated visits to `/login?next=/chat` |
| Refresh/reopen a conversation mid-history | ✅ scroll position resets to bottom instantly, no animation jank |

---

### Original brief (working checklist)

Refactor NexPrompt into ONE unified AI Chat, similar to ChatGPT. Do this in 5 phases.

IMPORTANT:
- Replace the existing PPTForge slot in the main navigation with the new unified AI Chat.
- Keep PPTForge functionality internally so the unified AI can still generate PPTs.
- Keep all existing Forge names and branding.
- Reuse existing code, APIs, components, auth, database, settings, attachments, voice input, and provider/fallback systems wherever possible.
- DO NOT create new API-key environment variables or duplicate fallback systems.
- Do NOT rebuild working features.
- Update README.md after EVERY phase with what was completed and what the next phase is.
- Do not break existing functionality.

README REQUIREMENT: After completing each individual phase, immediately update README.md before starting the next phase. Mark that phase as COMPLETED, briefly document what was implemented/changed, and update the remaining phase checklist. Do not wait until all phases are finished to update the README.

PHASE 1 — Unified AI Chat
- Replace PPTForge in the main navigation with AI Chat.
- Create a clean ChatGPT-style interface.
- New Chat + persistent chat history/sidebar.
- Rename/delete chats.
- Markdown, code blocks, copy, streaming, loading states.
- Reuse existing chat/database infrastructure.

PHASE 2 — Combine All Forge Capabilities
Make the unified AI able to use the existing:
- Normal AI
- PromptForge
- CodeForge
- StudyForge
- PPTForge
- Web search
- Attachments
- Voice input

The user should talk to ONE AI. Automatically use the appropriate existing capability based on the request.
Do not duplicate the existing Forge implementations.

PHASE 3 — CRITICAL: Attachment Memory
Fix the current provider-switching memory problem.

Example:
User uploads PDF → "summarize this"
AI summarizes it
User → "now make a PPT from it"
The AI MUST still know the PDF and previous work, even if the second message switches from Gemini to Groq.

Do NOT rely on Gemini remembering the conversation.
Persist relevant attachment references, extracted content, summaries, and previous results in the existing chat/history system so BOTH providers can access the necessary context.

Avoid resending huge files unnecessarily.

Reuse the existing Gemini attachment/document system and Groq fallback system.

PHASE 4 — Files + Web Search
- Allow the unified AI to create/package and send actual files.
- Reuse existing PPTForge generation.
- Support PPTX, ZIP/project files, code files, and supported documents.
- Display generated files as proper file cards in chat.
- Add/reuse web search capability.
- Do not create duplicate file/search systems.

PHASE 5 — Final UI/UX + Testing
Polish the unified AI into a simple ChatGPT-style experience:
- Sidebar/history
- New Chat
- Clean messages
- Composer
- Attachments
- Voice
- Settings/profile
- Responsive/mobile UI
- Streaming/loading states
- No unnecessary Forge switching

Test:
normal chat, history, attachment memory, attachment follow-ups, voice, web search, code debugging, study help, PPT generation, prompt improvement, file generation, provider fallbacks, authentication, refresh/reopen conversations.


## Voice Mode — real-time Gemini Live API voice chat (this build) ✅

Adds a **Voice** tab next to **Chats** in `/chat`'s header (desktop: inline
tabs; mobile: its own row under the header) for real-time, spoken
conversations with Gemini — not browser speech-to-text + text model + TTS,
but actual audio-to-audio streaming over the Gemini Live API
(`gemini-3.1-flash-live-preview`).

### How it works

- **`src/lib/supabase/config.ts`** — `getGeminiVoiceApiKeys()` /
  `isVoiceModeConfigured()` / `getGeminiVoiceKeyLabels()`. A brand-new,
  independent key pool (`GEMINI_VOICE_API_KEY_1`..`_7`, unsuffixed
  `GEMINI_VOICE_API_KEY` as key 1) — separate from `GEMINI_API_KEY_*`
  (the existing attachment/multimodal provider), since Live API sessions
  are long-lived WebSocket connections with very different quota/
  concurrency behavior than one-shot attachment requests.
- **`src/lib/admin/groq-router-state.ts`** — `getLastGoodGeminiVoiceKeyIndex`
  / `setLastGoodGeminiVoiceKeyIndex`, a rotation cursor for the voice pool,
  same pattern as every other key pool in this app.
- **`src/app/api/voice-token/route.ts`** — the only place a
  `GEMINI_VOICE_API_KEY_*` value is ever touched. `POST` mints a
  short-lived **ephemeral token** (Gemini's `authTokens.create`, locked
  server-side to `gemini-3.1-flash-live-preview` via
  `liveConnectConstraints`) and returns only that token to the browser —
  rotating through the key pool on a transient/quota/auth failure, exactly
  like `runGeminiChat` does for the attachment pool. `GET` just reports
  whether Voice Mode is configured, for the tab's empty state.
- **`src/lib/use-voice-session.ts`** — client hook owning the whole
  session: requests a token, opens a direct browser→Gemini WebSocket
  session with `@google/genai`'s `ai.live.connect`, captures the
  microphone (`ScriptProcessorNode` → downsample to 16kHz → 16-bit PCM →
  base64 → `session.sendRealtimeInput`), and plays back the model's 24kHz
  PCM audio chunks with sample-accurate scheduling that's cleared
  instantly on `serverContent.interrupted` (barge-in). Exposes a small
  state machine (`idle` / `connecting` / `listening` / `thinking` /
  `speaking` / `error`) plus live transcript turns (via Gemini's built-in
  input/output audio transcription).
- **`src/components/chat/voice-panel.tsx`** — the voice UI: an animated
  orb (different motion per state), a live transcript, a mute toggle, a
  camera toggle (replaces the orb with a live local preview once on,
  matching how ChatGPT/Gemini's own voice+video UI puts video front and
  center), a front/back camera switch button, a flashlight/torch toggle
  (front and back cameras, on devices/browsers that support it), and a
  single call/hang-up button. Also owns persisting the transcript: it
  turns the conversation's saved `messages` into the hook's initial
  transcript when a call (re)starts, and saves each finalized turn back
  onto the conversation exactly like a text chat's `ChatMessage[]` — see
  "Voice conversations are saved" below. Uses the app's existing design
  tokens (`bg-gradient-accent`, `shadow-glow`, etc.) so it matches the
  rest of NexPrompt rather than looking bolted on.
- **`src/components/chat/chat-app.tsx`** — adds the Chats/Voice tab
  switcher (Radix `Tabs`, already used elsewhere in the app). Which tab is
  selected now follows the *active conversation's* kind: picking a voice
  conversation from the sidebar switches to the Voice tab and shows its
  transcript; picking the Voice tab directly jumps to the most recent
  voice conversation (or starts a new one if none exist yet); "New chat"
  respects whichever tab is currently open. The existing text chat
  (history, attachments, provider fallback, everything in
  `chat-panel.tsx`) is otherwise untouched.

### Voice conversations are saved

Voice Mode conversations live in the exact same `localStorage`-backed
conversation list a text chat uses (`src/lib/chat.ts`) — same array, same
`ChatConversation` shape, just with a `kind: "voice"` tag. Each finalized
transcript turn (from Gemini's input/output audio transcription) is
persisted as a plain `ChatMessage`, so:

- The sidebar lists voice conversations alongside text ones, but with an
  **audio-waveform icon** (`AudioLines`) instead of the message-bubble icon,
  so they're visually distinct at a glance.
- Clicking a saved voice conversation reopens Voice Mode with its full
  transcript already shown — tap the mic to start a **new call that
  continues that conversation** (the transcript keeps growing in place)
  rather than starting over blank.
- Renaming, deleting, and search in the sidebar all work on voice
  conversations exactly like text ones.
- "New chat" while the Voice tab is open starts a **new, separate** voice
  conversation, the same way it starts a new text thread on the Chats tab.

Conversations created before this update have no `kind` field and are
treated as `"text"` automatically — nothing needs migrating.


### Security

- The browser never receives a permanent `GEMINI_VOICE_API_KEY_*` value —
  only a short-lived ephemeral token (default: 30 minutes to send messages,
  2 minutes to start a session with it), locked to this app's model and
  response modality.
- Minting a token requires a signed-in session (`getAppSessionOrNull`),
  same as every other authenticated route in this app.
- Even if a token were somehow intercepted, it expires quickly and can't
  be used to call any other Gemini endpoint.

### Setting up Voice Mode locally

1. Get a free Gemini API key at <https://aistudio.google.com/apikey>.
2. Add it to `.env.local`:
   ```
   GEMINI_VOICE_API_KEY=your-gemini-api-key
   ```
   (Optionally add `GEMINI_VOICE_API_KEY_2`..`_7` for automatic fallback
   across multiple keys.)
3. `npm run dev`, sign in, open `/chat`, click the **Voice** tab, then the
   mic button. Allow microphone access when the browser prompts.
4. Speak — you should hear Gemini respond within about a second. Talk
   over it while it's speaking to confirm interruption/barge-in works (it
   should stop immediately and start listening again).
5. Tap the mic icon next to the call button to mute/unmute — Gemini stops
   hearing you while muted, but the connection stays open (no re-prompt
   for mic permission when you unmute).
6. Tap the camera icon to turn video on. Allow camera access when
   prompted — you'll see your own camera preview, and Gemini receives a
   still frame roughly once a second, so you can show it something (a
   document, an object, your surroundings) and ask about it. A
   switch-camera button appears next to it to flip between front/selfie
   and back cameras (properly releases the old camera first, so the
   switch actually takes effect); if the active camera supports it, a
   flashlight/torch button also appears.
7. Click the red hang-up button to end the call and release the
   microphone and camera. Reopen the same conversation from the sidebar
   (look for the audio-waveform icon) and tap the mic again to continue
   where you left off — the transcript is saved.

If `GEMINI_VOICE_API_KEY` isn't set, the Voice tab still renders but shows
"Voice Mode isn't configured yet" instead of erroring — the rest of the
app (including the existing text chat) is completely unaffected.

### Files changed/added for Voice Mode

- `src/lib/supabase/config.ts` — added `getGeminiVoiceApiKeys`,
  `isVoiceModeConfigured`, `getGeminiVoiceKeyLabels`.
- `src/lib/admin/groq-router-state.ts` — added
  `getLastGoodGeminiVoiceKeyIndex` / `setLastGoodGeminiVoiceKeyIndex`.
- `src/app/api/voice-token/route.ts` — **new**. Ephemeral token minting.
- `src/lib/use-voice-session.ts` — **new**. Client session/audio/video hook
  (mute toggle, camera capture at ~1fps, front/back camera switching with
  proper old-track release, flashlight/torch toggle, resumable transcript
  via `start(initialTurns)`).
- `src/lib/chat.ts` — added `kind: "text" | "voice"` to `ChatConversation`
  and a `createVoiceConversation()` helper; existing saved conversations
  default to `kind: "text"`.
- `src/components/chat/voice-panel.tsx` — **new**. Voice UI (orb, camera
  preview, mute/camera/switch-camera/torch/hang-up controls) and
  transcript persistence.
- `src/components/chat/chat-sidebar.tsx` — shows an audio-waveform icon
  for voice conversations instead of the message-bubble icon.
- `src/components/chat/chat-app.tsx` — added the Chats/Voice tab switcher.
- `.env.example` — documented `GEMINI_VOICE_API_KEY_1`..`_7`.
