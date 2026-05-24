# Human ops runbook

Copy-paste guide for taking Workstream from the current code-complete state to a locked-down first paying customer.

## Clerk Authentication

### Step 1: Create Clerk application

1. Go to https://clerk.com → Create application
2. Name: "Workstream" · Auth methods: Email + Google
3. Copy: Secret Key (`sk_live_...`) + Publishable Key (`pk_live_...`)

### Step 2: Set Fly secrets

```bash
flyctl secrets set \
  CLERK_SECRET_KEY="sk_live_PASTE_HERE" \
  CLERK_PUBLISHABLE_KEY="pk_live_PASTE_HERE" \
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
# Expect 302 redirect to /sign-in
```

## Redis Worker

### Step 1: Provision Redis

Option A, Upstash recommended for Fly:

1. Go to https://upstash.com → Create database → Region: Sydney
2. Copy the Redis URL (`rediss://...`)

Option B, Fly Redis:

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
# Expect: "[worker] BullMQ worker started" or "[worker] pipeline worker running"
```

## Sentry Error Monitoring

### Step 1: Create Sentry projects

1. Go to https://sentry.io → New Project
2. Create one Node.js project for `construct-api`
3. Create one Next.js project for `construct-web`
4. Copy both DSNs

### Step 2: Install web package when enabling

```bash
cd apps/web
pnpm add @sentry/nextjs
```

### Step 3: Set secrets

```bash
flyctl secrets set SENTRY_DSN="https://PASTE_API_DSN@sentry.io/..." -a construct-api
flyctl secrets set SENTRY_DSN="https://PASTE_WEB_DSN@sentry.io/..." -a construct-web
```

### Step 4: Redeploy both apps

```powershell
.\scripts\deploy-fly.ps1
```

## OpenTelemetry tracing

### Step 1: Create an OTLP receiver

Use Datadog, Honeycomb, Grafana Cloud, or an OpenTelemetry Collector with OTLP HTTP enabled.

### Step 2: Set the endpoint

Do not hardcode this in the repo.

```bash
flyctl secrets set \
  OTEL_EXPORTER_OTLP_ENDPOINT="https://OTLP_HTTP_ENDPOINT" \
  -a construct-api
```

### Step 3: Verify spans

Run a capture pipeline or geocode search, then check for spans named:

- `openai.audio_transcription`
- `anthropic.generate_design`
- `anthropic.run_audit`
- `mapbox.geocode_address`
- `mapbox.geocode_search`

## Fly Machine Count

The JSON snapshot store is single-writer. Keep API at one app machine until the database migration lands.

```bash
flyctl scale count 1 -a construct-api

flyctl status -a construct-api
# Expect: 1 app machine running
```

## Mobile TestFlight + Play Store

### Step 1: EAS init

```bash
cd apps/mobile
npx eas-cli init
```

This writes the real EAS project ID into `app.json`.

Do not run a production mobile build with `EXPO_PUBLIC_AUTH_REQUIRED=true`
until the Clerk publishable key is also set in the EAS production environment.

### Step 2: Apple credentials

Requires an Apple Developer account.

```bash
eas credentials --platform ios
```

In Apple Developer Portal, create App ID `com.curtisandco.workstream`.

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

Needed for full live pipeline; dev fallbacks work without them.

```bash
flyctl secrets set \
  OPENAI_API_KEY="sk-PASTE_HERE" \
  ANTHROPIC_API_KEY="sk-ant-PASTE_HERE" \
  MAPBOX_TOKEN="pk.PASTE_HERE" \
  WORKSTREAM_PORTAL_SECRET="$(openssl rand -hex 32)" \
  -a construct-api
```

## Litestream backups

Follow `docs/LITESTREAM-SETUP.md` to create an R2 or B2 bucket and configure the Fly sidecar. Do not enable the Litestream process until bucket credentials are set.

## Branch Protection

Requires GitHub Pro for this private repository.

1. Go to https://github.com/Boringuy7799/workstream/settings/branches
2. Upgrade to GitHub Pro if branch protection is unavailable
3. Add rule → Branch name pattern: `main`
4. Enable Require status checks to pass
5. Select `ci`
6. Enable Require branches to be up to date
7. Enable Include administrators
8. Save

