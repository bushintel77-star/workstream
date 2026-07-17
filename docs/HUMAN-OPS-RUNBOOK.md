# Production human ops runbook

One-time and recurring operator steps that cannot be automated from code. Run from a machine with `flyctl`, `eas`, and GitHub admin access.

## Fly.io — API single writer

```powershell
flyctl scale count 1 -a construct-api
flyctl status -a construct-api
```

## Clerk auth (api + web)

```powershell
flyctl secrets set CLERK_SECRET_KEY="sk_…" -a construct-api
flyctl secrets set CLERK_SECRET_KEY="sk_…" NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_…" -a construct-web
```

Redeploy both apps after setting secrets.

## Redis + BullMQ worker

1. Provision Upstash or Fly Redis; copy connection URL.
2. `flyctl secrets set REDIS_URL="redis://…" -a construct-api`
3. `flyctl scale count worker=1 -a construct-api`

## Sentry

```powershell
flyctl secrets set SENTRY_DSN="https://…" -a construct-api
flyctl secrets set SENTRY_DSN="https://…" -a construct-web
```

Web also needs: `pnpm add @sentry/nextjs --filter @workstream/web` when enabling client capture.

## EAS / mobile distribution

```powershell
cd apps/mobile
npx eas-cli init
npx eas-cli build --profile preview --platform all
npx eas-cli submit --profile production
```

Set in EAS secrets / `eas.json`:

- `EXPO_PUBLIC_API_URL=https://construct-api.fly.dev`
- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_…`

Replace `REPLACE_WITH_*` placeholders in [apps/mobile/eas.json](../apps/mobile/eas.json) with Apple/Google credentials.

## GitHub branch protection

Settings → Branches → require CI green on `main` (needs GitHub Pro on private repos).

## Verify after deploy

```powershell
curl -sS https://construct-api.fly.dev/healthz
pnpm -w typecheck
pnpm vitest run
```
