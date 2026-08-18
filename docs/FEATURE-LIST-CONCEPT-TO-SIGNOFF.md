# Workstream — Full Workflow Feature List (Concept → Signoff)

**Date:** 2026-08-17 · **Companion docs:** `PRODUCTION-ROADMAP-2026-08-17.md`
(phases + rails) · `DESIGN-PRINCIPLES-2026.md` (AI-native · canvas-first ·
gold-standard) · `SITE-INFRASTRUCTURE-AUTOMATED-LINKS.md` (Vicmap/BYDA).

This is the **workflow-level** feature list — every capability needed to take a
landscape project from first idea to signed-off quote, benchmarked against the
professional toolset (Vectorworks Landmark, DynaScape, VizTerra, Irricad/
RainCAD).

> **Accuracy note (2026-08-17):** the coverage column below was re-verified
> against the codebase with an evidence sweep. Earlier drafts marked several
> built features as "not wired" — those are corrected to ✅. The genuinely
> missing items are all P2 (construction details, council-pack export,
> DWG/DXF, change orders).
>
> **[2026-08-18 update]** C2 "scribble over a site photo" is now fully
> covered by the shipped photo-trace elevation capstone (WebGL studio,
> working tree); C6 sketch→CAD parse is built and wired but only into the
> classic studio + pipeline — **not yet surfaced on the WebGL studio**.
> F3 signoff shipped (PR #175); the open item is record trace (signoff must
> freeze the accepted quote). Current entry doc: `ONBOARDING.md`.

**Legend:** ✅ built · 🟡 partial · ⬜ missing · **P0** must ship · **P1**
should ship · **P2** later. **Ground-truth rule:** every estimate must trace to
a real source; anything not traceable is labelled *indicative*.

---

## Stage A — Project intake & site setup (Screen 1 entry)

| # | Feature | Coverage | Priority | Evidence |
|---|---------|----------|----------|----------|
| A1 | Create project from an address | ✅ | P0 | geocode + aerial capture wired |
| A2 | Vicmap title hydrate (boundary, dwelling, easements, urban trees, neighbour buildings) | ✅ | P0 | `vicmap.ts` WFS lib + `POST /boundary/auto-trace` + server action + studio wiring; **verified live** (real 515 m² ring) |
| A3 | Keyless overlay hydrate (planning · bushfire · contour · flood · heritage · water_corp · road_casement · acid_sulfate · wetland) | ✅ | P0 | `KeylessHydrate` contract + discovery scorers + `routes/keyless.ts` + `KeylessOverlayWash` |
| A4 | Council / BYDA data links (sewer, stormwater, water, gas, power, NBN) | 🟡 | P0 | Typed BYDA strokes + stormwater-geojson ingest; live council data pull partial |
| A5 | Survey 5/5 checklist (boundary, dwelling, trees, levels, services/easements) | ✅ | P0 | Survey mode + gate |
| A6 | Handheld field capture → project (photo, measure, grid-soil, voice) | 🟡 | P1 | Screens exist; offline + sync missing |
| A7 | Project versioning / history / undo | ✅ | P0 | `design-vcs.ts` (branches + revisions) |

**Rail:** survey completeness + traceability gate.

---

## Stage B — Site analysis (ground truth, derived)

| # | Feature | Coverage | Priority | Evidence |
|---|---------|----------|----------|----------|
| B1 | Sun / shade analysis (seasonal + daily, Southern Hemisphere) | ✅ | P0 | SunCastOverlay + 3D sun rig; season single-source |
| B2 | Terrain / contours from spot levels (IDW mesh) | ✅ | P0 | TerrainMesh + terrainMath |
| B3 | Drainage analysis (overland flow, ponding, cut/fill) | 🟡 | P1 | DrainageFlowLayer exists; cut/fill volumes partial |
| B4 | Slope analysis | 🟡 | P2 | From terrain mesh |
| B5 | Soil entry (grid-soil) | ✅ | P1 | Mobile grid-soil screen |
| B6 | TPZ / arborist (DBH → TPZ rings) | 🟡 | P1 | TPZ rings exist; DBH capture + schedule partial |
| B7 | Setback / buildable area (compliance) | ✅ | P0 | BuildableAreaOverlay + compliance dock |
| B8 | Live measures (indicative metre readouts) | ✅ | P1 | Live measures + scale bar |

---

## Stage C — Concept design (Screen 2)

| # | Feature | Coverage | Priority | Evidence |
|---|---------|----------|----------|----------|
| C1 | Freehand sketch (pen, eraser, tip grades) | ✅ | P0 | Sketch dock |
| C2 | Scribble over aerial **or** over a site photo | ✅ | P0 | Image layers (upload/underlay) + freehand on top; mobile `measure-photo` |
| C3 | AI tidy / formalize freehand | ✅ | P0 | `sketch-tidy` + `sketch-convert-cad` (SketchBoard) |
| C4 | Bubble diagrams / concept zones | 🟡 | P1 | Zone tool exists; diagramming partial |
| C5 | Concept presentation (birdseye render) | 🟡 | P1 | 3D garden + present mode partial |
| C6 | Sketch → CAD parse (closed, snapped geometry) | ✅ | P0 | `SketchToCad` contract + Claude-vision flow + heuristic fallback |
| C7 | Freehand style export (over-image birdseye) | 🟡 | P1 | |

**Rail:** sketch → CAD fidelity gate.

---

## Stage D — Design development / CAD (Screen 3)

| # | Feature | Coverage | Priority | Evidence |
|---|---------|----------|----------|----------|
| D1 | Planting design — plant database, palette, placement | ✅ | P0 | `PlantPaletteSchema` + `plant-palette.json` seeds + FloraRingLayer / AssetPlaceLayer |
| D2 | Plant schedule / legend (auto from placed plants) | ✅ | P0 | `buildPlantingSchedule` (ops-schedules) |
| D3 | Hardscape — paving, decks, walls, paths | 🟡 | P0 | Hardscape assets exist; detailing partial |
| D4 | Softscape — lawns, beds, hedges | 🟡 | P0 | |
| D5 | Levels & grading (cut/fill volumes) | 🟡 | P1 | Terrain mesh; volume calcs partial |
| D6 | Drainage design (french drains, stormwater routing) | 🟡 | P1 | DrainageFlowLayer |
| D7 | Irrigation design — zones, hydraulics, uniformity | ✅ | P0 | `calculateHydraulicRun` (hydrology) + `assessIrrigationUniformity` + zones |
| D8 | Lighting design (LV beams, workspace) | 🟡 | P2 | Lighting dock partial |
| D9 | Trenches / services (auto-trench, ghost dig paths) | ✅ | P1 | Auto trench + services ledger |
| D10 | 3D garden / terrain simulation (sun, shade, root volumes) | ✅ | P0 | WebGL studio + demo garden |
| D11 | Live BOM / estimation (assemblies, quantities, cost) | ✅ | P0 | `useStudioEstimate` — sync seed + **Web Worker** settle, recomputes on every geometry commit |
| D12 | Variation schemes (A/B/C) | 🟡 | P2 | Session-only, not generative |

**Rail:** design → BOM gate — every placed asset appears costable in the BOM.

---

## Stage E — Documentation & estimation (Screen 3 → 4)

| # | Feature | Coverage | Priority | Evidence |
|---|---------|----------|----------|----------|
| E1 | Plans, sections, elevations | ✅ | P1 | Elevation mode + silhouettes |
| E2 | Fit sheets / construction sheets (A3/A4, title block) | 🟡 | P0 | FitSheetOverlay; full sheet composition partial |
| E3 | Construction details (typical details) | ⬜ | P2 | Missing |
| E4 | Schedules — plant, irrigation, lighting, material | ✅ | P0 | `ops-schedules.ts` (planting/trench/lighting/material) |
| E5 | Material takeoff from closed geometry | ✅ | P0 | `cad-quantities` + BOM |
| E6 | Costing — materials + labor, live cost rail | ✅ | P0 | LiveCostRail + `cadQuoteAction` |
| E7 | Quote generation from boundary + BOM | 🟡 | P0 | QuoteBuilder + quote-doc; end-to-end polish |

**Rail:** quote accuracy + traceability gate.

---

## Stage F — Client & approvals (Screen 4)

| # | Feature | Coverage | Priority | Evidence |
|---|---------|----------|----------|----------|
| F1 | Presentation mode (deck pages, swatches) | 🟡 | P1 | Present surface partial |
| F2 | Share / portal (quote, scenario picker, deposit, accept) | ✅ | P0 | Portal + deposit |
| F3 | Signoff flow (revision + liability gate) | ✅ | P0 | **PR #175**: contracts + domain `signoffReadiness`/`createSignoffRecord` + store + GET/PUT route + `SignoffCard`; immutable once signed off |
| F4 | Client review / feedback loop | 🟡 | P2 | |
| F5 | Council / planning-approval pack export | ⬜ | P2 | Docs + overlays could feed this |

---

## Stage G — Construction handoff (post-signoff, future)

| # | Feature | Coverage | Priority | Evidence |
|---|---------|----------|----------|----------|
| G1 | Construction documents (sheet set) | 🟡 | P2 | Sheets partial |
| G2 | As-built / site notes (handheld) | 🟡 | P2 | Field screens exist |
| G3 | Change orders / revisions | ⬜ | P2 | |
| G4 | DWG/DXF export (paper space) | ⬜ | P2 | Explicitly out of scope today |

---

## Coverage vs professional toolset — the honest gaps

| Professional capability | Workstream | Priority |
| ----------------------- | ---------- | -------- |
| Plant database + plant schedule | ✅ built | — |
| Irrigation hydraulics (pipe sizing, water budget) | ✅ built (domain) | — |
| Live BOM wired to the drawing | ✅ built (worker) | — |
| Sketch → CAD conversion | ✅ built | — |
| Material takeoff → quote | ✅ built | — |
| Site-photo scribble + freehand export | ✅ built | — |
| **Construction details + schedules set** | ⬜ | P2 |
| **Council/approval pack export** | ⬜ | P2 |
| **DWG/DXF export** | ⬜ | P2 |
| **Change orders** | ⬜ | P2 |

**Conclusion:** the P0/P1 workflow is **substantially built**. The remaining
production work is hardening (persistence, offline sync for handheld, live
council/BYDA data, presentation/council-pack polish) rather than building core
features from scratch.

---

## Audit hooks (from this list)

- Weekly audit checks the P0 column against the rails in
  `PRODUCTION-ROADMAP-2026-08-17.md`.
- Traceability spot-check: every BOM/quote figure must trace to a ground-truth
  source (A2/A3/B6), else it is marked *indicative*.
- A feature is "done" only when its rail passes in CI, not when it ships code.
- **Run the Vicmap live smoke test each audit** (`VICMAP_LIVE=1 ... vicmap.live.test.ts`)
  to prove the ground-truth source is still reachable.
