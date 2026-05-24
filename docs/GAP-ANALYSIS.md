# Workstream gap analysis

Living audit: **current state ? gold-standard production**, with owner and
automation status. Update when PRs land. Companion: `OUTSTANDING.md` (punch list).

Last reviewed: 2026-05-24. Current matrix: `docs/GAP-ANALYSIS-CURRENT.md`.

## Summary

| Area | Status | Blocker |
| --- | --- | --- |
| Build & CI | **Automated** | Valid `FLY_API_TOKEN` on GitHub |
| Docker images | **Automated** | PR + main builds; web uses production API URL arg |
| Fly deploy | **Automated on main** | Token + machine health |
| API persistence | **Configured** | Volume mount; single machine recommended |
| Auth (Clerk) | Code ready | Fly secrets on api + web |
| File delivery | **Auth-gated routes** | Portal token on quote HTML; operator Bearer |
| Tier-1 Wrights Terrace | **Product-complete** | ? |
| Design studio (web) | **Phases 2?5, 7 shipped** | AI assist + brochure deferred |
| Multi-tenant API | **Shipped** | Integration routes aligned to `getOwnedProject` |
| Mobile / queue | Worker reload shipped | Redis + EAS = human |

## 1. Build & release automation

See `.github/workflows/ci.yml`, `pnpm ci`, `docker-compose.yml`.

**Human:** GitHub secret `FLY_API_TOKEN`, branch protection (Pro plan).

## 2. Production runtime (P0)

| Item | Code | Fly / ops |
| --- | --- | --- |
| Volume persistence | `[mounts]` in `apps/api/fly.toml` | `fly scale count 1 -a construct-api` |
| Protected static files | `apps/api/src/routes/protected-files.ts` | Redeploy api after merge |
| Worker snapshot reload | `store.reloadSnapshot()` in `queue.ts` | `REDIS_URL` + worker process |
| Per-request owner secrets | `owner-secrets.ts` AsyncLocalStorage | Shipped |
| Clerk auth | Middleware + provider | `CLERK_*` on api + web |
| Sentry | API + web `instrumentation.ts` scaffold | `SENTRY_DSN`; `@sentry/nextjs` on web |

## 3. Tier-1 ? 36 Wrights Terrace

| Requirement | Status |
| --- | --- |
| Domain math + savings | Shipped + tested |
| Costing parity `$58,410.35` | Shipped (`ALW-TIER1-ALIGN`) |
| Operator design page Tier-1 styling | Shipped (`DesignProposalView`) |
| Portal hero image | Shipped (`hero_url` from survey aerial) |

## 4. Operator UX

| Item | Status |
| --- | --- |
| Auth guards, upload proxies, route guards | Shipped (PR #15) |
| Unified AppNav, not-found, locked stages | Shipped (PR #15) |
| Project soft delete + restore undo | Shipped |
| Design studio phases 2?5, 7 | Shipped (`CHANGES.md`) |
| Design studio e2e | Shipped + extended |

## 5. Remaining engineering (P1?P3)

See `OUTSTANDING.md`. Highest leverage next:

1. Clerk + Redis + Sentry Fly secrets (human).
2. Mobile TestFlight (`eas init`).
3. Design studio Phase 6 AI assist (proposal only).
4. Brochure output (product spec TBD).
5. Bundle-size budget in CI.

## 6. Human-only checklist

| Action | Where |
| --- | --- |
| Clerk on Fly | `flyctl secrets set CLERK_*` |
| Redis worker | `REDIS_URL` + `fly scale count worker=1` |
| Sentry | DSN + `@sentry/nextjs` on web |
| Branch protection | GitHub Settings |
| EAS / Apple credentials | `apps/mobile` |

## 7. Verify after change

```bash
pnpm ci
curl -sS https://construct-api.fly.dev/healthz
# Protected file (expect 401 without auth):
curl -sS -o /dev/null -w "%{http_code}" https://construct-api.fly.dev/uploads/test.mp3
```
