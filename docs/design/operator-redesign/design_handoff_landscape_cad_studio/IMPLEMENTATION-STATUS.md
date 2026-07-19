# Design Studio v4/v5 — implementation status

Tracks the **Complete Feature Checklist** in [README.md](./README.md) against the production app on `main`. Update this file when checklist items land.

Legend: **Done** · **Partial** · **Not started**

---

## Modes & navigation

| Item | Status | Notes |
|------|--------|-------|
| Mode switcher (Survey, Sketch, CAD, Quote, Share) | **Done** | `CanvasModeStrip` + progressive unlock in `canvas-mode.ts`. Share = client quote, not separate “Client view”. |
| Elevation mode | **Not started** | Prototype only; not in `CanvasMode` enum. |
| Site switcher popover | **Partial** | Header **Sites** links to `/` (project list). No in-canvas multi-site snapshot switcher. |
| Focus mode | **Done** | Header **Focus** hides side docks (`rootFocus` in `SiteCanvas`). |
| Client view | **Not started** | Presentation-safe chrome hide + AI label suppression. |
| Command palette (⌘K) | **Partial** | Sketch mode via `CanvasCommandPalette`; header ⌘K opens palette in sketch, shortcuts elsewhere. |

---

## Canvas / CAD drawing tools

| Item | Status | Notes |
|------|--------|-------|
| Left tool rail (Trace, Edit, Add, Lock, Reset, Pan, zoom) | **Partial** | Geo stage: boundary tools in `BoundaryLockSnap`; CAD line draw; pan on map. No unified left rail. |
| Trace polygon (boundary / footprint) | **Partial** | Vicmap auto-trace + boundary edit; not full click-to-place trace over aerial. |
| Ghost-geometry rectangle autocomplete | **Not started** | |
| Edit handles (corners, mid-segment, delete) | **Partial** | Boundary edit tool; CAD ops via API. |
| Add / place symbols | **Done** | `SketchInstrument` + catalog placements. |
| Multi-select marquee | **Not started** | |
| Keyboard nudge / delete | **Partial** | CAD undo; sketch placement delete; not full nudge. |
| Lock tool | **Done** | Boundary lock → Fit sheet. |
| Undo/redo (40 steps) | **Partial** | CAD line undo stack; not global 40-step history. |
| Measure tool | **Done** | `DraftingAssist` measure overlay. |
| Snap guides | **Not started** | |
| Symbol palette (+ Add panel) | **Done** | `SketchRibbon` + catalog symbols. |

---

## AI ghost-suggestion system

| Item | Status | Notes |
|------|--------|-------|
| Dashed-gold ghost rendering | **Partial** | CAD SVG ghosts + sketch ephemeral ghosts; styling varies by surface. |
| Ghost review card (why, cost, confidence) | **Partial** | Empty-hint accept UI + sketch ghost layer; not full review card. |
| Confidence-factor breakdown | **Not started** | |
| Accept / Reject / cycle / Accept all | **Partial** | Accept all + A shortcut for CAD; sketch scan/accept flow. |
| Stale-ghost detection | **Not started** | |
| Aerial canopy auto-detection | **Partial** | `scanDesignGhostsAction` / vision API; not pixel-cluster heuristic from prototype. |
| Command-palette Ask AI | **Partial** | NL assist in sketch ribbon + palette “Ask AI”. |
| “AI DRAFT: UNVERIFIED” header badge | **Not started** | |

---

## Bi-directional CAD ↔ Elevation linking

| Item | Status | Notes |
|------|--------|-------|
| Trace in elevation / Trace in plan pills | **Not started** | Requires Elevation mode. |

---

## Elevation mode

| Item | Status | Notes |
|------|--------|-------|
| Front/Side axis, silhouettes, heights, north | **Not started** | |

---

## Compliance & analysis

| Item | Status | Notes |
|------|--------|-------|
| Compliance dock (pass/fail, area, permeability, canopy) | **Partial** | `LiveBomHud` risks/chips + orchestration overlays; not dedicated COMPLIANCE dock. |
| 1.5 m setback overlay | **Partial** | Orchestration / domain overlays; layer-tied opacity pending. |
| TPZ / root-zone circles | **Partial** | Via orchestration world overlays. |
| Conflict mitigation chips | **Partial** | Live BOM risk chips + accept/dismiss overlay actions. |
| Sun & Growth panel | **Partial** | `SunShadeControls` + shade grid toggle; no growth-stage scrubber in header. |

---

## Layer system

| Item | Status | Notes |
|------|--------|-------|
| 4 opacity sliders (Survey, Boundary, Council, Vegetation) | **Partial** | `CanvasLayerOpacityPanel` + presets in `canvas-layer-opacity.ts`; wire opacity to render paths next. |
| Compliance stats independent of layer opacity | **Partial** | Intended; BOM dock not tied to council slider yet. |
| Survey-mode auto-preset | **Partial** | Presets defined; apply on mode switch in `SiteCanvas` when wired. |

---

## Sheet / print / export (Fit sheet)

| Item | Status | Notes |
|------|--------|-------|
| Fit sheet toggle | **Done** | `ArchitecturalSheet` + header toggle + **F** shortcut. |
| A3 / A4 paper size | **Not started** | |
| Title block, schedule, dimensions, legend | **Partial** | `ArchitecturalSheet` + `FitSheetLayer` + QS on quote. |
| Multi-profile elevation stacking (+ Elevations) | **Not started** | |
| North indicator | **Done** | On architectural sheet. |
| Auto edge dimensions | **Partial** | Fit dims toggle (`showFitDims`). |

---

## Quote / BOM mode

| Item | Status | Notes |
|------|--------|-------|
| Live BOM dock (GST total, line expansion) | **Done** | `LiveBomHud`. |
| Cost delta for AI suggestions | **Partial** | Optimistic mutation HUD. |
| Mitigation schedule lines | **Partial** | Overlay accept flows into orchestration. |

---

## Other chrome / utilities

| Item | Status | Notes |
|------|--------|-------|
| Dark canvas toggle | **Not started** | |
| Share button / client link | **Partial** | Share mode + portal link copy in dock. |
| Coach marks (3-step tour) | **Partial** | `FirstRunGuide` + `?guide=1`; not full Trace→Add→Fit tour. |
| Autosave indicator | **Partial** | Sketch save status in ribbon. |
| Aerial base (MapLibre / survey) | **Done** | `GeoSiteMap` + survey pipeline; not drag-drop image-slot. |

---

## Operator chrome (v4 skin)

| Item | Status | Notes |
|------|--------|-------|
| Unified header (`CanvasStudioHeader`) | **Done** | Brand, modes, working-drawing meta, toolbar. |
| v4 design tokens | **Done** | `globals.css` + `siteCanvas.module.css`. |
| Glass docks styling | **Partial** | Live BOM top-right; compliance dock split TBD. |

---

## Suggested build order (from checklist dependencies)

1. Layer opacity wired to canvas render + survey presets  
2. Compliance dock split from Live BOM (stats never gated by council opacity)  
3. AI DRAFT badge + ghost review card + confidence breakdown  
4. Trace / edit tool rail on geo Fit sheet  
5. Elevation mode + CAD↔elevation linking + sheet elevation panel  
6. Client view + dark canvas + A3/A4  

Reference prototype: [Design Studio v4.dc.html](./Design%20Studio%20v4.dc.html) (do not port verbatim).
