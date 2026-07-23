# Material + library inventory (canvas-first)

**Binding styling/UX:** [STUDIO-STYLING-AND-UX.md](./STUDIO-STYLING-AND-UX.md).

Point of difference: borrow **structure** from inventory / asset-library UX
(search, fold-out category sections, skimable chips, digit accelerators), then
render it as calm CAD studio chrome — never as a game, never over the selected
object.

**Spatial rule:** the drawing stays clear. Inventory is a **summoned frost
popup** at the instrument summon point (Add / Paint / Library open) — not a
fixed opaque bar. Selection actions orbit **outside** the glyph.

## Open-source library packs

See [AI-CAD-DESIGN-LIBRARY.md](./AI-CAD-DESIGN-LIBRARY.md) and
[OPEN-CROP-ICONS.md](./OPEN-CROP-ICONS.md).

| Pack | Dock |
|------|------|
| Draft kit (studio types, all bags merged) | First fold-out section |
| Full gold catalog — Curtis + Temaki plants/site + Osmic + PlanZV + Wikimedia trees | One fold-out section per catalog category (Planting / Hardscape / Structures / Water / Site furniture / Lighting / Markup) |

Grouping + search are domain helpers (`buildSketchLibraryGroups`,
`searchSketchLibrary` in `packages/domain/src/sketch-gold-library.ts`) —
gold-filtered, Curtis-first, deterministic order.

## Behaviour

1. **Popup on demand** — Add / Paint armed; dismiss on linger / pan
2. Soft frost glass (`--hc-glass-soft`), not an opaque full-width overlay
3. **Search first** — one field filters the whole gold catalog (label,
   botanical name, keywords); results flatten into a single tray
4. **Fold-out sections** — one open at a time; headers show live counts
5. Pick a chip → arms Place (or retypes selection / sets Paint swatch)
6. Library chips map through `mapSymbolToStudioType` onto the drawing types
7. Digits 1–5 accelerate Soft/Hard paint swatches
8. Instruments still summon from empty margin — separate from inventory

## Files

- `features/kitInventory/KitAssetDock.tsx` — frost popup (Add/Paint only)
- `state/handoffChrome.ts` — `inventoryPopup` flag
- `features/reach/marginSummon.ts` — keep summon chrome in the gutter
- `docs/AI-CAD-DESIGN-LIBRARY.md` — PlanZV / Osmic import
- Wired from `HandoffDesignStudio` (`kit-asset-dock`, `paint-swatch-*`)
