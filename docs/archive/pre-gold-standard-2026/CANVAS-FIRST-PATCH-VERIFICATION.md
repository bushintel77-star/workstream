# System patch verification — core canvas & layout collisions

**Status:** Binding engineering rules (Workflow 1)  
**Date:** 2026-07-19  
**Companions:** [CANVAS-FIRST-SPATIAL-ENGINE-SDS.md](./CANVAS-FIRST-SPATIAL-ENGINE-SDS.md) · [CANVAS-FIRST-VOLUMETRIC-ISOLITH-SDS.md](./CANVAS-FIRST-VOLUMETRIC-ISOLITH-SDS.md)

Hard-refresh after these patches moves the handoff studio from unstable template state to a deterministic, publication-grade `%`-coord spatial engine.

---

## Phase firewall

| Spec language | Workflow 1 implementation | Stage 2 |
|---------------|---------------------------|---------|
| `ST_Area(F1)` / PostGIS | `polygonAreaM2` on drawn `%` polys + `resolveFitSheetAreas` | True PostGIS on MapLibre |
| Vicmap conflict | Drawn building always wins; cadastral lot only if compatible | Live parcel topology join |
| 60 FPS worker | Sync React + SVG on mutate (no separate worker yet) | Canvas worker telemetry |

---

## 1. Dynamic area resolution (`resolveFitSheetAreas`)

```text
[ Canvas mutation ]
        │
        ▼
 polygonAreaM2(boundary) · polygonAreaM2(building)   ← Workflow 1 “ST_Area”
        │
        ▼
 Vicmap lot conflict?
   ├── YES → override API; enforce drawn geometry
   └── NO  → inject Vicmap lot as passive lot-area datum only
```

**Execution rule:** Building footprint and outdoor area are always from drawn coordinate polygons.  
**Conflict rule:** External cadastral records are baseline only. Manual vector edits override them instantly.

Implementation: `apps/web/src/components/canvas/handoff/geometry/siteScheduleDisplay.ts`

---

## 2. Elevation rendering stack & label anti-collision

| Layer | Role | Z |
|-------|------|---|
| 01 | Base grid & altitude datums | 10 |
| 02 | Building silhouettes & hardscapes | 20 |
| 03 | Vegetation elements & canopies | 30 |
| 04 | Interactive labels & text callouts | 40 |

- **120px horizon rule:** anchors within ≈12 viewBox units (~120 CSS px) step +24px (≈2.8 vb) vertically  
- **Parchment mask:** label clearance fill `#F7F4EF` / `#faf6f2` behind text  

Implementation: `ElevationBoard.tsx` + `geometry/elevationLabels.ts`

---

## 3. Canvas boundary restraints & async sync

| Save state | UI treatment | Behaviour |
|------------|--------------|-----------|
| Active sync | Saving… (muted) | Debounced persist |
| Network drop | Save paused — retrying | Up to 3 backoff attempts |
| Exhausted | Save paused — retrying (stays until next mutate) | Next geometry change re-queues |

**Hard vector boundary:** Fit sheet applies `clipPath` inset to the A3/A4 frame — symbols past the margin are clipped.

---

## Next

Vector drafting specifications for Dynamic Volumetric Isolith overlays — see [CANVAS-FIRST-VOLUMETRIC-ISOLITH-SDS.md](./CANVAS-FIRST-VOLUMETRIC-ISOLITH-SDS.md) § Vector drafting.
