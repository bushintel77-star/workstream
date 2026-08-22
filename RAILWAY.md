# Railway deployment

Git hosting is GitLab. GitLab CI is off — it burned minutes and took
production down. Deploy only from this machine.

This is a pnpm workspace. Production is two Railway services in one project:

1. API (`@workstream/api`)
2. Web (`@workstream/web`)

Do **not** set a Railway service root directory. The Dockerfiles build from the
repo root so workspace packages (`packages/contracts`, `packages/domain`,
`packages/db`, `packages/cad`) are available during the build.

## Deploy

No pipeline. From this machine:

```bash
railway up --project e2c12b66-af3a-4a51-a285-874c7a6de7d4 --service web --environment production --detach
railway up --project e2c12b66-af3a-4a51-a285-874c7a6de7d4 --service api --environment production --detach
```

Do not wire Railway to a git source. A failed CI job must not be able to
take the site down.

## Service settings

### API service

Use these service settings:

| Setting | Value |
| --- | --- |
| Service name | `workstream-api` |
| Root directory | leave blank |
| Railway config file | `/apps/api/railway.toml` |
| Healthcheck path | `/healthz` |

Variables:

```bash
NODE_ENV=production
PORT=3001
CLERK_SECRET_KEY=sk_live_...
PUBLIC_API_URL=https://<api-service-domain>
CORS_ORIGIN=https://<web-service-domain>
```

Unset `AUTH_REQUIRED` in production is fail-closed (API refuses to boot
without `CLERK_SECRET_KEY`). Set `AUTH_REQUIRED=false` to keep the shared
`dev-user` bootstrap until Clerk keys are on the service.

Optional AI/geocode variables:

```bash
ANTHROPIC_API_KEY=...
OPENAI_API_KEY=...
```

### Web service

Use these service settings:

| Setting | Value |
| --- | --- |
| Service name | `workstream-web` |
| Root directory | leave blank |
| Railway config file | `/apps/web/railway.toml` |
| Healthcheck path | `/` |

Variables:

```bash
NODE_ENV=production
PORT=3002
CLERK_SECRET_KEY=sk_live_...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
API_URL=https://<api-service-domain>
NEXT_PUBLIC_API_URL=https://<api-service-domain>
```

## Domains

After the first successful deploy:

1. Generate a Railway domain for `workstream-api`.
2. Generate a Railway domain for `workstream-web`.
3. Set `NEXT_PUBLIC_API_URL` and `API_URL` on the web service to the API domain.
4. Set `PUBLIC_API_URL` and `CORS_ORIGIN` on the API service.
5. Redeploy both services.

## Verify

```bash
curl https://<api-service-domain>/healthz
curl -I https://<web-service-domain>/
```

Both should return HTTP 200.
