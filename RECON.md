# Aerial Design Studio — recon (Phase 1)

**Date:** 2026-05-22 (updated after deploy review)  
**Brief:** `AERIAL_DESIGN_STUDIO_AGENT_BRIEF.md`  
**Deploy reference:** `DEPLOY.md`

## Deploy surfaces (corrected)

Phase 1 undercounted deploy targets. The repo has **three** surfaces, not two:

| App | Production | This brief |
|-----|------------|------------|
| `apps/api` | `api-production-a8ff1.up.railway.app` | Aerial static URL from `mapbox.ts` / survey |
| `apps/web` | `web-production-3c194.up.railway.app` | **All studio UI work here** |
| `apps/mobile` | EAS / Expo | Separate `design-studio/[id]` — out of scope |

**CI:** On `main` push, Railway auto-deploys API + web. Agents must **not** edit
`.github/workflows/ci.yml` as part of this redesign.

Railway auto-deploys on push to `main`; no manual deploy step is needed.

## Product decisions (2026-05-22)

| Topic | Decision |
|-------|----------|
| Brand | **B** — `@workstream/ui` / `globals.css` achromatic + `--accent` `#C2410C`. No Curtis/Cormorant/corten. Accent discipline: ≤3% surface — **Save** + **armed mode** only. Walkthrough §3.2 is the governing spec (no separate design-amendment file in repo). |
| Mapbox | Static aerial only; indicative scale from `mapView.ts` bounds (Phase 5). |
| AI | `PROPOSAL.md` only when scheduled; **skip Phase 6** this run. |

## Re-sequenced phases

1. Phase 2 — Brand re-skin (**shipped**)
2. Phase 3 — Layout (**shipped**)
3. Phase 4 — Planning palette + search by code (**shipped**)
4. Phase 5 — Modeless canvas + scale bar (**shipped**)
5. Phase 7 — States, honesty UI, a11y (**shipped**)
6. Phase 8 — Docs + E2E (**shipped** — see `CHANGES.md`; brochure deferred)
7. Phase 6 — AI assist (**deferred** — `PROPOSAL.md`)

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

- **Client-only React state** in `DesignStudio.tsx`: `toolOverride` (auto/place/draw/select),
  `placements`, `strokes`, `draftPoints`, `armedSymbolId`, `selectedPlacementId`, `saving`.
- **No global store.** Persist on Save via server action → API → in-memory `_designCanvases`.
- **Modes:** Auto (modeless) default; explicit Place / Draw / Select fallback toolbar.
  Draw blocks palette; select blocks placement.

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

Category includes `annotation` for TRP symbols; palette UI pins a **Planning** group.

## Search / codes

- `filterCatalogSymbols` + `catalogAssetCode()` — search matches label, id, SKU, keywords.
- Every tile shows asset code (`PLT-HORN`, `TRP-TPZ`, etc.).

## Aerial / Mapbox

- Studio uses `<img src={aerialUri}>` + percent-positioned overlays.
- **No Mapbox GL JS.** Indicative scale from `mapView.ts` (`MAPBOX_TILE_PX = 256`).
- Geographic overlay alignment via `projectLngLatToPercent` (see `SitePlan.tsx`).

## Brand (resolved)

Aegis / Workstream tokens only. Studio chrome uses glass panels (`backdrop-filter`), unified achromatic asset tiles with category chips, ink markup strokes (legacy `#ff2ef6` remapped on display).

## Remaining gates

1. **AI assist** — `PROPOSAL.md` when scheduled; no detection libraries shipped.
2. **Brochure output** — product spec TBD; not in current web studio.

## Not STOP

- Design tokens exist (`globals.css`, `packages/ui`).
- Asset list has a single source of truth (`catalog-assets.ts` + API).
- Saved-plan type is documented in Zod (`DesignCanvasSchema`).

## Computer URL (production)

After sign-in, open a project that has a **completed survey** (aerial required):

`https://web-production-3c194.up.railway.app/projects/<PROJECT_ID>/design/studio`

Example pattern — replace `<PROJECT_ID>` from the dashboard project link.

## Mobile

`/(app)/design-studio/[id]` — simpler palette; **not** the subject of this brief’s web redesign. Mobile project-home changes are separate (`docs/MOBILE-SITE-COCKPIT.md`).
