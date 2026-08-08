# System design specification — Canvas-First AI Plant Suggestion & Micro-Climate Engine

**Status:** Binding product + engineering SDS  
**Date:** 2026-07-19  
**Companions:** [CANVAS-FIRST-SPATIAL-ENGINE-SDS.md](./CANVAS-FIRST-SPATIAL-ENGINE-SDS.md) · [CANVAS-FIRST-UX.md](./CANVAS-FIRST-UX.md) · [STUDIO-PRODUCT-PHASES.md](./STUDIO-PRODUCT-PHASES.md)

---

## Phase firewall

| Capability | Workflow 1 (now) | Stage 2 |
|------------|------------------|---------|
| Canvas | `%` parchment / aerial handoff board | MapLibre |
| Shade sample | Indicative `buildIndicativeShadeGrid` + nearby canopy heuristic | Ray-cast extruded buildings / EnergyPlus-class |
| Botanical registry | Curtis catalog assets + house palette JSON | PostGIS `botanical_registry` + `ST_DWithin` |
| UI | Inline Flora Ring (holographic, zero sidebar) | Same interaction on geo canvas |
| AI | Probabilistic rank → **ghost** Accept/Reject | Same HITL; never silent plant write |

Do **not** invent PostGIS plant tables or MapLibre as default for this feature until Stage 2 schema brief.

---

## 1. Interaction paradigm — zero-click generative infill

```text
[User arms planting / clicks bed]
        │
        ▼
 Spatial aggregation (address · sun cell · nearby canopy · max height)
        │
        ▼
 Deterministic botanical solver (Curtis palette filter + seasonality)
        │
        ▼
 Top 3 matches → Inline Flora Ring (ghost canopies under cursor)
        │
        ▼
 Accept → accepted StudioItem · Reject → dismiss
```

Traditional sidebar filters are forbidden in the primary loop (Canvas-First).

---

## 2. Environmental ingestion (five layers)

| Layer | Workflow 1 source | Stage 2 |
|-------|-------------------|---------|
| Solar access | Shade-grid cell `sunHours` + growth scrubber | Ray-cast integral sunrise→sunset |
| Architecture style | Address / municipality heuristic + modernist vs heritage tags | Building mesh style tags |
| Regional ecology | `detectMunicipality` + temperate Melbourne defaults | Soil / rainfall GIS joins |
| Seasonality | System calendar month → plant-now vs spring-hold flag | Nursery lead-time API |
| Height envelope | Optional max mature height (m) on flora session | Canvas volume constraint |

Exposure bands (indicative):

| Band | Direct sun hours |
|------|------------------|
| Deep shade | &lt; 2 h |
| Dappled | 2–4 h |
| Full sun | &gt; 6 h |

---

## 3. Inline Flora Ring UI

- Translucent ring (`backdrop-filter: blur`) under cursor / click point  
- Up to **3** species chips + Reject  
- Hover → dashed holographic mature canopy (`COLOR_COMPLIANCE_AMBER`, 1px / 2px dash)  
- Sweep / density slider (v1: density chip Low · Mid · High)  
- Honesty: “Indicative suitability — confirm on site”

---

## 4. Visual tokens (aligned with Spatial Engine SDS)

| Component | Token | Spec |
|-----------|-------|------|
| Shade boundary | `COLOR_VECTOR_MUTED` @ 8% | Stipple / hatch |
| AI suggestion ghost | `COLOR_COMPLIANCE_AMBER` | Dashed mature canopy |
| Height guideline | `COLOR_VECTOR_MUTED` | Elevation micro-label |
| Active plant target | `COLOR_VECTOR_PRIMARY` | 1.5px · 10px crosshair |

No photoreal plant thumbnails in the primary CAD loop.

---

## 5. Deterministic filter matrix (Workflow 1)

```text
Probabilistic rank (style + context)
        → Curtis planting symbols (sun, mature_height_m)
        → Blocklist gate (plant-rules)
        → Height envelope · seasonality flag
        → Top 3 Flora candidates
```

Stage 2 SQL sketch (deferred):

```sql
SELECT species_id, botanical_name, mature_height_m, canopy_spread, solar_tolerance
FROM botanical_registry
WHERE ... AND ST_DWithin(geom, ST_MakePoint(...), 5000);
```

---

## Implementation status

| Item | Status |
|------|--------|
| SDS documented | **Done** |
| `rankCurtisFloraCandidates` domain solver | **Done** |
| Flora Ring UI + ghost preview | **Done** |
| Wire planting Add → ring → Accept place | **Done** |
| Shade stipple on `%` board | **Partial** (optional light hatch) |
| Full ray-cast solar integral | Stage 2 |
| PostGIS botanical registry | Stage 2 |
