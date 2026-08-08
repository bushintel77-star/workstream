# Design Studio v4/v5 — implementation status

Tracks the **Complete Feature Checklist** in [README.md](./README.md). Last full pass: v5 backlog completion on `main`.

Legend: **Done** · **Partial** · **Not started**

---

## Modes & navigation

| Item | Status | Notes |
|------|--------|-------|
| Mode switcher (Survey, Sketch, CAD, Elevation, Quote, Share) | **Done** | `canvas-mode.ts` + `CanvasModeStrip`. |
| Site switcher popover | **Done** | `SiteSwitcherPopover` — lists projects via `listProjects()`. |
| Focus mode | **Done** | Header **Focus** → `rootFocus`. |
| Client view | **Done** | Header toggle → minimal header, hides docks/AI chrome. |
| Command palette (⌘K) | **Done** | Sketch palette + `CanvasStudioCommandPalette` for all modes; Ask AI row when &lt;3 matches. |

---

## Canvas / CAD drawing tools

| Item | Status | Notes |
|------|--------|-------|
| Left tool rail | **Done** | `CanvasToolRail` — Trace/Edit/Add/Lock/Reset/Pan/Measure + zoom. |
| Trace polygon | **Done** | `GeoSiteMap` click-trace over aerial; Vicmap auto-trace retained. |
| Ghost-geometry rectangle autocomplete | **Done** | `inferRectangleCompletion()` + Tab / gold preview in `GeoSiteMap`. |
| Edit handles | **Partial** | `BoundaryOverlay` edit; CAD via API ops. |
| Add / place symbols | **Done** | `SketchInstrument` + catalog. |
| Multi-select marquee | **Done** | Marquee in `SketchInstrument` when Edit tool + sketch select mode. |
| Keyboard nudge / delete | **Done** | Arrow nudge + delete for selection/group; sketch history undo. |
| Lock tool | **Done** | Boundary lock → Fit sheet. |
| Undo/redo (40 steps) | **Done** | `canvas-history.ts` — sketch placements, boundary snapshots, CAD line stack. |
| Measure tool | **Done** | `DraftingAssist` + tool rail Measure. |
| Snap guides | **Done** | Alignment guides while dragging placements (`snapDragPct`). |
| Symbol palette | **Done** | `SketchRibbon`. |

---

## AI ghost-suggestion system

| Item | Status | Notes |
|------|--------|-------|
| Dashed-gold ghost rendering | **Done** | CAD SVG + sketch ghosts + gold styling. |
| Ghost review card | **Done** | `GhostReviewCard` — CAD batch + sketch layer. |
| Confidence-factor breakdown | **Done** | Click bar → `deriveConfidenceFactors()` in domain. |
| Accept / Reject / cycle / Accept all | **Done** | Card actions + header Accept AI + shortcuts. |
| Stale-ghost detection | **Done** | `markStaleGhostsNearEdit()` on sketch move/delete. |
| Aerial canopy auto-detection | **Partial** | `scanDesignGhostsAction` / vision; not pixel-cluster heuristic. |
| Command-palette Ask AI | **Done** | Palette + sketch assist. |
| “AI DRAFT: UNVERIFIED” header badge | **Done** | When `ghostCount > 0`. |

---

## Bi-directional CAD ↔ Elevation linking

| Item | Status | Notes |
|------|--------|-------|
| Trace in elevation / Trace in plan pills | **Done** | `ElevationProfile` ⇄ plan mode via `onTraceInPlan`. |

---

## Elevation mode

| Item | Status | Notes |
|------|--------|-------|
| Front/Side axis, silhouettes, heights, north | **Done** | `ElevationProfile` from orchestration spatial facts. |

---

## Compliance & analysis

| Item | Status | Notes |
|------|--------|-------|
| Compliance dock | **Done** | `ComplianceDock` + `computeSiteCompliance()` — independent of layer opacity. |
| 1.5 m setback overlay | **Done** | `inwardSetbackRing()` + MapLibre layer; Layers toggle `setback`. |
| TPZ / root-zone circles | **Partial** | Orchestration TRP overlays. |
| Conflict mitigation chips | **Done** | Live BOM risk chips + overlay accept. |
| Sun & Growth panel | **Done** | `SunShadeControls` dock + shade/easement toggles. |

---

## Layer system

| Item | Status | Notes |
|------|--------|-------|
| 4 opacity sliders | **Done** | `CanvasLayerOpacityPanel` + survey preset on mode switch. |
| Compliance stats independent of opacity | **Done** | Compliance dock always visible when mode allows. |
| Survey-mode auto-preset | **Done** | `SURVEY_LAYER_PRESET` in `SiteCanvas`. |
| Opacity on render | **Done** | MapLibre paint + design overlay vegetation bucket. |

---

## Sheet / print / export (Fit sheet)

| Item | Status | Notes |
|------|--------|-------|
| Fit sheet toggle | **Done** | Header + **F** shortcut. |
| A3 / A4 paper size | **Done** | Header segmented control → `ArchitecturalSheet` `data-paper-size`. |
| Title block, schedule, dimensions | **Partial** | `ArchitecturalSheet` + `FitSheetLayer` + quote QS. |
| Multi-profile elevation stacking | **Done** | `SheetElevationPanel` + **+ Elevations** toggle. |
| North indicator | **Done** | Architectural sheet + elevation profile. |
| Auto edge dimensions | **Partial** | Fit dims toggle. |

---

## Quote / BOM mode

| Item | Status | Notes |
|------|--------|-------|
| Live BOM dock | **Done** | `LiveBomHud` — Instant Planner strip (Sketch + CAD + Quote). |
| Instant Planner (cost / labour / conflicts / Add to Main Quote) | **Done** | PDF §4.3 — glance chips + promote. |
| Next-best-option chip (shadow ledger) | **Done** | `NextBestOptionChip` + `proposeShadowAlternatives`. |
| Freeze / variation branches | **Done** | Freeze stores canvas payload; activate restores + refreshes BOM. |
| Structured tools (ditch / path / wall / bed) | **Done** | Features feed `spatialFactsFromCanvas` → Instant Planner. |
| Hero detail overlay | **Done** | Plan magnifier markers + Three.js overlay. |
| Irrigation / lighting assist + leftover pool | **Done** | Assist persists zones/lights; `/resource-pool` + presentation pack. |
| Shadow ledger Apply | **Done** | `applyShadowAlternative` mutates canvas + resave. |
| Cost delta for AI | **Partial** | Optimistic mutation HUD. |
| Mitigation schedule lines | **Partial** | Overlay accept → orchestration. |

---

## Other chrome / utilities

| Item | Status | Notes |
|------|--------|-------|
| Dark canvas toggle | **Done** | Header + `rootDark`. |
| Share button | **Done** | Header → Share mode. |
| Coach marks | **Done** | `CanvasCoachMarks` — 3-step tour, `localStorage`. |
| Autosave indicator | **Done** | Header save tick after mutations. |
| Aerial base | **Done** | MapLibre survey pipeline. |

---

## Remaining (lower priority)

1. CAD redo stack (sketch + boundary redo wired; CAD entity redo TBD)  
2. Pixel-cluster aerial canopy heuristic (vision scan remains primary)  
3. Dedicated TPZ geometry beyond orchestration overlays  
4. Title block / QS schedule polish on Fit sheet  

Reference prototype: [Design Studio v4.dc.html](./Design%20Studio%20v4.dc.html) (do not port verbatim).
