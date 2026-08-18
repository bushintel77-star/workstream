# Workstream status

> **Superseded — historical snapshot (generated 2026-07-21).** Do not treat
> as current. See [`ONBOARDING.md`](../ONBOARDING.md), `OUTSTANDING.md`, and
> `docs/PRODUCTION-ROADMAP-2026-08-17.md`.

Generated 2026-07-21T00:38:19Z for branch
`cursor/workstream-gold-standard-rebuild-1f48` through `814a3cb`.

## Shipped this session

- Current gap matrix regenerated at `docs/GAP-ANALYSIS-CURRENT.md` with unique
  rows, branch/commit context, and the literal `pnpm ci` result.
- Human ops runbook rebuilt at `docs/HUMAN-OPS-RUNBOOK.md` with copy-paste
  sections for Clerk, Redis, Sentry, Railway scale, EAS, external keys, Stripe,
  OpenTelemetry, Litestream, branch protection, and verification.
- Dashboard register stylesheet rebuilt after merge corruption so filters,
  cards, action menus, empty/error states, and delete undo styles are valid CSS.
- Portal deposit surfaces no longer expose developer fallback language, secret
  names, or session IDs to clients; quote deposit copy now follows the selected
  scenario.
- Settings, integration, crew, rate-card, and error recovery controls now
  compose shared button modifiers with the base button treatment.
- Studio and preview CSS now use loaded IBM Plex font tokens instead of unloaded
  Sora/Fraunces declarations.
- Portal Edge guard now runs `scripts/check-portal-edge.mjs` from `pnpm run ci`.
- Litestream docs are now SQLite-ready and no longer imply that Litestream can
  replicate the current JSON snapshot store.

## Still human-owned

- Clerk live application and Railway variables for the API and web services.
- Redis URL and Railway worker process scale-up.
- Sentry DSNs and optional web `@sentry/nextjs` enablement.
- Single API instance for JSON snapshot consistency.
- EAS init plus Apple and Google distribution credentials.
- Branch protection on `main` after GitHub Pro is enabled.
- External OpenAI, Anthropic, Mapbox, Stripe, portal, OpenTelemetry, and future
  Litestream object-store variables.

## Product status

| Area | Status |
|------|--------|
| Operator dashboard | Shipped; project register cards, search, filters, sort, empty/error/no-results states, delete undo, and valid CSS are wired. |
| Project hub | Shipped canvas-first project shell and tabs; dead brochure output action was removed in prior hardening. |
| Client portal | Shipped quote/deposit portal with graceful invalid-link handling, quote watermark, scenario-aware deposit copy, and client-safe fallback state. |
| Design Studio | Phases 2-5 and 7 shipped; Phase 6 AI assist remains intentionally deferred as a coming-soon/suggestion-only track. |
| Pipeline | Capture processing screen polls, errors with retry, and uses current drawing-board language. |
| API observability | Sentry scaffold and OpenTelemetry code path shipped; live exporters require human secrets. |
| Mobile | Expo app, capture flow, placeholder guard, and EAS profiles shipped; store credentials are human-owned. |

## Verification

Latest local verification for this branch:

```bash
pnpm ci
```

Result: `ERR_PNPM_CI_NOT_IMPLEMENTED` on pnpm 9.15.4. Use the workspace gate:

```bash
pnpm run ci
```

Result: 106 Vitest files, 446 tests passing.

Live smoke checks:

```bash
curl -sS https://api-production-a8ff1.up.railway.app/healthz
curl -sS https://api-production-a8ff1.up.railway.app/readyz
curl -sS -o /dev/null -w "%{http_code}\n" https://api-production-a8ff1.up.railway.app/uploads/test.mp3
```

Result: health `ok`, ready `ok`, protected upload probe `404` because the test
asset is absent.
