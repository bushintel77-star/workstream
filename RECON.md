# Aerial Design Studio — recon (Phase 1)

**Date:** 2026-05-22  
**Brief:** `AERIAL_DESIGN_STUDIO_AGENT_BRIEF.md`

## Product decisions (2026-05-22)

| Topic | Decision |
|-------|----------|
| Brand | **B** — `@workstream/ui` / `globals.css` achromatic + `--accent` `#C2410C`. No Curtis/Cormorant/corten. Accent discipline: ≤3% surface — **Save** + **armed mode** only. Walkthrough §3.2 is the governing spec (no separate design-amendment file in repo). |
| Mapbox | Static aerial only; indicative scale from `mapView.ts` bounds (Phase 5). |
| AI | `PROPOSAL.md` only when scheduled; **skip Phase 6** this run. |

## Re-sequenced phases

1. Phase 2 — Brand re-skin (**shipped** — stop for review)
2. Phase 3 — Layout
3. Phase 4 — Planning palette + search by code
4. Phase 5 — Modeless canvas + scale bar
5. Phase 7 — States, honesty UI, a11y
6. Phase 8 — Docs + E2E

## File map

| Area | Path |
|------|------|
| Web route | `apps/web/src/app/projects/[id]/design/studio/page.tsx` |
| Main UI | `apps/web/src/components/DesignStudio.tsx` |
| Styles | `apps/web/src/components/designStudio.module.css` |
| Asset palette | `apps/web/src/components/studio/DesignAssetPalette.tsx`, `designAssetPalette.module.css` |
| Glyph render | `apps/web/src/components/studio/DesignAssetGlyph.tsx` |
| Save action | `apps/web/src/app/actions.ts` → `saveDesignCanvasApi` |
| API | `PUT /projects/:id/design-canvas` (`apps/api/src/routes/…`, store in `packages/db`) |
| Saved-plan schema | `packages/contracts/src/schemas/catalog.ts` (`DesignCanvas`, `CatalogPlacement`, `CanvasStroke`) |
| Asset source of truth | `packages/domain/src/catalog.ts` + `packages/domain/src/catalog-assets.ts` |
| Aerial image | `survey.aerial_uri` from Mapbox **Static Images** (`apps/api/src/lib/mapbox.ts`), not Mapbox GL in the studio |
| Static map bounds | `apps/web/src/lib/mapView.ts` (`parseMapboxStaticAerial`) — usable for indicative scale |
| Envelope (out of scope) | `packages/domain/src/envelope-brief.ts`, `sketch-costing.ts`, Design page |
| E2E | `apps/web/e2e/design-studio.spec.ts` |
| Mobile studio (separate) | `apps/mobile/app/(app)/design-studio/[id].tsx` |
| Design tokens (web) | `apps/web/src/styles/globals.css` (+ `styles/app.module.css`) |
| Shared tokens | `packages/ui/src/tokens.ts` |
| Docs | `docs/DESIGN_STUDIO.md` |

## State management

- **Client-only React state** in `DesignStudio.tsx`: `mode` (`place` \| `draw`), `placements`, `strokes`, `draftPoints`, `selectedId`, `dragSymbolId`, `saving`.
- **No global store** (Zustand/Redux). Persist on Save via server action → API → in-memory `_designCanvases`.
- **Modes:** explicit toolbar toggle Place / Draw; placement blocked when `mode === "draw"`.

## Save payload

```ts
// UpsertDesignCanvasInput
{ placements: CatalogPlacement[], strokes?: CanvasStroke[] }
```

Estimator reads placements via `rate_card_sku` on symbols (`catalog-quote.ts`, `sketch-costing.ts`). Geometry: `x_pct`, `y_pct`, `rotation_deg`, `scale` per placement.

## TRP / planning symbols

Already in `catalog-assets.ts`:

- `tree-root-protection` — Tree protection zone  
- `existing-tree-retain` — Existing tree (retain)  

Category is `annotation` today, not a dedicated **Planning** group in the palette UI.

## Search / codes

- `filterCatalogSymbols` in domain filters by category + query on **label, description, keywords** — not `rate_card_sku` / asset code unless keyword overlap.
- Tiles show **label**; SKU/code display is inconsistent (brief wants `PLT-HORN` on every tile).

## Aerial / Mapbox

- Studio uses `<img src={aerialUri}>` + percent-positioned SVG/div overlays.
- **No Mapbox GL JS** in the studio component today.
- Indicative scale from “Mapbox zoom” in the brief implies either parsing static URL zoom (`mapView.ts`) or adopting Mapbox GL — **verify before Phase 5/6**.

## Brand (resolved)

Aegis / Workstream tokens only. Studio chrome uses glass panels (`backdrop-filter`), unified achromatic asset tiles with category chips, ink markup strokes (legacy `#ff2ef6` remapped on display).

## Remaining gates

1. **Mapbox** — static image + `parseMapboxStaticAerial` for scale (Phase 5).
2. **AI** — write `PROPOSAL.md` when scheduled; no detection libraries this run.

## Not STOP

- Design tokens exist (`globals.css`, `packages/ui`).
- Asset list has a single source of truth (`catalog-assets.ts` + API).
- Saved-plan type is documented in Zod (`DesignCanvasSchema`).

## Computer URL (production)

After sign-in, open a project that has a **completed survey** (aerial required):

`https://construct-web.fly.dev/projects/<PROJECT_ID>/design/studio`

Example pattern — replace `<PROJECT_ID>` from the dashboard project link.

## Mobile

`/(app)/design-studio/[id]` — simpler palette; **not** the subject of this brief’s web redesign. Mobile project-home changes are separate (`docs/MOBILE-SITE-COCKPIT.md`).
