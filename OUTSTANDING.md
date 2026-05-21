# Production punch list

Product: **Workstream**. Studio: **Curtis & Co**. See [CONSOLIDATION.md](CONSOLIDATION.md).

## P0 — Blocks first paying customer

- [x] **Persistence on Fly** — volume `workstream_data`, `min_machines_running = 1`, CI runs `fly scale count 1`.
- [x] **Auth (code)** — Clerk required in production on API, web, mobile.
- [ ] **Fly secrets** — Clerk, OpenAI, Anthropic, Mapbox on `construct-api` / `construct-web` (see [PRODUCTION.md](PRODUCTION.md)).
- [x] **Fly deploy (construct-*)** — API + web live; `AUTH_REQUIRED=false` staging mode.
- [ ] **Cutover from legacy** — retire `construct-api` / `construct-web` hostnames when new apps are live.
- [x] **Secret scanning** — gitleaks in CI.
- [x] **Stripe key validation on save**.
- [ ] **Sentry DSN** on both Fly apps (`@sentry/node` on API; add `@sentry/nextjs` on web when ready).

## Commercial

- [x] **Plans doc** — Lite = 1 user free + dev fallbacks; Studio = paid live integrations ([docs/PLANS.md](docs/PLANS.md)).
- [x] **Integration hub** — CRM webhook, Resend email, MYOB/Xero/Stripe/AI keys in Settings; event log ([docs/INTEGRATIONS.md](docs/INTEGRATIONS.md)).
- [x] **Plan gating (code)** — `WorkspaceBilling` lite/studio; live connectors only on Studio; dev upgrade endpoint.
- [x] **Stripe Studio checkout** — `STRIPE_STUDIO_PRICE_ID` + webhook activates Studio.
- [ ] **Stripe per-seat** — extra seat price + Clerk org enforcement.
- [ ] **Extra seats** — Clerk org + seat limit enforcement.

## P1 — Quality + scale

- [ ] **Mobile distribution** — EAS production build + TestFlight.
- [ ] **BullMQ + Redis** — `REDIS_URL` + `pnpm start:worker` on a worker machine.
- [ ] **Litestream → R2** — DR for JSON snapshot.
- [x] **CI deploy** — `.github/workflows/ci.yml` deploys `workstream-api` + `workstream-web` on `main`.
- [x] **Dependabot** — `.github/dependabot.yml`.
- [ ] **Branch protection on `main`**.
- [x] **Playwright e2e** — design studio + asset upload (`apps/web/e2e/design-studio.spec.ts`, `pnpm test:e2e`).
- [ ] **Contract tests** — all route responses through Zod.
- [x] **capture-pipeline test** — `capture-pipeline.test.ts`.
- [ ] **Visual regression** on HTML outputs.
- [x] **Design studio phase 1** — catalog + canvas API, web drag-drop, mobile tap-to-place ([docs/DESIGN_STUDIO.md](docs/DESIGN_STUDIO.md)).
- [x] **Design asset widget library** — 18 visual plants/hardscape/structure glyphs, category tabs, search (web + mobile).
- [x] **Design studio phase 2** — OSS freehand: perfect-freehand (web + mobile `CanvasStroke`).
- [x] **Design studio phase 3** — quote/scope site-plan table from canvas placements + SKU.
- [x] **Design asset admin** — Settings → Design assets, POST/DELETE `/catalog/symbols`.

## Human actions (Fly / GitHub / Apple)

```bash
flyctl apps create workstream-api   # or launch per DEPLOY.md
flyctl volumes create workstream_data -a workstream-api --region syd --size 1
flyctl secrets set … -a workstream-api
flyctl secrets set … -a workstream-web
gh secret set FLY_API_TOKEN
eas init   # set projectId in app.json extra.eas
```
