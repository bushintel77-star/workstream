> **⚠️ HISTORICAL DOCUMENT — superseded 2026-08-02.**
> Live source of truth: [`docs/MASTER-GAP-ANALYSIS-2026-08-02.md`](./MASTER-GAP-ANALYSIS-2026-08-02.md)
> This matrix predates the canvas-first studio rebuild and unified token
> system. Retained for change-history reference only.

## Workstream Gap Matrix - generated 2026-07-21T00:38:19Z

Branch: `cursor/workstream-gold-standard-rebuild-1f48`  
Commits: `3b5427a`, `814a3cb`  
Initial literal `pnpm ci`: `ERR_PNPM_CI_NOT_IMPLEMENTED` on pnpm 9.15.4. Use `pnpm run ci`.

| # | Task | Source | Status | Gap Type | Owner | Priority |
|---|------|--------|--------|----------|-------|----------|
| 1 | Clerk live application plus `CLERK_SECRET_KEY` on the API service and `CLERK_SECRET_KEY` + `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` on the web service | OUTSTANDING.md | NOT DONE | HumanOps | Human | P0 |
| 2 | `REDIS_URL` plus worker process enablement on the API service | OUTSTANDING.md | NOT DONE | HumanOps | Human | P0 |
| 3 | `SENTRY_DSN` set on both services and web Sentry package enabled when live | OUTSTANDING.md | NOT DONE | HumanOps | Human | P0 |
| 4 | Single API instance for JSON snapshot consistency | OUTSTANDING.md | NOT DONE | HumanOps | Human | P0 |
| 5 | EAS init, Apple credentials, Google Play credentials, and real EAS project ID | OUTSTANDING.md | NOT DONE | HumanOps | Human | P1 |
| 6 | Branch protection on `main` with required CI checks | OUTSTANDING.md | BLOCKED - requires GitHub Pro/private repo admin | HumanOps | Human | P1 |
| 7 | OpenTelemetry tracing for Anthropic, OpenAI, Mapbox, aerial fetches, queue worker, and API route handlers | GAP-ANALYSIS.md | CLOSED in `f00a98e` and preserved in current branch | Code | Agent | P2 |
| 8 | Edge runtime for `/portal/*` pages with CI guard | GAP-ANALYSIS.md | CLOSED in `86db313`; CI guard strengthened in `3b5427a` | Code | Agent | P2 |
| 9 | Route contract smoke coverage extended beyond core health/projects routes | OUTSTANDING.md | CLOSED in `f00a98e` and `339361b`; current suite covers protected files, studio AI, orchestration, Stripe webhook, geocode, catalog, suppliers, weather, carbon, readiness, validation, and auth configuration | Test | Agent | P1 |
| 10 | Litestream backup configuration documented without implying JSON snapshot replication | OUTSTANDING.md | CLOSED in `814a3cb`; config is SQLite-ready and runbook marks sidecar human-owned after SQLite migration | Doc | Agent | P2 |
| 11 | Mobile `REPLACE_AFTER_eas_init` placeholder removed from `app.json` and guarded in CI | OUTSTANDING.md | CLOSED in `86db313`; current search finds placeholder only in guard/docs references | Test | Agent | P1 |
| 12 | Human ops runbook with copy-paste steps for Clerk, Redis, Sentry, Railway scale, EAS, external keys, branch protection, OpenTelemetry endpoint, Stripe, and Litestream | User prompt | CLOSED in `814a3cb` | Doc | Agent | P0 |
| 13 | Dashboard project register filters, sort, delete undo, empty/error states, and valid CSS | User prompt | CLOSED in `ee5330a` and malformed CSS fixed in `3b5427a` | UX | Agent | P2 |
| 14 | Project hub tabs, locked states, empty states, destructive confirms, and output actions | User prompt | CLOSED by prior canvas-first/project hub hardening; dead brochure action removed in `4461b28` | UX | Agent | P2 |
| 15 | Client portal graceful expiry/error states, quote watermark, scenario-aware deposit copy, and no debug fallback copy | User prompt | CLOSED in `4461b28`; client-facing deposit copy fixed in `3b5427a` | UX | Agent | P2 |
| 16 | Design Studio tooltips, autosave/save state, pointer capture, scale bar, context labels, keyboard legend, Phase 7 honesty UI, and loaded fonts | User prompt | CLOSED by prior studio hardening; unloaded Sora/Fraunces references replaced with IBM Plex tokens in `3b5427a` and shared UI tokens aligned in `814a3cb` | UX | Agent | P2 |
| 17 | Settings integrations/team/billing/audit controls respond and use shared button treatment | User prompt | CLOSED by prior settings implementation; standalone modifier-only buttons fixed in `3b5427a` | UX | Agent | P2 |
| 18 | Pipeline processing screen retry/error/complete navigation and current canvas-stage language | User prompt | CLOSED in `4461b28`; stale hub/pipeline copy fixed in `3b5427a` | UX | Agent | P2 |
| 19 | Navigation shell route guards, dev-mode banner, not-found/error pages, and responsive recovery controls | User prompt | CLOSED in `ee5330a` and `f00a98e`; error recovery links fixed in `3b5427a` | UX | Agent | P2 |
| 20 | Local `pnpm run ci` includes install, mobile placeholder guard, portal Edge guard, typecheck, lint, and Vitest | User prompt | CLOSED in `ee5330a`; portal guard now uses `scripts/check-portal-edge.mjs` in `3b5427a` | Test | Agent | P1 |

Gap types: Code | HumanOps | UX | Asset | Test | Doc  
Owner: Agent (can implement now) | Human (requires credentials/platform access)
