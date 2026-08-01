# PromptForge 2.0

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

Since PromptForge is a tool for a very literal act of *crafting*, the design
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
  every other open PromptForge tab in the same browser (open
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

PromptForge still runs with **zero configuration** — every Phase 1–6 feature
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
