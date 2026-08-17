# WIP and gap analysis — 2026-08-17 (evening session)

Written 2026-08-17 ~23:59 local. State verified against this session's tool
results: main at `f828800`, gates green, Railway preview live. Companion to
`docs/SESSION-HANDOVER-2026-08-17-CONTINUATION.md`; supersedes the stale
`docs/WORKSTREAM-STATUS.md` (2026-07-21) as the current snapshot.

## 1. Verified green today (explicitly NOT gaps)

- **Gates:** web typecheck green; full `pnpm lint --max-warnings 0` green;
  vitest 290 files / 1818 tests passed (6 live-network skips).
- **Merged:** #187 camera rig, #188 irrigation-zone tool + `/readyz`,
  #189 docs reconciliation (Paper + Signal Blue), #190 lighting-runs tool.
- **Deploys:** production `web` and `api` SUCCESS on Railway; preview
  service live at https://web-preview-production-16b1.up.railway.app.
- **CI root cause:** found and code-fixed on main (`5a5e0ee` lockfile
  regeneration — osmic git-SSH fetch replaced by a public HTTPS codeload
  tarball).

## 2. WIP (in flight)

| # | Item | State | Next action |
|---|------|-------|-------------|
| 1 | CI live verification | Diagnosed; the one `startup_failure` run was the **frozen GitHub account** pausing Actions | User's card clears → dispatch CI on main; expect green. Blocked on billing, not code. |
| 2 | Railway auto-deploy of `f828800` | Production web/api auto-deployed the earlier merges within seconds; the last push had not fired at final poll (frozen account likely also pausing GitHub webhook deliveries) | Re-check after unfreeze; trigger manually (`railway up` from repo root) if the webhook stays silent |
| 3 | OUTSTANDING tracker accuracy | §2 build-status still described dark-era tokens as "live" | Fixed in this commit; mobile token gap recorded below |
| 4 | `docs/WORKSTREAM-STATUS.md` | Stale (2026-07-21) | Regenerate or point at this doc |

## 3. Product gaps vs Gold Standard 2026 (ranked)

1. **§3 Phase 4 Build Pack — NOT BUILT.** Compliance audit (regulatory
   offsets) and the contractor CAD/spec bundle export are the largest
   remaining stage gap. Fit-sheet/quote exist; the handoff artifact does not.
2. **§3 Phase 1 Sketch — floating tool ribbon.** Polyline/Curve still route
   to the legacy SVG surface; on the GL surface only freehand ink exists.
   Area routes to `SpatialObject`/`outline_pct` (no stroke). Soil/aspect
   soft filters remain SVG-only.
3. **§3 Phase 3 Presentation Lens polish.** Fit-sheet + comparison split-view
   shipped; the storytelling lens (hide technical truth, keep live
   intelligence) is polish-only, not built out.
4. **Photo-trace elevation (sketch capstone).** Pin a photo as a frozen
   camera bookmark → fly/crossfade → vertical ink plane → freehand trace →
   elevation sheet. Calibration model undecided — needs a schema/UX decision
   before build.
5. **§4 Mobile Field Bridge AR — explicitly not built (by design).** Needs
   real RTK-GPS + camera (WebXR/native). Fabricated "RTK FIXED" telemetry
   would violate the no-mock-data law; do not build without a real data
   source.
6. **Mobile token mirrors are dark-era.** `packages/ui/src/tokens.ts`
   `studio` block: gold `#FBBF24` (retired from chrome), `signalBlueInk
   #A8B4FF` (dark-era lifted stop), `conflict #EF4444` (should be crimson
   `#C41E1E`), IBM Plex fonts (retired for Inter/Space Grotesk on web).
   Mobile UI is out of step with the shipped Paper + Signal Blue `#3D5AFE`
   system until reconciled.
7. **"Murk" polish.** Light canvas vs dark-era foliage `d-*` ramp and olive
   ground-bounce (`sceneItems.tsx` FOLIAGE, `--gs-ground-bounce`). Lift
   foliage to the `l-*` ramp; neutralise the olive bounce.
8. **Premium assets.** Species depth, thumbnails, curated palettes beyond the
   current catalog symbols.
9. **Signoff record trace.** Unverified that signoff freezes the accepted
   quote — operator `SignoffCard` vs portal deposit must share one record.
10. **Stage 2 CAD (true CAD).** Survey coordinates, named layer export, dim
    styles. Schema-gated (`STUDIO-PRODUCT-PHASES.md`); not started and
    blocked until product opens Stage 2.
11. **Mobile offline-first sync.** Design doc only
    (`docs/SYNC-LAYER-DESIGN-OFFLINE-FIRST.md`); implementation not started.

## 4. Production / ops gaps (mostly human-owned)

- **Clerk** live keys not set on Railway — production currently falls back
  to `dev-user`.
- **Sentry DSNs** not set on either service (scaffold only).
- **Redis worker** not enabled (`REDIS_URL` unset; pipeline runs in-process).
- **Branch protection on main** requires GitHub Pro.
- **EAS store credentials** (Apple/Google) for mobile distribution.
- **Litestream bucket** — after the SQLite migration (single API replica
  constraint applies meanwhile).
- **GitHub Actions paused** — account frozen on payment failure; all PRs
  currently merge with local gates only.
- **CI e2e non-blocking** by design (hosted-runner font/startup flakiness);
  revisit with a self-hosted runner.

## 5. Easy-to-misread items

- The spec blockquote inside `OUTSTANDING.md` is the historical 2026-08-14
  brief (Studio Dark, gold primary). **It is quoted as history, not as the
  current standard.** The live binding set is `docs/GOLD-STANDARD-2026*.md`
  (Paper canvas, Signal Blue primary, crimson conflict-only).
- Playwright e2e exists and passes locally; CI e2e being non-blocking is a
  deliberate setting, not a silent failure.
- Subsurface, GPM/pressure-drop, drainage flow, earthworks cut/fill, and the
  LV lighting model are real math wired to real data — not placeholders.
