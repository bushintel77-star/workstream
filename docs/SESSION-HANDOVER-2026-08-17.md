# Session handover — 2026-08-17

> **Superseded — historical record.** The 12-PR queue below was fully merged
> in the sessions that followed. Current state: [`ONBOARDING.md`](../ONBOARDING.md);
> current handover: `SESSION-HANDOVER-2026-08-18-CONTINUATION.md`; live
> tracker: `OUTSTANDING.md`. Keep this file for the merge-order reasoning only.

Resume point for a fresh context window. The durable work queue is the **12
open PRs** below (all `MERGEABLE / CLEAN` against `main`, verified
2026-08-17). This doc adds what the PR list cannot: merge order, the
dependencies between them, gotchas, and what is left on the roadmap.

## The queue — 12 open PRs (all mergeable, no conflicts)

| # | Branch | What | Merge hint |
|---|--------|------|-----------|
| 173 | `canvas-stability-2026-08-17` | Season/sun single-source, sketch boundary ring closure, terrain de-smear, hover throttle | Foundational canvas fixes — merge early |
| 177 | `fix/web-lint-gate` | Greens the lint gate (unblocks Phase 0 CI) | Merge before relying on CI green |
| 174 | `docs/strategy-vicmap-live` | Production roadmap + full-workflow feature list + Vicmap live smoke test | Docs — anytime |
| 175 | `feat/signoff-flow` | Durable project signoff — revision + quote + liability gate | Independent |
| 176 | `feat/quote-accuracy` | Quote accuracy + traceability gate (domain) | Independent |
| 179 | `feat/live-bom-trace` | Live traceable BOM — boundary area, volumes, asset counts, ground-truth strip | **Merge before #181** (it adds the trace strip #181 enforces) |
| 181 | `feat/traceability-gate` | Automated BOM/quote ground-truth gate wired into CI | Structural — gets stronger after #179 |
| 178 | `perf/camera-refs` | Camera pan/zoom via store refs — no per-frame React writes + zero-commit e2e gate | Perf base; touches same canvas files as #173 — rebase after #173 if needed |
| 180 | `feat/plant-database` | Professional plant DB — schema, palette-driven schedule, open-source seed (53 spp) | Independent |
| 182 | `docs/mobile-sync-design` | Offline-first sync-layer design for Stage 2 handheld | Docs — design only, no code |
| 183 | `feat/sentry-studio-error-paths` | Sentry wired into web studio + all mobile field-capture error paths | Independent |
| 184 | `feat/council-live-data` | Council-overlay hydrate now resolves real planning zones / heritage / contours | Independent (this session's last) |

**Suggested merge order:** 173 → 177 → 174 → 175 → 176 → 179 → 181 → 178 → 180 → 182 → 183 → 184.

## Gotchas a fresh window must know

- **CI is blocked by a GitHub Actions billing hold** — the account is on hold; the
  `typecheck` job (and the new `check:traceability` gate) will not actually run on
  GitHub until the hold lifts. Everything is verified **locally** instead:
  `pnpm run ci` (typecheck + lint + custom checks + tests) and `pnpm test`.
- **Live Vicmap tests are env-gated:** `VICMAP_LIVE=1 pnpm exec vitest run
  apps/api/src/lib/vicmap.live.test.ts` and `vicmap.keyless.live.test.ts`. They hit
  the public WFS; never run in normal CI.
- **The shell has `PORT=0` exported**, which breaks the API's env schema (coerces to
  0). Start the API / Playwright with `PORT=3001` explicitly. A Next dev server may
  already be running on 3004 from another thread — reuse it, don't start a second
  `next dev` (`.next` lock).
- **Live data sources are opt-in:** Sentry (`SENTRY_DSN` /
  `NEXT_PUBLIC_SENTRY_DSN` web, `EXPO_PUBLIC_SENTRY_DSN` mobile), Clerk
  (`CLERK_SECRET_KEY`), Redis (`REDIS_URL`), EAS credentials — all human-owned, none
  set. The code paths are inert without them.
- **Stale docs:** `docs/WORKSTREAM-STATUS.md` is dated 2026-07-21 and out of date.
  `OUTSTANDING.md` is the living production punch list — read it, but its "5 failing
  tests (3 files)" entry is already stale: the full suite is green (1699 passed).

## Roadmap position

The 4-screen workflow (survey → sketch → CAD → signoff) and the staged roadmap live
in the docs committed under PR #174 (`docs/ROADMAP-*.md` / feature list). Screen 1
ground-truth is now substantially complete: live Vicmap title hydrate (#174 proof),
council overlays (#184), live BOM traceability (#179/#181), and Sentry (#183).

**Next roadmap items not yet started:**
- Mobile offline-first sync **implementation** (design is #182; build `localStore` /
  `outbox` / `conflicts` pure modules → server idempotency → convert capture screens).
- Phase 3 Presentation Lens polish + Phase 4 Build Pack (compliance audit + contractor
  CAD/spec export) on the Gold Standard surface.
- Live supplier price feeds (`suppliers.ts` canned `DEV` prices today) + live trade
  catalog — the honest placeholders flagged in `OUTSTANDING.md`.

## Resume commands

```bash
gh pr list --state open            # the queue
gh pr view 173 --json title,mergeable
pnpm run ci                        # local gate (typecheck + lint + checks + tests)
pnpm test                          # full suite (1699 passed, 4 skipped live)
VICMAP_LIVE=1 pnpm exec vitest run apps/api/src/lib/vicmap.live.test.ts
git checkout -b feat/next origin/main   # start fresh work off main
```
