# Gold Standard 2026 — Architecture Spec

> **Subordinate to [`GOLD-STANDARD-2026.md`](./GOLD-STANDARD-2026.md).**
> This document specifies the WebGL-primary rendering architecture, the
> scene-graph contract, the chrome layering model, and the data pipeline from
> `SpatialObject` to rendered geometry.

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

- `alpha: false` — the canvas clears to `--gs-canvas` (`#101418`) every frame.
- The `<Canvas>` is `position: absolute; inset: 0` — full-bleed per §2 Code Law.
- **SSR boundary:** R3F `<Canvas>` is dynamically imported with `ssr: false`:
  ```ts
  const WebGLStudio = dynamic(() => import("./WebGLStudio"), { ssr: false });
  ```

### 1.2 Coordinate system — metre-space, origin-locked

- **1 Three.js unit = 1 metre.** The `%`-coordinate SVG board (`viewBox 0 0 100 100`) is retired.
- **Origin `(0, 0, 0)`** is the primary survey peg, marked with a Signal Blue (`--gs-truth`) crosshair. This is the "Local Origin Lock" (Step 0).
- The X/Y plane is the ground; +Z is up (elevation/height).
- All geometry is authored in metre-space. The `geometry/` pure-maths functions (polygon area, perimeter, TPZ radius) are unit-agnostic and port directly — they receive metre-space polygons instead of `%`-space polygons.

### 1.3 Camera rig — ortho-with-tilt

A hybrid camera that serves both the 2D CAD plan view and the 3D "Vertical Truth" (Phase 2):

- **Default:** orthographic, top-down (`position: [0, height, 0]`, looking down `-Z`). This is the CAD operator view — no perspective distortion, true measurements.
- **Tilt:** the camera lowers to an oblique angle (`position: [0, height·cos(θ), height·sin(θ)]`), transitioning to perspective for the 3D elevation/tilt view.
- **Pan:** translate the camera (or a group containing all geometry) in the X/Y plane.
- **Zoom:** orthographic zoom (adjust `camera.zoom`), not dolly — preserves the flat-measurement quality.
- **Inverse camera math:** `clientToBoardMetres(clientX, clientY)` — the replacement for `clientToBoardPct`. Uses `raycaster` from camera through pointer, intersected with the ground plane (`z = 0`).

---

## 2. Scene-graph contract — `SpatialObject` is the node

Every rendered element in the scene is hydrated from a `SpatialObject[]`.
This is the §5 "Data Integrity" mandate: **all imported assets must map to
`SpatialObject`.**

### 2.1 The schema (extended)

The existing `SpatialObjectSchema` in `packages/contracts/src/schemas/orchestration.ts`
is extended with the 3D + utility fields the new engines require:

```ts
SpatialObjectSchema = z.object({
  id: z.string(),
  layer: SpatialLayerSchema,          // hardscape | softscape | irrigation | lighting | topography | structure | other
  label: z.string(),
  symbol_id: z.string().optional(),
  source: z.enum(["placement", "cad", "irrigation"]),
  area_m2: z.number().default(0),
  length_m: z.number().default(0),
  depth_m: z.number().optional(),     // existing — burial depth for utilities
  height_m: z.number().optional(),    // existing — extrusion height for structures/trees
  volume_m3: z.number().optional(),
  count: z.number().int().positive().default(1),
  x_pct / y_pct: z.number().optional(),  // legacy % position (migration)
  x_m / y_m: z.number().optional(),      // NEW — metre-space position
  elevation_m: z.number().optional(),    // NEW — RL (relative level)
  mature_canopy_m: z.number().optional(),
  root_radius_m: z.number().optional(),
  // NEW — utility fields (Subsurface Engine + Strike Alert)
  utility_type: z.enum(["gas", "water", "sewer", "electric", "comms", "reclaimed"]).optional(),
  pressure_drop: z.number().optional(),  // Hydrological Pulse
  gpm: z.number().optional(),            // Hydrological Pulse
});
```

### 2.2 Scene-graph components

Each `SpatialObject` renders as an R3F component based on its `layer`:

| Layer | Component | Geometry |
|-------|-----------|----------|
| `hardscape` | `<HardscapeMesh>` | Extruded shape from polygon (`depth_m`) |
| `softscape` | `<SoftscapeMesh>` | Filled shape (lawn/bed/garden bed) |
| `irrigation` | `<IrrigationRun>` | Tube geometry (`<TubeGeometry>`) + GPM billboard |
| `lighting` | `<LightingConduit>` | Tube geometry + fixture sprite |
| `topography` | `<ContourMesh>` | Elevation contour lines / mesh |
| `structure` | `<StructureMesh>` | Extruded building footprint (`height_m`) |
| Trees (softscape w/ `mature_canopy_m`) | `<TreeSprite>` | Billboard canopy sprite + `<Ring>` TPZ |

### 2.3 Boundary + origin

- **Lot boundary:** `<LotBoundary>` — `<Line>` (drei) in `--gs-truth`. Data from Vicmap title or traced polygon.
- **Easements:** `<Easement>` — dashed `<Line>` in `--gs-truth`.
- **Origin peg:** `<OriginPeg>` — Signal Blue crosshair at `(0, 0, 0)`, always visible.

---

## 3. Chrome layering — DOM overlay above the Canvas

### 3.1 The three layers

```
┌─────────────────────────────────────────┐
│  Layer 3: DOM Chrome Overlay (Glass)    │  ← pointer-events: none on container, auto on cards
├─────────────────────────────────────────┤
│  Layer 2: R3F <Canvas> (WebGL)          │  ← the drawing
├─────────────────────────────────────────┤
│  Layer 1: Canvas Base (#101418)         │  ← clear color
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

## 5. State layer — unchanged contract

The `useStudioState` reducer hook (~4,500 lines) is **preserved**. It holds:

- `StudioItem[]` — the design objects (placements, strokes, zones).
- Tool / mode / UI state.
- The persistence contract (`canvasBridge.ts` ↔ API autosave).

The WebGL components consume the same state via the same hook. What changes is
the **rendering shell**: the 6,344-line `HandoffDesignStudio.tsx` (SVG +
CSS-transform camera + portal chrome) is replaced by `WebGLStudio.tsx`
(R3F `<Canvas>` + DOM overlay + Glass Cards). The feature modules under
`features/*` become consumers of the new shell.

---

## 6. Mode system — preserved, extended

The URL-driven mode system (`?mode=survey|sketch|cad|elevation|quote|present|share|garden`)
is preserved. The brief's five workflow stages map onto it:

| Brief stage | Mode(s) |
|-------------|---------|
| Step 0: Site Truth | `survey` |
| Phase 1: Sketch Studio | `sketch` |
| Phase 2: CAD Operator | `cad`, `elevation` (tilt) |
| Phase 3: Client Proposal | `quote`, `present` |
| Phase 4: Build Pack | `share` |

`handoffChrome.ts` (`resolveHandoffChrome`) is extended to control which
WebGL layers (subsurface, strikes, hydrology) and which Glass Cards are
visible per mode — e.g. `present` hides Subsurface + Strike meshes but keeps
Live BOM widgets.

---

## 7. Mobile Field Bridge (Phase 4)

The mobile AR surface renders the same `SpatialObject` data in a camera-feed
overlay:

- **react-three-fiber/native** (or expo-gl + three) for the AR scene-graph.
- **Staking chips:** `--gs-primary` (`#fbbf24`) sprites anchored to GPS/RTK coordinates.
- **Subsurface ghosting:** translucent utility volumes (same `--apwa-*` colors) rendered at their `depth_m` below the device's ground plane.
- **Strike alerts:** `--gs-conflict` (`#ef4444`) high-contrast billboards when device GPS enters a utility danger zone.

The mobile scene-graph is a **parallel consumer** of `SpatialObject[]`, not a
shared component tree with web (R3F native has a different reconciler).
