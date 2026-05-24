## Workstream Gap Matrix — generated 2026-05-24T03:39:45Z

| # | Task | Source | Status | Gap Type | Owner | Priority |
|---|------|--------|--------|----------|-------|----------|
| 1 | Clerk CLERK_SECRET_KEY + CLERK_PUBLISHABLE_KEY on construct-api; CLERK_SECRET_KEY + NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY on construct-web | OUTSTANDING.md, PRODUCTION.md | NOT DONE | HumanOps | Human | P0 |
| 2 | REDIS_URL provisioned and fly scale count worker=1 on construct-api | OUTSTANDING.md, GAP-ANALYSIS.md | NOT DONE | HumanOps | Human | P0 |
| 3 | SENTRY_DSN set on both apps and @sentry/nextjs installed on web when enabling Sentry | OUTSTANDING.md, GAP-ANALYSIS.md | NOT DONE | HumanOps | Human | P0 |
| 4 | fly scale count 1 -a construct-api for JSON snapshot consistency | OUTSTANDING.md, PRODUCTION.md | NOT DONE | HumanOps | Human | P0 |
| 5 | EAS init, project ID replacement, Apple credentials, Google Play credentials | OUTSTANDING.md, apps/mobile/app.json, apps/mobile/eas.json | NOT DONE | HumanOps | Human | P1 |
| 6 | Branch protection on main | OUTSTANDING.md, GAP-ANALYSIS.md | BLOCKED | HumanOps | Human | P1 |
| 7 | OpenTelemetry tracing for Anthropic, OpenAI, Mapbox, and route spans | OUTSTANDING.md, GAP-ANALYSIS.md | CLOSED `ce198e0` | Code | Agent | P2 |
| 8 | Edge runtime for /portal/* pages | OUTSTANDING.md, GAP-ANALYSIS.md | CLOSED `46161c4` | Code | Agent | P2 |
| 9 | Contract smoke coverage for remaining API routes beyond core routes | OUTSTANDING.md, apps/api/src/routes/contract.test.ts | CLOSED `0c78e17` | Test | Agent | P1 |
| 10 | Litestream backup setup promoted from template to operator-ready documentation | OUTSTANDING.md, docs/litestream.example.yml | CLOSED | Doc | Agent | P2 |
| 11 | Mobile app.json EAS placeholder detection and CI guard | apps/mobile/app.json, apps/mobile/eas.json | CLOSED `97df9a4` | Test | Agent | P1 |
| 12 | docs/WORKSTREAM-STATUS.md authoritative status document | User prompt, repository audit | CLOSED | Doc | Agent | P2 |
| 13 | Portal loading and error boundaries for client-facing quote/deposit routes | User prompt, web audit | CLOSED `46161c4` | UX | Agent | P2 |
| 14 | Settings loading boundary and token-only legacy CSS cleanup | User prompt, web audit | PARTIAL `4465787` | UX | Agent | P2 |
| 15 | Project tab loading skeleton consistency | User prompt, web audit | CLOSED `4465787` | UX | Agent | P2 |
| 16 | Design studio Phase 6 AI assist | AERIAL_DESIGN_STUDIO_AGENT_BRIEF.md, OUTSTANDING.md | DEFERRED | UX | Human | P3 |
| 17 | Brochure output | AERIAL_DESIGN_STUDIO_AGENT_BRIEF.md, OUTSTANDING.md | DEFERRED | UX | Human | P3 |
| 18 | Storybook for web primitives | OUTSTANDING.md | NOT STARTED | UX | Agent | P3 |
| 19 | Bundle-size budget in CI | OUTSTANDING.md | NOT STARTED | Test | Agent | P3 |
| 20 | PostgreSQL migration | OUTSTANDING.md | DEFERRED | Code | Human | P3 |
| 21 | Multi-region Fly deploy for HA | OUTSTANDING.md | DEFERRED | HumanOps | Human | P3 |

Gap types: Code | HumanOps | UX | Asset | Test | Doc
Owner: Agent (can implement now) | Human (requires credentials/platform access)

## Baseline verification

- `git log --oneline -50` read at 2026-05-24T03:39:45Z.
- `pnpm ci` was attempted as requested and failed because pnpm reports `ERR_PNPM_CI_NOT_IMPLEMENTED`.
- `pnpm run ci` passed with 118 tests.

