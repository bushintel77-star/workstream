# Workstream status

Generated 2026-07-21 for branch `cursor/workstream-gold-standard-rebuild-970f`.

## Shipped on the gold-standard branch

- Current gap matrix maintained at `docs/GAP-ANALYSIS-CURRENT.md`.
- API OpenTelemetry scaffold is active behind `OTEL_EXPORTER_OTLP_ENDPOINT`.
  Route, queue worker, Anthropic, OpenAI, Mapbox, aerial fetch, and shutdown
  spans are wired with project/operator/stage/model/token attributes where
  available.
- Client portal route files run on Edge runtime. `pnpm web:check-portal-edge`
  now validates portal route/runtime exports and blocks Node-only imports.
- Contract smoke coverage covers core project flows plus geocode, catalog,
  suppliers, weather, carbon preconditions, protected files, studio AI,
  orchestration, Stripe webhook, readiness, validation, and auth guards.
- Mobile EAS placeholder text is absent from `apps/mobile/app.json`; local and
  GitHub CI fail if `REPLACE_AFTER_eas_init` returns.
- Litestream disaster-recovery setup is documented for R2/B2 object stores.
- Dashboard, shell, client portal, processing, and shipped canvas-first studio
  surfaces have designed empty/loading/error states for the current product
  scope.
- Human-only launch actions are documented in
  `docs/HUMAN-OPS-RUNBOOK.md`.

## Still human-owned

- Clerk live application and Fly secrets for `construct-api` and
  `construct-web`.
- Redis URL and Fly worker process scale-up.
- Sentry DSNs and optional web `@sentry/nextjs` enablement.
- Single API machine scale command for JSON snapshot consistency.
- EAS init plus Apple and Google distribution credentials.
- Branch protection on `main` after GitHub Pro/admin access is available.
- External OpenAI, Anthropic, Mapbox, Stripe, portal, OpenTelemetry, and
  Litestream object-store secrets.

## Product status

| Area | Status |
|------|--------|
| Operator dashboard | Shipped; project register cards, search, filters, sort controls, costing totals, empty/error/no-results states, AppNav, and delete undo are wired. |
| Project hub | Canvas-first project surface is shipped with survey/sketch/CAD/quote/share modes and progressive locks. Legacy standalone tab routes redirect into the canvas modes. |
| Client portal | Shipped quote/deposit portal with graceful invalid-link handling, confidential watermark, disabled checkout state, and Edge runtime. |
| Design Studio | Workflow 1 professional sketch surface is shipped through the handoff studio; Phase 6 AI assist remains intentionally deferred as a Coming Soon capability. |
| Pipeline | Capture pipeline, idempotent full pipeline, and processing retry/error screen are shipped. |
| API observability | Sentry scaffold and OpenTelemetry code path are shipped; live exporters require human secrets. |
| Mobile | Expo capture flow and EAS profiles are shipped; store credentials and EAS project initialization are human-owned. |

## Verification

Latest local verification:

```bash
pnpm run ci
```

Result: exits 0 with 105 Vitest files and 443 tests passing.

Bare `pnpm ci` exits `ERR_PNPM_CI_NOT_IMPLEMENTED` on pnpm 9.15.4; use
`pnpm run ci` for the repository gate.
