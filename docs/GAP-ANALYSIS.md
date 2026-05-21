# Workstream gap analysis

Living audit: **current state ? gold-standard production**, with owner and
automation status. Update when PRs land. Companion: `OUTSTANDING.md` (punch list).

Last reviewed: 2026-05-20.

## Summary

| Area | Status | Blocker |
| --- | --- | --- |
| Build & CI | **Automated** | Valid `BROKKER` / `FLY_API_TOKEN` on GitHub |
| Docker images | **Automated** | PR + main builds; web uses production API URL arg |
| Fly deploy | **Automated on main** | Token + machine health |
| API persistence | **Configured** | Volume mount; single machine recommended |
| Auth (Clerk) | Code ready | Fly secrets on api + web |
| CORS | **Deployed** on Fly | `https://construct-web.fly.dev` |
| Tier-1 Wrights Terrace | **Product-complete** | Costing line-items vs workbook = P1 |
| Mobile / queue / e2e | Backlog | P1 |

## 1. Build & release automation

### Was missing

- README said deploy was manual; CI had deploy job but web Docker **PR build**
  omitted `NEXT_PUBLIC_API_URL`, so broken client bundles could pass CI.
- No local script mirroring CI (`install ? typecheck ? test ? docker build`).
- No post-deploy smoke checks.
- No `docker-compose` for full-stack local parity.

### Now in place

| Capability | Where |
| --- | --- |
| CI: typecheck + test | `.github/workflows/ci.yml` |
| CI: Docker build api + web | same; web passes `build-args` |
| CI: deploy api + web on `main` | same; web `--build-arg NEXT_PUBLIC_API_URL=ù` |
| CI: post-deploy smoke | `curl` `/healthz` + web home |
| Manual deploy dispatch | `workflow_dispatch` on CI workflow |
| Local CI mirror | `pnpm ci` |
| Local Docker build | `pnpm build:docker` |
| Fly deploy helper | `scripts/deploy-fly.ps1` / `scripts/deploy-fly.sh` |
| Local stack | `docker-compose.yml` |

### Remaining (human / org)

- [ ] GitHub secret `BROKKER` or `FLY_API_TOKEN` ù valid Fly deploy token
- [ ] Branch protection on `main` ù require CI green (repo settings)

## 2. Production runtime (P0)

| Item | Code | Fly / ops | Notes |
| --- | --- | --- | --- |
| Volume persistence | `apps/api/fly.toml` `[mounts]` | `fly scale count 1 -a construct-api` | Multi-machine breaks JSON store |
| `CORS_ORIGIN` | `env.ts` validates in prod | Secret staged; deploy after VM bump | Was failing on 512 MB machine |
| `NEXT_PUBLIC_API_URL` | `apps/web/Dockerfile` default + CI arg | Redeploy web after merge | Baked at **build** time |
| Clerk auth | Middleware + provider | `CLERK_*` on api + web | Dev fallback without keys |
| Sentry | `apps/api/src/lib/sentry.ts` | `SENTRY_DSN` optional | Dynamic import; no DSN = noop |
| Gitleaks | `.github/workflows/gitleaks.yml` | Done | `pull-requests: read` |
| Stripe validate | `settings.ts` | N/A | `GET /v1/balance` round-trip |

### URLs (do not confuse)

| Use | URL |
| --- | --- |
| Operator UI | https://construct-web.fly.dev |
| API + health | https://construct-api.fly.dev/healthz |
| API root in browser | 404 JSON ù expected |

## 3. Tier-1 ù 36 Wrights Terrace, Prahran

Reference assets: `clients/wrights-terrace/` (proposal v3 PDF, workbook).

### Implemented in product

| Requirement (proposal v3) | Implementation |
| --- | --- |
| Address detection | `isTier1WrightsTerrace()` in `@workstream/domain` |
| Architectural massing (front + rear) | `tier1WrightsTerraceDesign()` |
| Savings ledger | `TIER1_WRIGHTS_SAVINGS` ? portal + HTML quote |
| Skip Claude for Tier-1 design | `claude.ts` short-circuit |
| Operator design page | `projects/[id]/design` + `DesignZones` tier styling |
| Client portal narrative | `QuotePortal` tier-1 blocks |
| Gap flag (step nosing) | Design `gaps[]` + scope output |

### Gaps (P1 product, not blocking demo)

| Gap | Impact | Suggested fix |
| --- | --- | --- |
| Pipeline **costing totals** vs workbook | Portal may show rate-card math ? $58,410.35 target | Seed Tier-1 scenario or override in cost job when `isTier1ù` |
| Portal **hero image** slot | Editorial quote lacks site photo | `outputs` or portal `hero_url` field |
| Mobile site-walk for this job | Capture endpoints exist; UI thin | `docs/CAPTURE.md` roadmap |
| Lidar / eyewear | Documented TODOs | Native modules |

### Regression guard

`packages/domain/src/tier1-wrights-terrace.test.ts` locks savings math and
zone structure so proposal numbers do not drift silently.

## 4. Quality & scale (P1ùP3)

See `OUTSTANDING.md` for the full punch list. Highest leverage next:

1. Playwright ù operator happy path (create project ? design ? quote link).
2. Contract tests ù parse every API response with its Zod schema.
3. BullMQ + Redis ù async pipeline jobs.
4. EAS / TestFlight ù mobile distribution.
5. Real ESLint per workspace (today `lint` is a no-op echo).

## 5. How to verify after a change

```bash
pnpm ci                                    # same as GitHub typecheck job
pnpm build:docker                          # both images locally
docker compose up --build                  # api :3001, web :3002
./scripts/deploy-fly.sh                    # or deploy-fly.ps1 on Windows
curl -sS https://construct-api.fly.dev/healthz
```

## 6. Traceability

| Doc | Purpose |
| --- | --- |
| `OUTSTANDING.md` | Checkbox punch list |
| `DEPLOY.md` | Fly + EAS commands |
| `docs/UI-FOCUS.md` | Operator + portal UX priorities |
| `clients/wrights-terrace/` | Client bid artifacts (not in git LFS for PDFs) |
