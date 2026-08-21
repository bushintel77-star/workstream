# Material + library inventory (canvas-first)

**Binding styling/UX:** [STUDIO-STYLING-AND-UX.md](./STUDIO-STYLING-AND-UX.md).
**Lane law:** [STUDIO-SURFACES.md](./STUDIO-SURFACES.md).

Point of difference: borrow **structure** from inventory / asset-library UX
(search, fold-out category sections, skimable chips, digit accelerators), then
render it as calm CAD studio chrome — never as a game, never over the selected
object.

**Spatial rule:** the drawing stays clear. Inventory is the **unified left
AssetPanel** — collapsed Fill rail by default; grows in place to the library
or Path Grammar. Never a second floating Draft kit or Path Grammar card.

## Open-source library packs

See [AI-CAD-DESIGN-LIBRARY.md](./AI-CAD-DESIGN-LIBRARY.md) and
[OPEN-CROP-ICONS.md](./OPEN-CROP-ICONS.md).

| Pack | Dock |
|------|------|
| Pinned (studio types from kit bags, ≤9 tiles) | Top of Expanded |
| Full gold catalog — Curtis + Temaki plants/site + Osmic + PlanZV | One fold-out section per catalog category (Planting / Hardscape / Structures / Water / Site furniture / Lighting / Markup) |

Grouping + search are domain helpers (`buildSketchLibraryGroups`,
`searchSketchLibrary` in `packages/domain/src/sketch-gold-library.ts`) —
gold-filtered, Curtis-first, deterministic order.

## Behaviour — three states

1. **Collapsed** — Fill rail (Turf / Planting / Bluestone / Deck / Hedge / Search / Pick). Always visible in plan CAD/sketch.
2. **Expanded** — Search, shade/soil/aspect chips, Pinned row, category accordion. Open via rail icon (pre-filtered), Search, or ADD.
3. **Placing** — Path Grammar (width / edge / fillet / Draw path) for paving/deck. Back restores Expanded; placement complete returns to Collapsed.

Mutual exclusion: Expanded/Placing and the right data / meta inspector share one docked-panel rule — opening one closes the other. Tooltip banners may co-exist.

## Single asset source

Fill rail chips and Pinned / accordion tiles are **two render targets** for the
same studio types (`PAINT_SWATCHES` / `BY_TYPE` / catalog `mapSymbolToStudioType`).
Bluestone is one `paving` record, not two.

## Files

- `features/assetPanel/AssetPanel.tsx` — shell (collapsed / expanded / placing)
- `features/assetPanel/AssetPanelExpanded.tsx` — search, filters, Pinned, accordion
- `features/assetPanel/AssetPanelPlacing.tsx` — Path Grammar controls
- `features/assetPanel/leftAssetPanel.ts` — state helpers + exclusivity with `rightDataPanel`
- `state/useStudioState.ts` — `ui.leftAssetPanel` / `ui.leftAssetRestore`
- Wired from `HandoffDesignStudio` (`asset-panel`, `swatch-*`, `paint-swatch-*`)
