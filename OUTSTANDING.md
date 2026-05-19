# Production punch list

Living doc of work between today's state and gold-standard
end-to-end production. Owned alongside the codebase; tick items as PRs land.

## P0 — Blocks first paying customer

- [x] **Persistence on Fly** — `[mounts]` block live in
      [apps/api/fly.toml](apps/api/fly.toml) against `construct_data_v2`.
      Still needs `flyctl scale count 1 -a construct-api` + deploy.
- [x] **Auth on (code)** — Clerk middleware + `<ClerkProvider>` + server-side
      `requireSignedIn()` gate on the dashboard. Opt-in via `CLERK_SECRET_KEY`;
      dev mode unchanged. Still needs Clerk Fly secrets set on `construct-web`
      (`CLERK_SECRET_KEY` + `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`).
- [ ] **CORS_ORIGIN** Fly secret on construct-api → `https://construct-web.fly.dev`.
- [ ] **NEXT_PUBLIC_API_URL** baked into web Docker build (see `apps/web/Dockerfile`);
      CI deploy passes `--build-arg`. Redeploy `construct-web` after merge.
- [x] **Secret scanning** — gitleaks GitHub Action at
      [.github/workflows/gitleaks.yml](.github/workflows/gitleaks.yml).
- [x] **Stripe key validation on save** — `GET /v1/balance` round-trip wired in
      [apps/api/src/routes/settings.ts](apps/api/src/routes/settings.ts) via
      `validateStripeKey()`; rejects bad keys with Stripe's own error message.
- [ ] **Sentry DSN** — add `SENTRY_DSN` to both apps' Fly secrets. Scaffold is
      in place under `apps/api/src/env.ts`.

## P1 — Quality + scale

- [ ] **Mobile distribution** — `eas build:configure`, then a TestFlight
      preview build. APK for Android sideload.
- [ ] **BullMQ + Upstash Redis** — move pipeline jobs off the HTTP request
      thread.
- [ ] **Litestream → R2/B2** — DR backup of the JSON snapshot.
- [x] **CI deploy job** — `flyctl deploy` on push to `main` when CI is green;
      token via `FLY_API_TOKEN` or `BROKKER` GitHub secret.
- [x] **Dependabot** — enabled for pnpm + GitHub Actions (see open/merged PRs).
- [ ] **Branch protection on `main`** — require CI green.
- [ ] **Playwright e2e** for the operator happy path.
- [ ] **Contract tests** — every API response shape parsed by its Zod schema.
- [ ] **Unit tests on pipeline jobs** (survey, design, cost, audit, output).
- [ ] **Visual regression** on the rendered quote/scope/permit HTML outputs.

## P2 — Scale + cost

- [ ] **Multi-tenant authorization** — per-owner store queries on every route.
- [ ] **Real ESLint configs** per workspace (currently `lint: echo ok`).
- [ ] **OpenTelemetry tracing** API → Anthropic / OpenAI / Mapbox.
- [ ] **Real-user monitoring** on web (Sentry Performance or Plausible).
- [ ] **Audio compression** before upload (opus quality cap).
- [ ] **Edge runtime** for `/portal/*` pages.
- [ ] **Soft delete + audit trail** on every destructive action.
- [ ] **Idempotency keys** on pipeline POSTs.

## P3 — Nice to have

- [ ] Storybook for web primitives.
- [ ] Local `docker-compose` for new contributors.
- [ ] Bundle-size budget in CI.
- [ ] PostgreSQL migration once the data model stabilises.
- [ ] Multi-region Fly deploy for HA.

## Sandbox-blocked actions (need the user)

The sandbox blocked these as production-affecting; they're code-only above but
need a one-time human action to take effect:

- `flyctl scale count 1 -a construct-api`
- `flyctl secrets set CORS_ORIGIN=… -a construct-api`
- `flyctl secrets set CLERK_SECRET_KEY=… -a construct-api`
- `flyctl secrets set SENTRY_DSN=… -a construct-api`
- `flyctl secrets set SENTRY_DSN=… -a construct-web`
- Add `FLY_API_TOKEN` to the GitHub repo secrets.
