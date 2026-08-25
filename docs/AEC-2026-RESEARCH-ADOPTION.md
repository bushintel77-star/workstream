# AEC 2026 Research Adoption — decision record (2026-08-25)

> **Status:** binding for the adopted scope below; subordinate to
> [`GOLD-STANDARD-2026.md`](./GOLD-STANDARD-2026.md) and its companion specs.
> This doc records what was adopted, deferred, and rejected from the uploaded
> "Architectural and Engineering Canvas Design Plan: 2026 Enhancements"
> research, the verified facts it rests on, and the stage-threading the
> adopted work must follow. **Sequencing: see
> [`AEC-2026-ROLLOUT-PLAN.md`](./AEC-2026-ROLLOUT-PLAN.md).** Work items live
> in [`OUTSTANDING.md`](../OUTSTANDING.md); current state lives in
> [`ONBOARDING.md`](../ONBOARDING.md).

---

## 1. Verified regulatory facts (the compliance engine's legal basis)

Web-verified 2026-08-25 against Planning Victoria sources:

- **Clause 54.02-6 / Standard A2-6 (Tree canopy)** — reformed **8 September
  2025** by **Amendment VC298** (the ResCode single-home-code overhaul):
  **1 canopy tree per 100 m² of site area**, each tree reaching
  **≥ 6 m height and ≥ 4 m canopy width at maturity**. Sources:
  [Planning Victoria — new streamlined requirements for single dwellings](https://www.planning.vic.gov.au/news/articles/new-streamlined-requirements-for-single-dwellings-and-small-second-dwellings),
  [Planning Victoria — Single Home Code guide](https://www.planning.vic.gov.au/guides-and-resources/guides/all-guides/residential-development/single-home-code),
  [VPP Amendment VC298 ordinance](https://planning-schemes.app.planning.vic.gov.au/Victoria%2520Planning%2520Provisions/histories/VC298/ordinance/17668343).
- **Clause 52.37 (Canopy Trees)** — separate provision, effective
  15 September 2025 (VC289): permit triggers for removing existing canopy
  trees + canopy-cover outcomes (~10% cover for sites ≤ 1,000 m²).
  Context only — not in the adopted scope.

**Honesty constraints (zero-mock-data law applies to legal output):**

- The exact **rounding/bracket table** for tree count vs site area was NOT
  verbatim-verified (secondary sources disagree at the margins — e.g. a
  250 m² lot reading as "2 trees"). The implementation must carry the
  threshold in one named, documented constant and stamp any signoff-grade
  output with the standard's identity (A2-6 / 54.02-6, VC298) so an
  operator can verify before relying on it. A single-standard check is
  **never** presented as a VicSmart-eligibility or permit guarantee.
- **Canopy overhang is intentional product law** (`outdoorClamp.ts`: "Tree
  canopy discs may overhang the fence — we never clip crowns to the lot").
  A2-6 enforcement is a **density + maturity** check; canopy-over-boundary
  surfaces as **advisory only**, never a hard clamp.

## 2. Research-vs-reality corrections (recorded so nobody rebuilds what exists)

| Research claim | Actual state (verified in code) |
|---|---|
| "Vicmap high-resolution DEM generates terrain meshes" | Terrain is a real IDW heightmap (`TerrainMesh.tsx` from `site_frame.levels`), but levels derive from **Vicmap vector contour lines** (keyless WFS, `keyless-job.ts` → `derived_levels`), not DEM rasters. Operator-authored spot levels win when present. |
| "Sketch-to-CAD as future AI work" | **Shipped** 2026-08-18: `interpretSketchStrokesToCad` classifier + Claude-vision parse with heuristic fallback, Tidy → ghost review, Convert → persisted `LandscapeFeature`s, ink kept as provenance. |
| "Authenticate with the Vicmap API" | Vicmap is **keyless DELWP GeoServer WFS with layer self-discovery** (`apps/api/src/lib/vicmap.ts`). The retired developer-API-key path must not be reintroduced. |
| "3D engine actively evaluates ResCode" | **No ResCode/VicSmart logic exists.** This is the genuinely new work (§3.1). The cited example "Kept inside outdoor area (lot − house)" is `outdoorClamp.ts`, not a ResCode check. |
| "Liquid Glass refracting panels; dark mode default" | Contradicts the supreme brief (calm zero-chrome paper; light canvas mandated). The adopted subset is a **transient motion state** only (§3.2). |

Also already-shipped research items, for the record: double-precision jitter is
solved by the metre-space `(0,0,0)` origin peg (no million-value coords reach
the GPU); real-sun + growth simulation exists (`sunGrowth`, `hatchSun.ts`);
frost/blur HUD chrome was a binding token until the 2026-08-25 opaque-card
release (see the tokens doc amendment log).

## 3. Adopted — full scope, threaded through the platform stages

### 3.1 ResCode A2-6 canopy compliance engine

Pure assessment in `packages/domain` (thresholds per §1), surfaced through
every stage of the canvas:

| Stage / mode | Surface |
|---|---|
| Survey (`survey`) | Baseline: once title hydrate gives site area, show the **required** canopy-tree count for the lot — before any design exists. |
| Sketch (`sketch`) / CAD (`cad`) | Live assessment as trees land (placements with tree SKUs + canopy features): provided vs required, per-tree maturity gate (≥ 6 m height, ≥ 4 m canopy width), advisory-only canopy-overhang note. |
| Quote (`quote`) | Compliance summary row on the fit sheet, carried into signoff context — with the standard's identity stamped, never a permit claim. |

Constraints: reads the title boundary as the single source of truth (raises no
new boundary-reconciliation event — it consumes, never places); chrome uses
current tokens; a11y per §3.3.

### 3.2 Motion-aware chrome recede (the compliant "Liquid Glass" subset)

While the camera orbits/pans/zooms, floating paper cards drop opacity
(~0.55 floor) so boundaries and canopies read beneath the chrome; full opaque
paper returns at rest. Optional hold-key peek. Constraints: **opacity only**
— no refraction/distortion, no reintroduction of resting frost blur (removed
deliberately 2026-08-25), no dark mode; contrast gates still apply at rest.
Camera-motion signal derives from the existing rig; implementation must not
re-introduce per-frame `backdrop-filter` changes.

### 3.3 ARIA Graphics accessibility (WAI-ARIA Graphics Module, WCAG 2.2)

A parallel accessible tree for the canvas: `graphics-document` on the studio
root, `graphics-object` for assemblies, `graphics-symbol` for indivisible
components (placements/features with labels), keyboard-reachable without
traps. Studio-wide (all modes).

## 4. Deferred (candidates, not committed)

- **DEM raster upgrade** — swap contour-derived levels for Vicmap Elevation
  DEM tiles where licensing/format allows; bounded enhancement, no spec yet.
- **Bento-grid inspector restructure** — IA refinement of the properties
  panel inside current tokens.
- **Ambient "pre-load next stage" assets** — cheap perf win along the
  Survey→Sketch→CAD rail.
- **Raster survey vectorization** (VTracer-style) — only if raster import
  becomes a feature; the existing `webgl/vectorize.ts` covers stroke fusion.

## 5. Rejected (with reasons — do not re-propose without new evidence)

- **Dark-mode default** — contradicts the supreme brief (high-key paper
  canvas; "depth from light, never darkness").
- **Liquid Glass as a design language** (refraction, distortion, adaptive
  materials) — visual theatrics the zero-chrome brief exists to refuse; only
  the §3.2 motion-opacity subset survives.
- **WebGPU-first deprecation of WebGL** — three ^0.185 ships
  `WebGPURenderer`/TSL so a migration is *possible*, but the binding
  architecture doc is WebGL/R3F, nothing in a site-scale scene is draw-call
  bound, and the research's perf figures are benchmark marketing. Revisit
  only via a Gold Standard architecture-doc revision.
- **OCCT / WASM CAD kernel** — 50 MB+ payload vs the CI bundle budget; the
  product's 2D-plan + light-3D geometry doesn't need a full B-Rep kernel.
- **Autodesk Forma / ERP live pricing** — external auth-and-cost dependency
  aimed at building takeoff, not landscape AEC; live supplier pricing is a
  fair roadmap idea but via AU landscape suppliers (see OUTSTANDING's
  supplier-price-feed placeholder) and cannot be stubbed.
- **RLRF/OmniSVG vectorization; voice/gaze multimodal** — research-grade or
  hardware-dependent; not roadmap.
