# Canvas-first Stage 1 — Cadastral Alignment & Foundation Cleanse SDS

**Status:** Implementable  
**Mode:** Deterministic vector alignment & layer purge (parser-worker pipeline v1.2)  
**Scope:** All active interface tabs (Survey, Sketch, CAD, Elevation, Quote) via foundation chrome  
**Trigger:** Ask AI / ⌘K — phrases matching Stage 1 foundation NLP; command "Stage 1 foundation cleanse"  
**Related:** [Spatial Correction NLP SDS](./CANVAS-FIRST-SPATIAL-CORRECTION-NLP-SDS.md) (subset — this SDS is stricter)

---

## 1. Purpose

Bypass probabilistic AI design generation, purge visual noise from the active canvas, and enforce absolute alignment with authoritative Vicmap legal land records. Output is a **Stage 1 Accurate Cadastral Foundation Drawing**: clean vector surface + verified title polygon + millimetre dimensions + architectural oblique ticks.

---

## 2. Systemic overrides

### 2.1 Global AI vegetation & automation shutdown

| Off | Behaviour |
|-----|-----------|
| Flora Ring | `flora` → `idle`; no Place from ring |
| Botanical HUD / proximity infill | No auto canopy, plant symbols, or beds |
| Ghost plant suggestions | Cleared |
| Placement | Manual vector only — planting tools remain for hand placement |

### 2.2 Aerial imagery base layer purge

| Parameter | Value |
|-----------|-------|
| `aerialUri` | `null` |
| Raster opacity | N/A (layer removed) |
| Background | Parchment / clean vector plane only |

### 2.3 Authoritative Vicmap title boundary

1. Resolve parcel via address / SPI (existing Vicmap + Nominatim path).  
2. Convert GeoJSON ring → `%` via `canvasMetresRingToPct` / `geoRingToPct`.  
3. **Replace** any user-sketched boundary; set `boundaryLocked: true`.  
4. Clear conflicting sketches that duplicate the lot outline.  
5. Metric edge lengths from Vicmap are absolute truth for dimension labels.

### 2.4 Stage 1 visual layout

| Layer | Spec |
|-------|------|
| Base | Flat low-contrast parchment (no satellite) |
| Title CAD overlay | Deep charcoal `#1C1917`, **1.5px** stroke (`COLOR_VECTOR_PRIMARY`) |
| Vertices | 45° architectural oblique ticks (2–3 mm visual) |
| Dimensions | Always on; labels show metres to **3 dp** (millimetre truth) |
| Scale | Fit sheet / board locked toward 1:100 or 1:200 (A3 frame); zoom not free-interpolated while cleanse active |
| Content purge | Hide vegetation + loose items on plan while foundation cleanse is on |

---

## 3. Chrome flag

```ts
handoffChrome.foundationCleanse: boolean  // default false
```

When `true`:

- Mode forced to **survey** (cadastral focus).  
- `showDimensions: true`, `showGrid: true`.  
- Flora / Isolith / Trade ambient HUD suppressed.  
- CadPlanBoard renders foundation stroke + ticks + mm dims; skips veg/items draw.  
- Elevation / Quote still use purged design state (boundary locked, no aerial).

---

## 4. Pipeline `runStage1FoundationCleanse`

```
1. aerialUri = null
2. foundationCleanse = true; showDimensions = true; showGrid = true
3. flora = idle; designAssist = idle; clear ghosts
4. sieveVegetationItems (all plant/tree/canopy/bed keys)
5. boundaryLocked = false briefly → Vicmap resolve → ring → boundary
6. boundaryLocked = true
7. clear sketches that are near-duplicate of title ring (optional loose match)
8. mode = survey; fitSheet = false (title stage before Fit sheet)
9. toast: Stage 1 cadastral foundation locked
```

Idempotent when already cleansed + locked to same Vicmap ring.

---

## 5. NLP

| Pattern (case-insensitive) | Match |
|----------------------------|-------|
| stage\s*1|cadastral\s+foundation|foundation\s+cleanse | yes |
| purge\s+(aerial\|vegetation\|ai)|vicmap\s+title\s+boundary | yes |
| authoritative\s+(title\|cadastral)|legal\s+land\s+records | yes |
| to[- ]scale\s+2d\s+cad\s+title | yes |

Also: ⌘K → **Stage 1 foundation cleanse**.

---

## 6. Acceptance

- [x] Aerial gone; parchment only  
- [x] Flora Ring / AI plant spawn disabled while cleanse on  
- [x] Boundary = Vicmap polygon, nodes locked  
- [x] Charcoal 1.5px title + 45° ticks + mm dims  
- [x] Veg/items hidden on plan in foundation view  
- [x] Survey mode; toast confirms  
- [x] User can Exit foundation to resume design (toggle off)

---

## 7. Non-goals

- Live MapLibre street basemap (Workflow 1 stays parchment; street names via address chrome only).  
- Stage 2 PostGIS / GeoJSON export.  
- Re-enabling generative flora while cleanse is active.
