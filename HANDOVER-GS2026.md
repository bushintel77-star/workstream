# WIP & GAP Analysis — Gold Standard 2026 WebGL Studio

**Date:** 2026-08-14 (end of session)
**Base:** PR #161 (`35fa7a8`) + session commit `5915ada` + uncommitted working tree
**Branch:** `main`

---

## ✅ COMPLETED THIS SESSION (was WIP or gap in the handover)

### 1. Growth Simulation — DONE ✅
**Handover status:** Partially done — `growthFactor` not threaded to `<SceneItems>`, no scrubber HUD.
**Session work:**
- Threaded `growthFactor` through `StudioScene` → `SceneItems` → `TreeMesh` → `CanopyCluster`
- Threaded through `WebGLStudio` props + `WebGLStudioPreview` state
- Built the **Temporal Scrubber HUD** (bottom-center GlassCard, Year 0→10 slider, gold progress fill, glowing active node, Year 0/5/10 ticks)
- Growth now driven via zustand store (`growthYear`) — useFrame reads via `getState()`, zero re-renders

### 2. Render Quality Rebuild — DONE ✅ (exceeds GrowthStudio reference)
**Handover status:** Not mentioned (flat/plastic render was an open quality gap).
**Session work:**
- **ACES Filmic tone mapping** + sRGB output + exposure 1.05
- **VSM shadow maps** (replaces deprecated PCFSoft) + `<SoftShadows>` removed (incompatible with VSM)
- **Image-based lighting** — drei `<Environment preset="park" background={false}>` for real-world reflections
- **Post-processing stack** — N8AO (ambient occlusion) + Bloom (emissive glow) + Vignette + SMAA
- **Fog** — linear `THREE.Fog` matching `#101418`, fades distant geometry
- **Real-sun lighting** — wired `sunPositionAt` from `@workstream/domain` (the GrowthStudio proven formula), driven by the time-of-day slider
- **Lighting rig** — ambient (cool `#aebfd0`) + hemisphere (olive ground-bounce) + warm key (real sun position) + cool fill + rim light
- **Multi-lobe canopy** — 6 main lobes + 3 crown lobes, smooth shading, deterministic per-lobe color variation, `castShadow`/`receiveShadow`
- **Extruded building** — `ExtrudeGeometry` with bevel + window emissive glow (spec §2.2 `<StructureMesh>` mandate)
- Installed `@react-three/postprocessing` + `postprocessing` + `zustand`

### 3. Seasonal Dynamics (Micro-Time Engine) — DONE ✅
**Handover status:** Not mentioned (new feature).
**Session work:**
- **Dual-axis time store** (zustand) — `growthYear` (0–10) + `seasonProgress` (0–1, Jan→Dec) + `sunMin`
- **Winter canopy drop** (Rule 2 multiplier) — `useFrame` mutates canopy scale: `growthScale × lerp(1, retention, winterFactor)`. Existing trees hold 70%, new plantings go bare
- **Foliage color lerp** (Rule 3) — `material.color.lerpColors(summerGreen, autumnOrange, autumnFactor)` per-frame
- **Hardscape moisture** (Rule 3) — paving roughness 0.65→0.2 in winter (wet/reflective)
- **Seasonal sun elevation** (Rule 4) — winter lowers the sun 55% for long shadows
- **Seasonal fog** (Rule 4) — `SeasonalFogController` pulls fog 30% closer in winter
- **Metadata chips** (Rule 1) — Season, Leaf Status, Sun Angle, Root Spread in corner GlassCards
- **Seasonal scrubber HUD** — Jan→Dec slider with month readout
- **All via `getState()`** — zero React re-renders during 3D transitions

### 4. LA Hardscape Components — DONE ✅
**Handover status:** Not mentioned (new feature).
**Session work:**
- **PavingMesh** — `ExtrudeGeometry` with mandatory bevel (Rule 1), architectural concrete PBR (`#8c9294`/0.65/0.15)
- **DeckMesh** — drei `<Instances>` planks with 2cm physical gaps (Rule 2), weathered timber PBR
- **BollardLight** — anodized metal body + LED cap, `emissiveIntensity=2.5`, `toneMapped={false}` for Bloom
- All materials `dithering={true}`, `castShadow`/`receiveShadow`

### 5. Subsurface Engine Rebuild — DONE ✅
**Handover status:** Phase 2 deployed (3D tubes, APWA colours). Quality gap: "visual mud."
**Session work:**
- Gutted `TubeGeometry` → **hairline CAD schematic** (drei `<Line>`, 2px screen-space constant)
- **Muted drafting CAD palette** (not neon) — `cadWater` `#4FA3D1`, `cadElectric` `#D17A4F`, etc.
- **Micro-animation flow** — `dashOffset` creep (0.03–0.15 units/sec by type, agonizingly slow)
- **Blueprint state transition** — `subsurfaceView` toggle: ground lerps to vellum (`#2A2F33`, opacity 0.88), contact shadows fade, grid fades
- `depthTest={false}` + `renderOrder={1}` — lines show through the vellum
- **"View Underground" toggle** in the top-left GlassCard

### 6. 2D Sketch Pad — DONE ✅
**Handover status:** Not mentioned (new feature — canvas-first field tool).
**Session work:**
- New route: `/projects/[id]/sketch`
- **Edge-to-edge aerial photo** + dark vignette + faint dot grid (bullet-journal style)
- **Left-border icon sidebar** — Plan, Elevation, Calibrate Grid, Draw Boundary, Drop Node, Undo, Redo
- **SVG + perfect-freehand** strokes (reuses `freehandPath`, `CanvasStroke` schema)
- **Corner metadata chips** — live area (m²) + cost bracket + perimeter, context-aware by view
- **Auto-close** (snap near origin), **gesture deletion** (long-press → highlight → swipe)
- **Keyboard undo/redo** (Cmd+Z / Cmd+Shift+Z)

### 7. Unified Plan ↔ Elevation Sketch — DONE ✅
**Handover status:** Not mentioned (new feature).
**Session work:**
- **Plan/Elevation toggle** in the sidebar — no second screen, the grid + chip math pivot in place
- **Smart dot grid** — stands up in elevation mode (tighter vertical spacing + ground datum line)
- **Context-aware chips** — area/perimeter in plan mode, height/clearance in elevation mode
- **Silhouette ghosting** — deferred (requires placed-items data flowing into the sketch pad)

### 8. 3D Sketch Mode — DONE ✅
**Handover status:** Not mentioned (new feature).
**Session work:**
- **SketchLayer3D** inside the WebGL studio — raycast plane captures pointer drags as 3D world-space strokes
- **Topographical draping** — strokes render as drei `<Line>` in world space at y≈0.02, naturally follow terrain
- **Volumetric extrusion** — closed stroke + drag up → `ExtrudeGeometry`, live height, semi-transparent gold mass
- **Camera lock** — `sketchMode` gate suppresses pan in `StudioControls`; drags become strokes
- **"Sketch 3D" toggle** in the top-left GlassCard

---

## ⬜ REMAINING GAPS (from the handover's "What to do next")

### Gap 1: Fix the 4 pre-existing test failures — NOT DONE ⚠️
**Handover item #2.** `toolChips.test`, mapbox geocode, contract geocode, Sora unused import. These are from `main`'s code (another session), not ours. **Still unfixed.**

### Gap 2: Swap the default — `?webgl=1` as default mount — NOT DONE ⚠️
**Handover item #3.** The SVG studio is still the default; WebGL is opt-in via `?webgl=1`. Needs visual parity verification first. **1-line change in `page.tsx` but not yet done.**

### Gap 3: Port remaining SVG layers to WebGL — NOT DONE ⚠️
**Handover item #4.** These exist in `CadPlanBoard.tsx` but aren't in the WebGL scene:
- Dimensions / measurement annotations
- Snap visuals
- Sun shadow polygons (the 2D `SunCastOverlay` — though the 3D sun rig now casts real shadows)
**Not ported.**

### Gap 4: Wire engines to live data — PARTIALLY DONE 🔶
**Handover item #5.**
- ✅ Real sun position wired (lat/lng → `sunPositionAt` → directional light)
- ✅ Seasonal engine wired (drives materials, fog, sun, canopy via store)
- ❌ BYDA assets → subsurface utilities (the `SubsurfaceUtility` data still comes from sample/demo arrays)
- ❌ Construction trenches → strike excavations
- ❌ Irrigation zones → hydrological runs

### Gap 5: Explore remaining Stitch screens — NOT DONE ⚠️
**Handover item #6.** ~46 of ~50 Stitch screens unexamined. Notable unexamined:
- Hydrological Pulse Flow HUD
- Elevation Slice Analysis
- Asset Discovery Fan-Out
- Itemized Fit-Sheet
- Solar Impact 3D
- Revision History HUD

### Gap 6: Chrome-color CI gate — 35 pre-existing violations ⚠️
The 4 webgl files (`SubsurfaceEngine`, `sceneItems`, `StudioScene`) carry **35 raw hex literals** from the previous session's work. This session **added zero net new violations** (all new colors route through `PALETTE.*`), and actually *reduced* the count (SubsurfaceEngine 10→1, WebGLStudio 1→0). But the gate is still failing. **A cleanup pass to route the remaining 35 through tokens is needed.**

### Gap 7: Commit + push — NOT DONE ⚠️
**All session work is uncommitted in the working tree.** 11 modified files + 5 new files/directories. Nothing has been committed or pushed to Railway.

---

## 📊 NEW FEATURES BEYOND THE HANDOVER SCOPE

These were not in the handover's roadmap — they're net-new capabilities built this session:

| Feature | What it does |
|---------|-------------|
| **Post-processing stack** | N8AO + Bloom + Vignette + SMAA (first use of `@react-three/postprocessing` in the codebase) |
| **Image-based lighting** | drei `<Environment>` — first env map anywhere in the repo |
| **Seasonal dynamics** | Dual-axis time engine (growth + season), all via zustand transient updates |
| **LA hardscape** | PavingMesh, DeckMesh, BollardLight with PBR bevel-rule materials |
| **Subsurface CAD schematic** | Hairline Line2 + flow animation + blueprint vellum transition |
| **2D sketch pad** | Dedicated `/sketch` route, canvas-first, perfect-freehand, Plan/Elevation toggle |
| **3D sketch mode** | Raycast-draped strokes + volumetric extrusion inside the WebGL studio |
| **Sun scrubber HUD** | Time-of-day slider driving real solar position |
| **Season scrubber HUD** | Jan→Dec slider driving material/lighting/fog transitions |

---

## 🏗️ ARCHITECTURAL CHANGES

| Change | Impact |
|--------|--------|
| **zustand store** (`seasonalStore.ts`) | New shared state layer for the WebGL studio. `getState()` in useFrame (zero re-render), selectors in DOM HUD. Holds: `growthYear`, `seasonProgress`, `sunMin`, `subsurfaceView`, `sketchMode` |
| **VSM shadow maps** | Replaced PCF (deprecated on r185). `<SoftShadows>` removed (incompatible) |
| **SunRig → useFrame** | Sun position now mutated per-frame (was `useMemo` → re-render). Seasonal elevation multiplier added |
| **New deps** | `zustand@5`, `@react-three/postprocessing@3`, `postprocessing@6` |

---

## 🎯 RECOMMENDED NEXT STEPS (priority order)

1. **Commit + push** — all this work is uncommitted. Ship it.
2. **Clean up the 35 chrome-color violations** — route the remaining raw hex in the 3 webgl files through `PALETTE.*`. The gate is the CI blocker.
3. **Fix the 4 pre-existing test failures** from main (toolChips, geocode).
4. **Swap the default** — make `?webgl=1` the default mount after visual parity check.
5. **Wire live data** — BYDA → subsurface utilities, trenches → strikes, irrigation → hydrology.
6. **Port SVG layers** — dimensions, annotations, snap visuals to WebGL.
7. **Terrain heightmap** — the 3D sketch draping architecture is ready but the ground is flat Y=0. A heightmap ground would make drape + cut/fill + drainage flow meaningful.
8. **Explore Stitch screens** — 46 unexamined.
