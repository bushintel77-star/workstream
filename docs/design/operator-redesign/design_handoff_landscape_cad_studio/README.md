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

## Complete Feature Checklist (build every item — nothing here is optional/decorative)

### Modes & navigation
- Mode switcher (pill tabs): Survey, Sketch, CAD, Elevation, Quote — instant client-side switch, no page nav.
- Site switcher ("Sites ▾" popover): multiple saved sites, each with its own boundary/building/items/history, switching snapshots and restores full state per site.
- Focus mode: hides side docks/panels for a larger drawing area.
- Client view: a presentation-safe view (hides editing chrome/AI-draft labeling for client-facing screen share).
- Command palette (⌘K / Ctrl+K): fuzzy-filterable list of ALL app actions (mode switches, "Fit sheet", "Dark canvas", "Close layers", site switches, "Place <symbol>" for every item type), keyboard nav (↑↓, Enter to run, Esc to close), plus a free-text "Ask AI" row that drafts new ghost suggestions from the typed query when fewer than 3 matches are found.

### Canvas / CAD drawing tools
- Tool switcher (left rail): Trace, Edit, Add, Lock, Reset, Pan — plus zoom controls (+/−/Fit) and pan-position dots/arrows.
- **Trace tool**: click-to-place polygon tracing for Boundary and Building Footprint (`traceTarget` toggle) directly over the aerial photo. Ortho/angle-snap guide (hold Shift). Undo last point (Backspace), close polygon (Enter or click first point). Live point count + computed area readout while tracing.
- **Ghost-geometry rectangle autocomplete** (added this session): live dashed-gold rectangle preview computed from the in-progress trace; accept via Tab or the "⇥ Autocomplete rectangle" badge.
- **Edit tool**: drag boundary/building corner handles to reshape; drag mid-segment to insert a new point; right-click a corner to delete it.
- **Add tool**: arm a symbol type (from the palette) and click the canvas to place it; placed items are draggable, rotatable, and resizable (scale).
- Multi-select: marquee-drag select (dashed selection box), shift/cmd-click to add to selection (`groupIds`), group drag-move.
- Keyboard nudge: arrow keys move selection by 0.2%, Shift+arrow by 1%.
- Delete: Delete/Backspace removes selection (or in-progress trace point).
- **Lock tool**: locks boundary/building geometry from further edits.
- Undo/redo: full history stack (⌘Z / ⌘⇧Z or ⌘Y), 40 steps.
- Measure tool: click-drag to get a live distance readout between two points.
- Snap guides: vertical/horizontal alignment guide lines while dragging items.
- Symbol palette ("+ Add" panel): every plantable/hardscape type (canopy tree, feature tree, hedge, planting bed, lawn, paving, deck, French drain, existing tree) as hand-built inline-SVG glyphs, each with name/rate/dimensions.

### AI ghost-suggestion system
- Ghost items render dashed-gold, at 50% opacity, distinct from accepted (solid, full-opacity) items.
- Ghost review card: shows current suggestion's name, rationale ("why"), cost/schedule impact, and confidence score.
- **Confidence-factor breakdown** (added this session): click the confidence bar to expand 3 category-specific contributing factors (sun exposure, root clearance, cost efficiency, drainage intercept, etc. depending on item type), each its own mini progress bar.
- Accept / Reject per-suggestion (✓/✕ buttons, also keyboard `A`/`R` shortcuts), cycle through multiple ghosts (prev/next), "Accept all" bulk action.
- Arrow-key cycling between ghost suggestions when none selected.
- **Stale-ghost detection** (added this session): moving/resizing/deleting an accepted item flags nearby pending ghosts `stale` — amber pulse border + "recheck this" tooltip note, computed automatically inside the central `mutate()` diff.
- **Aerial canopy auto-detection** (added this session): on aerial image load, offscreen-canvas pixel/color-cluster analysis proposes up to 6 canopy-tree ghosts directly from the photo, with a transient "Scanning aerial for canopy…" status pill.
- **Command-palette "Ask AI"**: typing a free-text query in ⌘K and running it drafts new ghost suggestions tagged with that query as their rationale.
- "AI DRAFT: UNVERIFIED" persistent badge in the header while any ghost suggestions are pending review.

### Bi-directional CAD↔Elevation linking (added this session)
- Hover/select an accepted item with a defined height in CAD → floating "⇄ Trace in elevation" pill jumps to Elevation mode with the same selection preserved.
- Hover/select an elevation silhouette → matching "⇄ Trace in plan" pill jumps back to CAD, same selection state.
- Elevation silhouettes are now independently hoverable/selectable/clickable (previously static).

### Elevation mode
- Front/Side elevation axis toggle (top-right pill).
- Ground line, building eave-height box, item silhouettes with height labels, existing-tree marker with DBH.
- North indicator.

### Compliance & analysis
- **Compliance dock** (glass panel, top-right, collapsible to a tab): pass/fail pill, outdoor area, permeable-surface % vs minimum, canopy-at-maturity % — each its own stat row, capped height with internal scroll so it never overlaps other docks.
- 1.5 m setback overlay (dashed boundary offset), toggle in Layers popover.
- Tree Protection Zone (TPZ) / root-zone circles around existing trees, auto-computed from DBH.
- Conflict detection & mitigation chips: TPZ encroachment, easement conflicts, stormwater/impervious-surface threshold (>30% triggers a French-drain-allowance chip) — each clickable to toggle a "mitigated" state that updates the schedule/quote.
- Sun & Growth panel: time-of-day slider/scrubber (9am–5pm+ range) with an animated play button showing real-time shadow-casting from buildings/trees; growth-stage toggle (Plant / +5yr / Mature) scales canopy sizes and shadow length accordingly.

### Layer system (added/rebuilt this session)
- Single "⧉ Layers" popover with 4 continuous opacity sliders (0–100%, not on/off): Survey (existing), Boundary & hardscape, Council & compliance, Vegetation (proposed) — each showing a live item count.
- Compliance pass/fail and conflict counts in the stats dock are intentionally independent of this opacity (never silenced by peeling a layer back).
- Survey-mode auto-preset dims Council/Vegetation and brings Survey/Boundary forward; leaving Survey restores prior levels.

### Sheet / print / export mode
- "Fit sheet" toggle: composes the CAD drawing onto a formal working-drawing sheet layout.
- A3/A4 paper-size segmented control.
- Site title block (brand, address), site schedule (lot area, building footprint, outdoor area, site coverage, boundary perimeter), full boundary & footprint dimension table (B1–B4, F1–F4 style labeled segments), notes block, scale + issue-date readout.
- Item schedule/legend with quantities per symbol type.
- **Multi-profile elevation stacking** (added this session): "+ Elevations" toggle inserts a bottom panel with independently-computed Front + Side elevation mini-profiles (own ground line, building box, item silhouettes, width readout) alongside the plan — not a duplicate of the live single-axis Elevation view.
- North indicator on the sheet.
- Dimension lines auto-generated along boundary/building edges when in sheet mode (or edit tool unlocked).

### Quote / BOM mode
- Live BOM (bill of materials) dock: running total (incl. GST), itemized schedule lines with quantities and cost, "+N more lines" expansion.
- Cost delta indicator when AI suggestions would add cost.
- Schedule entries auto-add for accepted mitigations (e.g. French drain allowance line).

### Other chrome / utilities
- Dark canvas toggle (full alternate dark palette for eye strain / presentation).
- Share button (presumed link/export share action — verify intended behavior with stakeholders, name suggests external sharing not yet fully specified in this prototype).
- Onboarding coach marks: 3-step first-run tour (Trace → Add → Fit sheet), dismissible, "skip" always available, only shows once (persisted via `localStorage cc_coach_done`).
- Autosave indicator (periodic "saved" tick, no explicit save button — changes persist continuously).
- Aerial base image: drag-and-drop `<image-slot>` placeholder for the top-down site photo (Mapbox/Google-style aerial), which all tracing and the canopy-detection feature key off of.

## Files
- `Design Studio v4.dc.html` — the full interactive prototype source (all screens/modes/features described above; complete, unabridged code).
- `image-slot.js` — internal reference for the aerial drag-and-drop image placeholder's fill-state attribute (`data-filled`) and shadow-DOM `img` element, which the canopy-detection feature depends on.
- `support.js` — internal template runtime, reference only.
- `screenshots/` — 10 full-page PNGs, see above.

---

## UX/UI execution mandate — Canvas-First (binding)

Treat cognitive load and visual aesthetic as **strict technical requirements**,
not polish. Full binding copy also lives in [`docs/CANVAS-FIRST-UX.md`](../../../CANVAS-FIRST-UX.md).

### Overarching goal

Maintain a calm, low-cognitive-load, non-technical interface. Complex geospatial
and financial math must remain completely abstracted behind a minimalist,
progressive workspace.

### 1. Strict progressive disclosure (state-machine UI)

- **Action:** Ban monolithic, AutoCAD-style tool ribbons.
- **Implementation:** Chrome renders only for the active state
  (**Survey → Sketch → CAD → Quote**). In Sketch, completely hide Quantity
  Survey and Live BOM. Surface only tools relevant to the active context.
- **Code:** `resolveHandoffChrome` in
  `apps/web/src/components/canvas/handoff/state/handoffChrome.ts`.

### 2. Abstracted complexity (the invisible engine)

- **Action:** Hide parametric variables from the primary user loop.
- **Implementation:** The operator draws a shape, tags it “Bluestone,” and the
  Live cost HUD updates via the background estimate engine. Nested assembly
  (excavation, CR6, tippers) and recipe depths live under **Advanced** only —
  never in the primary canvas loop.

### 3. Unobtrusive floating HUDs

- **Action:** Maximize workable canvas area.
- **Implementation:** Floating, semi-transparent, collapsible HUDs (utility
  indicator tabs + Live cost) instead of heavy fixed sidebars. The parchment /
  aerial plane bleeds under chrome; Fit sheet freezes floating cost chrome.

### 4. Visual calm & muted aesthetics

- **Action:** Standardize Fit sheet paper mode and Digital Clay aesthetics.
- **Implementation:** Cream canvases, sharp dark ink vectors, low-saturation UI
  highlights via CSS variables. Cross-fade 2D ↔ 3D Walk where mounted — no hard
  cuts.

### 5. Human-in-the-loop friction reduction

- **Action:** AI interactions feel like a conversation, not a database query.
- **Implementation:** AI Ghost / coach / horizon use natural-language microcopy
  and binary actions (**Accept / Reject**, **Yes, add it / Not now**) — no
  primary-path coordinate tables or BOM recipe editors.

### Acceptance (engineering)

| Check | Pass when |
| --- | --- |
| Sketch | No Live BOM / QS / horizon cards visible |
| CAD primary | Live cost shows total + material tags only |
| Advanced | Nested assembly / tippers behind disclosure |
| Trace/Edit | Utility sheets auto-collapse |
| AI | Accept / Reject (or Yes / Not now) without data tables |
