# Ground plane aliasing and z-fighting — diagnostic audit

Code-first diagnostic of the severe Moire aliasing and zebra-striping on
the WebGL ground plane in orthographic CAD view and 3D Garden mode. No
fixes have been applied — this report is the remediation plan for sign-off
before code execution. Every claim cites `file:line` evidence read from
the current tree.

## Root cause report

### 1. Depth-buffer quantization z-fight (primary — the zebra striping)

The orthographic projection maps a 20,000-metre depth span into the
24-bit depth buffer:

- `apps/web/src/components/canvas/webgl/cameraAnimation.ts:168` — the
  scratch ortho camera is constructed with `near = -10000, far = 10000`.
- `cameraAnimation.ts:190-191` — `updateOrtho` re-asserts those bounds
  every frame before writing the matrix.
- Depth resolution = 20000 m / 2^24 ≈ **1.19 mm per depth unit**.

Against that, the coplanar layer stack is separated by millimetres:

- Ground plane at y = 0: `StudioScene.tsx:615`.
- Grid at y = 0.001 (exactly 1 mm): `StudioScene.tsx:629`.
- Terrain mesh at y = 0: `TerrainMesh.tsx:128`.
- Draped layers: ink `FLAT_Y = 0.02` (`FusedSketchLayer.tsx:54`), features
  `FEATURE_Y = 0.03` (`FeatureLayer.tsx:26`), semantic 0.06 and markers
  0.08 (`layerContract.ts:20-25`).

The grid's 1 mm lift is **inside one depth-quantization bucket** of the
ortho span, so grid and ground alternate winning the depth test per pixel
per frame — zebra striping by construction in every orthographic view
(CAD). At blend > 0 the lerped matrix (`cameraAnimation.ts:257-269`)
carries the same span, and the perspective matrix is dynamic
(`far = distance * 4`, `cameraAnimation.ts:216`), which is why Garden mode
fights less but still stripes at the 0.02/0.03 offsets during tilt. The
`Canvas` prop `near: 0.1, far: 10000` (`WebGLStudio.tsx:212`) is
overridden per-frame by the fused matrices but documents the same disease.

### 2. Grid line-frequency Moire (secondary — the interference shimmer)

- `StudioScene.tsx:626-629`: `gridHelper` with
  `args={[w, Math.round(w), ...]}` and `w = scaleM * GROUND_CONTEXT_EXTENT`
  (`terrainMath.ts:33`, extent = 3). A 110 m site renders a 330 m board
  with **330 divisions at 1 m cells** — hundreds of 1 px `LineSegments`
  across the viewport at plan zoom-out. Sub-pixel line density produces
  classic Moire; MSAA (`WebGLStudio.tsx:213`, `antialias: true`,
  `dpr [1, 1.5]`) cannot resolve lines thinner than a pixel.
- No unit-conversion mismatch was found: the helper receives metres and
  metres are consistent; the problem is frequency, not units.

### 3. Texture mipmapping — ruled out

A repo-wide grep for `minFilter | magFilter | anisotropy | LinearMipmap`
over `apps/web/src/components/canvas/webgl` returns **zero matches**. The
ground is a colour-only `meshStandardMaterial` (`StudioScene.tsx:617-624`)
with no repeating texture, so mipmapping and anisotropy play no part in
these artifacts. No renderer-filter change is required.

## Component impact map

| Component | Verdict |
|-----------|---------|
| Camera depth span (`cameraAnimation.ts:190-191`) | **Global amplifier** — every near-coplanar pair fights under the 1.19 mm bucket; the single highest-leverage fix. |
| Grid vs ground (`StudioScene.tsx:626-629` vs `:615`) | Worst pair (1 mm lift ≈ 0.84 depth units); the visible zebra striping. |
| Terrain vs ground (`TerrainMesh.tsx:128`, `StudioScene.tsx:723-726`) | Compliant — XOR mount, never both; not a co-stack source. |
| Ink / features (0.02 / 0.03) | ~17 / 25 depth units apart at the extreme — marginal today, safe after the span fix. |
| Selected-feature overlay (`FeatureLayer.tsx:160-168`) | Same Y as its base line, wider line only — no visible fight; no action. |
| Grid cell density (330 × 1 m) | Moire shimmer in both modes; scales with site size (`scaleM × 3`). |

Conclusion: the artifact is **not isolated to one layer** — it is a global
camera depth-precision defect (cause 1) made visible by the grid (cause 2).

## Proposed remediation plan (minimal, non-breaking)

1. **Shrink the ortho depth span** — `cameraAnimation.ts:168` and
   `:190-191`: `near/far ±10000` → `±120`. The scene envelope (camera
   height ≤ ~100 m + terrain relief + clearance) fits comfortably in
   ±120 m; precision becomes 240 / 2^24 ≈ **0.014 mm per unit (~85×
   better)**. This alone ends the z-fighting class.
2. **Lift the grid clear of the quantization floor** — `StudioScene.tsx:629`:
   `position={[0, 0.001, 0]}` → `[0, 0.01, 0]` (10 mm ≈ 700 depth units
   after fix 1). Visually indistinguishable; z-fight impossible.
3. **Reduce grid frequency** — `StudioScene.tsx:628`:
   `Math.round(w)` divisions → `Math.round(w / 10)` (10 m cells, or a
   scale-invariant ~64-cell count). Kills the 1 m-cell Moire. Major/minor
   grid lines are a follow-up, not part of the minimal fix.
4. **Hygiene** — `WebGLStudio.tsx:212`: `far: 10000` → `far: 500` so the
   declaration matches the envelope (overridden per frame anyway).
5. **Fallback only if 1-3 are insufficient** — `polygonOffset` on the
   ground mesh (`StudioScene.tsx:615`, factor −1, units −1). Deprioritized;
   1-3 are expected to resolve fully.
6. **Known limitation (unchanged behaviour)** — the flat grid hides under
   terrain relief on high ground exactly as today; draping the grid onto
   the terrain is a follow-up, not part of this fix.

## Verification plan (after sign-off)

- Unit-test the new matrix bounds in `cameraAnimation.test.ts` (assert the
  ortho near/far envelope).
- Repo typecheck + lint gates.
- Visual pass: `webgl-preview-smoke` and `webgl-default-mount` e2e
  (regression), plus a screenshot comparison in CAD (ortho) and Garden
  (perspective) modes for the zebra/Moire.
