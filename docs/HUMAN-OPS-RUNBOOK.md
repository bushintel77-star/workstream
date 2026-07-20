# Production human ops runbook

One-time and recurring operator steps that require live platform access. Do not
paste real secrets into git; run these commands from a trusted terminal with
`flyctl`, `pnpm`, `openssl`, and `eas-cli` available.

## Clerk authentication

### Step 1: Create Clerk application

1. Go to <https://clerk.com> and create an application.
One-time operator steps that require live credentials or platform admin access.
Do not commit any secret values to this repository.

## Clerk Authentication

### Step 1: Create Clerk application

1. Go to https://clerk.com and create an application.
2. Name: `Workstream`.
3. Auth methods: Email and Google.
4. Copy the live Secret Key (`sk_live_...`) and Publishable Key (`pk_live_...`).

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

`NEXT_PUBLIC_*` values are baked into the Next.js build, so redeploy web after
setting the publishable key.
`NEXT_PUBLIC_` variables are build-time values for the web image.

```bash
flyctl deploy --config apps/web/fly.toml \
  --dockerfile apps/web/Dockerfile \
  -a construct-web \
  --build-arg NEXT_PUBLIC_API_URL=https://construct-api.fly.dev \
  --build-arg NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_PASTE_HERE
```

### Step 4: Verify

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://construct-web.fly.dev/
```

Expect `200` for an authenticated session or a Clerk redirect/sign-in response
for unauthenticated access.

## Redis worker

### Step 1: Provision Redis

Option A — Upstash, recommended for Fly:

1. Go to <https://upstash.com>.
2. Create a Redis database in or near Sydney.
3. Copy the Redis URL (`rediss://...`).

Option B — Fly Redis:
curl -s -o /dev/null -w "%{http_code}" https://construct-web.fly.dev/dashboard
# Expect 302 redirect to /sign-in when auth is live.
```

## Redis Worker

### Step 1: Provision Redis

Option A - Upstash, recommended for Fly:

1. Go to https://upstash.com.
2. Create a Redis database in the Sydney region.
3. Copy the Redis URL (`rediss://...`).

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
```

Expect a BullMQ worker start message.

## Sentry error monitoring

### Step 1: Create Sentry projects

1. Go to <https://sentry.io>.
2. Create one Node.js project for `construct-api`.
3. Create one Next.js project for `construct-web`.
4. Copy both DSNs.

### Step 2: Install web package when enabling browser capture

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
flyctl deploy --config apps/api/fly.toml --dockerfile apps/api/Dockerfile -a construct-api
flyctl deploy --config apps/web/fly.toml --dockerfile apps/web/Dockerfile -a construct-web \
  --build-arg NEXT_PUBLIC_API_URL=https://construct-api.fly.dev
```

## Fly machine count

Keep the JSON snapshot store single-writer until the database migration lands.

### Step 4: Verify

```bash
flyctl logs -a construct-api | grep "worker"
# Expect: "[worker] BullMQ worker listening on workstream-pipeline"
```

## Sentry Error Monitoring

### Step 1: Create Sentry projects

1. Go to https://sentry.io.
2. Create a Node.js project for `construct-api`.
3. Create a Next.js project for `construct-web`.
4. Copy both DSNs.

### Step 2: Install web package when enabling browser capture

```bash
pnpm --filter @workstream/web add @sentry/nextjs
```

### Step 3: Set secrets

```bash
flyctl secrets set SENTRY_DSN="https://PASTE_API_DSN@sentry.io/PROJECT" -a construct-api
flyctl secrets set SENTRY_DSN="https://PASTE_WEB_DSN@sentry.io/PROJECT" -a construct-web
```

### Step 4: Redeploy both apps

```bash
./scripts/deploy-fly.sh
```

## Fly Machine Count

Keep the API as a single writer while JSON snapshot persistence is active.

```bash
flyctl scale count 1 -a construct-api
flyctl status -a construct-api
```

Expect one running API machine.

# Expect: 1 app machine running for construct-api.
```

## Mobile TestFlight and Play Store

### Step 1: EAS init

```bash
cd apps/mobile
npx eas-cli init
```

This writes the real EAS `projectId` into `apps/mobile/app.json`.
This writes the real EAS project ID into `apps/mobile/app.json`.

### Step 2: Apple credentials

Requires an Apple Developer account.

1. In Apple Developer Portal, create App ID `com.curtisandco.workstream`.
2. Run:

```bash
eas credentials --platform ios
```

### Step 3: iOS build and submit
### Step 3: Build for TestFlight

```bash
eas build --platform ios --profile production
eas submit --platform ios
```

### Step 4: Android build and submit

1. Create a Play Console app for package `com.curtisandco.workstream`.
2. Create/download the service account JSON expected by `apps/mobile/eas.json`.
### Step 4: Android Play Store

1. Create a Google Play app for package `com.curtisandco.workstream`.
2. Place the service-account file at `apps/mobile/google-service-account.json`
   or update `apps/mobile/eas.json` with the chosen path.
3. Run:

```bash
eas build --platform android --profile production
eas submit --platform android
```

## External API keys

Set these on the API app when moving from dev fallbacks to live integrations.
## External API Keys

Set live AI, map, Stripe, portal, and telemetry secrets on the API app.

```bash
flyctl secrets set \
  OPENAI_API_KEY="sk-PASTE_HERE" \
  ANTHROPIC_API_KEY="sk-ant-PASTE_HERE" \
  MAPBOX_TOKEN="pk.PASTE_HERE" \
  WORKSTREAM_PORTAL_SECRET="$(openssl rand -hex 32)" \
  OTEL_EXPORTER_OTLP_ENDPOINT="https://PASTE_OTEL_COLLECTOR_ENDPOINT" \
  -a construct-api
```

Do not hardcode the OpenTelemetry endpoint. Use the endpoint issued by the
chosen collector or observability platform.

## Stripe deposits

1. Create a Stripe account and switch to live mode.
2. Copy the live secret key.
3. Set the API secret:

```bash
flyctl secrets set STRIPE_SECRET_KEY="sk_live_PASTE_HERE" -a construct-api
```

4. Verify the key in Workstream Settings → Integrations → Stripe.

## Litestream object-store backup

Follow [LITESTREAM-SETUP.md](LITESTREAM-SETUP.md) for Cloudflare R2 or Backblaze
B2 bucket setup and Fly sidecar wiring.

## Branch protection

Requires GitHub Pro for private repositories.

1. Go to <https://github.com/Boringuy7799/workstream/settings/branches>.
  STRIPE_SECRET_KEY="sk_live_PASTE_HERE" \
  STRIPE_WEBHOOK_SECRET="whsec_PASTE_HERE" \
  WORKSTREAM_PORTAL_SECRET="$(openssl rand -hex 32)" \
  OTEL_EXPORTER_OTLP_ENDPOINT="https://PASTE_OTLP_COLLECTOR_BASE_URL" \
  -a construct-api
```

The OpenTelemetry SDK appends `/v1/traces` automatically if the endpoint omits it.

## Litestream object-store backups

Use Cloudflare R2 or Backblaze B2 for the disaster-recovery replica. Full setup
details live in [LITESTREAM-SETUP.md](LITESTREAM-SETUP.md).

### Step 1: Set object-store secrets

```bash
flyctl secrets set \
  LITESTREAM_BUCKET="workstream-dr" \
  LITESTREAM_S3_ENDPOINT="https://PASTE_ENDPOINT" \
  LITESTREAM_S3_REGION="auto" \
  LITESTREAM_ACCESS_KEY_ID="PASTE_ACCESS_KEY_ID" \
  LITESTREAM_SECRET_ACCESS_KEY="PASTE_SECRET_ACCESS_KEY" \
  -a construct-api
```

### Step 2: Add sidecar process in `apps/api/fly.toml`

```toml
[processes]
  app = "node dist/server.js"
  worker = "node dist/worker.js"
  backup = "litestream replicate -config /etc/litestream.yml"
```

### Step 3: Scale sidecar

```bash
flyctl scale count backup=1 -a construct-api
flyctl logs -a construct-api | grep "litestream"
```

## Branch Protection

Requires GitHub Pro for private repositories.

1. Go to https://github.com/Boringuy7799/workstream/settings/branches.
2. Add a branch protection rule.
3. Branch name pattern: `main`.
4. Enable:
   - Require status checks to pass before merging.
   - Select the CI checks.
   - Require branches to be up to date before merging.
   - Require branches to be up to date before merging.
   - Select the `CI` checks.
   - Include administrators.
5. Save.

## Verify after deploy

```bash
curl -sS https://construct-api.fly.dev/healthz
curl -sS https://construct-api.fly.dev/readyz
curl -sS -o /dev/null -w "%{http_code}\n" https://construct-api.fly.dev/uploads/test.mp3
pnpm run ci
curl -sS https://construct-api.fly.dev/healthz
curl -sS https://construct-api.fly.dev/readyz
curl -sS -o /dev/null -w "%{http_code}\n" https://construct-api.fly.dev/uploads/test.mp3
# Expect healthz ok, readyz ok, and protected uploads 401 or 404 for absent test asset.
```

Expect API health/ready to return `ok`. Protected file probes return `401`
when the object exists and the caller is unauthenticated, or `404` if the test
object is absent.
