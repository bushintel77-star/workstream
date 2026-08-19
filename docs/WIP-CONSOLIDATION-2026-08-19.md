# WIP consolidation — 2026-08-19

Full sweep of every WIP surface ahead of the GitLab push and Railway deploy:
stash, working tree, local branches, unpushed `main`, and dangling objects.
Verdict: **all WIP is already in `main` or superseded**. The consolidation is
a no-op merge plus branch cleanup; `main` carries the entire product.

## 1. Stash

One entry existed: `park: other-chat dangling WIP (vicmap geocoder
follow-through)`. Unpacked to `wip-stash-consolidation` (commit `09c3ac9`,
kept for history) and diffed file-by-file against `main`:

| Stash content | Verdict |
|---------------|---------|
| Delete `mapbox.ts` / `mapbox.test.ts` | Superseded — `main` removed Mapbox in `b966ca7` |
| `env.ts`, `survey-job.ts`, `contract.test.ts` tweaks | Superseded — all Mapbox-era text; `main` has the Esri/StateView-era wording |
| `StudioScene.tsx` gridHelper tweak | Superseded — `main` replaced the line grid with `DottedGroundField` (`e8ec538`) |
| Untracked `aerial.ts`, `geocode.ts`, live tests | Duplicated — `main` has its own, newer versions |

Every hunk was the older state of work `main` later completed.

## 2. Working tree

Clean at sweep time (only the sweep's own scratch file, removed).

## 3. Local branches (38 deleted)

`git cherry main <branch>` (patch-equivalence) classified all 38 non-`main`
branches. Eleven had "unlanded" commits; each was inspected:

| Branch | Unlanded commit | Verdict |
|--------|-----------------|---------|
| `docs/mobile-sync-design` | sync-layer design doc | File identical in `main` |
| `docs/session-handover` | 08-17 handover doc | `main` copy is newer |
| `feat/canvas-adaptive-grid` | `apps/web/railway.toml` | Superseded — `main` has the same config plus deploy bumps |
| `feat/canvas-asset-menu-quote-builder` | confirm-pin fix | Superseded — branch is the old Mapbox-era `parseMapboxStaticAerial` state |
| `feat/council-live-data` | council hydrate | Superseded — branch predates the `native_vegetation`/EVC kind landed in #200/#201 |
| `feat/live-bom-trace` | live BOM | `studio-preemptive-estimate.ts` identical in `main`; SVG-studio dock retired with the studio |
| `feat/plant-database` | plant DB | All six files identical in `main` |
| `feat/sentry-studio-error-paths` | Sentry wiring | Superseded — web/mobile sentry libs identical, branch screens are old dark-era tokens, `main` has the full `@sentry/*` dep set |
| `feat/signoff-flow` | signoff flow | Superseded — route/schema/domain identical, `main`'s `index.ts`/`server.ts` are ahead |
| `feat/traceability-gate` | traceability gate | Superseded — `traceability.ts` identical, `check:traceability` wired into `pnpm run ci`, `.github/workflows` retired |
| `fix/web-lint-gate` | lint gate | Superseded — config identical; the deleted e2e specs are the retired classic-studio suite |

The other 27 branches were already patch-equivalent to `main` (`git cherry`
0 unlanded). All 38 branches were deleted; their content is verified in
`main`, and the branch tips remain on the (frozen) GitHub origin plus reflog.

## 4. `main` vs `origin/main`

`main` is 21 commits ahead of `origin/main` (`542831f`). These are the real
2026-08-19 session: Mapbox removal, keyless Vicmap GNAF geocoder, Esri World
Imagery, legacy SVG-studio prune, GitLab CI migration, tier-1 spec restore,
landing hero/auth/studio-layout front-end pass. `origin` (GitHub) is frozen;
push goes to GitLab.

## 5. Dangling objects

`git fsck --no-reflogs --unreachable` returned hundreds of objects —
overwhelmingly historical stash mechanics (`WIP on main`, `index on main`,
`untracked files on`) from every session since May. Every recent (08-18/19)
candidate was checked: all are ancestors of `main` except `927ad92`
(chrome-restructure-wip) and `b54a0e5` (planner hydration), both of which
are patch-equivalent to `main`. No unlanded WIP in the object store.

## Outcome

- `main` is the single consolidated branch (per the single-branch law).
- `wip-stash-consolidation` kept as the preserved record of the one stash.
- Pushed: `main` → GitLab `https://gitlab.com/77999-group1/77999-project`
  (commit `a358967`); GitLab CI runs on it. Railway web + api CLI deploys
  triggered the same session after `pnpm run ci` went green.
