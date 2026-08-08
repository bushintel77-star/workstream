# Design studio

Visual customization for site plans and (later) quotations. Sits alongside the
AI-generated design zones — operators place Curtis CAD symbols on the survey
aerial and persist placements per project.

## Quote sequence

See [QUOTE_WORKFLOW.md](QUOTE_WORKFLOW.md): survey → **sketch** → sketch estimate → **AI from sketch** → cost → quote.

## Phase 1 (shipped)

- **Catalog API** — `GET /catalog/symbols` returns SVG path symbols from
  `packages/domain/src/catalog.ts` (hornbeam, Lomandra, bluestone, pergola, etc.).
- **Canvas API** — `GET/PUT /projects/:id/design-canvas` stores placements in the
  in-memory store (`_designCanvases`).
- **Web** — `/projects/:id/design/studio`: drag symbols from the catalog onto the
  aerial, or select + click. Save via server action.
- **Mobile** — `/(app)/design-studio/:id`: horizontal catalog strip, tap symbol then
  tap aerial to place.

## Asset widget library

Visual Curtis CAD widgets live in `packages/domain/src/catalog-assets.ts`:

- **Planting** — pleached hornbeam, Lomandra, agapanthus, buxus, olive, liriope, turf
- **Hardscape** — bluestone, granite steppers, sandstone crazy-pave, basalt grid, gravel, deck
- **Structures / water / furniture** — pergola, retaining wall, pool, spa, seat wall, fire pit
- **Markup** — dimensions, north arrow

Each symbol has an `asset` glyph (multi-layer SVG + palette preview colour) and optional
`rate_card_sku`. Web widgets: `apps/web/src/components/studio/`. Mobile:
`apps/mobile/src/components/studio/`.

## Open source first

Prefer MIT/Apache libraries and web standards. Avoid proprietary SDKs unless
there is no viable OSS path (e.g. Vicmap / Mapbox / Clerk are external services,
not drawing engines).

| Capability | Choice | Licence | Notes |
|------------|--------|---------|--------|
| CAD symbols | Inline SVG `path_d` in domain catalog | — | No icon font lock-in |
| Web canvas | DOM + SVG + drag-and-drop API | — | Already in phase 1 |
| Web freehand (phase 2) | [perfect-freehand](https://github.com/steveruizok/perfect-freehand) | MIT | Pressure-smoothed strokes → SVG path |
| Mobile / iPad draw (phase 2) | perfect-freehand + react-native-svg + gesture-handler | MIT | Same stroke engine as web; Apple Pencil as touch, no PencilKit |
| Mobile symbols | react-native-svg | MIT | Already a dependency |
| Quote PDF (phase 3) | Existing HTML outputs + optional [pdf-lib](https://github.com/Hopding/pdf-lib) | MIT | No commercial PDF SDK |

**Not using:** Apple PencilKit (native, closed), proprietary CAD viewers, paid
symbol libraries unless Curtis buys assets and we only store SVG files.

## Phase 3+ (web redesign — shipped)

See `CHANGES.md` and `AERIAL_DESIGN_STUDIO_AGENT_BRIEF.md`.

- **Layout** — aerial hero, 320px asset rail, toolbar Save with autosave status.
- **Asset library** — codes on every tile, search by code/SKU, pinned Planning (TRP) group.
- **Canvas** — modeless place/select, move/rotate/scale handles, indicative scale bar.
- **Honesty UX** — “not a construction drawing” caption, draftsperson hand-off on save.
- **Freehand** — survey ink strokes (legacy `#ff2ef6` stored; rendered as ink token).

## Phase 2 (planned — mobile polish)

- **Freehand on web + iPad** — `perfect-freehand` on web; Skia stroke layer on
  mobile. Strokes stored in `CanvasStroke` on the same canvas document.
- **Gesture polish** — react-native-gesture-handler + Reanimated (already in app):
  pinch scale, rotate, undo stack.

## Phase 3 (shipped)

- **Quote / scope** — `formatSitePlanQuoteSection` adds a **Site plan (design studio)**
  table to quote and scope markdown (qty on plan, SKU, rate card lookup).
- **Admin catalog** — Settings → **Design assets** (`/settings/design-assets`):
  `POST /catalog/symbols`, `DELETE /catalog/symbols/:id` (custom-* ids only).

## E2E

```bash
pnpm test:e2e
```

Starts API + web, seeds a project + survey, exercises design studio place/draw/save
and custom SVG upload.

## Data model

See `packages/contracts/src/schemas/catalog.ts`:

- `CatalogSymbol` — `path_d` for web SVG / react-native-svg
- `CatalogPlacement` — `x_pct`, `y_pct` (0–100) on aerial image
- `DesignCanvas` — placements + strokes + `updated_at`

## Deploy note

After pulling, Railway auto-deploys both services on push to `main`. To deploy
manually:

```bash
railway up
```
