# Workstream status

Generated 2026-05-24 for the gold-standard automation audit.

## Shipped this session

- Current gap matrix added at `docs/GAP-ANALYSIS-CURRENT.md`.
- API OpenTelemetry scaffold added behind `OTEL_EXPORTER_OTLP_ENDPOINT`.
- External Anthropic, OpenAI Whisper, and Mapbox calls emit spans with project,
  operator, pipeline stage, model, and token attributes where available.
- Portal quote/deposit routes now declare Edge runtime.
- Contract smoke coverage expanded to geocode, catalog, supplier, and project
  context routes; telemetry unit coverage added.
- Mobile EAS project placeholder removed from `app.json`; CI now fails if the
  old placeholder returns.
- Litestream setup promoted to documented R2/B2 backup runbook.
- Web shell typography moved to IBM Plex tokens and dev auth mode now displays a
  persistent warning banner.
- Human ops runbook created at `docs/HUMAN-OPS-RUNBOOK.md`.
- Strict ready-for-review follow-up (`4461b28`): route telemetry now annotates
  current non-`/v1` API routes, dictation Anthropic calls emit spans, protected
  file portal scopes are tightened, tombstoned project assets are blocked,
  brochure output is no longer exposed as a dead action, portal quotes show the
  confidential watermark and gate deposits until costing exists, and processing
  retry calls the real pipeline restart endpoint.
- Gold-standard hardening (`f00a98e`, `339361b`): route spans now preserve active
  context, provider spans retain token usage through response body reads, aerial
  image fetches and BullMQ jobs are traced, worker shutdown flushes telemetry,
  protected-file/studio/orchestration/webhook contract smokes were added, the
  dashboard regained AppNav, filters, date/name sorting, delete undo, and a
  designed empty state, canvas modes enforce progressive locks, autosave Retry is
  clickable, and the dev-auth banner is global.

## Still human-owned

- Clerk live application and Fly secrets for `construct-api` and `construct-web`.
- Redis URL and Fly worker process scale-up.
- Sentry DSNs and optional web `@sentry/nextjs` enablement.
- Single API machine scale command for JSON snapshot consistency.
- EAS init plus Apple and Google distribution credentials.
- Branch protection on `main` after GitHub Pro is enabled.
- External OpenAI, Anthropic, Mapbox, Stripe, portal, OpenTelemetry, and
  Litestream object-store secrets.

## Product status

| Area | Status |
|------|--------|
| Operator dashboard | Shipped; filters, date/name sorting, delete undo, designed empty state, and shared nav are wired. |
| Project hub | Shipped tabs for survey, design, costing, audit, outputs, filing, tasks, recordings, measurements, and carbon. |
| Client portal | Shipped quote/deposit portal with graceful invalid-link handling; now Edge runtime. |
| Design Studio | Phase 1 recon plus Phases 2-5, 7, and 8 shipped; Phase 6 AI assist remains intentionally deferred. |
| Pipeline | Capture pipeline, idempotent full pipeline, and processing screen are shipped. |
| API observability | Sentry scaffold and OpenTelemetry code path shipped; live exporters require human secrets. |
| Mobile | Expo app, capture flow, and EAS profiles shipped; store credentials are human-owned. |

## Verification

Latest local verification:

```bash
pnpm run ci
pnpm mobile:check-placeholders
pnpm web:check-portal-edge
```

Result: `pnpm run ci` exits 0 with 102 Vitest files and 430 tests passing.
Literal `pnpm ci` exits with `ERR_PNPM_CI_NOT_IMPLEMENTED` on pnpm 9.15.4.
