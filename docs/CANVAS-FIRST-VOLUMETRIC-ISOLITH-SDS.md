# System design specification — Dynamic Volumetric Isolith

**Status:** Binding product + engineering SDS  
**Date:** 2026-07-19  
**Companions:** [CANVAS-FIRST-UX.md](./CANVAS-FIRST-UX.md) · [CANVAS-FIRST-SPATIAL-ENGINE-SDS.md](./CANVAS-FIRST-SPATIAL-ENGINE-SDS.md) · [CANVAS-FIRST-AI-FLORA-ENGINE-SDS.md](./CANVAS-FIRST-AI-FLORA-ENGINE-SDS.md)

---

## Phase firewall

| Capability | Workflow 1 (now) | Stage 2 |
|------------|------------------|---------|
| Volume source | `%` board item areas → `estimateStudioDrawing` dig / CR / spoil | PostGIS `ST_Volume` / true cut-fill mesh |
| Bulkage | Named factors (clay loam 1.25, spoil swell 1.6, CR 1.15) | Local soil-profile GIS join |
| Isolith graphic | SVG concentric contours + CSS grain (no WebGL) | Optional WebGL point-cloud grain |
| Placement | Sheet-margin float; stays live while Add/Edit | Cursor-proximate float (−40 px) during dig draw |
| Materials | Topsoil strip · crushed rock · excavated clay | Mulch fills, brick rubble, pool voids |

Do **not** invent PostGIS volume tables or heavy 3D pile meshes for Workflow 1.

---

## 1. Visual anatomy

Organic concentric vector contour cluster (micro-topographic “hill”):

- Outer footprint expands with **loose** volume (bank × bulkage)
- Inner rings tighten / multiply as volume rises (procedural density)
- Stroke: `COLOR_VECTOR_MUTED` (~0.5–1 px); primary label charcoal
- Grain: CSS stipple / hatch / wave — not photoreal fills

| Material | Token | Grain | Default depth rule |
|----------|-------|-------|--------------------|
| Topsoil (stripped) | `COLOR_VECTOR_PRIMARY` `#1A1A1A` | Stipple | 100 mm over disturbed hardscape |
| Crushed rock (CR6) | `COLOR_VECTOR_MUTED` `#8C8A85` | Triangular hatch | 150 mm under paving (display); BOM may use assembly base |
| Excavated clay | `COLOR_COMPLIANCE_AMBER` `#C99757` | Concentric waves | Sub-base dig from assembly depth |

---

## 2. Canvas behaviour

```text
[ Designer mutates hardscape / deck ]
        │
        ▼
 estimateStudioDrawing → bank m³
        │
        ▼
 Bulkage → loose m³ · truckloads (8 m³)
        │
        ▼
 Isolith footprint + ring density spring (CSS)
        │
        ▼
 Compact tag → click expands micro-HUD ledger
```

- Default: floats on the **right sheet margin** (legend band), not a sidebar table
- Drawing-hot (Add/Edit): Isolith **remains visible** (unlike conversational horizon)
- Fit sheet: compact Isolith may stay in the scrim / margin (cost dock still frozen)
- Cursor-proximate float: Stage 2

---

## 3. Engineering logic (Workflow 1)

$$V_{\text{loose}} = V_{\text{bank}} \times B_f$$

| Stream | \(V_{\text{bank}}\) | \(B_f\) |
|--------|---------------------|---------|
| Topsoil | `hardscapeM2 × 0.10` | 1.25 (Prahran clay loam default) |
| Crushed rock | CR tonnes / 1.8 (from estimate lines) | 1.15 |
| Excavated clay | `excavateM3` | 1.60 (spoil swell) |

Truckloads (Isolith HUD): \(V_{\text{loose}} / 8\) (standard 8 m³).  
Live BOM tipper lines may still use tonne payload — do not silently overwrite BOM maths.

---

## 4. Micro-HUD

**Compact (draw calm):** contour pile + `27.13 m³` tag  
**Expanded (click Isolith):** bank · bulkage · loose · est. truckloads  
**Collapse:** pointer leave or second click  

Honesty: “Indicative bank→loose — confirm soil profile on site”

---

## 5. Vector drafting specifications (Isolith overlay)

Binding graphic rules for the micro-topographic stockpile — publication-grade, not decorative.

### 5.1 Contour generation loop

```text
looseM3 → intensity ∈ [0,1]  (√(loose)/8, capped)
        → ringCount = 2 + round(intensity × 5)   // 2…7 rings
        → radii outer→inner with eased spacing
        → footprint px = 52 + intensity × 58
```

- Ring stroke: **0.5px** (`vectorEffect: non-scaling-stroke` where SVG allows)
- Ring colour: material token at 55% opacity; core ellipse 1px solid at 85%
- Inner core marks structural height — tightens as intensity rises
- Grain fill: SVG `<pattern>` only (stipple / hatch / wave) — **no WebGL** in Workflow 1

### 5.2 Depth sort on the sheet (relative to plan chrome)

| Isolith sub-layer | Role | Local z |
|-------------------|------|---------|
| Grain ellipse | Micro-texture under contours | 1 |
| Contour rings | Topographic density | 2 |
| Core ellipse | Height cue | 3 |
| Material label + m³ tag | Typographic HUD | 4 |
| Expanded ledger | Click-reveal bank / bulkage / trucks | 5 |

Isolith chrome sits above CadPlan vectors (`z-index: 14`) but below Flora Ring / selection (`16–17`).

### 5.3 Motion

- Footprint / ring count: CSS spring `cubic-bezier(0.22, 1.2, 0.36, 1)` ≈ stiffness 120 / damping 14 feel
- Proximity mode (Add paving/deck or Edit): shift toward board centre — cursor-proximate Stage 2
- Ledger: 180ms fade/slide; collapse on pointer leave

### 5.4 Sheet + Fit sheet

- Default anchor: **right margin** (legend band)
- Fit sheet (`frameOn`): Isolith remains in margin; plan vectors stay clip-masked to A3/A4
- Never a sidebar spreadsheet — compact pile + tag only until click

### 5.5 Honesty

Always: “Indicative bank→loose — confirm soil profile on site”

---

## Implementation status

| Item | Status |
|------|--------|
| SDS documented | **Done** |
| `buildIsolithSurvey` domain helper | **Done** |
| Isolith SVG + micro-HUD on handoff | **Done** |
| Live spring from estimate mutations | **Done** (CSS) |
| Vector drafting tokens (0.5px rings, grain, z) | **Done** (this pass) |
| Cursor-proximate dig float | Stage 2 |
| WebGL grain / PostGIS volumes | Stage 2 |
