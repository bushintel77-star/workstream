# Human ops runbook

Copy-paste guide for taking Workstream from the current Fly deployment to a
first paying customer. Do not commit any real secret values to the repo.

## Clerk Authentication

### Step 1: Create Clerk application

1. Go to https://clerk.com → Create application.
2. Name: `Workstream` · Auth methods: Email + Google.
3. Copy: Secret Key (`sk_live_…`) + Publishable Key (`pk_live_…`).

### Step 2: Set Fly secrets

```bash
flyctl secrets set \
  CLERK_SECRET_KEY="sk_live_PASTE_HERE" \
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_live_PASTE_HERE" \
  AUTH_REQUIRED=true \
  -a construct-api

flyctl secrets set \
  CLERK_SECRET_KEY="sk_live_PASTE_HERE" \
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_live_PASTE_HERE" \
  AUTH_REQUIRED=true \
  -a construct-web
```

### Step 3: Redeploy web

`NEXT_PUBLIC_` variables require a rebuild.

```bash
flyctl deploy --config apps/web/fly.toml \
  --dockerfile apps/web/Dockerfile \
  -a construct-web \
  --build-arg NEXT_PUBLIC_API_URL=https://construct-api.fly.dev \
  --build-arg NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_PASTE_HERE
```

### Step 4: Verify

```bash
curl -s -o /dev/null -w "%{http_code}" https://construct-web.fly.dev/dashboard
# Expect 302 redirect to /sign-in.
```

## Redis Worker

### Step 1: Provision Redis

Option A — Upstash:

1. Go to https://upstash.com → Create database.
2. Region: Sydney or closest Australian edge.
3. Copy the Redis URL (`rediss://…`).

Option B — Fly Redis:

```bash
flyctl redis create --name workstream-redis --region syd
```

### Step 2: Set secret

```bash
flyctl secrets set REDIS_URL="rediss://PASTE_HERE" -a construct-api
```

### Step 3: Scale worker process

```bash
flyctl scale count worker=1 -a construct-api
```

### Step 4: Verify

```bash
flyctl logs -a construct-api | grep "worker"
# Expect: "[worker] BullMQ worker started"
```

## Sentry Error Monitoring

### Step 1: Create Sentry projects

1. Go to https://sentry.io → New Project.
2. Create one Node.js project for `construct-api`.
3. Create one Next.js project for `construct-web`.
4. Copy both DSNs.

### Step 2: Install web package when enabling

```bash
cd apps/web
pnpm add @sentry/nextjs
```

### Step 3: Set secrets

```bash
flyctl secrets set SENTRY_DSN="https://PASTE_API_DSN@sentry.io/…" -a construct-api
flyctl secrets set SENTRY_DSN="https://PASTE_WEB_DSN@sentry.io/…" -a construct-web
```

### Step 4: Redeploy both apps

```powershell
.\scripts\deploy-fly.ps1
```

## Single API Machine

JSON snapshot persistence must stay single-writer until the database migration.

```bash
flyctl scale count 1 -a construct-api

flyctl status -a construct-api
# Expect: 1 app machine running.
```

## Mobile TestFlight + Play Store

### Step 1: EAS init

```bash
cd apps/mobile
npx eas-cli init
```

Copy the generated project ID into `apps/mobile/app.json` at
`expo.extra.eas.projectId`, replacing the sentinel
`00000000-0000-0000-0000-000000000000`.

### Step 2: Apple credentials

Requires an Apple Developer account.

1. In Apple Developer Portal, create App ID `com.curtisandco.workstream`.
2. Run:

```bash
eas credentials --platform ios
```

### Step 3: Build for TestFlight

```bash
eas build --platform ios --profile production
```

### Step 4: Submit to TestFlight

```bash
eas submit --platform ios
```

### Step 5: Android

```bash
eas build --platform android --profile production
eas submit --platform android
```

## External API Keys

Needed for the full live AI, maps, and portal pipeline.

```bash
flyctl secrets set \
  OPENAI_API_KEY="sk-PASTE_HERE" \
  ANTHROPIC_API_KEY="sk-ant-PASTE_HERE" \
  MAPBOX_TOKEN="pk.PASTE_HERE" \
  WORKSTREAM_PORTAL_SECRET="$(openssl rand -hex 32)" \
  -a construct-api
```

## OpenTelemetry

The API now starts OpenTelemetry only when `OTEL_EXPORTER_OTLP_ENDPOINT` is set.
Use the OTLP HTTP traces endpoint from your observability provider.

```bash
flyctl secrets set \
  OTEL_EXPORTER_OTLP_ENDPOINT="https://PASTE_OTLP_HTTP_TRACES_ENDPOINT" \
  -a construct-api
```

Verify after deploy:

```bash
flyctl logs -a construct-api | grep -i telemetry
```

## Litestream Backups

Follow `docs/LITESTREAM-SETUP.md` after selecting Cloudflare R2 or Backblaze B2.
Set the object-store secrets, add the Fly sidecar process, then scale it:

```bash
flyctl scale count backup=1 -a construct-api
```

## Branch Protection

Requires GitHub Pro for this private repository.

1. Go to https://github.com/Boringuy7799/workstream/settings/branches.
2. Add rule → Branch name pattern: `main`.
3. Enable:
   - Require status checks to pass before merging.
   - Select required check: `ci`.
   - Require branches to be up to date before merging.
   - Include administrators.
4. Save.

## Final Verification

```bash
pnpm run ci
curl -sS https://construct-api.fly.dev/healthz
curl -sS https://construct-api.fly.dev/readyz
curl -sS -o /dev/null -w "%{http_code}\n" \
  https://construct-api.fly.dev/uploads/test.mp3
# Expect: ok / ok / 401
```
