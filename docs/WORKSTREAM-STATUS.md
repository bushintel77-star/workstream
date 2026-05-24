# Workstream status

Generated 2026-05-24. Product: Workstream. Studio brand: Curtis & Co.

## Shipped in this session

- Current gap matrix: `docs/GAP-ANALYSIS-CURRENT.md` (`33fdfea`).
- API OpenTelemetry scaffold and provider spans for Anthropic, OpenAI, and Mapbox (`ce198e0`).
- Portal route fetches moved out of the `server-only` operator API module; quote/deposit portal routes now declare edge runtime and branded loading states (`46161c4`).
- Mobile EAS placeholder removed from `app.json`; CI now checks mobile placeholders and portal `fs` imports (`97df9a4`).
- API contract test harness now registers the broader route surface and adds smoke coverage for geocode, ops tabs, integrations, accounting, catalog, suppliers, and validation paths (`0c78e17`).
- Web loading states improved for settings plus design/costing project tabs (`4465787`).
- Litestream setup and human operations runbook added.
- Client portal deposit links now use separate checkout-scoped tokens, signed
  token routes accept HMAC tokens with dots, and portal success/cancel/error
  states are branded (`9de3ed7`, `443761d`).
- Contract tests now cover carbon smoke and quote-to-deposit portal token flow
  (`677b543`, `0af85c0`).
- Portal checkout URLs now default to the production web app instead of
  localhost, and portal cost figures render with cents (`fd23e08`).

## Human-owned before first paying customer

- Clerk live keys on `construct-api` and `construct-web`, then redeploy `construct-web`.
- Redis URL and one Fly worker process for async pipeline.
- Sentry DSNs on both apps; add `@sentry/nextjs` to `apps/web` when enabling.
- One API machine until the JSON snapshot store is replaced.
- EAS init plus Apple/Google store credentials.
- Branch protection on `main` after GitHub Pro is enabled.
- Optional OTLP endpoint for tracing export.

## Current verification baseline

- Literal `pnpm ci` is not implemented by pnpm 9 in this environment.
- `pnpm run ci` passed after implementation with 128 tests.
- `pnpm lint`, `pnpm mobile:check-placeholders`, and the portal edge import
  guard passed.
- `pnpm test:e2e` passed after installing Playwright Chromium in the runner.
- Production smoke: `/healthz` and `/readyz` returned `ok`; the requested
  `/uploads/test.mp3` probe returned `404` because that object does not exist.

## Roadmap

- Finish human ops checklist in `docs/HUMAN-OPS-RUNBOOK.md`.
- Enable Litestream sidecar after R2 or B2 credentials exist.
- Keep Design Studio Phase 6 AI assist deferred until proposal, model cost, and review gates are approved.
- Keep PostgreSQL migration out of scope until the JSON snapshot path is replaced intentionally.

