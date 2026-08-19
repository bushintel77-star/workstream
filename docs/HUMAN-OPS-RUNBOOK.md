# Production human ops runbook

Generated 2026-07-21, updated 2026-08-05 for the Railway migration.

These steps require live platform access or credentials. Do not commit real
secret values to this repository. Run commands from the repository root unless a
section says otherwise.

Railway services: `api-production-a8ff1` (API) and `web-production-3c194` (web).
Set variables through the Railway dashboard or `railway variables set`.

## Section 1 - Clerk authentication (P0)

### Step 1: Create Clerk application

1. Go to https://clerk.com and create an application.
2. Name: `Workstream`.
3. Auth methods: Email and Google.
4. Copy the live Secret Key (`sk_live_...`) and Publishable Key (`pk_live_...`).

### Step 2: Set Railway variables

The API needs the server secret. The web app needs the server secret plus the
public publishable key used by Clerk middleware and client components.

On the API service (`api-production-a8ff1`):

```
CLERK_SECRET_KEY=sk_live_PASTE_HERE
AUTH_REQUIRED=true
PUBLIC_API_URL=https://api-production-a8ff1.up.railway.app
CORS_ORIGIN=https://web-production-3c194.up.railway.app
```

On the web service (`web-production-3c194`):

```
CLERK_SECRET_KEY=sk_live_PASTE_HERE
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_PASTE_HERE
AUTH_REQUIRED=true
```

### Step 3: Redeploy web

`NEXT_PUBLIC_*` values are build-time values for the web image. Trigger a
redeploy from the Railway dashboard or with the Railway CLI so the new
publishable key is baked in.

### Step 4: Verify

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://web-production-3c194.up.railway.app/dashboard
```

Expect a Clerk redirect or sign-in response for unauthenticated access when
`AUTH_REQUIRED=true`.

## Section 2 - Redis worker (P0)

### Step 1: Provision Redis

Option A - Upstash:

1. Go to https://upstash.com.
2. Create a Redis database in or near Sydney.
3. Copy the Redis URL (`rediss://...`).

Option B - Railway Redis plugin:

1. In the Railway project, add a Redis plugin.
2. Copy the `rediss://...` connection string from the plugin variables.

### Step 2: Set variable on the API service

```
REDIS_URL=rediss://PASTE_HERE
```

### Step 3: Enable the worker process

Run the worker as a separate Railway service or as a worker process within the
API service, sharing the same image. The worker entrypoint is
`node dist/worker.js`.

### Step 4: Verify

Tail the API/worker logs in the Railway dashboard and expect a BullMQ worker
start message.

## Section 3 - Sentry error monitoring (P0)

### Step 1: Create Sentry projects

1. Go to https://sentry.io.
2. Create a Node.js project for the API.
3. Create a Next.js project for the web.
4. Copy both DSNs.

### Step 2: Install web package when enabling browser capture

```bash
pnpm --filter @workstream/web add @sentry/nextjs
```

### Step 3: Set variables on both Railway services

On the API service:

```
SENTRY_DSN=https://PASTE_API_DSN@sentry.io/PROJECT
```

On the web service:

```
SENTRY_DSN=https://PASTE_WEB_DSN@sentry.io/PROJECT
```

### Step 4: Redeploy both services

Trigger a redeploy on both Railway services so the new DSNs take effect.

## Section 4 - Single API instance (P0)

Keep the JSON snapshot store single-writer until the database migration lands.
In Railway, set the API service's replica count to 1 while the store is
single-writer SQLite.

## Section 5 - Mobile EAS distribution (P1)

### Step 1: EAS init

```bash
cd apps/mobile
npx eas-cli init
```

This writes the real EAS `projectId` into `apps/mobile/app.json`.

### Step 2: Set EAS production environment

```bash
eas env:create --environment production --name EXPO_PUBLIC_API_URL --value https://api-production-a8ff1.up.railway.app
eas env:create --environment production --name EXPO_PUBLIC_AUTH_REQUIRED --value true
eas env:create --environment production --name EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY --value pk_live_PASTE_HERE
```

### Step 3: Apple credentials

Requires an Apple Developer account.

1. In Apple Developer Portal, create App ID `com.curtisandco.workstream`.
2. Run:

```bash
eas credentials --platform ios
```

### Step 4: Build and submit for TestFlight

```bash
eas build --platform ios --profile production
eas submit --platform ios
```

### Step 5: Android build and submit

1. Create a Google Play app for package `com.curtisandco.workstream`.
2. Place the service account file at `apps/mobile/google-service-account.json`
   or update `apps/mobile/eas.json` with the chosen path.
3. Run:

```bash
eas build --platform android --profile production
eas submit --platform android
```

## Section 6 - External API keys (P1)

Set live AI, map, portal, Stripe, and telemetry variables on the API service.

```
OPENAI_API_KEY=sk-PASTE_HERE
ANTHROPIC_API_KEY=sk-ant-PASTE_HERE
MAPBOX_TOKEN=pk.PASTE_HERE
STRIPE_SECRET_KEY=sk_live_PASTE_HERE
STRIPE_WEBHOOK_SECRET=whsec_PASTE_HERE
WORKSTREAM_PORTAL_SECRET=<openssl rand -hex 32>
OTEL_EXPORTER_OTLP_ENDPOINT=https://PASTE_OTLP_COLLECTOR_BASE_URL
```

Do not hardcode the OpenTelemetry endpoint. Use the endpoint issued by the
chosen collector or observability platform.

Verify Stripe from Workstream Settings -> Integrations -> Stripe after deploy.

## Section 7 - Litestream object-store backup (P2, SQLite-ready)

The current production store is JSON snapshot persistence. Litestream replicates
SQLite WAL files, not arbitrary JSON snapshots, so enable this sidecar only after
the SQLite migration creates the database path documented in
`docs/litestream.example.yml`.

### Step 1: Create object storage

Cloudflare R2:

1. Open Cloudflare Dashboard -> R2 -> Create bucket.
2. Bucket name: `workstream-dr`.
3. Create an R2 API token with object read/write access.
4. Copy the S3 endpoint, access key ID, and secret access key.

Backblaze B2:

1. Open Backblaze -> B2 Cloud Storage -> Create bucket.
2. Bucket name: `workstream-dr`.
3. Create an application key scoped to the bucket with read/write access.
4. Copy the S3 endpoint, region, key ID, and application key.

### Step 2: Set variables on the API service

```
LITESTREAM_BUCKET=workstream-dr
LITESTREAM_S3_ENDPOINT=https://PASTE_ENDPOINT
LITESTREAM_S3_REGION=auto
LITESTREAM_ACCESS_KEY_ID=PASTE_ACCESS_KEY_ID
LITESTREAM_SECRET_ACCESS_KEY=PASTE_SECRET_ACCESS_KEY
```

### Step 3: Add a backup process after SQLite is live

Run Litestream as a separate Railway service (or worker process within the API
service) sharing the API image, with entrypoint:

```
litestream replicate -config /etc/litestream.yml
```

### Step 4: Verify

Tail the backup service logs in the Railway dashboard and expect Litestream
replication messages.

## Section 8 - Branch protection (P1)

Free on GitLab — the GitHub-Pro requirement is gone.

1. Go to https://gitlab.com/<your-user>/workstream/-/settings/repository.
2. Protected branches → protect `main`.
3. Allowed to push: No one; allowed to merge: Maintainers.
4. Optionally require the pipeline to pass before merge
   (Settings → Merge requests → Pipelines must succeed).
   - Include administrators.
5. Select required checks:
   - `typecheck`
   - `playwright e2e`
   - `build api docker image`
   - `build web docker image`
6. Save.

## Section 9 - Final verification

```bash
pnpm run ci
curl -sS https://api-production-a8ff1.up.railway.app/healthz
curl -sS https://api-production-a8ff1.up.railway.app/readyz
curl -sS -o /dev/null -w "%{http_code}\n" https://api-production-a8ff1.up.railway.app/uploads/test.mp3
```

Expect API health and ready checks to return `ok`. The protected upload probe
returns `401` for an existing unauthenticated object, or `404` if the test object
is absent.
