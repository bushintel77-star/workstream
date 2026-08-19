# Railway deployment

This repo is a shared pnpm workspace. Deploy it to Railway as **two services** in
one Railway project:

1. API service (`@workstream/api`)
2. Web service (`@workstream/web`)

Do **not** set a Railway service root directory. The Dockerfiles build from the
repo root so workspace packages (`packages/contracts`, `packages/domain`,
`packages/db`, `packages/cad`) are available during the build.

## Create the Railway project from GitLab

In Railway:

1. New project
2. Deploy from GitLab repo
3. Select `<your-user>/workstream`
4. If Railway auto-detects multiple apps, keep the API and Web services. If it
   creates only one service, add the second service from the same GitLab repo.

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
AUTH_REQUIRED=false
PUBLIC_API_URL=https://<api-service-domain>
CORS_ORIGIN=https://<web-service-domain>
```

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
AUTH_REQUIRED=false
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
