# Production human ops runbook

Copy-paste-ready steps for the operator actions that require credentials,
platform admin access, paid accounts, or production deployment authority. Do not
run these from an automation sandbox.

## Clerk Authentication

### Step 1: Create Clerk application

1. Go to <https://clerk.com> and create an application.
2. Name: `Workstream`
3. Auth methods: Email and Google.
4. Copy:
   - Secret Key: `sk_live_...`
   - Publishable Key: `pk_live_...`

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

`NEXT_PUBLIC_` variables are build-time inputs for the web image.

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
# Expect 302 redirect to /sign-in when auth is live.
```

## Redis Worker

### Step 1: Provision Redis

Option A - Upstash, recommended for Fly:

1. Go to <https://upstash.com>.
2. Create database.
3. Region: Sydney or nearest available Australian region.
4. Copy the Redis URL, usually `rediss://...`.

Option B - Fly Redis:

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

1. Go to <https://sentry.io>.
2. Create a Node.js project for `construct-api`.
3. Create a Next.js project for `construct-web`.
4. Copy both DSNs.

### Step 2: Install web package when enabling client capture

```bash
pnpm --filter @workstream/web add @sentry/nextjs
```

### Step 3: Set secrets

```bash
flyctl secrets set SENTRY_DSN="https://PASTE_API_DSN@sentry.io/..." -a construct-api
flyctl secrets set SENTRY_DSN="https://PASTE_WEB_DSN@sentry.io/..." -a construct-web
```

### Step 4: Redeploy both apps

```bash
./scripts/deploy-fly.sh
```

On Windows:

```powershell
.\scripts\deploy-fly.ps1
```

## Fly Machine Count (snapshot consistency)

The current store is a JSON snapshot on a Fly volume. Keep the API app
single-writer until SQLite/Postgres migration lands.

```bash
flyctl scale count 1 -a construct-api

flyctl status -a construct-api
# Expect: 1 machine running.
```

## Mobile TestFlight and Play Store

### Step 1: EAS init

```bash
cd apps/mobile
npx eas-cli init
```

This writes `expo.extra.eas.projectId` into `apps/mobile/app.json` for the real
EAS project. `app.json` must not contain `REPLACE_AFTER_eas_init`.

### Step 2: Apple credentials

Requires an Apple Developer account.

1. In Apple Developer Portal, create App ID `com.curtisandco.workstream`.
2. Run:

```bash
npx eas-cli credentials --platform ios
```

### Step 3: Build for TestFlight

```bash
npx eas-cli build --platform ios --profile production
```

### Step 4: Submit to TestFlight

```bash
npx eas-cli submit --platform ios
```

### Step 5: Android internal track

1. Create Play Console app with package `com.curtisandco.workstream`.
2. Create and download a service account JSON key.
3. Save it at `apps/mobile/google-service-account.json` or adjust
   `apps/mobile/eas.json`.
4. Run:

```bash
npx eas-cli build --platform android --profile production
npx eas-cli submit --platform android
```

### Step 6: Replace EAS submit placeholders

Update `apps/mobile/eas.json`:

- `REPLACE_WITH_APPLE_ID`
- `REPLACE_WITH_APP_STORE_CONNECT_ID`
- `REPLACE_WITH_APPLE_TEAM_ID`
- `google-service-account.json`

## External API Keys

Set only the keys the business is ready to use live. Missing AI and map keys use
safe development fallbacks, but live customer operation should configure them.

```bash
flyctl secrets set \
  OPENAI_API_KEY="sk-PASTE_HERE" \
  ANTHROPIC_API_KEY="sk-ant-PASTE_HERE" \
  MAPBOX_TOKEN="pk.PASTE_HERE" \
  WORKSTREAM_PORTAL_SECRET="$(openssl rand -hex 32)" \
  -a construct-api
```

## OpenTelemetry exporter

The API starts OpenTelemetry only when `OTEL_EXPORTER_OTLP_ENDPOINT` is present.
Use the OTLP HTTP endpoint from the chosen collector or observability vendor; do
not hardcode it in source.

```bash
flyctl secrets set \
  OTEL_EXPORTER_OTLP_ENDPOINT="https://otel-collector.example.com" \
  -a construct-api
```

Verify after deploy:

```bash
flyctl logs -a construct-api | grep "telemetry"
```

## Litestream backups

Use [docs/LITESTREAM-SETUP.md](LITESTREAM-SETUP.md) for complete R2 and B2
bucket setup. Minimum operator sequence:

1. Create an R2 or B2 bucket dedicated to Workstream backups.
2. Create access keys with read/write permissions for that bucket only.
3. Copy `docs/litestream.example.yml` into the deployment image or sidecar
   configuration path selected in the setup guide.
4. Set Fly secrets for the selected backend credentials.
5. Add the Litestream process/sidecar stanza documented in
   `docs/LITESTREAM-SETUP.md`.
6. Restore into a scratch volume before trusting the backup path.

## Branch Protection

Requires GitHub Pro for private repository branch rules.

1. Go to <https://github.com/Boringuy7799/workstream/settings/branches>.
2. Add rule.
3. Branch name pattern: `main`.
4. Enable:
   - Require status checks to pass before merging.
   - Select `typecheck`, `playwright e2e`, `build api docker image`, and
     `build web docker image`.
   - Require branches to be up to date before merging.
   - Include administrators.
5. Save.

## Final production smoke

```bash
curl -sS https://construct-api.fly.dev/healthz
curl -sS https://construct-api.fly.dev/readyz
curl -sS -o /dev/null -w "%{http_code}\n" \
  https://construct-api.fly.dev/uploads/test.mp3
```

Expect API health/ready `ok`. The protected upload smoke should return `401` for
an existing unauthenticated object once auth is enabled, or `404` if the test
object does not exist.
