# Handover — studio UX pass + Present workspace brief (2026-08-02)

Fresh-context handover for the Workstream studio session of 2026-08-02. Covers
what changed, what is committed vs uncommitted, open threads, and the next
concrete step for each. Read this top-to-bottom before picking up any thread.

## TL;DR

- **Committed** (`224e1de` — "feat(web): premium studio chrome — chip clusters,
  persistent rail, frame bevel"): Vic-gov chip corner clusters, restored
  persistent left tool rail, instrument-dial frame finish. Not yet verified in a
  running browser.
- **Uncommitted**: Fit-sheet ground fix (`HandoffDesignStudio.tsx`) and the latest
  `PRESENT-WORKSPACE-BRIEF.md` revisions. `apps/web/next-env.d.ts` is a build
  artifact — ignore.
- **Docs**: `docs/PRESENT-WORKSPACE-BRIEF.md` is Phase-0-ratifiable (two dev
  review passes folded in). Next code step there is the schema brief.
- **Environment caveat**: the mounted `node_modules` is a Windows install; its
  pnpm bin/symlink layout does **not** resolve under the Linux sandbox, so the
  test suite and dev server could not be run here. All code changes were verified
  by static reasoning only. Everything below marked "needs eyeball" is unverified
  visually.

## 1. Vic-gov chip corner clusters (committed)

**Ask:** the long "placeholder bar" of meta chips (BOUNDARY / EASEMENTS / ZONING /
OVERLAYS / TREES / BYDA / COUNCIL / ENV) ran across the top of the canvas and got
clipped under the right data lane. Move it off the canvas into frame corners.

**Done:** split into two frame-corner clusters via a new data-driven `cluster`
field on the chip model.

- Title / planning cluster (top-left): boundary, easements, zoning, overlays,
  heritage.
- Site context / authorities cluster (top-right): trees, byda, council,
  environment.

**Files:**
- `apps/web/src/components/canvas/handoff/features/stickyMeta/vicGovChipStatus.ts`
  — added `VicGovChipCluster` type + `cluster` on each chip model.
- `.../stickyMeta/VicGovStatusChipRow.tsx` — partitions chips, renders two
  clustered pills (`vic-gov-status-chips-title` / `-context`).
- `.../stickyMeta/vicGovChips.module.css` — `.title` / `.context` corner anchors;
  right cluster yields when the data lane is busy; phone flows both.
- `apps/web/e2e/vic-gov-status-chips.spec.ts` — updated testids to the two
  clusters.

**Verify:** the id-based unit tests (`vicGovChipStatus.test.ts`) still pass by
construction (the `cluster` field is additive). Needs eyeball for placement.

## 2. Persistent left tool rail (committed)

**Ask:** the persistent dark tool rail down the left frame column (with a red
active highlight) had disappeared.

**Root cause:** not deleted — deliberately converted to "summoned only". The dock
was gated `chrome.ambientRibbon && instrumentsVisible`, and an idle timer
auto-hid it ~4s after the last non-select tool. In the default select state it
was invisible (only a "Tools" peek + a lone SELECT pill showed).

**Done:** render the dock whenever the desktop instrument layout is active
(`chrome.ambientRibbon`), regardless of summon/idle. Idle now only dims it to
~0.72 (never hides). Restyled as a milled instrument rail (distinct dark surface,
thin outline, layered greys) and switched the active indicator from the orange
`--signal` to the **red `--existing-stroke`** the owner remembered.

**Files:**
- `apps/web/src/components/canvas/handoff/HandoffDesignStudio.tsx` — dock render
  gate (~line 4545).
- `.../features/toolDock/toolDock.module.css` — rail surface, idle floor, red
  active seat + needle.

**Note:** the compact-layout summon behaviour is untouched (compact has
`ambientRibbon` false), so the `canvas-compact-chrome` e2e still holds.

## 3. Instrument-dial finish (committed)

Owner direction: premium instrument-dial aesthetic — thin crisp outline, depth
from five-to-six graded grey/white layers (not one flat fill). Applied to both
the chip cluster pills and the left rail.

## 4. Fit-sheet ground fix (UNCOMMITTED — needs eyeball)

**Ask:** on the Fit sheet the plan sat in a grey box that shrank with print scale
and detached from the paper. Owner wants the canvas to fill the sheet always, with
only the drawing scaling inside it.

**Root cause:** the viewport-fixed parchment ground (`.parchmentBleed`) is gated
off in sheet mode (`!ui.frameOn`), leaving only the ground painted inside
`.zoomWorld`, which scales with the camera — that is the shrinking grey box.

**Done (in `HandoffDesignStudio.tsx`, uncommitted):**
- `worldHidePaper` now also true in sheet mode, so the in-world (scaling)
  parchment stops painting.
- The `.parchmentBleed` viewport-fixed ground now renders in sheet mode too,
  clipped to the plot rect (`sheetPlotLayout.clipPath`) and forced to full peel —
  so it fills the plot permanently while the `.zoomWorld` plan vectors scale on
  top.

**Verify:** needs eyeball on the Fit sheet (Cad tab → A3/A4). Watch that the
title-column area is unaffected (the clip excludes it) and there's no parchment
bleed into the dark margins.

## 5. Building envelope on canvas (OPEN — needs live check)

**Ask:** the Vicmap building envelope that used to appear on the canvas (to design
around) is gone.

**Finding — not a clear code regression.** The pipeline is intact end to end:
`apps/api/src/lib/vicmap.ts` still fetches the building WFS; `boundary-job` /
`survey-job` thread it; `geometry/parcelHydrate.ts` sets the dwelling ring;
`CadPlanBoard` renders it whenever the ring has ≥3 points. For 12 Wrights Terrace
the schedule reads "Existing dwelling 0.00 m²" — the by-design empty-footprint
fallback ("outline unavailable · Trace dwelling"). Hydration deliberately clears
implausible footprints via `rejectOversizedDwelling`
(`geometry/dwellingPlausibility.ts`, cap `MAX_FOOTPRINT_COVERAGE_FRAC = 0.8`).

**Cannot resolve blind:** from the sandbox there is no live Vicmap fetch, so we
cannot tell "Vicmap returned no footprint" from "we fetched one and rejected it".

**Next step:** drive the studio in the owner's browser and inspect the parcel
snap / network for this address, or reproduce on a parcel where the envelope
previously showed. Only then decide between (a) a hydration/threshold bug fix or
(b) it is simply parcel data.

## 6. Neighbour building sun-massing (QUEUED — own brief)

**Ask:** model neighbouring house footprints (incl. 3D massing) so
overshadowing / sun analysis accounts for adjacent structures — the design does
not live in a vacuum.

**Status:** net-new feature (no neighbour schema in contracts). Now has a data
anchor: the Present brief's `north_bearing` decision (true north on
`DesignSiteFrame`) is the same value overshadowing needs. Write it as its own
brief; needs contracts work for adjacent footprints + massing.

## 7. Present workspace brief (docs — Phase-0-ratifiable)

`docs/PRESENT-WORKSPACE-BRIEF.md`. A new "Present" tab (same product, sibling to
Survey/Sketch/Cad/Elevation/Quote/Share) giving a fresh formatting canvas: AI
dissects the finished plan into feature/aspect panels, the designer shuffles them,
AI applies editorial formatting for print-ready decks, quotations, mood boards and
concept sketches. Two-surface model — the in-studio fit-sheet peel stays; Present
is the new multi-page surface.

Two dev-review passes (Devin) folded in. Resolved blockers:
1. **Orientation data** — add `north_bearing` to `DesignSiteFrame` (degrees 0–360,
   true north, calibration-stamped; aspect computed not stored). Phase 2 gated on
   it.
2. **Template enum** — new closed enum scoped to `PresentationDocument` only; the
   fit-sheet `PresentationPack` keeps its free string + `curtis-client-brochure` /
   `cleared` sentinels. No migration.
3. **PDF export** — no print path exists today; own sub-phase (Phase 1a), headless
   Chromium on the API — flag the container-image / memory cost.
4. **Unlock gate** — via `unlockedModes` (mechanism, on `hasQuote`, mirrors
   Share), kept distinct from `DesignLifecyclePhase` and `Project.status`.
5. **Persistence** — new top-level `Project.presentation_documents[]`, not inside
   `DesignCanvas`.

**Next code step (after owner ratifies Phase 0):** the schema brief itself —
`packages/contracts` changes for `PresentationDocument`, `north_bearing` on
`DesignSiteFrame`, `Project.presentation_documents[]`. Contracts are the boundary;
they land before API or view. The owner was actively prototyping the Canva-style
quotation/mood page in parallel.

## 8. Environment / verification caveats

- Mounted `node_modules` (Windows install) does not resolve pnpm bins under the
  Linux sandbox — `vitest` / dev server could not run. Re-run locally:
  `pnpm --filter @workstream/web test` and open the studio to confirm §1–§4.
- All edits verified by static reasoning only. Nothing UI was seen rendered.
- Repo conventions (CLAUDE.md): Conventional Commits, no emojis, sentence case,
  en-AU, CSS Modules + variables (no CSS-in-JS), contracts-first.

## 9. Open task list

| # | Thread | State | Next step |
| --- | --- | --- | --- |
| 4 | Fit-sheet ground fill | uncommitted | eyeball on Fit sheet, then commit |
| 5 | Building envelope | open | live browser inspection of the parcel snap |
| 6 | Neighbour sun-massing | queued | write its own brief (anchored on `north_bearing`) |
| 7 | Present schema brief | pending owner sign-off | write `packages/contracts` schema brief |

## 10. Suggested first actions for the next session

1. Commit or discard the uncommitted `HandoffDesignStudio.tsx` ground fix after an
   eyeball on the Fit sheet.
2. If the owner is free, open the studio in-browser to settle the building-envelope
   question (data vs regression) — that is the one thing that cannot be done blind.
3. On Phase 0 ratification, start the Present schema brief in `packages/contracts`.
