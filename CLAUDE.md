# Workstream — guidance for AI assistants

This repo is the Workstream app — a voice-first landscape design + build
co-pilot for Curtis & Co (Melbourne).

## Architecture facts (don't relitigate)

- pnpm workspace monorepo. Node 22, pnpm 9.15.4, TypeScript strict.
- `apps/api` Fastify; `apps/web` Next.js 15 App Router; `apps/mobile` Expo.
- `packages/contracts` is the Zod schema boundary — change it before changing
  the API or any client.
- `packages/db` is an in-memory array set keyed by `owner_id` (pipeline jobs and
  tests still take a fresh memory store). Durability is a SQLite write-through
  journal (`packages/db/src/sqlite-persist.ts`, Node 22 `node:sqlite`, WAL) —
  every mutation flushes synchronously before return. First boot imports the
  legacy `store.json` snapshot then archives it. Env:
  `CONSTRUCT_SQLITE_PATH` (default beside the JSON path as `store.sqlite3`).
  Production refuses to boot if the DB directory is not writable.
- **Canonical deploy: Railway (production).** Web
  `https://web-production-3c194.up.railway.app`, API
  `https://api-production-a8ff1.up.railway.app`. API durability volume
  `api-volume` mounts at `/repo/apps/api/data`
  (`CONSTRUCT_PERSIST_PATH=…/store.json`, `CONSTRUCT_SQLITE_PATH=…/store.sqlite3`).

## Conventions

- **Conventional Commits** — `feat(web):`, `fix(api):`, `chore(deploy):`. Match
  the existing log; don't invent new prefixes.
- **Lint is a zero-tolerance gate.** `pnpm lint` runs ESLint over `apps/api/src`,
  `apps/web/src`, `packages/domain/src`, `packages/contracts/src`,
  `packages/db/src` and `packages/ui/src` at `--max-warnings 0`. Every package
  with a `lint` script runs the real thing — if you see `"lint": "echo ok"`,
  that package is not covered and the script is lying. `apps/mobile` is the one
  surface still ESLint-ignored outright.
  `apps/web` was unlinted until 2026-08; five features had
  shipped inert because nothing reported the unused variable that proved it. Do
  not raise the ceiling to land work — fix it, or mark it `_`-prefixed with the
  reason inline and an `OUTSTANDING.md` entry.
- **No emojis** in code, commits, or docs unless the user asks.
- **Sentence case** for headings, button labels, page titles.
- **AU locale** — `en-AU`, AUD, GST math, ABN, ATO retention windows,
  Stonnington/Yarra heritage overlays.
- **Curtis & Co vocabulary** — pleached hornbeam, mass-planted Lomandra,
  bluestone, Curtis house style. Off-palette species are rejected at the gate.

## CSS conventions

- CSS Modules per page (`*.module.css`), plus a shared `styles/app.module.css`
  for primitives (page shell, button, card, pill, table, metric).
- CSS variables only — tokens defined in `styles/globals.css`. Dark mode is
  `prefers-color-scheme`-driven; don't introduce a class-based switcher.
- **Web is desktop-first.** `apps/web` is the desktop product — design the
  desktop viewport first, then scale down with `@media (max-width: …)`. The
  mobile-first product is the separate `apps/mobile` (Expo) app; the two are
  **forked**, not one responsive codebase.
- Comfortable pointer targets on desktop; **44 px minimum on touch / on-site**
  (`[data-density="onsite"]`, coarse pointer). 16 px input font (kills iOS
  focus zoom) on any touch input.
- The linter complains about inline styles — push them into the module.

## Server actions + forms

- Server actions live in `apps/web/src/app/actions.ts`. They `revalidatePath`
  affected routes.
- Use `SubmitButton` from `apps/web/src/components/SubmitButton.tsx` for the
  pending-state feedback. Don't hand-roll `useFormStatus` per button.
- For non-form mutations (status changes, optimistic), use
  `useTransition` + a server action + `router.refresh()`, and show a toast
  via `useToast`.

## When you write tests

- Vitest for unit tests, colocated as `*.test.ts`.
- Domain math (`packages/domain`) and pure libs (`apps/api/src/lib/*.ts`) should
  be testable without a server. The pipeline jobs (`*-job.ts`) take a store
  + ownerId + projectId; pass a fresh memory store in tests.

## Don't

- Don't introduce a new global state library beyond what the canvas already
  uses. Server components + server actions are the state model for the app
  shell. The two canvas studios are deliberate exceptions: the classic SVG
  studio's `useStudioState` reducer and the WebGL studio's zustand
  `studioStore` (`webgl/studioStore.ts`, `getState()` in `useFrame` /
  selectors in DOM — no React state shared between the two stores; they meet
  only at the persisted `DesignCanvas` document, per
  `docs/GOLD-STANDARD-2026-ARCHITECTURE.md` §5).
- Don't add a CSS-in-JS library. CSS Modules + variables are intentional.
- Don't soften deletes silently — every destructive action should warn or be
  reversible (the current dashboard delete is the exception and is on the
  punch list to add an undo toast).
- Don't add backwards-compatibility shims for removed code. Delete it.

## Design studio phases

- **Current:** the Gold Standard 2026 WebGL studio is the primary canvas —
  metre-space, terrain-draped, live BOM, per `docs/GOLD-STANDARD-2026*.md`
  (read `ONBOARDING.md` first). `docs/STUDIO-PRODUCT-PHASES.md` describes the
  retired pre-GS "Workflow 1" `%`-coord era; its Stage 2 gate still holds as
  the product line.
- **Stage 2 (product-gated):** True survey-grade CAD — survey coordinates,
  named layer export (DXF/DWG), dim styles; requires new contracts schema.
  Do not implement Stage 2 fields on `DesignCanvas` without a schema brief.

## Out-of-scope today

- Real-time multi-user sync. The store is single-tenant.
- Postgres. Durability is the SQLite WAL write-through journal
  (`packages/db/src/sqlite-persist.ts`) — the JSON snapshot is first-boot
  import + escape hatch only.
- The React Compiler rule set in `eslint-plugin-react-hooks` v7
  (`set-state-in-effect`, `refs`, `immutability`, `purity`,
  `preserve-manual-memoization`) is enforced at zero on non-canvas web
  surfaces; canvas components carry a deliberate scope override in
  `eslint.config.mjs` (their imperative camera/Three.js patterns are locked
  by `canvas-chrome-*` specs). Do not widen the hooks config to
  `configs.flat["recommended-latest"]`; it takes the gate red on contact.
- Stage 2 CAD export / survey-grade studio (product-gated — see above).
