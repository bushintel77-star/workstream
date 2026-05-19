# Construct — guidance for AI assistants

This repo is the Construct app — a voice-first landscape design + build
co-pilot for Curtis & Co (Melbourne).

## Architecture facts (don't relitigate)

- pnpm workspace monorepo. Node 22, pnpm 9.15.4, TypeScript strict.
- `apps/api` Fastify; `apps/web` Next.js 15 App Router; `apps/mobile` Expo.
- `packages/contracts` is the Zod schema boundary — change it before changing
  the API or any client.
- `packages/db` is in-memory with `persist.ts` JSON-snapshot flush. SQLite
  migration is on the punch list; until then assume the store is a plain
  in-memory array set keyed by `owner_id`.
- Deployed on Fly.io syd. `auto_stop_machines = "stop"` so cold-starts are real.

## Conventions

- **Conventional Commits** — `feat(web):`, `fix(api):`, `chore(deploy):`. Match
  the existing log; don't invent new prefixes.
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
- **Mobile-first**: write the small viewport first, then `@media (min-width: …)`
  for tablet/desktop.
- 44 px minimum tap targets. 16 px input font (kills iOS focus zoom).
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

- Don't introduce a global state library (Redux/Zustand/Jotai). Server
  components + server actions are the state model.
- Don't add a CSS-in-JS library. CSS Modules + variables are intentional.
- Don't soften deletes silently — every destructive action should warn or be
  reversible (the current dashboard delete is the exception and is on the
  punch list to add an undo toast).
- Don't add backwards-compatibility shims for removed code. Delete it.

## Out-of-scope today

- Real-time multi-user sync. The store is single-tenant.
- Postgres. Stay on the JSON snapshot path until SQLite migration lands.
- Native ESLint plugin churn — see `OUTSTANDING.md`.
