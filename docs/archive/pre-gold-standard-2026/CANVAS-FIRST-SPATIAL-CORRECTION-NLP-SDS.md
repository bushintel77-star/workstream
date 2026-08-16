# System NLP instruction — Spatial Correction & Cadastral Verification

**Status:** Binding product + engineering SDS (NLP → deterministic geometry)  
**Date:** 2026-07-19  
**Companions:** [CANVAS-FIRST-PATCH-VERIFICATION.md](./CANVAS-FIRST-PATCH-VERIFICATION.md) · [CANVAS-FIRST-SPATIAL-ENGINE-SDS.md](./CANVAS-FIRST-SPATIAL-ENGINE-SDS.md)

---

## Role

Core Spatial Reasoner for the canvas-first landscape studio. Convert unstructured operator requests (“clean the site”, “snap to title”, “drop aerial”) into **deterministic** geometry and chrome mutations — never silent PostGIS writes in Workflow 1.

---

## Phase firewall

| Tier | Workflow 1 (now) | Stage 2 |
|------|------------------|---------|
| Cadastral snap | Vicmap WFS via `autoTraceBoundaryAction` → `canvasMetresRingToPct` → `updateBoundary` | `ST_Transform` / PostGIS parcel tables |
| Vegetation sieve | Pure TS proximity on `%` board items | Spatial SQL cluster merge |
| Elevation scale | Dynamic `maxHM` datum + scale clamp | Survey-grade Z |
| Aerial suppress | `aerialUri: null` + parchment `#F7F4EF` | MapLibre raster `visibility: none` |

Do **not** ship raw `UPDATE … ST_Transform` against a live PostGIS store until Stage 2 schema brief.

---

## Four-tier sub-routines

### 1. Cadastral boundary realignment

1. Query Vicmap parcel (project lat/lng) through existing auto-trace API  
2. Map canvas-metre vertices → handoff `%` ring (`canvasMetresRingToPct`)  
3. `updateBoundary` — authoritative title overrides sketched noise  
4. Vicmap lot m² remains passive datum via `resolveFitSheetAreas`

### 2. Vegetation vector sieve

| Class | Clearance | Action |
|-------|-----------|--------|
| Existing trees | `1.5 ×` canopy radius | Keep strongest; drop overlaps |
| Proposed canopy / feature | `1.1 ×` combined radii | Keep higher conf / non-ghost; drop rest |
| Orphans without trade reason | — | Prefer drop when overpopulated |

### 3. Elevation scale verification

- Re-anchor vertical scale to `maxHM = max(9, tallest asset)`  
- Clamp absurd veg `scale` so crown height ≤ catalog `heightM` × 1.0 (mature)

### 4. Raster basemap suppression

- Clear aerial URI; peel parchment to full  
- Workspace reads Warm Architectural Parchment `#F7F4EF`

---

## NLP trigger phrases

`spatial correction` · `cadastral` · `snap to title` · `vicmap` · `clean vegetation` · `sieve trees` · `drop aerial` · `parchment only` · `verify elevation` · `clean the canvas`

Implementation: `runSpatialCorrectionPipeline` + `askAi` / command palette.

---

## Implementation status

| Item | Status |
|------|--------|
| SDS | **Done** |
| `canvasMetresRingToPct` | **Done** (this pass) |
| `sieveVegetationItems` / elev clamp | **Done** (this pass) |
| Pipeline + NLP wiring | **Done** (this pass) |
| PostGIS UPDATE matrix | Stage 2 |
