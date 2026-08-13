# Handover: Gold Standard 2026 WebGL Rebuild

**Date:** 2026-08-14
**Branch:** `main` (PR #161 merged)
**Commit:** `35fa7a8`

## What was built

A full implementation of the Gold Standard 2026 architectural brief — a Zero-Chrome WebGL studio for landscape architects, deployed to Railway production.

### Deployed (live on main)

| Phase | What | Key files |
|-------|------|-----------|
| **0** | Gold Standard 2026 binding docs (supreme). Studio Dark tokens (`--gs-*` palette: `#101418` canvas, `#fbbf24` primary, `#0030CF` truth, `#ef4444` strike). Fonts: Space Grotesk + Inter via `next/font`. 13 old docs archived. CI gates rewired. WCAG AA contrast fixed. | `docs/GOLD-STANDARD-2026*.md`, `apps/web/src/styles/color-tokens.css`, `apps/web/src/styles/globals.css`, `apps/web/src/app/layout.tsx` |
| **1** | WebGL rendering foundation — R3F `<Canvas>` + scene primitives (boundary, building, trees+TPZ, regions, easements, services) in metre-space. Pointer/pan/zoom via raycasting. State bridge from live project data. Live at `?webgl=1`. | `apps/web/src/components/canvas/webgl/` (WebGLStudio, StudioScene, StudioControls, sceneItems, coordTransform, cameraRig, GlassCard, stateBridge, WebGLStudioPreview) |
| **2** | Subsurface Engine (3D utility tubes, APWA colours). Strike Alert Engine (collision detection: segment intersection + depth overlap). Hydrological Pulse (Hazen-Williams pressure-drop math). Vertical Truth (55° tilt camera). | `packages/domain/src/hydrology.ts`, `packages/domain/src/strikeAlert.ts`, `apps/web/src/components/canvas/webgl/features/SubsurfaceEngine.tsx` |
| **3** | Presentation Lens (hides technical truth, keeps design). Comparison Lens (split-view with synced camera). | `apps/web/src/components/canvas/webgl/PresentationLens.tsx`, `ComparisonLens.tsx` |
| **4** | Mobile Field Bridge AR (staking chips, subsurface ghosting, strike geofencing via Haversine). | `apps/mobile/src/components/ar/MobileFieldBridge.tsx` |

### SpatialObject schema extended

`packages/contracts/src/schemas/orchestration.ts` — added `x_m`, `y_m`, `elevation_m`, `utility_type`, `gpm`, `pressure_drop`, `pressure_drop_kpa`, `origin_x/y/z`, `maturity_index`, `strike_alert`, `site_origin_locked`.

### Stitch design references committed

~50+ screens in `docs/design/gold-standard-2026/stitch/` and `stitch-part2/`. Directional guide, not carbon-copy spec. Includes Three.js tree growth proxy and a simplex-noise shader example.

### CI gates

All green on the branch before merge: typecheck (13/13), lint (0 warnings), 1563 tests, canvas-contrast-aa (5 modes, 0 failures), webgl-preview-smoke, chrome-color gate, CSS scales, reachability, bundle-size.

**Note:** After merging with `main` (which had its own Gold Standard work from another session), there are 4 pre-existing test failures and 4 lint issues from main's code (toolChips.test, mapbox geocode, contract geocode, Sora unused import, set-state-in-effect in a component main added). These are NOT from this branch's work.

---

## In-progress work (uncommitted in working tree)

### Growth simulation (partially done)

I was mid-way through wiring the 10-year growth simulation into the WebGL trees when the handover was requested.

**Done (in working tree, uncommitted):**
- `sceneItems.tsx`: `grownDimensions()` function added — resolves height/canopy from a `growthFactor` (0 = just planted at 20% size, 1 = 10-year maturity at 100%). Existing trees skip growth (always mature). `SceneItem`, `SceneItems`, `TreeMesh` all accept `growthFactor` prop.
- `StudioScene.tsx`: `growthFactor` prop added to `StudioSceneProps`, destructured in the component body. **NOT yet threaded to the `<SceneItems>` call** — that line still needs `growthFactor={growthFactor}` added.

**Not done yet:**
1. Thread `growthFactor` through the `<SceneItems>` call in StudioScene (1-line edit).
2. Thread through `WebGLStudio.tsx` props.
3. Build the **Temporal Scrubber HUD** — a GlassCard with a year slider (0→10) that drives the growthFactor state. The Stitch design (`phase_1.3_10_year_growth_simulation/code.html`) shows the pattern:
   - Bottom-center floating HUD with a timeline track
   - Nodes at Year 0, Year 5, Year 10
   - Gold progress fill + glowing active node
   - Label: "Year 10" in Space Grotesk, "Phase 1.3 Simulation" in Inter uppercase
4. Add the scrubber to `WebGLStudioPreview.tsx` as a toggle/slider.
5. Commit + push.

**The existing domain package already has growth logic** — `resolveItemHeightGrownM`, `resolveItemSpreadGrownM`, `buildGrowthTemporalRings` in `packages/domain/src/`. My `grownDimensions()` in sceneItems is a simplified renderer-side version. If you want to use the domain package's more sophisticated growth curve (which accounts for species-specific growth rates), import and use those instead.

---

## Architecture overview

### The three-layer model (ARCHITECTURE.md §3)

```
Layer 3: DOM Chrome Overlay (GlassCards)     ← pointer-events: none on container, auto on cards
Layer 2: R3F <Canvas> (WebGL geometry)       ← the drawing
Layer 1: Canvas Base (#101418 clear color)   ← gl.setClearColor
```

### Coordinate system

- **Metre-space** — 1 Three.js unit = 1 metre. Origin `(0,0,0)` = survey peg (Signal Blue crosshair).
- Board-% space (0–100, the legacy SVG viewBox) is converted via `pctToWorld()` in `coordTransform.ts`.
- `scaleM` = metres across the full board width. `boardAspect` = height/width ratio.

### Key types

```ts
// cameraRig.ts
interface StudioCameraRig { panX, panY, zoom, rotateDeg, tiltDeg, focusX, focusY }

// sceneItems.tsx
interface RenderItem { id, t, x, y, rot, scale, ghost, outlinePct?, dbhM?, heightM? }

// stateBridge.ts
function toRenderItems(items: StudioItem[]): RenderItem[]  // structural pick

// PresentationLens.tsx
interface PresentationLensFilter { hideSubsurface, hideStrikes, hideTpz, hideEasements, hideServices }

// features/SubsurfaceEngine.tsx
interface SubsurfaceUtility { id, type, start, end, depthM, toleranceM }
interface StrikeAlertData { id, utilityType, point, severity }
```

### Domain engines (packages/domain/src/)

- `hydrology.ts` — `calculateHydraulicRun(run)` → `{ pressureDropKpa, gpm, velocityMs }`. Hazen-Williams equation. Hydraulic isolation: origin-anchored runs excluded.
- `strikeAlert.ts` — `detectStrikes(excavations, utilities)` → `StrikeAlert[]`. Segment intersection + depth overlap. Severity: direct/near/proximity.

---

## How to access the WebGL studio

The SVG studio is still the default. The WebGL board is opt-in:

```
https://web-production-3c194.up.railway.app/projects/{projectId}?webgl=1
```

Locally:
```
http://localhost:3002/projects/{projectId}?webgl=1
```

The `?webgl=1` flag is handled in `apps/web/src/app/projects/[id]/page.tsx` (~line 90).

---

## What to do next (priority order)

1. **Finish the growth simulation** (in-progress, see above — ~30 min of work)
2. **Fix the 4 pre-existing test failures from main** (toolChips, mapbox geocode, contract geocode — these are from another session's code, not ours)
3. **Swap the default** — make `?webgl=1` the default mount (SVG studio becomes the fallback). This is a 1-line change in page.tsx but needs visual parity verification first.
4. **Port remaining SVG layers to WebGL** — dimensions, annotations, sketch strokes, snap visuals, sun shadows. These exist in CadPlanBoard.tsx but aren't in the WebGL scene yet.
5. **Wire engines to live data** — connect BYDA assets → subsurface utilities, construction trenches → strike excavations, irrigation zones → hydrological runs.
6. **Explore remaining Stitch screens** — only ~4 of ~50 were analyzed. Notable unexamined: Hydrological Pulse Flow HUD, Elevation Slice Analysis, Asset Discovery Fan-Out, Itemized Fit-Sheet, Solar Impact 3D, Revision History HUD.

---

## Key decisions made

- **Alias cascade** for token migration: kept `--hc-*` names as aliases pointing at new `--gs-*` values, so 103 consumer files (2,127 refs) didn't need editing.
- **Dynamic import with `ssr: false`** for the R3F Canvas — WebGL requires the browser.
- **`new Function("return import(spec)")` for Sentry** — the only approach that fully hides the dynamic import from Turbopack's static analysis (variable names and `join()` still produced warnings).
- **Stitch screens are a directional guide, not a spec** — per user instruction. The codebase architecture takes precedence.
- **Subsurface utilities are "nice to have"** — per user: "it's literally out of sight and having a nice graphic is gold." Keep the visual quality high but don't over-invest in the plumbing.

---

## Branch/PR history

```
35fa7a8 Merge pull request #161 (DEPLOYED to Railway)
c0c8ffa merge: resolve conflicts with main
b3a1f1e feat(mobile): Mobile Field Bridge AR overlay (Phase 4)
b474b44 feat(web): Presentation Lens + Comparison Lens (Phase 3)
5de1b74 feat(web): wire Subsurface Engine + Vertical Truth tilt
2c28cba feat(domain,web): Hydrological Pulse + Strike Alert + Subsurface
96e7617 test(web): WebGL preview smoke test — Phase 1 gate
a7651f2 feat(web): wire WebGL studio to live state
5cc944d feat(web): WebGL input controller + project page mount (?webgl=1)
befdb4f feat(web): WebGL scene primitives
... + Phase 0 commits (docs, tokens, fonts, gates)
```

PR: https://github.com/Boringuy7799/workstream/pull/161
