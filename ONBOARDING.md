# Onboarding — current state of the build (2026-08-25)

The single entry doc for a new developer. Everything else in the repo is
either **binding** (normative, wins on conflict), **living** (kept current),
or **historical** (point-in-time logs, not to be treated as current).
If this file and a binding doc disagree, the binding doc wins — but report
the disagreement instead of guessing.

| Role | Doc |
|---|---|
| **Entry (this)** | `ONBOARDING.md` |
| **Binding** | `docs/GOLD-STANDARD-2026.md` (supreme brief) · `apps/web/src/styles/tokens.css` (token source of truth — the standalone tokens doc was purged 2026-09-04 with the legacy design-doc set) · `docs/GOLD-STANDARD-2026-ARCHITECTURE.md` (WebGL architecture — corrected 2026-08-18) |
| **Living** | `OUTSTANDING.md` (ranked punch list) · `docs/PRODUCTION-ROADMAP-2026-08-17.md` + `docs/FEATURE-LIST-CONCEPT-TO-SIGNOFF.md` (stages + feature coverage) · `docs/CAMERA-STATE-MACHINE.md` (shipped camera map) · `docs/AEC-2026-RESEARCH-ADOPTION.md` (AEC-2026 research decisions) · `docs/MORPHOLIO-TRACE-3D-GAP-ANALYSIS-2026.md` (Trace-comparative frontend gap analysis + 3D roadmap) · `AGENTS.md` / `CLAUDE.md` (agent conventions) |
| **Historical** | `SESSION-HANDOVER-*.md` (session logs), `HANDOVER*.md` at repo root, `docs/WORKSTREAM-STATUS.md` (2026-07-21), `docs/GAP-ANALYSIS*.md`, `docs/archive/pre-gold-standard-2026/` |

---

## 1. One studio — the legacy SVG studio is retired (2026-08-19)

There is **one canvas studio** in `apps/web`:

- **WebGL studio (the only mount).** `/projects/[id]` mounts it.
  R3F `<Canvas>` + DOM paper-card overlay, metre-space (1 unit = 1 m),
  terrain-draped, real-sun, fused ortho↔persp camera. All new work lands
  here. Entry: `components/canvas/webgl/WebGLStudioPreview.tsx` →
  `WebGLStudio.tsx`.

The legacy SVG studio (`HandoffDesignStudio` + `useStudioState` +
`?svg=1` routing, ~295 SVG-only files and 63 classic e2e specs) was
**deleted 2026-08-19** in the SVG studio retirement. The ~51 modules the
WebGL studio genuinely shares (catalog, canvas bridge, geometry, and the
elevation/present/share/survey surfaces) were kept under
`components/canvas/handoff/` pending their re-homing into the WebGL tree;
the `--hc-*` / `--ws-*` chrome tokens moved to `styles/globals.css` as a
global `:root` block. The former "permanent fallback vs transitional" open
product decision is resolved: **retired**. The old board remains available
in git history if it is ever needed.

Two consequences:

1. **One store.** The WebGL studio runs its zustand store
   (`webgl/studioStore.ts`; `seasonalStore.ts` is a compat alias). The SVG
   `useStudioState` reducer is deleted. Persistence is the `DesignCanvas`
   document, unchanged.
2. **`?mode=` only.** All 8 modes mount natively on WebGL
   (`lib/canvas-mode.ts`, `WEBGL_STUDIO_MODES`). `?svg=1` is inert.

3. **2026-08-25 release — LA tokens + build packs (`87adeeb`, follow-up
   `bc2ee70`).** Chrome migrated to the `--la-*` earth-tone family
   (charcoal accent `--la-accent`; Signal Blue retired from chrome —
   tokens doc §1.7 + amendment log); `GlassCard` is opaque (`--la-surface`,
   no backdrop blur); the asset fan-out dock became `AssetLibraryPanel` +
   `BottomAssetStrip` + `RightPanelTabs`; drafting modes render dead-neutral
   `#F4F4F4` paper (no post-processing, `NoToneMapping`, IBL off); Client
   (8 pp) + Subcontractor (12 pp) Build Packs shipped
   (`buildPackTemplates.ts` — Phase 4 of the master brief). The adopted
   AEC-2026 research scope (ResCode A2-6 compliance, chrome recede, ARIA)
   is recorded in `docs/AEC-2026-RESEARCH-ADOPTION.md`.

4. **Landscape Canvas v2 chrome redesign (Stage Two).** The Stage One
   horizontal bottom tool dock is retired. The chrome is restructured per
   the Landscape Canvas v2 handoff:
   - **ToolRibbon** (`webgl/ToolRibbon.tsx`) — categorical vertical glass
     panel on the hand-opposite edge. Five groups (DRAW, GRADE, PLANT,
     BUILD, MEASURE) + a utility row (Layers, History). Three widths:
     RAIL 56px (pen down), STANDARD 88px (rest), NAMED 236px (400ms
     pointer dwell). Active tool has accent fill; active group header
     turns accent for wayfinding.
   - **CameraDock** (`webgl/CameraDock.tsx`) — bottom centre, exclusively
     the camera. Four presets: PLAN (ortho 0), AXO (ortho 22), SEC
     (ortho 90), 3D (perspective). Hotkeys 1-4. CAM/ORTHO status cap +
     Time/Sun pill.
   - **WfsChips** (`webgl/WfsChips.tsx`) — top bar primary chip (project
     name + camera + north + scale) + translucent overlay pills for
     active WFS layers (GRZ10, BAL-12.5, easements, canopy). Hazard
     colour for bushfire overlays.
   - **DepthRail** — updated to two-way bands: positive z planes above
     the ground line, subsurface utility depths (GAS, H2O, ELEC, SEW,
     TEL) below in redline accent.
   - **Pen-down quiet state** — pen contact drives `studioStore.penDown`,
     which fades the ribbon to rail width (opacity-only, never position),
     chips to 20%, and camera dock to hidden. Restore after 240ms.
   - **Tokens** — `--lc-*` namespace in `color-tokens.css` for the dark
     glass chrome. Archivo (`--font-lc-ui`) + IBM Plex Mono
     (`--font-lc-mono`) loaded in `layout.tsx`. Opacity scale (`--lc-op-*`)
     and geometry tokens (`--lc-ribbon-*`, `--lc-camera-dock-*`,
     `--lc-depth-rail-*`).
   - **Store bridge** — `activeTool: ToolId` in `studioStore` maps to the
     legacy tool flags (`sketchMode`, `measureActive`, `sliceActive`, etc.)
     so existing scene layers respond without each knowing about the
     ribbon. `cameraPreset: CameraPreset` writes the rig tilt + blend
     target.

## 2. Platform stages vs canvas modes

The product is defined by **four platform stages** (concept → signoff,
`docs/FEATURE-LIST-CONCEPT-TO-SIGNOFF.md`; the master brief's five phases —
Step 0 + Phases 1–4 — are the same journey). The canvas has **8 URL modes**
(`?mode=`), of which five are the core workflow; `garden`, `present`, and
`share` are auxiliary surfaces.

| Platform stage | WebGL canvas mode(s) | What it is |
|---|---|---|
| 1 — Survey & site intelligence | `survey` | Vicmap title hydrate, keyless overlays (EVC/planning/bushfire/contour/water_corp), BYDA, Survey 5/5 checklist |
| 2 — Concept sketch | `sketch` | Freehand ink on the GL surface, assets, flora ring, photo-trace elevation; parse to CAD feeds stage 3 |
| 3 — CAD design | `cad` (+ `elevation` = the CAD vertical-truth/facade view, `garden` = 3D eye-level) | Full design authoring — planting, hardscape, irrigation, lighting, trenches, terrain, live BOM |
| 4 — Signoff & quote | `quote` (+ `present` = client lens, `share` = portal) | Fit sheet, presentation, portal deposit; signoff record (PR #175) freezes the accepted quote |

Progressive unlock lives in `lib/canvas-mode.ts` (`unlockedModes` /
`suggestedMode`): survey always open; sketch/cad/elevation/garden open after
aerial/title; quote/present after CAD progress; share after a costed quote.

## 3. Camera state machine — shipped, not "one open item"

The fused camera shipped in two waves and is complete for its current scope:

- **PR #187** — single-pitch full-orbit camera: `φ` pitch 0–90° is the single
  axis (`cameraRig.ts`), ortho plan at 0°, perspective orbit between,
  ortho facade at ≈90° with azimuth snapped to cardinals (or to a pinned
  photo's non-cardinal bearing via `elevationFacadeAzimuth`). Editing is
  locked at `viewBlendTarget > 0.5 && !elevationActive`.
- **Photo-trace elevation capstone (2026-08-18)** — the former "one open
  item" is shipped: a site photo pins as a **frozen, calibrated camera
  frame** (reference-line calibration), freehand trace raycasts onto the
  vertical plane, and the plane snap-reconciles against the title boundary
  at pin time (see §4). Artifact: a photo elevation sheet in the
  elevation-board family, persisted in `DesignCanvas.photo_elevations`.

Full map: `docs/CAMERA-STATE-MACHINE.md` (gestures, matrix math, the facade
raycasting gotcha).

**Status honesty (2026-08-18, updated in-session):** the photo-trace
capstone is **committed on `main`** (`0b37127`) and pushed; the inspector,
marquee, and sketch→CAD WebGL wiring are committed (`a6f6646`, `78864ae`).
Earlier drafts of this file said "uncommitted working-tree code, PR not yet
opened" — that was accurate at 2026-08-18 ~c5cacfa and is now stale; the
working tree is clean of feature code.

## 4. Title-boundary reconciliation — a standing rule, not a one-off

Any new geometry, plane, or artifact that represents something **physically
sited on the property** must be checked against the title boundary polygon —
the single source of truth for site geometry (`DesignSiteFrame.boundary`, a
board-% ring; world-space edges via `pctToWorld`, as `DimensionLayer` does).
Either **snap to the boundary**, or **stamp the artifact
locational-indicative** — silently ignoring the boundary is a defect. This is
a standing gap-analysis rule (wording in `AGENTS.md`); its first application
was the photo-trace capstone (`boundary_snap`, `snapPhotoPlaneToBoundary`).

## 5. Where sketch-to-CAD parsing lives (verified 2026-08-18, WebGL now wired)

- **Contracts:** `SketchToCadRequest/Response` (`packages/contracts/src/schemas/catalog.ts`).
- **API:** `POST /projects/:id/sketch-cad` (`apps/api/src/routes/design-sketch-cad.ts`)
  → `formalizeSketchToCad` (`apps/api/src/lib/claude.ts`): Claude vision
  parse with a **heuristic fallback** when no vision key is set.
- **Domain:** `sketch-to-cad.ts` (`interpretSketchStrokesToCad` — the
  context-aware classifier: masses, hedges, frenchdrain, canopy/olive,
  hatching/duplicate disambiguation) and `stroke-recognize.ts`
  (`recognizeStroke` → `buildLandscapeFeatureFromStroke`).
- **Classic SVG studio:** `SketchDock` buttons (`sketch-tidy`,
  `sketch-convert-cad`) → `formalizeSketchToCadAction`
  (`HandoffDesignStudio.tsx` ~:2836), `StudioAssistPanel` uses
  `recognizeStroke`; the **pipeline** — `cad-job.ts` `importSketchToCad`.
- **WebGL studio (shipped 2026-08-18 — the former "Part A" gap is closed):**
  the rail **Tidy** action runs `proposeSketchCad` (the context-aware
  classifier) into a confidence-scored ghost review (the SVG
  `proposeFromStrokes` accept/reject pattern, `SketchCadReviewCard.tsx`);
  accept mints a live placement + a mirrored Polygon `LandscapeFeature`
  (id = placement id) when the proposal carried a drawn outline. The
  one-click **Convert to CAD features** runs `recognizeStroke` into real
  `LandscapeFeature`s persisted in `DesignCanvas.features`. Source ink is
  kept on both paths; photo-trace strokes are stamped as scoped out
  (elevation-space). See `AGENTS.md` ("Sketch → CAD on WebGL") and
  `webgl/sketchCad.ts`.

## 6. Current ranked work (live in `OUTSTANDING.md`)

1. ~~AEC-2026 adopted scope~~ — **shipped 2026-08-25** (see
   `docs/AEC-2026-ROLLOUT-PLAN.md` for the wave record): ResCode A2-6
   canopy compliance threaded survey → sketch/cad → quote (domain kernel +
   `a26-canopy` meta chip + fit-sheet row); motion-aware chrome recede
   (`ChromeRecedeWatcher` + hold-H peek, opacity-only); ARIA graphics tree
   (graphics roledescriptions on the canvas + human labels in the mirror
   tree). Follow-up: verify the A2-6 rounding bracket table against the
   VPP verbatim when accessible.
2. CI live-verify on GitHub once the account billing hold clears (human).
3. Premium assets (species depth, thumbnails, curated palettes).
4. Signoff record trace (signoff must freeze the accepted quote).
5. ~~Foliage "murk" polish~~ — resolved 2026-08-25 (`87adeeb`): drafting
   modes skip post-processing + `NoToneMapping` + IBL off; the canvas is
   dead-neutral `#F4F4F4` paper.
6. ~~Classic-studio e2e debt~~ — resolved 2026-08-19 (SVG retirement).
7. Longer tail: Phase 1 floating tool ribbon on GL, Phase 3 Presentation
   Lens polish, Stage 2 CAD (product-gated), mobile offline-first sync
   (design only). ~~Phase 4 Build Pack~~ — shipped 2026-08-25 (`87adeeb`:
   Client 8 pp + Subcontractor 12 pp via `buildPackTemplates.ts`).

## 7. Known stale code comments — register

All six entries previously listed here (page.tsx SVG-fallback wording,
PerimeterTabStrip classic-board navigation + `NativeWebGLMode`, stateBridge
§5 binding, studioStore aerial underlay, WebGLStudio dark-aesthetic, cameraRig
55°-cap) were **resolved in-session (2026-08-18)**: the comments were
corrected in code or the dead branch/type removed. Treat this section as an
empty ratchet: if you find a comment that drifts from code, fix it while you
are in the file and note it here so the register stays honest.

## 8. Handover files — which is current

- **Current handover:** `docs/SESSION-HANDOVER-2026-08-18-CONTINUATION.md`
  (written last; PRs #192–#201, live prod state, known issues).
- Everything else is history: `docs/SESSION-HANDOVER-2026-08-17*.md`,
  `HANDOVER-GS2026.md`, `HANDOVER-NEW-CONTEXT.md`, `HANDOVER.md`,
  `docs/WORKSTREAM-STATUS.md`. Each carries a superseded banner.
- **Live tracker (state over time):** `OUTSTANDING.md`.
- The GitHub account billing freeze, Railway git-build freeze, and their
  exact symptoms are documented in the current handover — do not re-debug
  them as code bugs.
