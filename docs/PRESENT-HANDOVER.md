# Present workspace — handover

Status: All phases complete + polish (Phase 0 + 1 + 2 + 2 stretch + 3 + 4 + 1a
+ swatch catalog wiring + template slot visual preview + raster-based vision
dissection). See `docs/PRESENT-WORKSPACE-BRIEF.md` for the full brief.

## What landed (Phase 0 + Phase 1 + Phase 2 + Phase 2 stretch + Phase 3 + Phase 4 + Phase 1a + polish)

### Contracts (`packages/contracts`)

- `PresentationDocumentSchema` in `src/schemas/presentation-document.ts` —
  multi-page document with pages, panels (discriminated union: `plan_crop`,
  `image`, `widget`, `text`, `swatch_board`), theme (palette + highlight +
  font + pen), template enum (4 editorial templates), deliverable type enum,
  title block, margins, status (draft/issued).
- `north_bearing` added to `DesignSiteFrame` in `src/schemas/catalog.ts` —
  true-north bearing 0-360 degrees, optional (absent = uncalibrated). Prerequisite
  for Phase 2 AI aspect/sun logic.
- `neighbour_buildings` added to `DesignSiteFrame` — adjacent-structure
  footprints for sun/overshadowing (also Phase 2 territory).
- `presentation_documents[]` added to `Project` (top-level, not nested in
  `DesignCanvas` — maintains separation of concerns).
- Exports wired in `src/index.ts`. Contracts tests + typecheck green.

### API (`apps/api`)

- Store CRUD in `packages/db/src/memory.ts`: `listPresentationDocuments`,
  `getPresentationDocument`, `createPresentationDocument`,
  `updatePresentationDocument`, `deletePresentationDocument`. Backed by
  `_presentationDocuments` array, persisted via SQLite write-through journal.
- Store interface in `packages/db/src/types.ts` — 5 new methods on `Store`.
- Routes in `apps/api/src/routes/presentation-documents.ts`:
  - `GET    /projects/:id/presentation-documents` — list
  - `POST   /projects/:id/presentation-documents` — create
  - `GET    /projects/:id/presentation-documents/:docId` — get one
  - `PUT    /projects/:id/presentation-documents/:docId` — update
  - `DELETE /projects/:id/presentation-documents/:docId` — delete
  All auth-gated via `requireAuth`, validated with Zod schemas.
- Route registered in `server.ts` under `/projects` prefix.
- `north_bearing` passthrough on design-canvas upsert is automatic — the
  existing `upsertDesignCanvas` in `memory.ts` passes `site_frame` through
  wholesale, so `north_bearing` flows without extra code.

### Web (`apps/web`)

- `canvas-mode.ts`: `present` added to `CanvasMode`, `CANVAS_MODES`,
  `parseCanvasMode`, `unlockedModes` (unlocks with `hasQuote`, mirroring
  `share`).
- `studioCatalog.ts`: `present` added to `MODE_TABS` so `StudioMode` accepts it.
- `HandoffDesignStudio.tsx`:
  - Imports and renders `PresentSurface` when `ui.mode === "present"`.
  - Excludes `present` from `planOn` (no plan board under the composer).
  - Lock reason: "Cost something on the drawing before presenting."
  - Passes `studio.imageLayers` to `PresentSurface` for image panel reuse.
- Next.js route handlers (proxy to API with auth, stable URLs):
  - `app/api/projects/[id]/presentation-documents/route.ts` — GET (list), POST (create)
  - `app/api/projects/[id]/presentation-documents/[docId]/route.ts` — GET, PUT, DELETE
- Client fetch wrapper (`presentClient.ts`): browser-safe functions for
  list/create/update/delete — no `server-only` import, uses the Next route
  handlers (survives Railway redeploys, same pattern as design-canvas autosave).
- `PresentSurface.tsx` + `present.module.css` — the composer:
  - Document sidebar: list, create, delete, select.
  - Toolbar: title, deliverable type, template, palette, font, save status.
  - Page canvas with A3 landscape paper, page tabs, add-page.
  - Panel types implemented:
    - **text** — heading + body, click-to-edit, in-place editing.
    - **image** — reuses `ImageLayer` from the design canvas; image picker
      shows canvas image layers as thumbnails.
    - **widget** — typed widgets (quote_total, savings_ledger, zone_summary,
      material_swatches, caption, honesty_footer); widget picker for creation.
    - **swatch_board** — placeholder (swatch_ids + columns stored, grid not
      wired to catalog yet).
    - **plan_crop** — placeholder (ref schema stored, plan rendering not wired
      yet — needs Phase 2 for AI dissection).
  - **Drag**: pointer-based move on any panel (click + drag body).
  - **Resize**: four corner handles (NW, NE, SW, SE) with pointer capture.
  - **Reorder**: bring-to-front on any panel interaction (z-index bump).
  - **Autosave**: debounced 1.5s on any doc change, status chip in toolbar.

### Pre-existing fixes along the way

- `neighbour_buildings` field was missing from test fixtures in
  `packages/cad/src/stamp-site-frame.test.ts`,
  `apps/api/src/routes/design-assist.test.ts`,
  `apps/api/src/routes/design-board-report.test.ts`, and
  `apps/web/src/components/canvas/handoff/state/canvasBridge.ts`. All fixed
  (the field had `.default([])` in the schema but the test fixtures predated it).

### Phase 2 — AI plan dissection

- **Contracts**: `PresentationDissectGhostSchema` +
  `PresentationDissectResponseSchema` in `src/schemas/presentation-document.ts`
  — ghost shape (crop + reason + label) and response (canvas_revision +
  ghosts[]). Ghosts are ephemeral review state, not persisted to the document.
- **API lib**: `apps/api/src/lib/plan-dissect.ts` — heuristic dissection
  algorithm (pure function, no I/O, deterministic):
  - **Overview** — always. One panel, full board crop, reason `overview`.
  - **Aspect quadrants** — only if `site_frame.north_bearing` is calibrated.
    Four 50×50 crops tagged N/E/S/W, computed from the bearing (not stored).
    Board-up faces `bearing`; each quadrant's compass direction is derived
    from its offset angle. Title-centric (brief §5.1).
  - **Feature clusters** — if ≥4 placements. Grid-bucketed into a 3×3 grid;
    non-empty cells with ≥2 placements become feature clusters with padded
    bounding-box crops. Label from the dominant `symbol_id` prefix.
  - `canvas_revision` = epoch ms of `DesignCanvas.updated_at` (stable integer
    for panel pinning).
- **API route**: `POST /projects/:id/presentation-dissect` in
  `apps/api/src/routes/presentation-documents.ts` — fetches the DesignCanvas,
  runs `dissectPlan`, returns the validated response. 404 if no canvas.
- **Next route handler**: `apps/web/src/app/api/projects/[id]/presentation-dissect/route.ts`
  — proxies to the API with auth (same pattern as the document CRUD handlers).
- **Client fetch**: `dissectPlanClient(projectId)` in `presentClient.ts`.
- **PresentSurface** (`PresentSurface.tsx`):
  - `PlanSnapshot` type — lightweight serializable plan data (boundary,
    building, items, strokes, northBearing, revision) passed from
    `HandoffDesignStudio`.
  - `PlanCropSvg` component — renders the plan cropped to a rect by setting
    the SVG `viewBox` to the crop rect (board %). Shows boundary polygon,
    building polygon, placement markers / outline polygons, sketch strokes.
    Reuses the `SharePlanSvg` pattern.
  - **Dissect plan** button in the panel add bar — calls the API, stores
    ghosts in client-side review state (not the document).
  - **Ghost review overlay** — list of proposed panels with Accept / Reject
    per ghost + Accept all. Accepting creates a `PlanCropPanel` on the
    current page pinned to `canvas_revision`. Rejecting removes from the
    ghost list. Matches the AI-CAD ghost-until-accept pattern.
  - Plan crop panels now render the live plan geometry via `PlanCropSvg`
    instead of the Phase 1 placeholder text.
- **HandoffDesignStudio**: passes `planSnapshot` (built from studio state:
  boundary, building, items, strokes, `ui.savedTick` as revision) to
  `PresentSurface`.
- **Tests**: `apps/api/src/lib/plan-dissect.test.ts` — 9 tests covering
  overview always present, canvas_revision derivation, aspect quadrants
  (with/without north_bearing, label correctness, crop sizes), feature
  clusters (threshold, clustering, labels), and all-three-families scenario.

## Gate evidence

- `pnpm typecheck` — 13/13 packages green.
- `pnpm test` — 211 files, 1146 tests, all passing.
- `e2e/canvas-cream-zoom.spec.ts` + `e2e/canvas-chrome-detector.spec.ts` — 3/3
  passing. (The hydration warning in the chrome detector test is from the
  test's deliberate mis-parent fixture, not a real issue.)

## Phase 2 stretch — vision-enhanced dissection + stale detection

- **Contracts**: `source: "heuristic" | "vision"` field added to
  `PresentationDissectResponseSchema` — the client knows which generation path
  produced the ghosts.
- **API lib**: `dissectPlanWithVision` in `apps/api/src/lib/claude.ts` —
  sends the structured plan data (placements, boundary, building, strokes,
  north_bearing) to Claude as text, asks it to enhance the heuristic
  feature-cluster labels with semantic zone names (courtyard, terrace, edible
  garden, etc.). Falls back to pure heuristic when no API key, no feature cuts,
  or any failure. Matches the `formalizeSketchToCad` pattern (vision model,
  fetchWithRetry, telemetry, JSON parse + clean).
- **API route**: dissection route now calls `dissectPlanWithVision` instead of
  `dissectPlan` directly. Telemetry logs `source` alongside ghost count.
- **Stale detection**: plan_crop panels compare `ref.canvas_revision` against
  `planSnapshot.revision`. When different, the panel gets a `data-stale="1"`
  attribute (amber border) and a "Sync to latest" button (hover-revealed).
  The sync action bumps `canvas_revision` to the current plan revision and
  sets `synced = true`.
- **Sync-to-latest**: `syncPlanCrop` handler in PresentSurface updates the
  panel ref via the standard `updatePanel` path (autosaves via the debounced
  PUT).

## Phase 3 — AI editorial formatting

- **Contracts**: `PresentationFormatRequestSchema` (deliverable_type +
  template_id + panels with kind/reason/widget_type/role) +
  `PresentationFormatResponseSchema` (ghosts with id + rect + rationale,
  overall rationale, source). Ghosts are ephemeral review state.
- **API lib**: `apps/api/src/lib/page-format.ts` — heuristic layout algorithm
  (pure function, deterministic, testable):
  - **Template slots**: each of the 4 templates defines named slots (hero,
    drawing, blurb, schedule, caption) with rects in % of page content area.
    `editorial_classic` = title strip + four drawing squares + schedule;
    `editorial_minimal` = single hero + generous whitespace;
    `editorial_feature` = asymmetric large feature left + stacked content right;
    `editorial_schedule` = schedule-heavy quotation layout.
  - **Deliverable priorities**: each deliverable type has a different slot
    priority order (deck = hero first; quotation = schedule first; mood_board =
    drawings first; concept_sketch = hero + captions).
  - **Panel → slot assignment**: greedy match by kind + metadata (plan_crop
    overview → hero, feature → drawing; text heading → blurb, caption →
    caption; widget → schedule; image → drawing). Overflow panels get a
    fallback grid position.
- **API route**: `POST /projects/:id/presentation-format` — validates the
  request, runs `formatPageLayout`, returns the response.
- **Next route handler**: `apps/web/src/app/api/projects/[id]/presentation-format/route.ts`.
- **Client fetch**: `formatPageClient(projectId, body)` in `presentClient.ts`.
- **PresentSurface**: "Format page" button → calls the API, stores format
  ghosts in client-side review state. Format review overlay (right-side panel)
  shows proposed rects with rationale per panel + Accept / Reject per ghost +
  Accept all. Accepting applies the rect to the panel. Matches the dissect
  ghost-until-accept pattern.
- **Tests**: `apps/api/src/lib/page-format.test.ts` — 11 tests covering empty
  panels, hero/schedule/blurb/caption slot assignment, feature crops to
  drawing slots, overflow grid, each template's slot layout, deliverable
  priorities, and rationale output.

## Phase 4 — deliverable templates + live widget binding

- **Template application**: "Apply template" button in the panel add bar —
  calls the format API and applies all accepted rects in one action (format +
  accept all). This is the one-click "arrange into template" flow.
- **Widget live data binding**: `EstimateSnapshot` type passed from
  `HandoffDesignStudio` (totalInclGst, materialsExGst, gst, lines,
  hardscapeM2, excavateM3). `WidgetLiveContent` component renders live values:
  - `quote_total` → AUD formatted total incl. GST
  - `savings_ledger` → line count + materials ex-GST
  - `zone_summary` → hardscape m² + excavation m³
  - `material_swatches` → material line count from live BOM
  - `honesty_footer` → indicative pricing disclaimer
  - `caption` → placeholder (operator edits text)
  Operator override text (`widget.text`) still takes precedence over live data.
- **HandoffDesignStudio**: passes `estimate` built from `studio.estimate`
  (the same StudioEstimateReport the quote HUD uses).

## Phase 1a — print-to-PDF

- **Approach**: client-side `window.print()` with print-media CSS, not
  headless Chromium on the API. This avoids the infra cost (larger Railway
  container, higher memory) flagged in the brief. The print CSS hides the
  sidebar, toolbar, add bar, page nav, ghost reviews, and pickers; shows only
  the page paper with panels. Each page breaks after printing
  (`page-break-after: always`). Panel resize handles and remove buttons are
  hidden in print.
- **Print button**: added to the PresentSurface toolbar (`data-testid="print-deck-btn"`).
- **Infra cost**: **none** — this approach adds no dependencies and no
  container changes. If higher-fidelity PDF (vector, embedded fonts, exact
  bleed) is needed later, headless Chromium on the API remains the upgrade
  path (flagged in the brief as a real infra cost).

## What's NOT done (deliberate scope gaps)

These are intentionally deferred:

1. **Headless Chromium PDF** — the current print path is client-side
   `window.print()` with print-media CSS. Headless Chromium on the API
   (server-side PDF generation with vector output, exact bleed, embedded
   fonts) is deferred to Phase 4 when quotation templates need emailable
   server-side PDFs. Infra cost: ~300MB Chromium binary on the Railway
   container, higher memory, longer cold starts. Ratify at that sign-off,
   not now.

2. **Swatch board rich catalog data** — swatch boards now render the material
   chips from the live board (id, hex, label) via `buildSheetWidgetContext`.
   Deeper catalog integration (SKU lookup, supplier info, rate card pricing
   per swatch) is deferred until the rate card catalog is wired through to
   the presentation layer.

## Polish items landed

### Swatch board catalog wiring

- **Material chips from the live board**: `MaterialSwatch` type (`{ id, hex, label }`)
  passed from `HandoffDesignStudio` via `buildSheetWidgetContext({ items: studio.items }).materialChips`.
  Reuses the fit-sheet's existing material chip derivation — same palette colours,
  same material type labels.
- **Swatch grid rendering**: `swatch_board` panels now render an actual grid of
  swatch cells (colour chip + label) instead of a placeholder count. Grid
  columns respect the panel's `columns` field (2-6).
- **Swatch picker**: "Edit swatches" button (hover-revealed) opens a picker
  showing all materials on the drawing. Toggle each material on/off the board.
  Empty state guides the operator to place materials on the design canvas first.
- **Caption**: optional caption text renders below the grid.

### Template slot visual preview

- **Dashed ghost overlay**: when the format review is open, dashed accent-coloured
  boxes appear on the page paper at each proposed panel position. Each box shows
  the rationale label and Accept/Reject buttons inline.
- **Visual spatial reasoning**: the designer can see where each panel would move
  before accepting — no more reading rects as text and guessing the position.
- **Print-hidden**: the ghost overlay is hidden in print mode (it's review state,
  not deliverable content).

### Raster-based vision dissection

- **Server-side plan rendering**: `apps/api/src/lib/plan-render.ts` — builds an
  SVG string from the `DesignCanvas` (boundary, building, placements, strokes,
  north arrow) and converts to PNG via `@resvg/resvg-js` (pure WASM, no system
  dependencies, works on Railway).
- **Vision model sees the plan image**: `dissectPlanWithVision` now sends the
  rendered PNG to Claude's vision model alongside the structured text data.
  Claude can see the spatial layout (not just read a list of items) and produce
  better semantic zone labels (courtyard, terrace, edible garden, etc.).
- **Fallback chain**: if the API key is missing, the renderer fails, the vision
  call fails, or there are no feature cuts to enhance, the pure heuristic runs
  and `source: "heuristic"` is returned.
- **Dependency**: `@resvg/resvg-js` added to `apps/api` — pure Rust WASM SVG
  renderer, no system dependencies, ~2MB package. No Railway container changes
  needed.
- **Tests**: `apps/api/src/lib/plan-render.test.ts` — 8 tests covering SVG
  rendering (empty canvas, boundary, building, placements, strokes, north arrow)
  and PNG conversion (magic bytes check).

## All phases complete

The Present workspace is feature-complete per the brief. Remaining work:

- Headless Chromium PDF upgrade (deferred to Phase 4 when quotation templates
  need emailable server-side PDFs; ratify the Railway infra cost at that
  sign-off).
- Swatch board rich catalog data (SKU lookup, supplier info, rate card pricing
  per swatch — deferred until the rate card catalog is wired through to the
  presentation layer).

## Key files for the next session

| What | Path |
|------|------|
| Brief | `docs/PRESENT-WORKSPACE-BRIEF.md` |
| Contracts schema | `packages/contracts/src/schemas/presentation-document.ts` |
| Site frame schema | `packages/contracts/src/schemas/catalog.ts` (DesignSiteFrameSchema) |
| Store CRUD | `packages/db/src/memory.ts` (search `PresentationDocument`) |
| API routes | `apps/api/src/routes/presentation-documents.ts` |
| Dissection lib | `apps/api/src/lib/plan-dissect.ts` |
| Dissection tests | `apps/api/src/lib/plan-dissect.test.ts` |
| Vision dissection | `apps/api/src/lib/claude.ts` (search `dissectPlanWithVision`) |
| Plan renderer | `apps/api/src/lib/plan-render.ts` |
| Plan renderer tests | `apps/api/src/lib/plan-render.test.ts` |
| Format lib | `apps/api/src/lib/page-format.ts` |
| Format tests | `apps/api/src/lib/page-format.test.ts` |
| Next route handlers | `apps/web/src/app/api/projects/[id]/presentation-documents/` + `presentation-dissect/` + `presentation-format/` |
| Client fetch | `apps/web/src/components/canvas/handoff/features/present/presentClient.ts` |
| Composer UI | `apps/web/src/components/canvas/handoff/features/present/PresentSurface.tsx` |
| Composer CSS | `apps/web/src/components/canvas/handoff/features/present/present.module.css` |
| Mode wiring | `apps/web/src/lib/canvas-mode.ts` |
| Studio integration | `apps/web/src/components/canvas/handoff/HandoffDesignStudio.tsx` (search `present`) |
| Material chips context | `apps/web/src/components/canvas/handoff/features/fitSheet/sheetWidgetContext.ts` |

## Conventions to preserve

- The Present tab never writes back to `DesignCanvas` — it reads the plan.
- `PresentationDocument` is a top-level entity on `Project`, not nested in
  `DesignCanvas`.
- The fit-sheet `PresentationPack` (in-studio, single-sheet) is a separate
  schema and is unchanged. Do not merge the two surfaces.
- Client-side fetch uses the Next route handlers (stable URLs), not server
  actions — this survives Railway redeploys without breaking open tabs.
- Panel rects are in `%` of the page content area (0-100), extending the
  `%`-coordinate model used by `ImageLayer`.
