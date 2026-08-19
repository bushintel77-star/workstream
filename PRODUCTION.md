# Workstream — production

Live stack. Product: **Workstream**. Studio on artefacts: **Curtis & Co**.

## URLs

| Surface | URL |
|---------|-----|
| API | https://api-production-a8ff1.up.railway.app |
| Web portal | https://web-production-3c194.up.railway.app |
| API health | https://api-production-a8ff1.up.railway.app/healthz |
| API ready | https://api-production-a8ff1.up.railway.app/readyz |

Railway services: `web-production-3c194` (web) and `api-production-a8ff1`
(API). API durability volume `api-volume` mounts at
`/repo/apps/api/data` (`CONSTRUCT_PERSIST_PATH=…/store.json`,
`CONSTRUCT_SQLITE_PATH=…/store.sqlite3`).

`PORTAL_BASE_URL` defaults to the Railway web host so magic links and
deposit checkout callbacks resolve to the live client portal. Override it
only when a custom portal domain is live.

## Current auth mode

`AUTH_REQUIRED=false` — open operator loop with shared `dev-user` until
Clerk keys are provisioned. The web shell shows a persistent dev-mode
banner whenever this fallback is active.

To lock down, set in the Railway dashboard (or `railway variables` CLI):

```
CLERK_SECRET_KEY=sk_live_…
AUTH_REQUIRED=true
PUBLIC_API_URL=https://api-production-a8ff1.up.railway.app
CORS_ORIGIN=https://web-production-3c194.up.railway.app
```

On the web service:

```
CLERK_SECRET_KEY=sk_live_…
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_…
AUTH_REQUIRED=true
```

Redeploy web after setting `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (build-time
for middleware).

## Operator loop (automated)

1. **Mobile** — new project → confirm pin on aerial → record walkthrough → upload.
2. **API** — `capture-pipeline` runs transcribe → survey → design → costing → audit.
3. **Mobile** — processing screen polls until `survey_review` / hub stages.
4. **Web** — project hub, outputs, client quote/deposit portals.

## Secrets still needed for full AI + maps

| Secret | Service | Effect if missing |
|--------|---------|-------------------|
| `OPENAI_API_KEY` | API | Canned transcript |
| `ANTHROPIC_API_KEY` | API | Mock design/audit |
| `STRIPE_SECRET_KEY` | API | Deposit checkout uses dev fallback |
| `STRIPE_WEBHOOK_SECRET` | API | Stripe webhooks accept dev-mode unsigned payloads |
| `CLERK_*` | both | Dev-user mode (current) |
| `PUBLIC_API_URL` | API | API readiness and generated absolute URLs may be incorrect |
| `CORS_ORIGIN` | API | Browser calls from the web app may be rejected |
| `WORKSTREAM_PORTAL_SECRET` | API | Rotate from legacy `CONSTRUCT_PORTAL_SECRET` |
| `PORTAL_BASE_URL` | API | Defaults to Railway web host; override only for a custom portal domain |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | API | OpenTelemetry spans stay local/no-op |
| `REDIS_URL` | API | Pipeline runs inline instead of worker queue |
| `SENTRY_DSN` | both | Errors are logged but not reported to Sentry |
| `LITESTREAM_*` | API | No object-store disaster-recovery replica |

## Human ops runbook

Use [docs/HUMAN-OPS-RUNBOOK.md](docs/HUMAN-OPS-RUNBOOK.md) for copy-paste
steps covering Clerk, Redis, Sentry, OpenTelemetry, EAS, Litestream, and
branch protection.

Local verification uses `pnpm run ci`. Literal `pnpm ci` is not implemented
by pnpm 9.15.4 in this workspace.

## Deploy

Railway deploys automatically on push to `main`. To deploy manually or
from a branch, use the Railway CLI:

```bash
railway up
```

Or trigger a redeploy from the Railway dashboard.

## Mobile production build

```bash
cd apps/mobile
eas build --platform ios --profile production
```

Set in EAS production env:

- `EXPO_PUBLIC_API_URL=https://api-production-a8ff1.up.railway.app`
- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` (when auth enabled)
- `EXPO_PUBLIC_AUTH_REQUIRED=true` (after Clerk cutover)

Bundle ID: `com.curtisandco.workstream`

## Smoke checks

```bash
pnpm run ci
curl -s https://api-production-a8ff1.up.railway.app/healthz
curl -s https://api-production-a8ff1.up.railway.app/readyz
curl -s -o /dev/null -w "%{http_code}\n" https://web-production-3c194.up.railway.app/
curl -s -o /dev/null -w "%{http_code}\n" https://api-production-a8ff1.up.railway.app/uploads/test.mp3
```

Expect API health/ready `ok`, web `200`/redirect, and protected uploads to
return `401` for existing unauthenticated objects or `404` when the requested
object is absent.
