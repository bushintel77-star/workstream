# Workstream gap analysis

Living audit: **current state ? gold-standard production**, with owner and
automation status. Update when PRs land. Companion: `OUTSTANDING.md` (punch list).

Last reviewed: 2026-05-21.

## Summary

| Area | Status | Blocker |
| --- | --- | --- |
| Build & CI | **Automated** | Valid `BROKKER` / `FLY_API_TOKEN` on GitHub |
| Docker images | **Automated** | PR + main builds; web uses production API URL arg |
| Fly deploy | **Automated on main** | Token + machine health |
| API persistence | **Configured** | Volume mount; single machine recommended |
| Auth (Clerk) | Code ready | Fly secrets on api + web |
| File delivery | **Auth-gated routes** | Portal token on quote HTML; operator Bearer |
| Tier-1 Wrights Terrace | **Product-complete** | Portal hero image slot = P2 |
| Mobile / queue | Worker reload shipped | Redis + EAS = human |
| Design studio | Phase 3 layout shipped | Phases 4?8 backlog |

## 1. Build & release automation

Unchanged from prior doc ? see `.github/workflows/ci.yml`, `pnpm ci`, `docker-compose.yml`.

**Human:** GitHub secret `FLY_API_TOKEN`, branch protection (Pro plan).

## 2. Production runtime (P0)

| Item | Code | Fly / ops |
| --- | --- | --- |
| Volume persistence | `[mounts]` in `apps/api/fly.toml` | `fly scale count 1 -a construct-api` |
| Protected static files | `apps/api/src/routes/protected-files.ts` | Redeploy api after merge |
| Worker snapshot reload | `store.reloadSnapshot()` in `queue.ts` | `REDIS_URL` + worker process |
| Clerk auth | Middleware + provider | `CLERK_*` on api + web |
| Sentry | API + web `instrumentation.ts` scaffold | `SENTRY_DSN`; `pnpm add @sentry/nextjs` on web |

## 3. Tier-1 ? 36 Wrights Terrace

| Requirement | Status |
| --- | --- |
| Domain math + savings | Shipped + tested |
| Costing parity `$58,410.35` | Shipped (`ALW-TIER1-ALIGN`) |
| Operator design page Tier-1 styling | **Restored** (`DesignProposalView`) |
| Portal hero image | Backlog |

## 4. Operator UX (audit PR + follow-up)

| Item | Status |
| --- | --- |
| `resolveProjectOwner`, upload auth, route guards | Shipped (PR #15) |
| Unified AppNav, not-found, locked stages | Shipped (PR #15) |
| Delete undo toast (5 s) | Shipped (`DashboardProjectRow`) |
| Design studio phase 3 layout | Shipped (toolbar save, 320px rail) |
| Design studio e2e save | Shipped |

## 5. Remaining engineering (P1?P3)

See `OUTSTANDING.md`. Highest leverage next:

1. Merge [PR #15](https://github.com/Boringuy7799/workstream/pull/15) + redeploy api/web.
2. Design studio phases 4?8 (palette, modeless canvas, honesty UI).
3. Per-request integration secrets (remove global `process.env` hydration).
4. Mobile TestFlight (`eas init`).
5. Portal hero image field.

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
