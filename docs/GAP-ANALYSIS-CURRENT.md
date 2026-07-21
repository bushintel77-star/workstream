## Workstream Gap Matrix — generated 2026-07-21T00:27:00Z

Verification: `pnpm run ci` exits 0 with 105 Vitest files and 442 tests. Bare
`pnpm ci` exits `ERR_PNPM_CI_NOT_IMPLEMENTED` on pnpm 9.15.4.

| # | Task | Source | Status | Gap Type | Owner | Priority |
|---|------|--------|--------|----------|-------|----------|
| 1 | Clerk `CLERK_SECRET_KEY` and publishable keys set on `construct-api` and `construct-web` | OUTSTANDING.md | NOT DONE | HumanOps | Human | P0 |
| 2 | `REDIS_URL` secret plus `fly scale count worker=1 -a construct-api` | OUTSTANDING.md | NOT DONE | HumanOps | Human | P0 |
| 3 | `SENTRY_DSN` set on both apps and web Sentry package enabled when live browser capture is needed | OUTSTANDING.md | NOT DONE | HumanOps | Human | P0 |
| 4 | Single API machine for JSON snapshot consistency via `fly scale count 1 -a construct-api` | OUTSTANDING.md | NOT DONE | HumanOps | Human | P0 |
| 5 | EAS init, Apple credentials, Google Play credentials, and real EAS project ID | OUTSTANDING.md | NOT DONE | HumanOps | Human | P1 |
| 6 | Branch protection on `main` with required CI checks | OUTSTANDING.md | BLOCKED until GitHub Pro / admin action | HumanOps | Human | P1 |
| 7 | OpenTelemetry tracing for Anthropic, OpenAI, Mapbox, queue worker, and API route handlers | GAP-ANALYSIS.md | CLOSED in `f00a98e` and hardened in `446beb5`; route, provider, aerial, worker, and shutdown spans are wired behind `OTEL_EXPORTER_OTLP_ENDPOINT` | Code | Agent | P2 |
| 8 | Edge runtime for `/portal/*` pages and CI guard against Node-only portal imports | GAP-ANALYSIS.md | CLOSED in `6e2f0ce`; portal error boundary declares Edge runtime and `web:check-portal-edge` validates route files plus Node-only imports | Code | Agent | P2 |
| 9 | Route contract smoke coverage extended beyond core health/projects routes | OUTSTANDING.md | CLOSED; protected files, studio AI, orchestration, Stripe webhook, geocode, catalog, supplier, weather, carbon, readiness, validation, and auth-configuration guards are covered | Test | Agent | P1 |
| 10 | Litestream backup configuration promoted from template to operator setup docs | OUTSTANDING.md | CLOSED; `docs/litestream.example.yml` and `docs/LITESTREAM-SETUP.md` document R2/B2 and Fly sidecar steps | Doc | Agent | P2 |
| 11 | Mobile `REPLACE_AFTER_eas_init` placeholder extracted to EAS notes and CI linted | OUTSTANDING.md | CLOSED; `apps/mobile/app.json` is clean and `mobile:check-placeholders` runs in local/GitHub CI | Test | Agent | P1 |
| 12 | Current status document restored and kept authoritative | User prompt | CLOSED in `647ae84`; `docs/WORKSTREAM-STATUS.md` reflects current verification and remaining human-owned work | Doc | Agent | P2 |
| 13 | Human ops runbook with copy-paste steps for Clerk, Redis, Sentry, Fly scale, EAS, external keys, OpenTelemetry, Litestream, and branch protection | User prompt | CLOSED in `647ae84`; duplicate/corrupt sections removed and API/web Clerk variable names corrected | Doc | Agent | P0 |
| 14 | Dashboard empty/loading/error/filter/delete-undo polish verified against Aegis UX standard | User prompt | CLOSED; project cards, search, status filters, date/name sorting, delete undo, empty/error/no-results states, and nav are wired | UX | Agent | P2 |
| 15 | Project hub and canvas mode locked states, empty states, destructive confirms, and output actions verified | User prompt | CLOSED for shipped canvas-first surface; brochure and Phase 6 AI assist remain intentionally deferred product scope | UX | Agent | P2 |
| 16 | Client portal edge-safe, responsive, graceful expired-link, quote watermark, and Stripe-disabled states verified | User prompt | CLOSED in `6e2f0ce`; portal Edge coverage is guarded and deposit preview no longer exposes debug session details | UX | Agent | P2 |
| 17 | Design Studio tooltips, autosave/save state, pointer capture, scale bar, context labels, keyboard legend, and honesty UI verified | User prompt | CLOSED for shipped phases; Phase 6 AI assist is a Coming Soon/deferred capability, not a broken action | UX | Agent | P2 |
| 18 | Settings tabs for integrations, team, billing, and audit log have responsive controls and designed empty/error states | User prompt | CLOSED for current settings surfaces; live connector activation remains human-owned secret/config work | UX | Agent | P2 |
| 19 | Pipeline processing screen retry/error/complete navigation verified | User prompt | CLOSED; stopped-pipeline error state and real retry endpoint are wired | UX | Agent | P2 |
| 20 | Navigation shell route guards, dev-mode banner, not-found page, and responsive menu verified | User prompt | CLOSED; global dev-mode banner, AppNav responsive menu, and not-found/error shells are present | UX | Agent | P2 |
| 21 | Local CI includes placeholder guard, portal Edge guard, lint, typecheck, and Vitest | User prompt | CLOSED in `6e2f0ce`; `pnpm run ci` runs install, mobile placeholder guard, Node portal Edge guard, typecheck, lint, and tests | Test | Agent | P1 |

Gap types: Code | HumanOps | UX | Asset | Test | Doc
Owner: Agent (can implement now) | Human (requires credentials/platform access)
