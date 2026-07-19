# Design Studio v4/v5 — implementation status

Tracks the **Complete Feature Checklist** in [README.md](./README.md). Last full pass: checklist rebuild on `main`.

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
| Trace polygon | **Partial** | Vicmap auto-trace + boundary edit; full click-trace over aerial TBD. |
| Ghost-geometry rectangle autocomplete | **Not started** | |
| Edit handles | **Partial** | `BoundaryOverlay` edit; CAD via API ops. |
| Add / place symbols | **Done** | `SketchInstrument` + catalog. |
| Multi-select marquee | **Not started** | |
| Keyboard nudge / delete | **Partial** | CAD undo; sketch placement delete. |
| Lock tool | **Done** | Boundary lock → Fit sheet. |
| Undo/redo (40 steps) | **Partial** | CAD line undo stack. |
| Measure tool | **Done** | `DraftingAssist` + tool rail Measure. |
| Snap guides | **Not started** | |
| Symbol palette | **Done** | `SketchRibbon`. |

---

## AI ghost-suggestion system

| Item | Status | Notes |
|------|--------|-------|
| Dashed-gold ghost rendering | **Done** | CAD SVG + sketch ghosts + gold styling. |
| Ghost review card | **Done** | `GhostReviewCard` — CAD batch + sketch layer. |
| Confidence-factor breakdown | **Done** | Click bar → `deriveConfidenceFactors()` in domain. |
| Accept / Reject / cycle / Accept all | **Done** | Card actions + header Accept AI + shortcuts. |
| Stale-ghost detection | **Partial** | Domain/card support; auto-stale on move not wired all paths. |
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
| 1.5 m setback overlay | **Partial** | Orchestration overlays; dedicated setback ring TBD. |
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
| Opacity on render | **Partial** | CAD SVG + bucket helpers wired; MapLibre layers next. |

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
| Live BOM dock | **Done** | `LiveBomHud`. |
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

## Remaining (explicit backlog)

1. Ghost-geometry rectangle autocomplete while tracing  
2. Multi-select marquee + keyboard nudge  
3. Global 40-step undo/redo stack  
4. Alignment snap guides while dragging  
5. Full click-to-place trace over aerial (vs Vicmap auto-trace)  
6. Wire layer opacity into MapLibre layer paint  
7. Stale-ghost auto-flag on all mutation paths  
8. Dedicated 1.5 m setback ring geometry  

Reference prototype: [Design Studio v4.dc.html](./Design%20Studio%20v4.dc.html) (do not port verbatim).
