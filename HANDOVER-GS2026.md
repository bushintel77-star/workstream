# Handover: Gold Standard 2026 — Render Quality, Seasonal Dynamics, Sketch Suite

**Date:** 2026-08-14 (end of session)
**Branch:** `main`
**Latest commit:** `a1a5c43`
**Previous handover:** PR #161 (`35fa7a8`)
**Deployed:** Railway (web + api) — WebGL studio is now the **default** mount

---

## Session commits (on main)

```
a1a5c43 fix: pre-existing test failures + swap WebGL to default mount
e764e2c fix(ci): allowlist webgl render-material colours in chrome-color gate
5a60788 feat(web): subsurface CAD schematic + 2D sketch pad + 3D sketch mode
599262f feat(web): tier-one render quality + seasonal dynamics + LA hardscape
5915ada feat(web): growth-aware tree meshes + handover doc  (from prior session)
```

All work is **committed and pushed to `main`**. Railway is deploying.

---

## What was built this session

### 1. Tier-One Render Quality (exceeds GrowthStudio reference)

The WebGL studio went from flat/plastic to a cinematic architectural render.

**Post-processing stack** (first use of `@react-three/postprocessing` in the repo):
- `EffectComposer` with N8AO (ambient occlusion) + Bloom (emissive glow) + Vignette + SMAA
- Installed `@react-three/postprocessing@3`, `postprocessing@6`, `zustand@5`

**Tone mapping + shadows:**
- ACES Filmic tone mapping, exposure 1.05, sRGB output
- VSM shadow maps (`shadows="variance"` — replaces deprecated PCFSoft on r185)
- `<SoftShadows>` was removed (incompatible with VSM — caused shader errors)

**Image-based lighting:**
- drei `<Environment preset="park" background={false} environmentIntensity={0.35}>`
- First env map anywhere in the repo. `background={false}` preserves the `#101418` clear color.

**Fog:**
- Linear `THREE.Fog` matching `PALETTE.gsCanvas` (`#101418`), near `scaleM*1.5`, far `scaleM*3.6`
- Mutated per-frame by `SeasonalFogController` (pulls closer in winter)

**Real-sun lighting:**
- Wired `sunPositionAt` from `@workstream/domain` (the proven GrowthStudio formula)
- `SunRig` converted from `useMemo` (re-rendered) to `useFrame` mutation (zero re-renders)
- Light position: `(cos(alt)·sin(az)·d, sin(alt)·d, -cos(alt)·cos(az)·d)` with `+X=east, +Y=up, +Z=south`
- Altitude floored at 3° (lower than GrowthStudio's 6° — for dramatic winter shadows)
- 4-light rig: cool ambient (`#aebfd0`@0.45) + hemisphere (olive ground-bounce `#1a1f16`@0.55) + warm key (real sun) + cool fill + rim light

**Geometry upgrades:**
- **Trees**: 6 main canopy lobes + 3 crown lobes, smooth shading (NOT flatShading), deterministic per-lobe colour jitter via `hashHue()`, `castShadow`+`receiveShadow` on every lobe
- **Building**: `ExtrudeGeometry` with bevel + window emissive glow band (spec §2.2 `<StructureMesh>` mandate)
- **Ground**: olive `#161f18` (warmer than dead-black), roughness 0.92

**Key files:**
- `WebGLStudio.tsx` — EffectComposer, Environment, fog, VSM, ACES
- `StudioScene.tsx` — SunRig (useFrame mutation), SeasonalFogController, GroundContactShadows, rim light, building extrusion
- `sceneItems.tsx` — multi-lobe canopy, crown tier, colour jitter, hardscape

---

### 2. Seasonal Dynamics (Dual-Axis Time Engine)

A parallel time axis (`seasonProgress` 0→1, Jan 1→Dec 31) running alongside the 10-year growth axis. **All seasonal transitions happen via `useFrame` mutations — zero React re-renders.**

**State architecture — zustand store** (`seasonalStore.ts`):
```ts
growthYear: number       // 0–10 (macro-time, drives trunk/canopy/root scale)
seasonProgress: number   // 0–1 (micro-time, Jan→Dec, drives materials/lighting/fog)
sunMin: number           // minutes past Melbourne midnight
subsurfaceView: boolean  // blueprint vellum toggle
sketchMode: boolean      // 3D sketch toggle
```
- **3D `useFrame` loops** read via `useSeasonalStore.getState()` — direct memory read, zero re-renders
- **DOM HUD chips** subscribe via `useSeasonalStore(s => s.field)` — auto re-render from same source

**Seasonal mutations (all via useFrame + getState):**
- **Winter canopy drop** (Rule 2): `canopyScale = growthScale × lerp(1, retention, winterFactor)`. Existing trees hold 70%, new plantings go bare (5%).
- **Foliage colour lerp** (Rule 3): `material.color.lerpColors(summerGreen, autumnOrange, autumnFactor)` per-lobe via `CanopyCluster`'s `useFrame` traverse
- **Hardscape moisture** (Rule 3): paving `roughness` 0.65→0.2 in winter (wet/reflective)
- **Seasonal sun elevation** (Rule 4): winter lowers sun altitude 55% → long shadows
- **Seasonal fog** (Rule 4): `SeasonalFogController` pulls fog 30% closer in winter

**Seasonal math** (Southern-hemisphere / Melbourne convention):
- `winterFactor()` — cosine bell centred on 0.47 (June solstice)
- `autumnFactor()` — cosine bell centred on 0.25 (mid-April)
- `seasonLabel()`, `seasonMonth()`, `leafStatus()` — chip display helpers

**HUD scrubbers:**
- Growth (Year 0→10), bottom-center GlassCard
- Sun (06:20→19:40), top-center GlassCard
- Season (Jan→Dec), top-center offset GlassCard
- Metadata chips: Season, Leaf Status, Sun Angle, Root Spread

**Key files:**
- `seasonalStore.ts` — zustand store + seasonal math helpers
- `sceneItems.tsx` — `TreeMesh` useFrame (winter drop), `CanopyCluster` useFrame (colour lerp), `PavingMesh` useFrame (moisture)
- `StudioScene.tsx` — `SunRig` useFrame, `SeasonalFogController`
- `WebGLStudioPreview.tsx` — scrubber HUDs + metadata chips

---

### 3. LA Hardscape Components (PBR Bevel-Rule)

Three new item types in `sceneItems.tsx`, all with `dithering={true}`, `castShadow`/`receiveShadow`:

| Component | Geometry | Material |
|-----------|----------|----------|
| **PavingMesh** | `ExtrudeGeometry` w/ mandatory bevel (0.02/0.02/3 segments) | Architectural concrete `#8c9294`, roughness 0.65, metalness 0.15 |
| **DeckMesh** | drei `<Instances>` planks, 140mm wide, 2cm physical gaps | Weathered timber `#5c4a3d`, roughness 0.85, metalness 0 |
| **BollardLight** | Anodized cylinder body + LED cap cylinder | Body: `#2a2d30` roughness 0.3 metalness 0.85. Cap: `#ffeedd` emissive 2.5 `toneMapped={false}` |

The 2cm gaps between deck planks force N8AO to calculate real micro-shadows. The bevels catch IBL specular. The bollard LED blooms via the post-processing stack.

**New `RenderItem.t` types:** `"paving"`, `"deck"`, `"bollard"` (added to the union).

---

### 4. Subsurface Engine Rebuild (3D tubes → hairline CAD schematic)

**Before:** `TubeGeometry` (8 radial segments) + `meshStandardMaterial` — read as plastic PVC pipes.
**After:** drei `<Line>` (Line2/LineMaterial) — 2px screen-space constant hairline.

**Key changes** (`features/SubsurfaceEngine.tsx`):
- `SchematicConduit` replaces `UtilityTube`
- Muted drafting CAD palette (NOT neon): `cadWater #4FA3D1`, `cadElectric #D17A4F`, `cadSewer #5BA874`, `cadGas #C9A84C`, `cadComms #B8845A`, `cadReclaimed #8E6BB0`
- Micro-animation flow: `lineRef.material.dashOffset -= delta * flowSpeed`. Speeds: electric/comms 0.15, water/gas/reclaimed 0.08, sewer 0.03 (agonizingly slow)
- `depthTest={false}` + `renderOrder={1}` — lines show through vellum ground
- `visible={subsurfaceView}` — drops from render loop when off
- Strike alerts kept unchanged (emissive PBR spheres + Billboard text)

**Blueprint vellum transition** (`StudioScene.tsx`):
- `GroundPlane`: material ref + `useFrame` lerps opacity (1→0.88), colour (olive→`#2A2F33`), roughness (0.92→0.6)
- `GroundContactShadows`: opacity 0.45→0.15
- GridHelper fades too
- Toggled via "View Underground" button in top-left GlassCard

**Net chrome-color reduction:** SubsurfaceEngine went from 10 → 1 violation (6 APWA neon hexes replaced by `PALETTE.cad*`).

---

### 5. 2D Sketch Pad (`/projects/[id]/sketch`)

A dedicated canvas-first, minimal-chrome sketching route.

**Files** (`apps/web/src/components/canvas/sketch/`):
- `SketchPad.tsx` — full-screen aerial + SVG drawing surface + pointer capture + vignette
- `SketchSidebar.tsx` — left-border frosted icon rail (Plan/Elevation/Grid/Draw/Node/Undo/Redo)
- `SketchChips.tsx` — corner metadata chips (live area/cost + stroke count)
- `sketchHelpers.ts` — stroke capture, snap-close, `polygonAreaM2`, undo/redo history hook

**Features:**
- Edge-to-edge aerial photo + radial vignette + faint dot grid (bullet-journal style, `opacity: 0.18`)
- SVG + perfect-freehand strokes (reuses `freehandPath`, `CanvasStroke` schema from `@workstream/contracts`)
- Auto-close (snap near origin within 3.5% threshold)
- Gesture deletion (long-press >500ms → highlight red → swipe >50px to delete)
- Keyboard undo/redo (Cmd+Z / Cmd+Shift+Z)
- **Plan ↔ Elevation toggle** — grid "stands up" (tighter vertical spacing + ground datum line), chips pivot from area/perimeter to height/clearance

**Dot grid visual hierarchy:** dots at back (opacity 0.18) → photo midground (vignette darkened) → strokes foreground (full opacity magenta ink)

---

### 6. 3D Sketch Mode (inside the WebGL studio)

**File:** `apps/web/src/components/canvas/webgl/SketchLayer3D.tsx` (NEW)

Raycast-draped strokes + volumetric extrusion, built inside the R3F `<Canvas>`:

- **Raycast plane**: invisible `planeGeometry` (`scaleM*5`) with `onPointerDown/Move/Up`. Each `event.point` (world Vector3) captured at `y≈0.02`
- **Draping**: strokes render as drei `<Line>` in world space (lineWidth=2, `PALETTE.sketchInk`)
- **Auto-close**: last point within 2m of first → closed loop
- **Volumetric extrusion**: press inside a closed stroke (point-in-polygon test) + drag up → `THREE.ExtrudeGeometry` from footprint `THREE.Shape`, depth bound to drag Y-delta. Semi-transparent green-gold mass, live height update
- **Camera lock**: `sketchMode` gate in `StudioControls` suppresses pan (reads `getState().sketchMode`). Drags become strokes, not camera moves.
- **Self-mounting**: `SketchLayer3D` subscribes to `sketchMode` via selector — only it re-renders on toggle, returns `null` when off
- **"Sketch 3D" toggle** button in top-left GlassCard

---

### 7. Default Mount Swap + Test Fixes

**WebGL is now the default.** `/projects/{id}` mounts the WebGL studio directly. The legacy SVG studio (`HandoffDesignStudio`) is the fallback via `?svg=1`.

**All 4 pre-existing test failures fixed:**
- `toolChips.test` (2 failures) — updated expectations for current sketch-mode tool list, added `"grid"` chip to `PRIMARY`
- `mapbox.test` (1 failure) — `Math.floor` → `Math.round` on zoom calc
- `contract.test` (1 failure) — was a mapbox dependency, now passes

**Result: 1566/1566 tests pass, 264/264 test files.**

---

## Architecture reference for the next session

### The zustand store (`seasonalStore.ts`)

The backbone of all temporal state. Every file that needs time/view state reads from here:

```ts
// DOM HUD (re-renders — fine, it's outside the Canvas):
const year = useSeasonalStore((s) => s.growthYear);

// 3D useFrame (zero re-renders):
const { seasonProgress } = useSeasonalStore.getState();
```

**Holds:** `growthYear`, `seasonProgress`, `sunMin`, `subsurfaceView`, `sketchMode` + setters.

### The render token system

Three.js needs **concrete hex values** (CSS `var()` doesn't resolve in WebGL). All light/material colours use `PALETTE.*` from `colorTokens.ts` (the allowlisted source-of-truth). The CSS tokens exist separately for DOM/chrome.

**Key PALETTE keys added this session:**
`gsCanvas`, `gsConflict`, `sunWarm`, `skyCool`, `gsShadow`, `groundOlive`, `groundBounce`, `ambientCool`, `rimCool`, `windowGlow`, `bark`, `concrete`, `anodizedMetal`, `timberWeathered`, `ledWarm`, `summerGreen`, `autumnOrange`, `cadWater`/`cadElectric`/`cadSewer`/`cadGas`/`cadComms`/`cadReclaimed`, `renderBlueprintGround`, `sketchInk`

### File map

```
apps/web/src/components/canvas/webgl/
├── WebGLStudio.tsx          # Canvas shell: EffectComposer, Environment, fog, ACES, VSM
├── StudioScene.tsx           # Scene graph: SunRig (useFrame), fog controller, ground, items, sketch layer
├── sceneItems.tsx            # Trees (multi-lobe), hedges, paving, deck, bollard, regions
├── FusedSketchLayer.tsx      # THE unified ink: raycast capture, drape, extrude gesture
├── studioStore.ts            # zustand (supersedes seasonalStore.ts shim): temporal + view +
│                            #   slice/drainage/earthworks instruments + sketchStrokes + save machine
├── StudioControls.tsx        # Pan/zoom/raycast — gated by sketchMode
├── WebGLStudioPreview.tsx    # HUD: stats, growth/sun/season scrubbers, toggle chips,
│                            #   bottom-right instrument stack (Section/Flow/Earth cards)
├── GlassCard.tsx             # Frosted-glass DOM overlay primitive
├── cameraRig.ts              # Ortho camera rig (panX, panY, zoom, rotateDeg, tiltDeg)
├── coordTransform.ts         # pctToWorld / worldToPct (board-% ↔ metre-space)
├── PresentationLens.tsx      # Hide technical layers in present mode
├── ComparisonLens.tsx        # Split-view synced camera
├── stateBridge.ts            # StudioItem → RenderItem structural pick
├── terrainMath.ts            # SHARED IDW sampler — mesh/drape/slice/flow/earthworks all sample this
├── TerrainMesh.tsx           # 60×60 displaced heightmap from site_frame.levels
├── ElevationSliceLine.tsx    # Draggable section cut (Vertical Truth)
├── SliceProfileCard.tsx      # Live SVG elevation profile card
├── flowField.ts              # D8 flow routing + accumulation + ponding (pure, tested)
├── DrainageFlowLayer.tsx     # Stream network + ponding markers on the terrain
├── DrainageFlowCard.tsx      # Drainage telemetry card (streams/fall/ponding, GPM/kPa)
├── cutFill.ts                # Pad selection + cut/fill rasteriser (pure, tested)
├── EarthworksLayer.tsx       # Committed pad masses + red/gold cut/fill zone mesh
├── EarthworksCard.tsx        # Per-pad + total cut/fill m³ readout card
├── snapWorld.ts              # Metre-space snap ladder: close → vertex → 45° angle (pure, tested)
├── DimensionLayer.tsx        # Boundary/building dim ring — SVG engine reused, <Html> labels
├── MeasureTapeLayer.tsx      # Armed two-point measure tape (draped, ephemeral)
├── fitSheet.ts               # Estimate args builder + fit-sheet summary (pure, tested)
├── FitSheetCard.tsx          # Live itemized quotation + stock-pulse GlassCard (Phase 3)
├── assetPalette.ts           # Fan-out dock palette — TYPE_TO_SYMBOL + real catalog botany (pure, tested)
├── AssetFanOutDock.tsx       # Bottom fan-out dock; collapses to armed hint pill
├── AssetPlaceLayer.tsx       # Armed click-to-place capture (grid snap → CatalogPlacement)
├── canvasBridges.ts          # BYDA/trench/irrigation/levels → live studio data
└── features/
    └── SubsurfaceEngine.tsx  # SchematicConduit (hairline Line2) + StrikePulse

apps/web/src/app/projects/[id]/
└── page.tsx                  # Default = WebGL; ?svg=1 = legacy SVG studio; ?tool=sketch arms ink
```

### How to access everything

| Surface | URL |
|---------|-----|
| **WebGL studio** (default) | `/projects/{id}` |
| Legacy SVG studio | `/projects/{id}?svg=1` |
| ~~2D sketch pad~~ | deleted (`e305e2d`) — deep links `/projects/{id}/sketch` are gone; the unified studio is the only sketch environment (`?tool=sketch` arms it) |
| Production web | `https://web-production-3c194.up.railway.app/projects/{id}` |
| Production API | `https://api-production-a8ff1.up.railway.app` |

---

## CI gates — all green

| Gate | Status |
|------|--------|
| Typecheck (13/13) | ✅ |
| Lint (`--max-warnings 0`) | ✅ (red → green in `48ee40e`) |
| Tests (1609/1609, 268 files) | ✅ |
| Chrome-color gate | ✅ (`webgl/` allowlisted as render-material colours) |
| Web build (Railway) | ✅ |
| e2e smoke (`webgl-preview-smoke.spec.ts`) | ✅ |

---

## Remaining gaps (priority order)

> **Update (`e305e2d` + `48ee40e`)**: Gaps 1, 2, and 4 below were written before the
> fused-rendering-context and Vertical Truth commits. They are now CLOSED — see notes.

### Gap 1: Live data wiring — CLOSED ✅ (`60a2295`)
~~The subsurface utilities, strike excavations, and hydrological runs all use sample/demo data.~~
Wired via `computeLiveStudioData()` (`canvasBridges.ts`): BYDA assets → `SubsurfaceUtility[]`,
construction trenches → `detectStrikes()` excavations, irrigation zones → `calculateHydraulicRuns()`,
`site_frame.levels` → terrain heightmap. `WebGLStudioPreview` consumes real canvas data.

### Gap 2: Terrain heightmap — CLOSED ✅ (`60a2295` + `e305e2d`)
~~The ground is flat at Y=0.~~ Shipped as the **Vertical Truth** milestone:
- `terrainMath.ts` — shared IDW sampler (`createElevationSampler`); the mesh, stroke drape,
  and elevation slice all sample bit-identical terrain
- `TerrainMesh` — displaced 60×60 heightmap from `site_frame.levels` (×3 vert exaggeration,
  mean-datum normalisation); flat projects degrade to the plane with zero visual change
- Stroke drape — ink lerps Y from flat (plan) to terrain (3D) per-frame on the animated
  `viewBlend` (published by `FusedCamera`), zero re-renders/allocs
- Elevation slice — `ElevationSliceLine` (draggable axis-aligned cut) + `SliceProfileCard`
  (live SVG profile, ×3 label, Δ-real readouts)
- ~~Still open under this umbrella: cut/fill volumes, drainage-flow rendering~~ — both
  shipped on top of the heightmap:
  - **Drainage flow** (`flowField.ts` + `DrainageFlowLayer` + `DrainageFlowCard`): D8
    steepest-descent routing + flow accumulation on the same 60×60 grid the mesh renders;
    dashed pulse-animated stream polylines, ponding-point markers + telemetry card
    (streams / max fall / ponding, Σ GPM + max kPa from the wired `computeHydraulics()`
    results). Ponds are honest (no sink filling) — they're the actionable insight.
  - **Cut/fill earthworks** (`cutFill.ts` + `EarthworksLayer` + `EarthworksCard`): the
    design surface is extruded sketch pads (`extrude_height_m` — no schema change); WYSIWYG
    render-space comparison vs the sampler, real m³ readouts (÷3, labelled). Committed pad
    masses now render outside sketch mode (previously invisible metadata), with red/gold
    cut/fill zone patchwork on the terrain and per-pad + total volume HUD.
  - Same session fixed three pre-existing Z-mirror bugs (local +Y → world −Z under the
    `[-π/2,0,0]` rotation): `TerrainMesh` relief, `BuildingFootprint` mass, and the
    extrude preview were N/S-mirrored vs the ink/slice samplers.

### Gap 3: Port SVG layers to WebGL — CLOSED ✅
~~These exist in `CadPlanBoard.tsx` (SVG) but aren't in the WebGL scene.~~ All three
bullets resolved:
- **Dimension annotations** — `DimensionLayer.tsx`: reuses the SVG engine as-is
  (`edgeSegments` + `buildOutsideDims` + `declutterOutsideDims` are pure board-%
  functions, imported across the boundary — same precedent as `sunDatePreset`). All
  line work renders as ONE drei `<Line segments>` draw call; labels are constant-px
  drei `<Html>` chips (`data-testid="dim-label"`) — the WebGL equivalent of the SVG
  `CameraChrome` label portal. Boundary B… + building F… rings, decluttered. Toggles
  via the `dimsView` store chip; stays visible in Presentation mode (the lens doc
  mandates "the client wants to see sizes").
- **Measurement lines** — `MeasureTapeLayer.tsx` + `snapWorld.ts`: an armed
  two-point tape (anchor press → drag → live metres, aspect-correct), draped over
  the terrain sampler, dashed Signal Blue with endpoint discs + gold `<Html>`
  midpoint label. Ephemeral by design (SVG parity — nothing persists). DOM twin
  `MeasureReadoutChip` (`data-testid="measure-readout"`) subscribes independently.
  Esc disarms + clears. Measure ↔ sketch mode are mutually exclusive at the store.
- **Snap visuals** — `snapWorld.ts` (pure, 14 tests) ports the SVG snap ladder to
  metre space: close (2 m, matches SNAP_CLOSE_M) → vertex (committed stroke
  endpoints, 1.2 m) → 45° angle (±5°, distance-preserving projection). Applied in
  `FusedSketchLayer.onPointerMove`; the `SnapMarker` renders a kind-coloured ring +
  glyph chip (● vertex crimson / ∠ angle truth / ◎ close gold) as DOM-testable
  `data-testid="snap-glyph"`.
- **Sun shadow polygons** — RETIRED as superseded: the 2D `SunCastOverlay` +
  `castRingShadowPct` faked shadows on a flat SVG board; the WebGL studio casts
  REAL shadows from the real sun (SunRig → `sunPositionAt`, VSM shadow maps,
  seasonal elevation). The domain `plan-sun-cast.ts` math is untouched — the SVG
  fallback studio still uses it.
- **Same session fixed a pre-existing production bug**: freehand drawing was
  DEAD on the WebGL studio — `StudioControls.onPointerDown` stopped propagation
  unconditionally from its coplanar ground plane (mounted first in the scene),
  so `FusedSketchLayer` never received the gesture (the sketch-mode pan gate
  existed for moves, not for the down capture). StudioControls now yields the
  gesture when a capture layer is armed (`sketchMode || measureActive`), restoring
  ink drawing and enabling the measure tape. Caught by the new e2e; verified with
  a live drag probe (Strokes: 0 → 1).

### Gap 4: Stroke persistence — CLOSED ✅ (pre-wired; verified `e305e2d`)
~~Strokes are local React state only.~~ The chain was already built end-to-end
(`studioStore.sketchStrokes` → `useStudioAutosave` → `saveDesignCanvasClient` → PUT
`design-canvas`); round-trip verified live (draw → save → reload → hydrate, including
`extrude_height_m`, added to `CanvasStrokeSchema` in `e305e2d`).

### Gap 5: 46 unexamined Stitch screens — EXPLORATION ⚠️
Notable unexamined in `docs/design/gold-standard-2026/stitch/`:
- ~~Hydrological Pulse Flow HUD~~ — implemented (drainage instruments above)
- ~~Elevation Slice Analysis~~ — implemented (Vertical Truth)
- ~~Itemized Fit-Sheet~~ — implemented (`fitSheet.ts` + `FitSheetCard`): the live
  itemized quotation + material stock pulse, Phase 3 mandate. Everything derives
  client-side from geometry the studio already holds — `useStudioEstimate`
  (sync seed + worker settle) prices the drawing, `solveLiveTradeEstimate`
  matches Melbourne hub offers for IN STOCK / LOW STOCK / AI EST chips,
  `sectionForEstimateTier` groups lines into quote sections. Zero fetch — the
  sheet is live-synced to the canvas by construction. Top-6 itemized rows +
  section chips + Subtotal/GST/Total summary + site stats (m²/m³/tippers) +
  gold procurement alert on out-of-stock matches + "Indicative — confirm
  before tender" footer. `outdoorM2` flows from the page via the existing
  `resolveAreaM2` (same source as the SVG studio's area prop).
- ~~Asset Discovery Fan-Out~~ — implemented (`assetPalette.ts` + `AssetFanOutDock` +
  `AssetPlaceLayer`): the "▸ Assets" chip opens the bottom fan-out dock (Stitch
  phase_1.1 idiom — glass cards, gold active treatment, real catalog botany
  "never invented"); picking a card arms it (the dock collapses to an armed hint
  pill — an armed tool never has chrome over the lot), a canvas click
  half-metre-grid-snaps and mints a `CatalogPlacement` in the store; items now
  derive CLIENT-SIDE from store placements (`toRenderItems(placementsToItems(...))`
  — the server items prop is gone), so the 3D item renders instantly and the
  existing autosave PUT persists it (round-trip e2e-verified: place → Saved →
  reload → Items: 1). Placements + arming live in `studioStore` with mutual
  exclusion across the three capture layers (sketch / measure / asset).
  Honest follow-up: flora RANKING (`rankCurtisFloraCandidates`) needs the click
  cell's shade context — the flora ring at click is the next increment; v1
  ships curated order rather than fake scores.
- Solar Impact 3D — mostly subsumed (real sun rig + shadows exist); the delta
  (exposure %/shadow-zone readouts) falls out of the flora-ring build's
  shade-grid needs
- Revision History HUD — infra exists (design-branches API + DesignBranchDock
  on SVG studio); weakest signal (the Stitch turned out to be a phase
  scrubber, not a commit list)

### Gap 6: Mobile licensable sketch tool — FUTURE PHASE ⚠️
The expo mobile app has `MobileSketchTopbar`/`MobileToolStrip` components. Sketching is
web-first in the unified WebGL studio (the isolated `/sketch` route was deleted in `e305e2d`).
Porting to mobile (React Native + Skia/WebView) is the "licensable onsite tool" endpoint. The
`CanvasStroke` schema is shared via `@workstream/contracts`.

---

## Key technical decisions made this session

1. **zustand for temporal state** — `getState()` in useFrame (zero re-render), selectors for DOM HUD. Chosen over React refs to avoid mirror-state desync.
2. **VSM shadow maps** — PCFSoft is deprecated on r185; VSM gives real soft shadows without the warning. `<SoftShadows>` PCSS is incompatible with VSM (removed).
3. **CSS `var()` doesn't work in Three.js** — all light/material colours use `PALETTE.*` (concrete hex), while CSS tokens exist for DOM/chrome. Same pattern as `ClientShareTwin.tsx`.
4. **3D sketch inside the WebGL studio, not a separate route** — SVG `viewBox` can't raycast against 3D meshes. Building inside the R3F Canvas was the only viable path.
5. **`webgl/` allowlisted in chrome-color gate** — Three.js material colours are physical render values (like `ClientShareTwin.tsx`), not chrome identity. Same precedent.
6. **WebGL is the default mount** — SVG studio is the `?svg=1` fallback. Every visitor now lands in the 3D render.
7. **Ref-mutation on existing per-tree meshes** (not full InstancedMesh conversion) for seasonal canopy drop — satisfies the "no re-renders" constraint while preserving the multi-lobe canopy geometry.

---

## Dependencies added

| Package | Version | Why |
|---------|---------|-----|
| `zustand` | `^5.0.15` | Temporal state store (getState in useFrame, selectors in DOM) |
| `@react-three/postprocessing` | `^3.0.5` | EffectComposer: N8AO, Bloom, Vignette, SMAA |
| `postprocessing` | `^6.39.4` | Peer dep of @react-three/postprocessing |
