# Production human ops runbook

Copy-paste-ready steps for platform work that requires live credentials or
administrator access. Do not commit real secret values to this repository.

Run commands from the repository root unless a section says otherwise.

## Clerk authentication

### Step 1: Create Clerk application

1. Go to <https://clerk.com> and create an application.
2. Name: `Workstream`.
3. Auth methods: Email and Google.
4. Copy the live Secret Key (`sk_live_...`) and Publishable Key (`pk_live_...`).

### Step 2: Set Fly secrets

The API reads `CLERK_PUBLISHABLE_KEY`. The Next.js web app reads
`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` at build/runtime.

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

`NEXT_PUBLIC_*` values are baked into the web image, so rebuild after setting
the publishable key.

```bash
flyctl deploy --config apps/web/fly.toml \
  --dockerfile apps/web/Dockerfile \
  -a construct-web \
  --build-arg NEXT_PUBLIC_API_URL=https://construct-api.fly.dev \
  --build-arg NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_PASTE_HERE
```

### Step 4: Verify auth

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://construct-web.fly.dev/dashboard
```

Expect a Clerk redirect/sign-in response for unauthenticated access.

## Redis worker

### Step 1: Provision Redis

Option A - Upstash, recommended for Fly:

1. Go to <https://upstash.com>.
2. Create a Redis database in or near Sydney.
3. Copy the Redis URL (`rediss://...`).

Option B - Fly Redis:

```bash
flyctl redis create --name workstream-redis --region syd
```

### Step 2: Set the API secret

```bash
flyctl secrets set REDIS_URL="rediss://PASTE_HERE" -a construct-api
```

### Step 3: Scale the worker process

```bash
flyctl scale count worker=1 -a construct-api
```

### Step 4: Verify worker startup

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

### Step 2: Install the web package when enabling browser capture

```bash
pnpm --filter @workstream/web add @sentry/nextjs
```

### Step 3: Set Fly secrets

```bash
flyctl secrets set SENTRY_DSN="https://PASTE_API_DSN@sentry.io/PROJECT" -a construct-api
flyctl secrets set SENTRY_DSN="https://PASTE_WEB_DSN@sentry.io/PROJECT" -a construct-web
```

### Step 4: Redeploy both apps

```bash
flyctl deploy --config apps/api/fly.toml --dockerfile apps/api/Dockerfile -a construct-api
flyctl deploy --config apps/web/fly.toml --dockerfile apps/web/Dockerfile -a construct-web \
  --build-arg NEXT_PUBLIC_API_URL=https://construct-api.fly.dev
```

## Single API machine

Keep the JSON snapshot store single-writer until SQLite/Postgres replaces the
in-memory store.

```bash
flyctl scale count 1 -a construct-api
flyctl status -a construct-api
```

Expect one running API app machine.

## Mobile TestFlight and Play Store

### Step 1: EAS init

```bash
cd apps/mobile
npx eas-cli init
```

This writes the real EAS `projectId` into `apps/mobile/app.json`.

### Step 2: Apple credentials

Requires an Apple Developer account.

1. In Apple Developer Portal, create App ID `com.curtisandco.workstream`.
2. Run:

```bash
eas credentials --platform ios
```

### Step 3: Build and submit iOS

```bash
eas build --platform ios --profile production
eas submit --platform ios
```

### Step 4: Build and submit Android

1. Create a Google Play app for package `com.curtisandco.workstream`.
2. Place the service-account file at `apps/mobile/google-service-account.json`
   or update `apps/mobile/eas.json` with the chosen path.
3. Run:

```bash
eas build --platform android --profile production
eas submit --platform android
```

## External API keys and tracing

Set live AI, map, portal, Stripe, and OpenTelemetry secrets on the API app.
Do not hardcode the OpenTelemetry endpoint; use the endpoint issued by the
chosen collector or observability platform.

```bash
flyctl secrets set \
  OPENAI_API_KEY="sk-PASTE_HERE" \
  ANTHROPIC_API_KEY="sk-ant-PASTE_HERE" \
  MAPBOX_TOKEN="pk.PASTE_HERE" \
  WORKSTREAM_PORTAL_SECRET="$(openssl rand -hex 32)" \
  OTEL_EXPORTER_OTLP_ENDPOINT="https://PASTE_OTEL_COLLECTOR_ENDPOINT" \
  -a construct-api
```

## Stripe deposits

1. Create a Stripe account and switch to live mode.
2. Copy the live secret key and webhook signing secret.
3. Set API secrets:

```bash
flyctl secrets set \
  STRIPE_SECRET_KEY="sk_live_PASTE_HERE" \
  STRIPE_WEBHOOK_SECRET="whsec_PASTE_HERE" \
  -a construct-api
```

4. Verify the key in Workstream Settings -> Integrations -> Stripe.

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

Use the Backblaze region for `LITESTREAM_S3_REGION` when using B2.

### Step 2: Add the sidecar process

Follow [LITESTREAM-SETUP.md](LITESTREAM-SETUP.md) to install Litestream in the
API image and add the `backup` process to `apps/api/fly.toml`.

### Step 3: Scale and verify the sidecar

```bash
flyctl scale count backup=1 -a construct-api
flyctl logs -a construct-api | grep "litestream"
```

## Branch protection

Requires GitHub Pro for private repositories.

1. Go to <https://github.com/Boringuy7799/workstream/settings/branches>.
2. Add a branch protection rule.
3. Branch name pattern: `main`.
4. Enable:
   - Require status checks to pass before merging.
   - Require branches to be up to date before merging.
   - Include administrators.
5. Select required checks:
   - `typecheck`
   - `playwright e2e`
   - `build api docker image`
   - `build web docker image`
6. Save.

## Verify after deploy

```bash
pnpm run ci
curl -sS https://construct-api.fly.dev/healthz
curl -sS https://construct-api.fly.dev/readyz
curl -sS -o /dev/null -w "%{http_code}\n" https://construct-api.fly.dev/uploads/test.mp3
```

Expect local CI to pass. On 2026-07-21 this is 105 Vitest files and 442
tests. Health and readiness return `ok`. Protected file probes return `401`
when the object exists and the caller is unauthenticated, or `404` if the test
object is absent.

Note: bare `pnpm ci` exits `ERR_PNPM_CI_NOT_IMPLEMENTED` on pnpm 9.15.4; use
`pnpm run ci`.
