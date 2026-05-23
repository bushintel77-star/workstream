# Production punch list

Living doc of work between today's state and gold-standard
end-to-end production. Owned alongside the codebase; tick items as PRs land.

**Gap analysis (detailed):** [docs/GAP-ANALYSIS.md](docs/GAP-ANALYSIS.md)

## P0 — Blocks first paying customer

- [x] **Persistence on Fly** — `[mounts]` block live in
      [apps/api/fly.toml](apps/api/fly.toml) against `construct_data_v2`.
      Run `flyctl scale count 1 -a construct-api` after deploy.
- [x] **Auth on (code)** — Clerk middleware + `<ClerkProvider>` + server-side
      `requireSignedIn()` gate on the dashboard. Opt-in via `CLERK_SECRET_KEY`;
      dev mode unchanged. Still needs Clerk Fly secrets set on `construct-web`
      (`CLERK_SECRET_KEY` + `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`).
- [x] **CORS_ORIGIN** Fly secret on construct-api → `https://construct-web.fly.dev`
- [x] **NEXT_PUBLIC_API_URL** baked into web Docker build + CI `--build-arg`.
- [x] **Build automation** — `pnpm ci`, `pnpm build:docker`, `docker-compose.yml`,
      `scripts/deploy-fly.*`, CI smoke tests, `workflow_dispatch` deploy.
- [x] **Secret scanning** — gitleaks GitHub Action at
      [.github/workflows/gitleaks.yml](.github/workflows/gitleaks.yml).
- [x] **Stripe key validation on save** — `GET /v1/balance` round-trip wired in
      [apps/api/src/routes/settings.ts](apps/api/src/routes/settings.ts) via
      `validateStripeKey()`; rejects bad keys with Stripe's own error message.
- [x] **Sentry scaffold (code)** — API [`sentry.ts`](apps/api/src/lib/sentry.ts) +
      web [`instrumentation.ts`](apps/web/src/instrumentation.ts). **Human:** set
      `SENTRY_DSN` on both Fly apps + `pnpm add @sentry/nextjs` on web when enabling.

## P1 — Quality + scale

- [ ] **Mobile distribution** — `eas build:configure`, replace
      `REPLACE_AFTER_eas_init` in `app.json`, TestFlight / APK. `eas.json` profiles
      exist; needs Apple/Google credentials in submit block.
- [x] **BullMQ + Redis (code path)** — worker in [`queue.ts`](apps/api/src/lib/queue.ts),
      `[processes] worker` in `fly.toml`, pipeline enqueues when `REDIS_URL` set.
      **Human:** provision Upstash/Fly Redis + `fly scale count worker=1`.
- [x] **Litestream → R2/B2 (template)** — [`docs/litestream.example.yml`](docs/litestream.example.yml).
      **Human:** bucket + Fly sidecar or export job.
- [x] **CI deploy job** — split `deploy-api` + `deploy-web`; `FLY_API_WEB` wired.
- [x] **Dependabot** — enabled for pnpm + GitHub Actions.
- [ ] **Branch protection on `main`** — requires **GitHub Pro** on private repo (403
      from API). Enable manually: Settings → Branches → require CI green.
- [x] **Playwright e2e** — `design-studio.spec.ts`, `operator-happy-path.spec.ts`;
      CI job `playwright e2e` on PR + main.
- [x] **Contract tests (core)** — Zod boundary tests + [`contract.test.ts`](apps/api/src/routes/contract.test.ts)
      (health + projects). Extend per route as APIs stabilise.
- [x] **Unit tests on pipeline jobs** — survey, cost, design, audit, pipeline
      (`*-job.test.ts`, `pipeline-job.test.ts`).
- [x] **Visual regression (quote markdown)** — snapshot in `output-generators.test.ts`.
- [x] **Tier-1 costing parity** — standard scenario locks to `$58,410.35` via
      `ALW-TIER1-ALIGN` in [`cost-job.ts`](apps/api/src/lib/cost-job.ts).

## P2 — Scale + cost

- [ ] **Multi-tenant authorization** — per-owner store queries on every route.
- [x] **ESLint (initial)** — root [`eslint.config.mjs`](eslint.config.mjs); CI `pnpm lint`
      on api/web/domain/contracts. Mobile/ui excluded until RN rules land.
- [ ] **OpenTelemetry tracing** API → Anthropic / OpenAI / Mapbox.
- [x] **Real-user monitoring (web scaffold)** — Sentry web instrumentation; needs DSN.
- [ ] **Audio compression** before upload (opus quality cap).
- [ ] **Edge runtime** for `/portal/*` pages.
- [ ] **Soft delete + audit trail** on every destructive action.
- [ ] **Idempotency keys** on pipeline POSTs.

## P3 — Nice to have

- [ ] Storybook for web primitives.
- [x] **Local docker-compose** — [docker-compose.yml](docker-compose.yml).
- [ ] Bundle-size budget in CI.
- [ ] PostgreSQL migration once the data model stabilises.
- [ ] Multi-region Fly deploy for HA.

## Aerial Design Studio (separate track)

See [`AERIAL_DESIGN_STUDIO_AGENT_BRIEF.md`](AERIAL_DESIGN_STUDIO_AGENT_BRIEF.md),
[`RECON.md`](RECON.md), [`PROPOSAL.md`](PROPOSAL.md) (AI Phase 6 deferred).

- [x] Phase 2 brand re-skin (Aegis tokens)
- [ ] Phases 3–8 layout, palette, modeless canvas, honesty UI, docs

## Human-only checklist (not code)

| Action | Command / where |
|--------|-----------------|
| Clerk on Fly | `flyctl secrets set CLERK_* -a construct-api` / `construct-web` |
| Sentry DSN | `flyctl secrets set SENTRY_DSN=…` both apps |
| Redis worker | `REDIS_URL` + `fly scale count worker=1 -a construct-api` |
| EAS project | `cd apps/mobile && eas init` |
| Branch protection | GitHub repo Settings (Pro plan) |
| Fly tokens | `FLY_API_TOKEN` + `FLY_API_WEB` — **done** |

## Sandbox-blocked actions (need the user)

- `flyctl scale count 1 -a construct-api` (if not already)
- `flyctl secrets deploy` after staging new secrets
- Valid Apple / Google credentials for EAS submit
