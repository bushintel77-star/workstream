## Workstream Gap Matrix — generated 2026-05-24T12:15:24Z

| # | Task | Source | Status | Gap Type | Owner | Priority |
|---|------|--------|--------|----------|-------|----------|
| 1 | Clerk CLERK_SECRET_KEY and NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY set on construct-api and construct-web | OUTSTANDING.md | NOT DONE | HumanOps | Human | P0 |
| 2 | REDIS_URL secret plus `fly scale count worker=1 -a construct-api` | OUTSTANDING.md | NOT DONE | HumanOps | Human | P0 |
| 3 | SENTRY_DSN set on both apps and web Sentry package enabled when live | OUTSTANDING.md | NOT DONE | HumanOps | Human | P0 |
| 4 | Single API machine for JSON snapshot consistency via `fly scale count 1 -a construct-api` | OUTSTANDING.md | NOT DONE | HumanOps | Human | P0 |
| 5 | EAS build configure, Apple credentials, Google Play credentials, and real EAS project ID | OUTSTANDING.md | NOT DONE | HumanOps | Human | P1 |
| 6 | Branch protection on `main` with required CI checks | OUTSTANDING.md | BLOCKED | HumanOps | Human | P1 |
| 7 | OpenTelemetry tracing for Anthropic, OpenAI, Mapbox, and `/v1/*` API handlers | GAP-ANALYSIS.md | NOT STARTED | Code | Agent | P2 |
| 8 | Edge runtime for `/portal/*` pages | GAP-ANALYSIS.md | NOT STARTED | Code | Agent | P2 |
| 9 | Route contract smoke coverage extended beyond core health/projects routes | OUTSTANDING.md | PARTIAL | Test | Agent | P1 |
| 10 | Litestream backup configuration promoted from template to operator setup docs | OUTSTANDING.md | PARTIAL | Doc | Agent | P2 |
| 11 | Mobile `REPLACE_AFTER_eas_init` placeholder extracted to EAS notes and CI linted | OUTSTANDING.md | NOT DONE | Test | Agent | P1 |
| 12 | `docs/WORKSTREAM-STATUS.md` authoritative status document restored or recreated | User prompt | NOT DONE | Doc | Agent | P2 |
| 13 | Human ops runbook with copy-paste steps for Clerk, Redis, Sentry, Fly scale, EAS, external keys, branch protection, and OpenTelemetry endpoint | User prompt | NOT DONE | Doc | Agent | P0 |
| 14 | Dashboard empty/loading/error/filter/delete-undo polish verified against Aegis UX standard | User prompt | PARTIAL | UX | Agent | P2 |
| 15 | Project hub tab locked states, empty states, form validation, destructive confirms, and output actions verified | User prompt | PARTIAL | UX | Agent | P2 |
| 16 | Client portal edge-safe, responsive, graceful expired-link, quote watermark, and Stripe-disabled states verified | User prompt | PARTIAL | UX | Agent | P2 |
| 17 | Design Studio tooltips, autosave/save state, pointer capture, scale bar, context labels, keyboard legend, and Phase 6 honesty UI verified | User prompt | PARTIAL | UX | Agent | P2 |
| 18 | Settings tabs for integrations, team, billing, and audit log have no dead controls and designed empty/error states | User prompt | PARTIAL | UX | Agent | P2 |
| 19 | Pipeline processing screen retry/error/complete navigation verified | User prompt | PARTIAL | UX | Agent | P2 |
| 20 | Navigation shell route guards, dev-mode banner, not-found page, and responsive menu verified | User prompt | PARTIAL | UX | Agent | P2 |

Gap types: Code | HumanOps | UX | Asset | Test | Doc
Owner: Agent (can implement now) | Human (requires credentials/platform access)
