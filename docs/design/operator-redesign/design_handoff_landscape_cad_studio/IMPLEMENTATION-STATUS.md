# Design Studio v4/v5 — implementation status

> **⚠️ HISTORICAL DOCUMENT — superseded 2026-08-02.**
> Live source of truth: [`docs/MASTER-GAP-ANALYSIS-2026-08-02.md`](../../../MASTER-GAP-ANALYSIS-2026-08-02.md)
> This file references removed MapLibre surfaces and pre-rename component names.
> Do not use for scoring or implementation decisions.

Tracks the **Complete Feature Checklist** in [README.md](./README.md).

**Visual fidelity note (2026-07-19):** `/projects/[id]` mounts `HandoffDesignStudio` — the v4 `%`-coord aerial board from `Design Studio v4.dc.html` / `screenshots/01-frame.png`. MapLibre `GeoSiteMap` / `SiteCanvas` removed. Vicmap cadastral is keyless DELWP GeoServer WFS (`apps/api/src/lib/vicmap.ts`, GetCapabilities self-discovery).

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
| Trace polygon | **Done** | Handoff `TraceOverlay` click-trace; Vicmap WFS auto-trace retained. |
| Ghost-geometry rectangle autocomplete | **Done** | `inferRectangleCompletion()` + Tab / gold preview in TraceOverlay. |
| Edit handles | **Done** | BoundaryOverlay + `CadEntityHandles` (`replace_entity` vertex drag). |
| Add / place symbols | **Done** | SketchInstrument + catalog. |
| Multi-select marquee | **Done** | Marquee in SketchInstrument when Edit tool + sketch select mode. |
| Keyboard nudge / delete | **Done** | Arrow nudge + delete for selection/group; sketch history undo. |
| Lock tool | **Done** | Boundary lock → Fit sheet. |
| Undo/redo (40 steps) | **Done** | `canvas-history.ts` + CAD `replace_entity` redo stack. |
| Measure tool | **Done** | `DraftingAssist` + tool rail Measure. |
| Snap guides | **Done** | Alignment guides while dragging placements (`snapDragPct`). |
| Symbol palette | **Done** | `SketchRibbon`. |

---

## AI ghost-suggestion system

| Item | Status | Notes |
|------|--------|-------|
| Dashed-gold ghost rendering | **Done** | CAD SVG + sketch ghosts + gold styling. |
| Ghost review card | **Done** | `GhostReviewCard` — CAD batch + sketch layer. |
| Confidence-factor breakdown | **Done** | Live factors via `computeLiveConfidenceFactors()` (sun / TPZ / cost; drainage neutral until services). |
| Accept / Reject / cycle / Accept all | **Done** | Card actions + header Accept AI + shortcuts. |
| Stale-ghost detection | **Done** | `markStaleGhostsNearEdit()` on sketch move/delete. |
| Aerial canopy auto-detection | **Done** | Vision scan + `detectCanopyClustersFromImageData()` pixel heuristic. |
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
| 1.5 m setback overlay | **Done** | `inwardSetbackRing()` + MapLibre layer; Layers toggle setback. |
| TPZ / root-zone circles | **Done** | MapLibre + sheet SVG rings from overlay `radius_m` / AS 4970 helper. |
| Conflict mitigation chips | **Done** | Live BOM risk chips + overlay accept. |
| Sun & Growth panel | **Done** | `SunShadeControls` dock + shade/easement toggles. |

---

## Layer system

| Item | Status | Notes |
|------|--------|-------|
| 4 opacity sliders | **Done** | `CanvasLayerOpacityPanel` + survey preset on mode switch. |
| Compliance stats independent of opacity | **Done** | Compliance dock always visible when mode allows. |
| Survey-mode auto-preset | **Done** | Handoff survey mode + Vicmap WFS title hydrate. |
| Opacity on render | **Done** | MapLibre paint + design overlay vegetation bucket. |

---

## Sheet / print / export (Fit sheet)

| Item | Status | Notes |
|------|--------|-------|
| Fit sheet toggle | **Done** | Header + **F** shortcut. |
| A3 / A4 paper size | **Done** | Header segmented control → `ArchitecturalSheet` `data-paper-size`. |
| Title block, schedule, dimensions | **Done** | Handoff Fit sheet pulls Vicmap cadastral for selected address (`GET …/cadastral-title` + `buildArchitecturalTitleBlock`). |
| Multi-profile elevation stacking | **Done** | `SheetElevationPanel` + **+ Elevations** toggle. |
| North indicator | **Done** | Architectural sheet + elevation profile. |
| Auto edge dimensions | **Done** | `buildFitSheetEdges()` — labelled B/F edges, Fit dims toggle. |

---

## Quote / BOM mode

| Item | Status | Notes |
|------|--------|-------|
| Live BOM dock | **Done** | `LiveBomHud`. |
| Cost delta for AI | **Done** | Ghost cost hints + mutation HUD on accept. |
| Mitigation schedule lines | **Done** | `buildAcceptedMitigationLines()` into orchestration live BOM. |

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

## Canvas-First UX mandate (binding)

See [README.md § UX/UI execution mandate](./README.md) and
[`docs/CANVAS-FIRST-UX.md`](../../../CANVAS-FIRST-UX.md).

| Item | Status | Notes |
|------|--------|-------|
| Mode state-machine chrome (`resolveHandoffChrome`) | **Done** | Sketch/Survey hide Live BOM; CAD floating HUDs |
| Live cost primary = total + tags; Advanced for assembly | **Done** | `LiveBomDock` disclosure |
| Conversational AI / horizon binary actions | **Done** | Coach Accept/Reject; horizon Yes / Not now |
| Fit sheet freezes floating cost chrome | **Done** | `frameOn` → chrome off |
| Optimistic + skeletal Live BOM pulse | **Partial** | Continuous estimate; worker skeletal pulse TBD |
| Flora Ring plant suggestion (micro-climate) | **Done** | `features/flora` + `rankCurtisFloraCandidates`; SDS [`CANVAS-FIRST-AI-FLORA-ENGINE-SDS.md`](../../../CANVAS-FIRST-AI-FLORA-ENGINE-SDS.md) |
| Dynamic Volumetric Isolith (stockpile) | **Done** | `features/isolith` + `buildIsolithSurvey`; SDS [`CANVAS-FIRST-VOLUMETRIC-ISOLITH-SDS.md`](../../../CANVAS-FIRST-VOLUMETRIC-ISOLITH-SDS.md) |
| Live trade sourcing HUD | **Done** | `features/trade` + `solveLiveTradeEstimate`; SDS [`CANVAS-FIRST-LIVE-TRADE-SDS.md`](../../../CANVAS-FIRST-LIVE-TRADE-SDS.md) |
| Core canvas collision patch | **Done** | `resolveFitSheetAreas` + elev label stack + sheet clip; [`CANVAS-FIRST-PATCH-VERIFICATION.md`](../../../CANVAS-FIRST-PATCH-VERIFICATION.md) |
| Isolith vector drafting tokens | **Done** | 0.5px contours, grain/core layers; Isolith SDS §5 |
| Spatial correction NLP pipeline | **Done** | `runSpatialCorrection` + sieve/elev/aerial; SDS [`CANVAS-FIRST-SPATIAL-CORRECTION-NLP-SDS.md`](../../../CANVAS-FIRST-SPATIAL-CORRECTION-NLP-SDS.md) |

---

## CAD–AI 2026 UX alignment

Binding: [CAD-AI-2026-UX.md](../../../CAD-AI-2026-UX.md).

| Item | Status | Notes |
|------|--------|-------|
| Disappearing UI / contextual tools at prime pixel | **Partial** | Material fan + selection ring + Fitts radius; instruments on summon |
| AI sidecar (right) | **Partial** | Utility hub + Live measures collapsed by default; Ask AI on selection |
| Structure rail (left, collapsed) | **Partial** | Layers panel (`layersOpen` false) |
| Constraint-first + HITL ghosts | **Partial** | Council ambient; Accept/Reject ghosts; setback explain ongoing |
| Variation filmstrip | **Partial** | A/B/C session schemes + plan minimap; generative AI thumbs deferred |
| Vicmap easement auto-install | **Done** | WFS polylines → hydrate / title trace; honesty footer; utilities manual |
| Develop site (Cmd+K) | **Partial** | `runDevelopLoop` — ghosts + tip + Live BOM; HITL accept |
| Lighting conduit + watering | **Partial** | Fixture snap → LV trench; agg PoD / spray valves tip; Zone niche |
| Sun-cast UI | **Done** | `resolveBoardSunCast` + CameraChrome dock; domain az 0=north |
| 1:1 plan ↔ 3D AI sync | **Not started** | Workflow 1 2D |

---

## Remaining (lower priority)

See prioritized matrix in [TIER1-AI-CANVAS-GAP-AUDIT.md](./TIER1-AI-CANVAS-GAP-AUDIT.md):

- **P0:** Durable persist · Share/portal unlock · AI draft gate — **Done** (`canvasBridge`, `ShareSurface`)
- **P1:** Worker skeletal Live cost · shade grid · easements/utilities · authored DBH — **Done** on handoff
- **P2.2:** Assist grounded on compliance + shade — **Done** (`buildAssistSiteIntel`)
- Live cost soft pulse while saving — **Partial** (save-status pulse; full worker settle TBD)
- DBH-authored TPZ survey fields / Stage 2 schema briefs

Reference prototype: [Design Studio v4.dc.html](./Design%20Studio%20v4.dc.html) (do not port verbatim).
