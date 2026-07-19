# Handoff: Landscape CAD Studio ("Curtis & Co" Design Studio v4)

## Overview
A browser-based landscape-architecture drafting tool. Users trace a site boundary and building footprint over an aerial photo (CAD/plan mode), place planting/hardscape symbols, review AI-suggested placements ("ghosts"), check council setback/compliance, switch to an elevation (side-view) mode, and export a working-drawing sheet. This handoff covers the current build plus the AI-assisted features added this session: bi-directional CAD↔Elevation trace-linking, multi-profile elevation stacking on the print sheet, ghost-geometry rectangle autocomplete while tracing, per-suggestion confidence-factor breakdown, stale-ghost detection, a unified opacity-based layer system, and aerial-image canopy auto-detection.

## About the Design Files
The bundled `.dc.html` file is a **design reference** built in an internal HTML prototyping format (custom template syntax like `{{ }}` holes, `<sc-if>`/`<sc-for>` control-flow tags, and a `DCLogic` class for state) — it is **not** production code and should not be copied verbatim. Treat it as a fully interactive, pixel-accurate spec: reproduce its layout, styling, state machine, and behavior in whatever stack the target codebase actually uses (React/Vue/Svelte/native — pick the best fit if none exists yet), using that codebase's real component/state patterns.

`image-slot.js` and `support.js` are internal runtime/scaffold files (drag-and-drop image placeholder, template runtime) — reference them only to understand intended drag-and-drop image behavior; do not port them as-is.

## Fidelity
**High-fidelity.** Colors, type, spacing, and interaction states below are final values used in the working prototype — recreate pixel-for-pixel.

## Screens / Modes
The app is a single persistent shell with a **mode switcher** (pill tab group, top center) toggling four modes without navigation: `CAD` (plan trace), `Elevation` (side profile), `Sketch` (freehand), `Quote` (cost summary). A fifth implicit mode, `Survey`, is entered via the same switcher and dims non-survey layers automatically (see Layer System).

### Global chrome (persists across modes)
- **Header bar** (`padding:10px 18px 8px`, flex row, `gap:12px`, wraps on narrow width):
  - Left: brand lockup — "Curtis & Co" in `Fraunces, serif`, 21px/600/`-0.01em` tracking, over a site address line (11px, `#7A5560`).
  - Center-left: mode-switch pill group — track `background: rgba(36,19,24,0.05)`, `border-radius:99px`, `padding:4px`, `gap:3px`; each tab `height:34px`... actually 30px in switcher, `padding:0 15px`, `border-radius:99px`, active tab filled dark, inactive transparent.
  - Right-aligned meta block: "WORKING DRAWING" label (8.5px, `0.14em` tracking, `#B08A95`) over source/area line (10px, `#7A5560`), monospace (`IBM Plex Mono`).
  - Toolbar buttons (right side, `height:34px`, `padding:0 13px`, `border-radius:10px`, `border:1px solid rgba(36,19,24,0.12)`, 11.5px/600 Sora): Paper size (A3/A4 segmented control, sheet-mode only), **"+ Elevations" toggle** (sheet-mode only — see Multi-Profile Stacking), Frame/Sheet toggle, Dark-canvas toggle, **Layers** (popover), Sites (site switcher popover), Focus (hide side panels), Share, Command palette (`⌘K`-style icon button), **Accept-all AI** button (accent-bordered).
- **Canvas** (`flex:1`, `margin` inset, `border-radius:18px`, background = paper color): holds the aerial `<image-slot>`, traced SVG geometry, placed symbol `<div>`s, and mode-specific overlays.
- **Coach marks**: 3-step onboarding tooltips (dark `#241318` bg, `#FFF6F8` text, 14px radius) anchored to canvas corners, dismissible, advancing via "Next"/"Skip".

## Color Palette (exact hex)
| Token | Hex | Usage |
|---|---|---|
| Canvas/app background | `#F6EAED` | body, app shell background |
| Ink (primary text) | `#241318` | headings, primary text, dark-mode chrome |
| Muted text | `#7A5560` | secondary text, meta lines |
| Faint label | `#B08A95` | eyebrow/mono labels, counts |
| Accent (brand red) | `#C2455F` | links, active states, selection rings, "trace" CTAs |
| Accent hover/dark | `#9E3049` | link hover, accent pressed state |
| Selection tint | `#FFD3DE` | ::selection, coach-mark CTA buttons, accepted highlight |
| Success/confidence-high | `#1F8A5A` | high-confidence AI badge, pass state |
| Warning/gold (AI ghost) | `#E8B84B` | ghost ai suggestion outline, stale-ghost pulse, autocomplete badge |
| Warning-dark | `#B78A2E` / `#8A6A1F` | stale ghost border, autocomplete badge text |
| Panel surface | `#FFFBFC` | popovers, dropdowns |
| Panel surface alt | `rgba(255,251,252,0.92)` + `backdrop-filter: blur(16px)` | glass stat/compliance dock |

## Typography
- **Display/brand**: `Fraunces, serif` (variable, opsz 9–144) — used only for the "Curtis & Co" wordmark, 21px/600.
- **UI text**: `Sora` (400/500/600/700) — all buttons, labels, body copy.
- **Data/mono**: `'IBM Plex Mono'` (400/500) — all numeric readouts, coordinates, area/scale text, eyebrow labels (with `letter-spacing: 0.14em` on all-caps eyebrows).
- Google Fonts import in `<helmet>`: `Fraunces:ital,opsz,wght@0,9..144,400..700;1,9..144,400..700` + `Sora:wght@400;500;600;700` + `IBM+Plex+Mono:wght@400;500`.

## Design Tokens
- **Radii**: 99px (pills/segmented controls), 18px (canvas), 16px (glass docks), 14px (popovers/coach marks), 12px (toasts), 10px (toolbar buttons), 9–10px (list rows), 4–6px (small chips/dots).
- **Shadows**: popovers `0 14px 44px rgba(42,23,29,0.25)`; glass docks `0 8px 28px rgba(42,23,29,0.28)`; coach marks/toasts `0 14px 44px rgba(42,23,29,0.4)` / `0 6px 24px rgba(42,23,29,0.4)`; floating action badges `0 4px 14px rgba(42,23,29,0.3)`.
- **Borders**: default `1px solid rgba(36,19,24,0.12)` on toolbar buttons/segmented controls; `1px solid rgba(36,19,24,0.1)` on popovers; dividers `1px solid rgba(36,19,24,0.07)`.
- **Spacing**: header padding `10px 18px 8px`; toolbar button height `34px`; popover row padding `7–9px`; gap `12px` between header groups, `3–9px` inside clusters.
- **Motion**: `ccIn` (fade+translateY(7px)→0, entrance for popovers/docks), `ccFade` (opacity 0→1), `ccPulse` (opacity 1↔0.3, 1.8–2s ease-in-out infinite — used for AI/scanning indicators and stale-ghost borders); button hover transitions `0.16s` on background/border/color/opacity.

## Features Built This Session (detailed behavior)

### 1. Bi-directional CAD↔Elevation trace-linking
- **In CAD/plan mode**: hovering or selecting any non-ghost placed item with a defined height shows a floating pill button "⇄ Trace in elevation" (accent-red, `border-radius:99px`, positioned above the item). Clicking switches `mode` to `elevation` and sets `tool` to `pan`.
- **In Elevation mode**: each elevation silhouette is now itself interactive (`onPointerEnter`/`onPointerLeave`/`onClick`, `cursor:pointer`), gets a focus ring on hover/select (`box-shadow` double-ring using selection tint + accent), and shows a matching "⇄ Trace in plan" pill above it that switches back to `mode:'cad'`.
- Both directions share one `selectedId`/`hoverId` state pair so selection state survives the mode switch.

### 2. Multi-profile stacking on one sheet (Fit-Sheet / print mode)
- New toolbar toggle **"+ Elevations"** appears only when Sheet/Frame mode is on. Label flips to "Elevations ✓" and background inverts to dark when active.
- When on, a panel is inserted at the bottom-left of the sheet composition (`position:absolute`, sized to avoid the existing schedule/legend panel), containing **two stacked mini elevation profiles** — "FRONT ELEVATION" (sorted/projected along the X axis) and "SIDE ELEVATION" (Y axis) — each independently computed (own ground line, own building footprint silhouette, own item silhouettes at reduced scale) rather than reusing the live Elevation view's single active axis.
- Each row shows a ground line, a building box, item silhouettes (ghost items dashed/gold, real items solid/accent), and a right-aligned width readout in meters (monospace, 7.5px).
- Panel only renders when the sheet is wide enough (`sheetBox.boxW >= 380`) — degrades gracefully by not appearing rather than clipping.

### 3. Ghost-geometry autocomplete while tracing
- While actively tracing (`tool:'trace'`, unlocked) with 2 or 3 points placed, the app computes a probable rectangle closure in real time:
  - At 2 points + a live cursor position: projects a perpendicular offset from the current segment to infer a third/fourth corner (i.e., "square up" the shape from the direction the cursor is moving).
  - At exactly 3 points: completes the implied parallelogram (4th point = mirrored across the diagonal).
- Renders as a **live gold dashed polygon preview** (`rgba(232,184,75,0.12)` fill, `#E8B84B` dashed stroke) on the canvas, plus a floating "⇥ Autocomplete rectangle" pill badge centered on the ghost shape.
- Accept via clicking the badge **or pressing Tab** — commits the inferred 4-point polygon as the finished boundary/footprint trace (whichever `traceTarget` is active) and exits trace mode.
- A hint line appears in the trace status bar ("⇥ Tab autocompletes rectangle") only while a valid completion is available.

### 4. Per-suggestion confidence-factor breakdown
- The existing AI ghost review card's confidence bar (percentage + colored fill) is now **clickable** (cursor:pointer, `title` hint).
- Clicking expands an inline breakdown: 3 factor rows specific to the suggestion's category (e.g. trees/features → Sun exposure / Canopy target / Root clearance; hardscape → Access & fall / Permeability impact / Cost efficiency; drainage → Drainage intercept / Permeability impact / Cost efficiency), each its own thin progress bar + percentage, deterministically derived from the suggestion's id (stable across re-renders) and its overall confidence score.
- A chevron (▾/▴) on the confidence row shows expand/collapse state. No modal/new panel — everything expands in place within the existing ghost card.

### 5. Stale-ghost detection
- Whenever an **accepted** (non-ghost) item is moved, resized, or deleted (tracked via before/after diff inside the central `mutate()` state-transition helper), any **pending ghost suggestion** within ~6 units of that change is flagged `stale:true`.
- Stale ghosts get an amber dashed border (`#B78A2E`) plus a continuous pulse animation (`ccPulse`, 1.8s) instead of the normal gold dashed border — a passive, always-visible signal (no toast/interrupt).
- The item's hover tooltip appends "· nearby edit — recheck this" when stale, surfacing the reason on demand rather than every frame.
- Purpose: prevents a user from blindly accepting an AI suggestion whose rationale (sun angle, clearance, etc.) may have been invalidated by a subsequent edit nearby.

### 6. Unified layer system (opacity-based, not duplicated per-mode)
- Replaced the old binary "layers" toggle set (`planting`/`hardscape`/`water` on/off) and a separate, redundant Survey-only layer toggle set with **one consolidated 4-bucket model**, each a continuous 0–100% slider (native `<input type="range">`, not checkboxes) in the existing "⧉ Layers" popover — no new panel added:
  1. **Survey (existing)** — existing-condition trees, freehand site sketches.
  2. **Boundary & hardscape** — boundary/building trace lines, paving, decks, drainage.
  3. **Council & compliance** — setback dashed ring + TPZ/root-zone circles.
  4. **Vegetation (proposed)** — new planting (canopy, feature trees, hedges, beds, lawn).
- Each row shows: label, a live item count for that bucket, the current percentage, and the slider itself.
- Opacity is applied multiplicatively to each item's existing ghost-opacity, so effects compose (e.g. a stale ghost at 50% layer opacity renders at 25%).
- **Switching into Survey mode** auto-sets `{survey:1, boundary:1, council:0.15, vegetation:0.15}` (bring raw site data forward, fade proposed design/compliance back); **switching out** restores `{survey:0.2, boundary:1, council:1, vegetation:1}`. This is the "layers, not a duplicated Survey-mode UI" behavior — Survey is a lens/preset over one shared canvas and data model, not a second copy of the CAD screen.
- **Important product decision**: compliance **pass/fail status and breach/conflict counts are intentionally NOT tied to this opacity** — they live in the separate glass "COMPLIANCE" stats dock (top-right), which is unaffected by the Council layer slider. Only the geometric overlay (setback ring, TPZ circles) fades with the slider; the alert/verdict never silently disappears.

### 7. Aerial-image canopy auto-detection
- On mount, the app attaches a `MutationObserver` to the aerial `<image-slot>` element watching its `data-filled` attribute (set by the image-slot component once a user drops/loads a photo).
- Once filled, it draws the loaded `<img>` onto an offscreen `96×96` canvas, samples pixel data in a 24×24 grid of cells, and flags each cell "green" if its average color is green-dominant (`g > r*1.12 && g > b*1.05`, within a plausible brightness band) over >42% of its sampled pixels.
- Flood-fills adjacent green cells into clusters (4-connected), keeps clusters ≥3 cells, sorts by size, and takes the **top 6** largest clusters.
- Each cluster becomes a new **ghost suggestion** of type `canopy`, positioned at the cluster's centroid (as % of canvas), scaled 0.5–1.3 based on cluster size, with `why: 'Detected canopy from aerial imagery (colour analysis)'` and a confidence score derived from cluster size — feeding directly into the existing ghost accept/reject review UI (no new UI for this feature).
- Shows a small transient status pill ("Scanning aerial for canopy…" with a pulsing gold dot) top-center of the canvas while processing; disappears automatically when done.
- **Explicitly a heuristic**, not a trained vision model: real pixel/color-cluster analysis, not species-level or shape-aware tree detection. Flag this clearly to stakeholders — if production quality needs real tree detection, evaluate a proper object-detection/segmentation model (see Assets section).

## State Management (key fields, from the `DCLogic` component state)
- `mode`: `'cad' | 'elevation' | 'sketch' | 'quote' | 'survey'` — drives which canvas overlay renders.
- `items[]`: all placed symbols — `{id, t (type key), x, y, rot, scale, ghost (bool), why, conf, stale}`. Ghost items are AI-suggested and pending review; non-ghost are accepted/user-placed.
- `boundary[]`, `building[]`: polygon point arrays (`{x,y}` in % coordinates) for the traced site boundary and building footprint.
- `selectedId` / `hoverId`: shared across CAD and Elevation views for the trace-link feature.
- `layerOpacity`: `{survey, boundary, council, vegetation}`, each 0–1 float — replaces the old `layers` + `surveyLayers` boolean maps.
- `drawPoly` / `drawCursor` / `traceTarget`: active trace-in-progress state; internal `_ghostCompletionPts` (not serialized state, instance field) holds the current autocomplete candidate for Tab-accept.
- `sheetElevOn` (bool): toggles the sheet multi-profile elevation panel.
- `canopyScanning` (bool): drives the "Scanning aerial…" status pill.
- `factorsOpen` (bool): expand state for the confidence-factor breakdown (currently global to the ghost review card, not per-suggestion — consider making per-id if multiple cards can be open-adjacent in your rebuild).
- `hist[]` / `redo[]`: undo/redo stacks, snapshotted on every `mutate()` call.

## State Transitions & Triggers
- `mutate(fn)`: the single write-path for any item/boundary change. Pushes a history snapshot, then diffs `items` before/after to detect moves/deletes and mark nearby ghosts `stale`. **Any port of this feature must preserve this diff-on-write pattern** — it's what makes stale-detection automatic rather than requiring every call site to opt in.
- Mode-switch handler (`pick` on each mode-pill) additionally reassigns `layerOpacity` when entering/leaving `'survey'` (see Layer System above).
- Keydown handler: `Tab` during an active unlocked trace with a valid `_ghostCompletionPts` calls `finishPolyWith(pts)` (extracted from the original single-purpose `finishPoly()` so both Enter-close and Tab-autocomplete share one commit path).

## Assets
No external icon/asset packs are used — every plan-view symbol (canopy tree, feature tree, hedge, paving hatch, deck, lawn, planting bed, French drain, existing-tree marker) is hand-built inline SVG generated in code (`buildBlocks()` in the logic class), not sourced from a library. The aerial base image is a user-provided drag-and-drop photo (via the `image-slot.js` component) — not bundled. If the target build wants more realistic/detailed symbols, recommended real sources are open plan-view CAD block libraries (e.g. First In Architecture, CAD Blocks Free) rather than a generic icon font — these ship as DXF/DWG/SVG files to import directly, not as copy-pasteable code.

## Screenshots (`screenshots/`)
Full-bleed, edge-to-edge captures of every mode/state, verified clean (no unresolved template artifacts, no console errors) at hand-off time:
1. `01-frame.png` — CAD mode, default light canvas, AI-suggestions banner + compliance/BOM docks visible.
2. `02-frame.png` — Elevation mode, front-elevation profile with dimension/height labels.
3. `03-frame.png` — Sketch mode.
4. `04-frame.png` — Quote mode.
5. `05-frame.png` — Survey mode (layer-opacity preset dimming proposed/council layers).
6. `06-frame.png` — CAD + Fit-sheet (print sheet) view, A3/A4 paper toggle, site schedule + dimensions panel.
7. `07-frame.png` — Fit-sheet with Layers popover open (opacity sliders for Survey/Boundary/Council/Vegetation).
8. `08-frame.png` — Command palette (⌘K) open, filtered command list + "Ask AI" row.
9. `09-frame.png` — Command palette default/empty state showing full command list.
10. `10-frame.png` — Dark canvas mode (CAD).
11. `11-frame.png` — Fit-sheet, A4 paper size selected.
12. `12-frame.png` — Fit-sheet with "+ Elevations" panel expanded (front + side profiles stacked).
13. `13-frame.png` — Elevation mode, dark canvas.
14. `14-frame.png` — Survey mode, dark canvas.

Use these as the pixel-accuracy reference alongside the live HTML (which remains the source of truth for exact spacing/behavior — screenshots can compress or anti-alias subtle values).

## Files
- `Design Studio v4.dc.html` — the full interactive prototype source (all screens/modes/features described above; complete, unabridged code).
- `image-slot.js` — internal reference for the aerial drag-and-drop image placeholder's fill-state attribute (`data-filled`) and shadow-DOM `img` element, which the canopy-detection feature depends on.
- `support.js` — internal template runtime, reference only.
- `screenshots/` — 10 full-page PNGs, see above.
