## Workstream Gap Matrix — generated 2026-05-24T05:24:32Z

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
| 9 | Contract smoke coverage for remaining API routes beyond core routes | OUTSTANDING.md, apps/api/src/routes/contract.test.ts | CLOSED `0c78e17`, `677b543`, `0af85c0` | Test | Agent | P1 |
| 10 | Litestream backup setup promoted from template to operator-ready documentation | OUTSTANDING.md, docs/litestream.example.yml | CLOSED | Doc | Agent | P2 |
| 11 | Mobile app.json EAS placeholder detection and CI guard | apps/mobile/app.json, apps/mobile/eas.json | CLOSED `97df9a4` | Test | Agent | P1 |
| 12 | docs/WORKSTREAM-STATUS.md authoritative status document | User prompt, repository audit | CLOSED | Doc | Agent | P2 |
| 13 | Portal loading, error boundaries, and signed deposit checkout flow for client-facing quote/deposit routes | User prompt, web audit | CLOSED `46161c4`, `9de3ed7`, `443761d` | UX | Agent | P2 |
| 14 | Settings loading boundary and token-only legacy CSS cleanup | User prompt, web audit | CLOSED `4465787`, `9de3ed7` | UX | Agent | P2 |
| 15 | Project tab loading skeleton consistency | User prompt, web audit | CLOSED `4465787` | UX | Agent | P2 |
| 16 | Portal checkout URLs must not default to localhost in production; client-facing cost figures include cents | PR audit, Design System Law | CLOSED `fd23e08` | Code | Agent | P1 |
| 17 | Design studio Phase 6 AI assist | AERIAL_DESIGN_STUDIO_AGENT_BRIEF.md, OUTSTANDING.md | DEFERRED | UX | Human | P3 |
| 18 | Brochure output | AERIAL_DESIGN_STUDIO_AGENT_BRIEF.md, OUTSTANDING.md | DEFERRED | UX | Human | P3 |
| 19 | Storybook for web primitives | OUTSTANDING.md | NOT STARTED | UX | Agent | P3 |
| 20 | Bundle-size budget in CI | OUTSTANDING.md | NOT STARTED | Test | Agent | P3 |
| 21 | PostgreSQL migration | OUTSTANDING.md | DEFERRED | Code | Human | P3 |
| 22 | Multi-region Fly deploy for HA | OUTSTANDING.md | DEFERRED | HumanOps | Human | P3 |

Gap types: Code | HumanOps | UX | Asset | Test | Doc
Owner: Agent (can implement now) | Human (requires credentials/platform access)

## Baseline verification

- `git log --oneline -50` read at 2026-05-24T05:20Z.
- `pnpm ci` was attempted as requested and failed because pnpm reports `ERR_PNPM_CI_NOT_IMPLEMENTED`.
- `pnpm run ci` passed after final implementation with 128 tests.
- `pnpm lint`, `pnpm mobile:check-placeholders`, portal import guard, and
  `pnpm test:e2e` passed after installing Playwright Chromium locally.
- Production smoke checks returned `ok` for `/healthz` and `/readyz`; the
  requested `/uploads/test.mp3` probe returned `404` because the test object is
  absent on production.

