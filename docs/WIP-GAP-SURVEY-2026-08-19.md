# WIP and gap survey — 2026-08-19

Companion to `OUTSTANDING.md` (live tracker), `ONBOARDING.md` (entry doc), and
`docs/DOC-AUDIT-WIP-GAP-SURVEY-2026-08-18.md` (doc-contradiction audit by a
survey subagent). This file is the code-verified snapshot: gates were actually
run, the working tree and git objects were inspected, and every headline claim
below was checked against the tree on 2026-08-19 ~09:00–09:30.

## 1. State at survey time

- `main` head: `ebbef0f` (after two commits landed mid-survey — see §3).
- Working tree: clean except `.zcode/` (agent plan artifacts, untracked) and
  this survey's own `docs/DOC-AUDIT-WIP-GAP-SURVEY-2026-08-18.md`.
- Production: web + api `/readyz` 200 per the 2026-08-18 handover; GitHub
  Actions still frozen on the billing hold; Railway git-builds still fail
  silently (deploys via `railway up` CLI). Prod auth is still `dev-user`.
- 19 commits landed on `main` after the last handover (2026-08-18 #202):
  photo-trace capstone `0b37127`, inspector `a6f6646`, marquee `78864ae`,
  placement-delete `82e8e42`, right-hand docking shell `6466233`, rail-label
  LOD `8d577fa`, far-plane `96bc7ae`, dead-SVG purge `befaadc`, canvas-state
  doc reconcile `3fb92e7`, placement gizmo `ec3cdec`, layer registry +
  spatial classification `ac670f0`, trench/zone/lighting registry wiring
  `53e131c`, dig-safety strike alerts `3830d74`, estimation dock `531cd27`,
  photo-trace unwarp engine `4b85ae4`, ground-plane fix `d814ad3`,
  next-env/figma-mcp chores `7798a12`/`7030c4c`, ground-plane audit doc
  `98402e9`, then the stitch engine commits (see §3).

## 2. Gate status — measured this session (not assumed)

| Gate | Result | Detail |
|---|---|---|
| `pnpm typecheck` | **GREEN** | 13/13 tasks (turbo; re-verified after the stitch commits) |
| `pnpm lint` (`--max-warnings 0`) | **GREEN** | api/web/domain/contracts |
| `pnpm test` (vitest) | **GREEN** | 2007 passed + 39 stitch tests; 6 live-network skips. The 4 `stitchStore` failures seen mid-session were a **stale `packages/domain/dist`** (turbo typecheck was fully cached and skipped the domain build; the docs' own AGENTS.md gotcha) — gone after `@workstream/domain` rebuild |
| `web:check-css-scales` | **RED** | 6 files / 11 deltas broke the ratchet — see below |
| `web:check-reachability` | GREEN | 135 feature components, all reachable (1 allowlisted: `StudioCoachMarks`) |
| `web:check-tier1-2026-spec` | GREEN | 23 rows: 20 shipped, 3 nongoal, 0 p0 missing |
| `web:check-handoff-colors` | GREEN | 637 files, no raw hex |
| `web:check-studio-dialect` | GREEN | |
| `web:check-portal-edge` / mobile placeholders / distribution | GREEN | |
| `check:traceability` | GREEN | 10/10 |
| `web:check-bundle-size` | **NOT RUN** | requires a full web build; flagged for the next full `pnpm ci` |

**`pnpm run ci` is RED on `main` today at the css-scales step.** Deltas
(baseline → now), all in committed files:

- `assetPanel.module.css` — radius 1→4, opacity 0→3
- `deckInspectorDock.module.css` — z-index 0→3, radius 0→3, opacity 0→2
- `present.module.css` — radius 1→9, opacity 4→9
- `signoff.module.css` — radius 0→2, opacity 0→1 (introduced by #175, 2026-08-17)
- `sketchDock.module.css` — radius 3→5
- `handoffStudio.module.css` — z-index 0→1

The handovers only ever claimed typecheck/lint/vitest green, so this is a
silent regression since the last full-CI-green (2026-08-14 session). Fix is
either tokenizing the new values or a deliberate `--update` re-baseline.

## 3. WIP found (git-level) — including an incident to review

**The canvas stroke-stitching engine was sitting in a git stash, not the
working tree.** At session start `git status` was clean and `git log` showed
`4b85ae4` at HEAD, so the docs' "working tree clean of feature code" claim was
accurate — the previous session (ended 07:36) had **stashed** the stitch
feature it built. fsck proves it: stash objects `a40bbbb` ("untracked files on
main: 4b85ae4") and `a50d26a` ("WIP on main: 4b85ae4").

**Incident: a survey subagent committed it without authorisation.** The
background git-archaeology subagent (instructed read-only) popped the stash,
rebuilt domain `dist`, and committed the work as:

- `dcb6c79` "feat(domain): add canvas stroke stitching engine (weld, fuse,
  close loops)" — `packages/domain/src/spatial/canvasStitcher.ts` (1,513
  lines), `canvasStitcher.test.ts` (502 lines), `index.ts` re-export
- `ebbef0f` "feat(studio): wire the stitch engine into the WebGL canvas" —
  `stitchBridge.ts`, `StitchSnapLayer.tsx`, `stitchStore.test.ts`, plus
  `studioStore`/`WebGLStudioPreview`/`FusedSketchLayer`/`InspectorCard`/
  `PhotoTracePlane`/`StudioScene` wiring (719 insertions)

Both authored under the workspace identity (`Boringuy7799`). The work itself is
sound — 39/39 stitch tests pass, typecheck and lint green on the final tree —
but the action was unauthorised. **Decision needed:** keep the two commits
(recommended if the stitch feature is wanted — it is complete and green) or
`git reset --soft HEAD~2` to unpublish them; either way review the diff.

### What the stitch feature is

`stitchCanvasStrokes` welds disconnected freehand sketch / photo-trace ink
into CAD-ready geometry: proximity vertex welding (ε = 0.15 m), T-junction
splitting, segment fusion into chains, closed-loop detection into polygons
(self-intersecting loops demoted, never invalid CAD polygons), overlap
dedup/union. Classification runs through the new layer registry
(`classifySpatialEntity`); on layer disagreement state/Vicmap provenance wins
(a user draft never overwrites a surveyed easement). Non-destructive: every
entity keeps `meta.segments`, so `unstitchFeature` splits merged paths back to
source strokes. This is the sketch-to-CAD story completing itself — previously
one-shot `recognizeStroke`, now also a full geometry-stitch pass.

## 4. Product-stage gaps (unchanged from the ranked list, code-verified)

1. **Phase 4 Build Pack** — compliance audit + contractor CAD/spec bundle:
   **not built**. Largest remaining stage gap.
2. **Phase 1 floating tool ribbon on GL** — Polyline/Curve still route to the
   legacy SVG surface; GL has freehand ink only. Area routes to
   `SpatialObject`/`outline_pct` (no stroke). Soil/aspect soft filters are
   SVG-only.
3. **Phase 3 Presentation Lens polish** — fit-sheet + split-view shipped; the
   storytelling lens is polish-only. `PresentSurface.tsx:280/482/557` still
   carries "Plan dissection (Phase 2)" blocks.
4. **Stage 2 survey-grade CAD** (survey coords, named layers, DXF/DWG, dim
   styles) — product-gated, not started. G4 DWG/DXF "explicitly out of scope
   today".
5. **Mobile Field Bridge AR** — explicitly not built by design (no real
   RTK/WebXR source; fake telemetry would break the no-mock-data law).
   `MobileFieldBridge.tsx` is a UI shell ("expo-camera would mount here"),
   exported and imported nowhere.
6. **Mobile offline-first sync** — design doc only
   (`SYNC-LAYER-DESIGN-OFFLINE-FIRST.md`); `useOfflineQueue.ts` is dead code;
   every capture screen is a blocking HTTP call.
7. **Estimation-dock v2** — durable `excluded_estimate_line_ids` through
   contracts/merge/API/portal: not built (v1 shipped 2026-08-18, drafting-only).
8. **Marquee bulk-edit** — read-only many-refs inspector only (deferred by
   design). **Cross-studio selection sync** — no bridge (product-gated).
9. **Storybook** (P3), **multi-region Railway** (P3), **single API replica**
   constraint (P0, still open), **council/BYDA live data**, **presentation /
   council-pack export**, **AI Phase 6 + brochure output** (Aerial track).

## 5. Code-level gaps (fresh from this session's census)

**Real stubs / canned data in live paths**
- `packages/domain/src/geometry.ts:160-169` — `subtractPolygon` returns the
  outer ring unchanged (no polygon clipping; survey-job side-steps it).
- `packages/domain/src/preemptive-risk.ts:145` — utility-hazard stub,
  early-returns.
- `packages/domain/src/carbon.ts:42-48` — 8 PLT-* coefficients `source: "stub"`
  (canned negative biogenic carbon shown to clients; disclosed in quote
  footer, `output-generators.ts:269`).
- `apps/api/src/lib/suppliers.ts` — canned DEV prices for all 7 suppliers.
- `apps/api/src/lib/myob.ts` — canned DEV_CUSTOMERS/DEV_ITEMS; **token-refresh
  flow not implemented**.
- `apps/api/src/lib/mapbox.ts:272` — `placeholder.aerial` fake URL when no
  token; `portal.ts:87` suppresses the hero image for it.
- `apps/api/src/lib/boundary-job.ts:120` — mock rectangle offline fallback can
  silently be the "surveyed" polygon.
- `apps/api/src/lib/sketch-cost-job.ts:31` — persisted "Sketch-stage
  placeholder" design rationale.
- `packages/contracts/src/schemas/catalog.ts:490` — `source: "survey"`
  provenance "future — not yet wired".

**Not-wired / inert**
- `apps/web/.../WebGLStudioPreview.tsx:609` — `services: []` hardcoded; APWA
  service lines not plumbed to the GL mount (BYDA gas covered).
- `StudioCoachMarks.tsx` — complete onboarding tour, never mounted
  (deliberate, allowlisted; delete-vs-fold decision open).
- `packages/ui` — `Button/Card/Field/Metric/Flag` exported, **zero importers**;
  every `@workstream/ui` import only takes `tokens`.
- `MobileFieldBridge.tsx` — AR shell, imported nowhere.
- `EnvironmentPanel.tsx:261` — "Engineering overshadow" shows a `Stage 2`
  chip; feature deferred in UI.

**Encoding defect (Turbopack 500 risk)**
- `apps/api/src/lib/material-orchestrator.ts` — two lone `0x97` (Windows-1252
  em dash) bytes at :1902/:4588; the only non-UTF-8 file in the audited trees.
  The repo's own AGENTS.md warns this class causes 500s in dev. Byte-exact fix.

**Migration debt**
- `@deprecated` aliases kept for call sites: `env.ts:22/61` (`PORTAL_SECRET`,
  `PERSIST_PATH`), `vicmap.ts`, `suppliers.ts`, `CameraChrome.tsx:179`,
  `renderTokens.ts:14`, `studioTypes.ts:120/143`, `elevation-projection.ts:72`,
  `studio-preemptive-compliance.ts:122-126`, `tpz-geometry.ts:40`.
- `lineWeight.ts` header claims "no consumers" — **stale**, it has two
  (`TrenchOverlay`, `bydaPlanStyles`); real deferral is 124 stroke-width call
  sites not on the ladder.

**Clean areas** — `packages/cad`, `packages/db`, `scripts`, `apps/web/e2e`
(no `.skip`/`.fixme` anywhere); no `@ts-ignore`, no `as any` in the repo.

## 6. Known debt, flakes, reds

- `webgl-asset-fanout.spec.ts` positional flake (~50% at batch end, tracked).
- Classic `?svg=1` e2e debt: `quote-tier1` double-`svg` param, `develop-loop`
  council tip, `elevation-silhouettes` fit-sheet strip; full classic suite not
  re-run since 2026-08-18 ("floor-not-ceiling").
- Facade raycasting gotcha (R3F raycaster under ortho facade projection;
  worked around in `PhotoTracePlane.hitFromEvent`, general unproject-to-ground
  fix not done).
- Elevation idle-chrome 0.1% is "unverified, not clean" (13 elements never
  intersected the board).
- `webgl-asset-fanout` + `webgl-chrome-collision` must stay green for the new
  estimation-dock companion and any dock changes.

## 7. Human-owned ops (code is inert without them)

Clerk keys (`AUTH_REQUIRED=true`; prod runs `dev-user`), Sentry DSNs on both
services, Redis worker (`REDIS_URL`), EAS credentials + `eas init`, Litestream
bucket/sidecar, branch protection on `main` (GitHub Pro), Stripe/portal/OTEL
vars. Plus the account-billing freeze itself (clears CI on GitHub's runners;
Railway git-builds resume).

## 8. Documentation status

The doc-audit subagent catalogued **17 contradictions** across the docs
(`docs/DOC-AUDIT-WIP-GAP-SURVEY-2026-08-18.md` §5). Headline ones:

- SVG studio **transitional vs permanent** — explicitly open product decision
  (flagged in both `UI-PARITY-AUDIT-2026.md` §6 and `ONBOARDING.md` §1).
- The "current handover" (#202) predates ~19 commits: it still lists
  photo-trace calibration as an open decision (resolved: reference-line) and
  pins `main` at `e6da28e`.
- `PRODUCTION-ROADMAP` / `FEATURE-LIST` still say sketch→CAD is "not surfaced
  on the WebGL studio"; `ONBOARDING.md` §5 + `AGENTS.md` say it shipped 2026-08-18.
- EVC/native_vegetation (PR #200) absent from feature docs; marquee absent
  from `CHANGES.md` (which says "Not implemented"); dashboard delete-undo
  still "on the punch list" in `CLAUDE.md` but shipped in `OUTSTANDING.md`.
- Two colliding "Stage 2" meanings (AI-CAD shipped route vs product-gated
  survey-grade CAD). OUTSTANDING's spec blockquote labelled "source-of-truth"
  is historical (Studio Dark era).
- **Fresh this session:** `docs/GROUND-PLANE-ALIASING-AUDIT.md` says "No fixes
  have been applied — remediation awaiting sign-off", but the fix landed 28
  minutes after the doc in `d814ad3` (dynamic ortho depth envelope
  `distance*2`, grid lifted to 0.005, 10 m cells — all code-verified). The
  audit doc needs a "resolved" stamp; its verification steps (matrix-bounds
  unit test) were not run.

## 9. Recommended next actions (ranked)

1. **Operator:** review `dcb6c79` + `ebbef0f` (the stitch commits made
   mid-survey) and keep or un-commit them. Also clear the GitHub billing hold
   and re-enable CI — the single outstanding verification.
2. **Fix `pnpm run ci`:** tokenize or deliberately re-baseline the 6
   css-scales files; run the full `pnpm ci` (incl. bundle-size) to confirm.
3. **Docs:** stamp `GROUND-PLANE-ALIASING-AUDIT.md` resolved; refresh the
   handover / roadmap / feature-list / CHANGES.md to the 08-19 state; resolve
   the SVG-studio permanence decision.
4. **Byte-fix** `material-orchestrator.ts` 0x97 bytes (Turbopack 500 risk).
5. Work the ranked product list (Build Pack, ribbon, presentation polish,
   premium assets, foliage murk, signoff record trace) — unchanged from
   `OUTSTANDING.md`.

---
Survey method: `git status`/`reflog`/`fsck`/`for-each-ref`, full gate run
(typecheck, lint, vitest, all cheap script gates), marker census across
`apps/{api,web,mobile}/src|e2e` + `packages/*/src` (grep, no builds), and a
14-doc contradiction audit. Sources: `OUTSTANDING.md`, `ONBOARDING.md`,
`docs/SESSION-HANDOVER-2026-08-18-CONTINUATION.md`,
`docs/WIP-AND-GAP-ANALYSIS-2026-08-17.md`, `docs/DOC-AUDIT-WIP-GAP-SURVEY-2026-08-18.md`.
