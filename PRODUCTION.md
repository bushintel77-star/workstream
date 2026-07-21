# Workstream — production

Live stack (July 2026). Product: **Workstream**. Studio on artefacts: **Curtis & Co**.

## URLs

| Surface | URL |
|---------|-----|
| API | https://construct-api.fly.dev |
| Web portal | https://construct-web.fly.dev |
| API health | https://construct-api.fly.dev/healthz |
| API ready | https://construct-api.fly.dev/readyz |

Fly app names remain `construct-api` / `construct-web` until cutover to `workstream-*` (see [CONSOLIDATION.md](CONSOLIDATION.md)).

Verified against branch `cursor/workstream-gold-standard-rebuild-970f` on
2026-07-21.

`apps/api/fly.toml` sets `PORTAL_BASE_URL=https://construct-web.fly.dev` so
magic links and deposit checkout callbacks resolve to the live client portal.
Override it only when a custom portal domain is live.

## Current auth mode

`AUTH_REQUIRED=false` on both Fly apps — open operator loop with shared `dev-user` until Clerk keys are provisioned. The web shell now shows a persistent dev-mode banner whenever this fallback is active.

To lock down:

```bash
flyctl secrets set \
  CLERK_SECRET_KEY="sk_live_…" \
  CLERK_PUBLISHABLE_KEY="pk_live_…" \
  AUTH_REQUIRED=true \
  -a construct-api

flyctl secrets set \
  CLERK_SECRET_KEY="sk_live_…" \
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_live_…" \
  AUTH_REQUIRED=true \
  -a construct-web
```

Redeploy web after setting `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (build-time for middleware).

## Operator loop (automated)

1. **Mobile** — new project → confirm pin on aerial → record walkthrough → upload.
2. **API** — `capture-pipeline` runs transcribe → survey → design → costing → audit.
3. **Mobile** — processing screen polls until `survey_review` / hub stages.
4. **Web** — project hub, outputs, client quote/deposit portals.

## Secrets still needed for full AI + maps

| Secret | App | Effect if missing |
|--------|-----|-------------------|
| `OPENAI_API_KEY` | construct-api | Canned transcript |
| `ANTHROPIC_API_KEY` | construct-api | Mock design/audit |
| `MAPBOX_TOKEN` | construct-api | Mock survey imagery |
| `STRIPE_SECRET_KEY` | construct-api | Deposit checkout uses dev fallback |
| `STRIPE_WEBHOOK_SECRET` | construct-api | Stripe webhooks accept dev-mode unsigned payloads |
| `CLERK_*` | both | Dev-user mode (current) |
| `WORKSTREAM_PORTAL_SECRET` | construct-api | Rotate from legacy `CONSTRUCT_PORTAL_SECRET` |
| `PORTAL_BASE_URL` | construct-api | Set in `apps/api/fly.toml`; override only for a custom portal domain |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | construct-api | OpenTelemetry spans stay local/no-op |
| `REDIS_URL` | construct-api | Pipeline runs inline instead of worker queue |
| `SENTRY_DSN` | both | Errors are logged but not reported to Sentry |
| `LITESTREAM_*` | construct-api | No object-store disaster-recovery replica |

## Human ops runbook

Use [docs/HUMAN-OPS-RUNBOOK.md](docs/HUMAN-OPS-RUNBOOK.md) for copy-paste steps covering Clerk, Redis, Sentry, OpenTelemetry, EAS, Litestream, and branch protection.

Local verification uses `pnpm run ci`. Literal `pnpm ci` is not implemented by
pnpm 9.15.4 in this workspace.

## Deploy (one command)

```powershell
.\scripts\deploy-fly.ps1
```

Or per app from repo root:

```bash
flyctl deploy --config apps/api/fly.toml --dockerfile apps/api/Dockerfile -a construct-api
flyctl deploy --config apps/web/fly.toml --dockerfile apps/web/Dockerfile -a construct-web \
  --build-arg NEXT_PUBLIC_API_URL=https://construct-api.fly.dev
```

## Mobile production build

```bash
cd apps/mobile
eas build --platform ios --profile production
```

Set in EAS production env:

- `EXPO_PUBLIC_API_URL=https://construct-api.fly.dev`
- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` (when auth enabled)
- `EXPO_PUBLIC_AUTH_REQUIRED=true` (after Clerk cutover)

Bundle ID: `com.curtisandco.workstream`

## Smoke checks

```bash
pnpm run ci
curl -s https://construct-api.fly.dev/healthz
curl -s https://construct-api.fly.dev/readyz
curl -s -o /dev/null -w "%{http_code}\n" https://construct-web.fly.dev/
curl -s -o /dev/null -w "%{http_code}\n" https://construct-api.fly.dev/uploads/test.mp3
```

Expect API health/ready `ok`, web `200`/redirect, and protected uploads to
return `401` for existing unauthenticated objects or `404` when the requested
object is absent.

Expect `pnpm run ci` to pass with 105 Vitest files and 443 tests. Bare
`pnpm ci` is not implemented by pnpm 9.15.4.
