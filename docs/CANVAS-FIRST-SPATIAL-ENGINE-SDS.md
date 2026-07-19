# System design specification — Canvas-First Spatial Design & Drafting Engine

**Status:** Binding product + engineering SDS  
**Date:** 2026-07-19  
**Companions:** [CANVAS-FIRST-UX.md](./CANVAS-FIRST-UX.md) · [STUDIO-PRODUCT-PHASES.md](./STUDIO-PRODUCT-PHASES.md) · handoff [ARCHITECTURE.md](../apps/web/src/components/canvas/handoff/ARCHITECTURE.md)

---

## Phase firewall (do not conflate)

| SDS layer | Workflow 1 (now — live mount) | Stage 2 (deferred) |
|-----------|-------------------------------|--------------------|
| Render surface | `%`-coord parchment / aerial board (`HandoffDesignStudio`) | MapLibre WebGL + optional WebGPU |
| Geometry store | In-session + `DesignCanvas` (placements / strokes) | PostgreSQL / PostGIS `ST_*` |
| Spatial worker | Optional main-thread / worker for snap & area (≤16 ms target) | Dedicated spatial parser worker + unproject matrices |
| AI | Probabilistic intent → **ghosts** only; Accept/Reject | Same HITL; `CadOp[]` into metre CAD |
| Compliance | Domain pure funcs (TPZ, permeability) on `%` board | PostGIS joins + topology validate |
| Fit sheet | A3/A4 frame, scale ladder 1:50…1:500 | Survey-locked sheet pack |

**Rule:** Do not make MapLibre / PostGIS the default studio surface until Stage 2 schema brief lands. Visual tokens, node schema, dim ticks, TPZ overlays, and sheet scale lock **do** apply to Workflow 1 now.

---

## 1. Global architecture & performance

### Separation of concerns

```text
Probabilistic Intent Layer          Deterministic Geometry Engine
(AI text / gesture / assist)   →    (snap, topology, schedules)
         │                                      │
         ▼ ghosts only                          ▼ accepted geometry
    Accept / Reject HITL                 DesignCanvas / (Stage 2) PostGIS
```

### Target runtime topology

```text
┌──────────────────────────────────────────────────────────────────┐
│ MAIN RENDER THREAD (Workflow 1: DOM/SVG board · Stage 2: MapLibre)│
│  - Render loop (60 FPS locked — Stage 2 WebGL/WebGPU)            │
│  - Captures cursor + gestural traces                             │
└─────────────────────────────────┬────────────────────────────────┘
                                  │ raw screen / action
                                  ▼
 ┌────────────────────────────────────────────────────────┐
 │ ASYNC WEB WORKER (Spatial Parser)                        │
 │ - Viewport unproject → global / %-grid                   │
 │ - Real-time node snap + vector intersections (≤16 ms)    │
 └───────────────────────┬────────────────────────────────┘
                         │ normalized GeoJSON / %-vectors
                         ▼
 ┌────────────────────────────────────────────────────────┐
 │ DETERMINISTIC BACKEND (Stage 2: PostGIS)                 │
 │ - ST_IsValid / ST_MakeValid / ST_SnapToGrid(0.001)       │
 │ - Compliance rules + spatial joins                       │
 └────────────────────────────────────────────────────────┘
```

### Benchmarks

| Metric | Target |
|--------|--------|
| Viewport frame rate | Constant **60 FPS** during translate / scale / rotate (Stage 2 MapLibre; Workflow 1: no jank on SVG mutate) |
| Worker latency | Snap + intersection ≤ **16 ms** on worker thread |
| AI commit | Never silent overwrite — ghosts until Accept |

---

## 2. Visual & spatial rendering (Workflow 1 + Stage 2)

Print-ready monochrome — warm parchment, not legacy dark CAD.

| Token | Value | Mapping |
|-------|-------|---------|
| `COLOR_CANVAS_BG` | `#F7F4EF` | Viewport / parchment base |
| `COLOR_VECTOR_PRIMARY` | `#1A1A1A` | Structural boundaries, text, data |
| `COLOR_VECTOR_MUTED` | `#8C8A85` | Extension lines, faint grid, datum ticks |
| `COLOR_COMPLIANCE_AMBER` | `#C99757` | Soft warnings, TPZ encroachment |
| `COLOR_COMPLIANCE_RED` | `#D66B6B` | Hard violations, permeability fail |

### Stroke metrics

- **Primary vectors:** `1.5px` solid `COLOR_VECTOR_PRIMARY`
- **Secondary / hidden:** `1px` dashed `4px` / `4px` gap, muted
- **Architectural oblique ticks:** 45° tick, `6px` long, `1.5px` thick — **no arrowheads**
- **Typography:** clean sans / mono data; labels parallel to path with **8px** offset

**Code anchors (Workflow 1):** CSS vars on `HandoffDesignStudio` root · `cadPlan.module.css` · dim marks on `CadPlanBoard`.

---

## 3. Vector precision & node interaction

### Control vertex schema

| Node | Spec | Behaviour |
|------|------|-----------|
| Corner | Solid circle **8px**, primary | Drag recalculates meeting segments |
| Mid-segment | Hollow diamond **6px**, muted | Drag/click splits edge → new corner |

### Snapping (multi-tier)

1. **Cadastral snap** — within **12px** of site boundary vertex → lock  
2. **Orthogonal snap** — modifier → 90° / 45° vs boundary baseline  
3. **Topology sanitize (Stage 2)** — on mouseup:  
   `ST_MakeValid(ST_SnapToGrid(geom, 0.001))`

Workflow 1: setback envelope snap + mid insert + corner drag already on `%` board; cadastral 12px + ortho modifier + PostGIS sanitize are Stage 2 / worker backlog.

---

## 4. Dynamic annotations & schedules

- Boundary segments: **B1…Bn** with length (e.g. `B1 · 7.16 m`)
- Building edges: **F1…Fn**
- Landscape: descriptive tags (Instant turf, Bluestone…)
- Bidirectional loop: node drag → area recompute → site schedule + legend + inline dims

**Anchors:** `edgeSegments`, `buildSiteSchedule`, Fit sheet panel, Live cost HUD.

---

## 5. Contextual spatial compliance

### AS 4970 TPZ

`Radius_TPZ = DBH × 12`

- Normal: faint dotted `COLOR_VECTOR_MUTED`
- Encroachment: `COLOR_COMPLIANCE_AMBER` + inline `TPZ Ø… m — AS 4970` + % compromise

### Permeability gate

`Permeable / Outdoor ≥ 20%` (Stonnington-style). Below threshold → offending hardscape stroke `COLOR_COMPLIANCE_RED` + schedule warning.

**Anchors:** `studio-preemptive-compliance`, CadPlanBoard TPZ / hatch, ComplianceTicker.

---

## 6. Multi-view elevation engine

- Horizontal datum lines every **1 m** (`COLOR_VECTOR_MUTED`, `0.5px`)
- Ground line: `COLOR_VECTOR_PRIMARY`, **2px**, labelled
- Structures / canopies as clean outlines + text callouts (no heavy fills)

**Anchors:** `ElevationBoard`, Fit sheet stacked elev profiles.

---

## 7. Viewport sheet framing & scale

- A3 / A4 paper frame over drawing plane  
- Scale steps only: **`[1:50, 1:100, 1:200, 1:250, 1:500]`** with elastic snap  
- Off-ladder → footer stamp: **`1:X (Not to scale) — Working drawing indicative only`**

**Anchors:** `FitSheetOverlay`, `sheetScaleDenom`, scale HUD.

---

## Implementation status (live handoff)

| SDS § | Status | Notes |
|-------|--------|-------|
| §2 Visual tokens + stroke metrics | **Partial → Done this pass** | Scoped SDS tokens on handoff root + cad plan |
| §3 Corner / mid nodes | **Done** (aligned to 8px / diamond) | Cadastral 12px + ortho + PostGIS = Stage 2 |
| §3 Worker ≤16 ms | **Partial** | Main-thread snap; worker backlog |
| §4 B/F labels + schedule sync | **Done** | Fit sheet + edgeSegments |
| §5 TPZ + permeability | **Done** (indicative) | Authored DBH still P1 |
| §6 Elevation | **Done** | Front/side + sheet stack |
| §7 Scale ladder + elastic | **Done** | NTS stamp when off-ladder |
| MapLibre 60 FPS + PostGIS | **Stage 2** | Explicitly deferred |

---

## Engineering acceptance gates

1. New canvas chrome declares mode visibility (`resolveHandoffChrome`).  
2. AI geometry stays ghost until binary Accept.  
3. Drafting colours use SDS tokens — not neon CAD defaults.  
4. Dims use oblique ticks, not arrowheads.  
5. Scale HUD only claims standard steps; else NTS stamp.  
6. No PostGIS / MapLibre default mount without Stage 2 brief.
