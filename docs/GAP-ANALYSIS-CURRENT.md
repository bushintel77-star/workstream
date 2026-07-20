## Workstream Gap Matrix — generated 2026-07-20T16:30:00Z
## Workstream Gap Matrix — generated 2026-07-20T14:31:00Z

| # | Task | Source | Status | Gap Type | Owner | Priority |
|---|------|--------|--------|----------|-------|----------|
| 1 | Clerk CLERK_SECRET_KEY and NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY set on construct-api and construct-web | OUTSTANDING.md | NOT DONE | HumanOps | Human | P0 |
| 2 | REDIS_URL secret plus `fly scale count worker=1 -a construct-api` | OUTSTANDING.md | NOT DONE | HumanOps | Human | P0 |
| 3 | SENTRY_DSN set on both apps and web Sentry package enabled when live | OUTSTANDING.md | NOT DONE | HumanOps | Human | P0 |
| 4 | Single API machine for JSON snapshot consistency via `fly scale count 1 -a construct-api` | OUTSTANDING.md | NOT DONE | HumanOps | Human | P0 |
| 5 | EAS build configure, Apple credentials, Google Play credentials, and real EAS project ID | OUTSTANDING.md | NOT DONE | HumanOps | Human | P1 |
| 6 | Branch protection on `main` with required CI checks | OUTSTANDING.md | BLOCKED | HumanOps | Human | P1 |
| 7 | OpenTelemetry tracing for Anthropic, OpenAI, Mapbox, queue worker, and API route handlers | GAP-ANALYSIS.md | CLOSED in f00a98e; route spans use active context, provider spans retain token attributes through body read, aerial fetch is traced, worker shutdown flushes telemetry | Code | Agent | P2 |
| 8 | Edge runtime for `/portal/*` pages | GAP-ANALYSIS.md | CLOSED in 86db313 | Code | Agent | P2 |
| 9 | Route contract smoke coverage extended beyond core health/projects routes | OUTSTANDING.md | CLOSED in f00a98e and 339361b; protected files, studio AI, orchestration, Stripe webhook, geocode, catalog, supplier, weather, carbon, readiness, validation, and auth-configuration guard covered | Test | Agent | P1 |
| 10 | Litestream backup configuration promoted from template to operator setup docs | OUTSTANDING.md | CLOSED in 86db313 | Doc | Agent | P2 |
| 11 | Mobile `REPLACE_AFTER_eas_init` placeholder extracted to EAS notes and CI linted | OUTSTANDING.md | CLOSED in 86db313 | Test | Agent | P1 |
| 12 | `docs/WORKSTREAM-STATUS.md` authoritative status document restored or recreated | User prompt | CLOSED in 4e8bfcf | Doc | Agent | P2 |
| 13 | Human ops runbook with copy-paste steps for Clerk, Redis, Sentry, Fly scale, EAS, external keys, branch protection, and OpenTelemetry endpoint | User prompt | CLOSED in 4e8bfcf | Doc | Agent | P0 |
| 14 | Dashboard empty/loading/error/filter/delete-undo polish verified against Aegis UX standard | User prompt | CLOSED in ee5330a | UX | Agent | P2 |
| 15 | Project hub tab locked states, empty states, form validation, destructive confirms, and output actions verified | User prompt | PARTIAL; dead brochure output removed in 4461b28 | UX | Agent | P2 |
| 13 | Human ops runbook with copy-paste steps for Clerk, Redis, Sentry, Fly scale, EAS, external keys, branch protection, OpenTelemetry endpoint, and Litestream | User prompt | CLOSED in docs update after f00a98e | Doc | Agent | P0 |
| 14 | Dashboard empty/loading/error/filter/delete-undo polish verified against Aegis UX standard | User prompt | CLOSED in f00a98e; shared nav, designed empty state, status filters, date/name sort, retry link, delete action, and undo toast wired | UX | Agent | P2 |
| 15 | Project hub tab locked states, empty states, form validation, destructive confirms, and output actions verified | User prompt | PARTIAL; dead brochure output removed in 4461b28; canvas mode locks closed in f00a98e | UX | Agent | P2 |
| 16 | Client portal edge-safe, responsive, graceful expired-link, quote watermark, and Stripe-disabled states verified | User prompt | PARTIAL; quote watermark, deposit gating, and friendly checkout error closed in 4461b28 | UX | Agent | P2 |
| 17 | Design Studio tooltips, autosave/save state, pointer capture, scale bar, context labels, keyboard legend, and Phase 7 honesty UI verified | User prompt | PARTIAL; autosave Retry button and progressive mode locks closed in f00a98e; Phase 6 AI assist remains intentionally deferred | UX | Agent | P2 |
| 18 | Settings tabs for integrations, team, billing, and audit log have no dead controls and designed empty/error states | User prompt | PARTIAL | UX | Agent | P2 |
| 19 | Pipeline processing screen retry/error/complete navigation verified | User prompt | PARTIAL; stopped-pipeline error and real retry endpoint closed in 4461b28 | UX | Agent | P2 |
| 20 | Navigation shell route guards, dev-mode banner, not-found page, and responsive menu verified | User prompt | PARTIAL; persistent dev-mode banner and IBM Plex shell tokens closed in ee5330a | UX | Agent | P2 |
| 21 | Local `pnpm run ci` includes placeholder guard, portal Edge guard, lint, typecheck, and Vitest | User prompt | CLOSED in ee5330a | Test | Agent | P1 |
| 20 | Navigation shell route guards, dev-mode banner, not-found page, and responsive menu verified | User prompt | PARTIAL; global dev-mode banner and dashboard AppNav closed in f00a98e | UX | Agent | P2 |

Gap types: Code | HumanOps | UX | Asset | Test | Doc
Owner: Agent (can implement now) | Human (requires credentials/platform access)
