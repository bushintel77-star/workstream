# Gold Standard 2026 — Architecture Spec

> **Subordinate to [`GOLD-STANDARD-2026.md`](./GOLD-STANDARD-2026.md).**
> This document specifies the WebGL-primary rendering architecture, the
> scene-graph contract, the chrome layering model, and the data pipeline from
> `SpatialObject` to rendered geometry.
>
> **Corrected 2026-08-18 (docs-vs-code audit):** §5 was rewritten — the
> WebGL studio runs its own zustand store and does **not** share the classic
> `useStudioState` hook (the two meet only at the persisted canvas). §2.1/§2.2
> now reflect the shipped schema and scene-graph component names; §1.2, §1.3,
> §6, §7 were reconciled with the current token, camera, mode, and mobile
> facts. See [`ONBOARDING.md`](../ONBOARDING.md) for the consolidated
> current-state picture.

---

## 1. Rendering surface — Three.js / React Three Fiber

The primary drawing surface is a **WebGL context** rendered via
`@react-three/fiber` (R3F) + `@react-three/drei`.

### 1.1 The Canvas

```tsx
<Canvas
  camera={{ /* orthographic top-down, tiltable to perspective */ }}
  gl={{ antialias: true, alpha: false }}
  style={{ position: "absolute", inset: 0 }}
>
  <StudioScene />
</Canvas>
```

- `alpha: false` — the canvas clears to `--gs-canvas` (`#F4F4F4`, Studio Paper) every frame (set in `onCanvasCreated` via `gl.setClearColor(PALETTE.gsCanvas)`).
- The `<Canvas>` is `position: absolute; inset: 0` — full-bleed per §2 Code Law.
- **SSR boundary:** the R3F `<Canvas>` ships behind a client-only dynamic
  import inside `WebGLStudioPreview.tsx` (and `SplitViewLens.tsx`), not in
  the page itself:
  ```ts
  const WebGLStudio = dynamic(() => import("./WebGLStudio"), { ssr: false });
  ```
  `apps/web/src/app/projects/[id]/page.tsx` imports `WebGLStudioPreview`
  statically; the preview is the `"use client"` shell that lazy-loads the
  WebGL bundle with a flat canvas-coloured loading fallback.

### 1.2 Coordinate system — metre-space, origin-locked

- **1 Three.js unit = 1 metre.** The `%`-coordinate SVG board (`viewBox 0 0 100 100`) is retired.
- **Origin `(0, 0, 0)`** is the primary survey peg, marked with a cobalt Truth-Anchor (`--gs-truth`, `#0030CF`) crosshair (`OriginPeg` in `StudioScene.tsx`). This is the "Local Origin Lock" (Step 0). Naming trap: the master brief's "Signal Blue (0,0,0) crosshair" predates the 2026-08-17 accent pivot — today Signal Blue means `--gs-primary` (`#3D5AFE`), and the peg renders in `#0030CF`.
- The X/Y plane is the ground; +Z is up (elevation/height).
- All geometry is authored in metre-space. The `geometry/` pure-maths functions (polygon area, perimeter, TPZ radius) are unit-agnostic and port directly — they receive metre-space polygons instead of `%`-space polygons.

### 1.3 Camera rig — ortho-with-tilt

A hybrid camera that serves both the 2D CAD plan view and the 3D "Vertical Truth" (Phase 2):

- **Default:** orthographic, top-down (`position: [0, height, 0]`, looking down `-Z`). This is the CAD operator view — no perspective distortion, true measurements.
- **Tilt:** the camera lowers to an oblique angle (`position: [0, height·cos(θ), height·sin(θ)]`), transitioning to perspective for the 3D elevation/tilt view.
- **Pan:** the rig's `panX`/`panY` world-space offsets, driven by pointer + wheel through the store refs (no per-frame React writes — `StudioControls.tsx`, zero-commit perf gate).
- **Zoom:** orthographic zoom factor (`rig.zoom`, 1 = fit), not dolly — preserves the flat-measurement quality.
- **Inverse camera math:** `raycastGround()` (`StudioControls.tsx`) intersects the pointer ray with the invisible ground plane (`z = 0`), then `worldToPct()` (`coordTransform.ts`) converts world → board-% — the metre-space replacement for the classic `clientToBoardPct`. At the elevation snap, the photo-trace plane skips the ray and unprojects directly (`PhotoTracePlane.hitFromEvent`) — see `CAMERA-STATE-MACHINE.md`, "Facade raycasting gotcha".

---

## 2. Scene-graph contract — `SpatialObject` is the node

Every rendered element in the scene is hydrated from a `SpatialObject[]`.
This is the §5 "Data Integrity" mandate: **all imported assets must map to
`SpatialObject`.**

### 2.1 The schema (extended)

The existing `SpatialObjectSchema` in `packages/contracts/src/schemas/orchestration.ts`
carries the 3D + utility fields the engines require. As shipped (2026-08), it is:

```ts
SpatialObjectSchema = z.object({
  id: z.string(),
  layer: SpatialLayerSchema,          // hardscape | softscape | irrigation | lighting | topography | structure | other
  label: z.string(),
  symbol_id: z.string().optional(),
  source: z.enum(["placement", "cad", "irrigation"]),
  area_m2: z.number().nonnegative().default(0),
  length_m: z.number().nonnegative().default(0),
  depth_m: z.number().nonnegative().optional(),     // burial depth for utilities
  height_m: z.number().nonnegative().optional(),    // extrusion height for structures/trees
  volume_m3: z.number().nonnegative().optional(),
  count: z.number().int().positive().default(1),
  x_pct / y_pct: z.number().min(0).max(100).optional(),  // legacy % position (migration)
  x_m / y_m: z.number().optional(),      // metre-space position
  elevation_m: z.number().optional(),    // RL (relative level)
  mature_canopy_m: z.number().nonnegative().optional(),
  root_radius_m: z.number().nonnegative().optional(),
  // utility fields (Subsurface Engine + Strike Alert)
  utility_type: z.enum(["gas", "water", "sewer", "electric", "comms", "reclaimed"]).optional(),
  gpm: z.number().nonnegative().optional(),          // Hydrological Pulse
  pressure_drop / pressure_drop_kpa: z.number().optional(),  // Hydrological Pulse
  // origin + maturity + strike extensions actually present in the schema
  site_origin_locked: z.boolean().default(true).optional(),
  origin_x / origin_y / origin_z: z.number().optional(),
  maturity_index: z.number().min(0).max(1).optional(),
  strike_alert: z.boolean().default(false).optional(),
});
```

(An earlier draft of this section listed a smaller subset; the schema has
since grown the origin-lock, maturity, and strike fields above.)

### 2.2 Scene-graph components (as shipped)

An earlier draft of this section named aspirational per-layer components
(`HardscapeMesh`, `SoftscapeMesh`, `IrrigationRun`, `LightingConduit`,
`ContourMesh`, `StructureMesh`, `TreeSprite`). None of those names exist in
code. The shipped scene graph is:

| What renders | Component (file) | Geometry |
|-------|-----------|----------|
| Trees / hedges / hardscape / decks / bollards / regions | `TreeMesh`, `HedgeMesh`, `PavingMesh`, `DeckMesh`, `BollardLight`, `RegionMesh` (`sceneItems.tsx`) | Multi-lobe canopy clusters, beveled extrusions, instanced deck planks |
| Boundary / easements / origin peg | `LotBoundary`, `Easements`, `OriginPeg` (`StudioScene.tsx`) | drei `<Line>`/segments draped on the terrain sampler |
| Terrain | `TerrainMesh` (`TerrainMesh.tsx`) | 60×60 displaced heightmap from spot levels (IDW, `terrainMath.ts`) |
| Subsurface utilities + strikes | `SchematicConduit`, `StrikePulse` (`features/SubsurfaceEngine.tsx`) | Hairline Line2 CAD schematic (muted `cad*` palette) + emissive PBR strike spheres |
| Ink (sketch) | `FusedSketchLayer` | Freehand strokes draped on terrain, extrude-to-mass |
| Drawable irrigation / lighting / trenches | `IrrigationZoneLayer`, `TrenchLayer` | Zone polygons / open fixture paths / trench runs |
| Photo-trace | `PhotoTracePlane` (+ `PhotoTraceHud`) | Vertical calibrated photo plane pinned on the title boundary |

### 2.3 Boundary + origin

- **Lot boundary:** `LotBoundary` — `<Line>` (drei) in `--gs-truth-soft`. Data from Vicmap title or traced polygon.
- **Easements:** `Easements` — dashed `<Line>` in `--gs-truth-soft` (`StudioScene.tsx`).
- **Origin peg:** `OriginPeg` — cobalt Truth-Anchor (`#0030CF`) crosshair at `(0, 0, 0)`, always visible, draped at the marker-layer clearance.

### 2.4 Spatial layer contract (2026-08-15)

In-canvas geometry declares its render policy via `layerContract.ts` — no
component invents its own depth offset. Law:

| Layer | Policy |
|---|---|
| `terrain` (0) | The ONE ground surface — `TerrainMesh` (levels) XOR flat `GroundPlane`, never both |
| `draped` (1) | Surface-following overlays (ink, flow, aerial): terrain height + 0.02 m, depth-tested |
| `semantic` (2) | Title/council truth (boundary, easements, services): terrain height + 0.06 m clearance |
| `markers` (3) | Survey furniture (origin peg): + 0.08 m |

Every line samples the shared terrain field
(`terrainMath.createElevationSampler` — the same math that displaces the
mesh), so geometry sits **on** the surface by construction. Constant-world-Z
lines are prohibited: the measured failure mode was the title boundary
intersecting ±7 m of relief — buried on high ground, floating on low
(`terrainDrape.test.ts` pins this). The terrain material itself is contoured
(elevation banding at the surveyor's 0.5 m interval + slope-based albedo +
noise breakup — `terrainMaterial.ts`) so relief reads from any light angle.

---

## 3. Chrome layering — DOM overlay above the Canvas

### 3.1 The three layers

```
┌─────────────────────────────────────────┐
│  Layer 3: DOM Chrome Overlay (Glass)    │  ← pointer-events: none on container, auto on cards
├─────────────────────────────────────────┤
│  Layer 2: R3F <Canvas> (WebGL)          │  ← the drawing
├─────────────────────────────────────────┤
│  Layer 1: Canvas Base (#F4F4F4 paper)   │  ← clear color
└─────────────────────────────────────────┘
```

- **Layer 2 (Canvas)** renders all geometry, subsurface volumes, strike alerts, hydrology, trees, boundaries.
- **Layer 3 (DOM overlay)** is a sibling `<div>` positioned above the `<Canvas>` (`position: absolute; inset: 0; pointer-events: none`). All Glass Card chrome renders here. Individual cards set `pointer-events: auto`.
- **Gate C (replaced):** the old `canvas-chrome-detector.spec.ts` checked that no chrome lived inside the CSS `.zoomWorld` camera transform. The new equivalent — `webgl-chrome-detector.spec.ts` — asserts that no DOM chrome renders inside the R3F `<Canvas>` element (all chrome is in the sibling overlay div).

### 3.2 Glass Card primitive

All floating instruments are **Glass Cards** per §2 Code Law:

```tsx
<GlassCard>
  {/* instrument content */}
</GlassCard>
```

- Background: `--gs-glass` at 70% + `backdrop-blur-md`.
- Radius: `16px` (`rounded-2xl`).
- No neumorphic plastic, no frost-paper, no dock shadows. Flat glass.
- Summoned (Cmd+K, contextual) — never a persistent opaque bar on the canvas.

### 3.3 Billboarding (§5 mandate)

All Meta Chips, labels, GPM badges, and dimension annotations that live in the
3D scene use `drei` `<Html>` with `transform` + billboard behavior, or Three.js
sprite materials — **they always face the camera regardless of tilt**.

---

## 4. Hydraulic isolation (§5 mandate)

The `(0,0,0)` origin peg is strictly excluded from active hydraulic run
calculations. This is enforced in `packages/domain/src/hydrology.ts`:

- Any irrigation/drainage run whose start or end point equals `(0, 0)` is
  treated as an incomplete survey artifact, not a real run.
- Unit-tested: `hydrology.test.ts` includes a fixture with an origin-anchored
  run and asserts it is skipped.

---

## 5. State layer — two stores, one persisted canvas (corrected 2026-08-18)

**Correction (2026-08-18 docs audit):** an earlier draft of this section
claimed the WebGL studio consumes the classic `useStudioState` hook. It does
not. The two studios run **separate in-memory stores** and meet only at the
persisted canvas document:

- **Classic SVG studio** (`HandoffDesignStudio`, `?svg=1`): the
  `useStudioState` reducer hook (`handoff/state/useStudioState.ts`, ~4,600
  lines) holds `StudioItem[]`, tool/mode/UI state, and the classic autosave
  path (`handoff/state/canvasBridge.ts` ↔ API autosave).
- **WebGL studio** (default mount): the unified zustand store
  `webgl/studioStore.ts` (`useStudioStore`; `webgl/seasonalStore.ts` is a
  backward-compat alias for the same instance) holds the fused camera rig,
  `sketchStrokes`, placements, photo-trace session, and the save-status
  machine (`webgl/useStudioAutosave.ts` → `saveDesignCanvasClient`).
- **Meeting point:** both stores persist into the same `DesignCanvas`
  document over the API, and both import the shared `StudioItem` / catalog
  types from the handoff layer. `webgl/stateBridge.ts` maps
  `StudioItem → RenderItem` (a structural pick, no value math;
  `coordTransform.pctToWorld` performs the %→metre conversion).

No React state is shared between the two mounts — a mode renders in one
studio or the other, never both. What changed between the classic shell and
the WebGL shell is the **rendering + state containers**, not the persisted
artifact: the 6,570-line `HandoffDesignStudio.tsx` (SVG + CSS-transform
camera + portal chrome) is the `?svg=1` fallback, while `WebGLStudio.tsx`
(R3F `<Canvas>` + DOM overlay + paper cards) is the primary surface, with
the classic `features/*` modules consumed by whichever shell mounts them.

---

## 6. Mode system — preserved, extended

The URL-driven mode system (`?mode=survey|sketch|cad|elevation|quote|present|share|garden`)
is preserved. The brief's five workflow stages map onto it:

| Brief stage | Mode(s) |
|-------------|---------|
| Step 0: Site Truth | `survey` |
| Phase 1: Sketch Studio | `sketch`, `garden` (eye-level 3D view) |
| Phase 2: CAD Operator | `cad`, `elevation` (tilt/facade) |
| Phase 3: Client Proposal | `quote`, `present` |
| Phase 4: Build Pack | `share` |

Per-mode visibility is resolved per surface: the classic studio uses
`handoffChrome.ts` (`resolveHandoffChrome`, classic-only); the WebGL studio
uses `layerPolicy.ts` (which in-canvas layers render per mode/lens), the
`PresentationLens` / `TECHNICAL_LENS` filter set, and mode-aware mounting in
`WebGLStudioPreview` — e.g. `present` hides Subsurface + Strike meshes but
keeps Live BOM widgets. (An earlier draft claimed `resolveHandoffChrome`
controls the WebGL layers; it does not — it is consumed only by
`HandoffDesignStudio.tsx`.)

---

## 7. Mobile Field Bridge (Phase 4)

The mobile AR surface renders the same `SpatialObject` data in a camera-feed
overlay:

- **react-three-fiber/native** (or expo-gl + three) for the AR scene-graph.
- **Staking chips:** `--gs-primary` Signal Blue (`#3D5AFE`) sprites anchored to GPS/RTK coordinates. (An earlier draft called this crimson; crimson is `--gs-conflict` and reserved for strikes — see TOKENS §1.2.)
- **Subsurface ghosting:** translucent utility volumes rendered at their `depth_m` below the device's ground plane. Colours follow the APWA utility locate set (`--apwa-*`, TOKENS §1.5 — the web studio renders its subsurface layer in the muted `cad*` drafting palette instead; both are legitimate, mode-invariant utility colours).
- **Strike alerts:** `--gs-conflict` (`#C41E1E`) high-contrast billboards when device GPS enters a utility danger zone.

The mobile scene-graph is a **parallel consumer** of `SpatialObject[]`, not a
shared component tree with web (R3F native has a different reconciler).
