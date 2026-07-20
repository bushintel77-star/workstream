# Material + library inventory (canvas-first)

**Binding styling/UX:** [STUDIO-STYLING-AND-UX.md](./STUDIO-STYLING-AND-UX.md).

Point of difference: borrow **structure** from inventory / asset-library UX
(family tabs, skimable chips, digit accelerators), then render it as calm CAD
studio chrome — never as a game, never over the selected object.

**Spatial rule:** the drawing stays clear. Inventory is a **summoned frost
popup** at the instrument summon point (Add / Paint / Library open) — not a
fixed opaque bar. Selection actions orbit **outside** the glyph.

## Open-source library packs

See [AI-CAD-DESIGN-LIBRARY.md](./AI-CAD-DESIGN-LIBRARY.md) and
[OPEN-CROP-ICONS.md](./OPEN-CROP-ICONS.md).

| Pack | Dock |
|------|------|
| Soft / Hard / Trees / Water | Drafting chips (studio types) |
| Curtis gold + Osmic + PlanZV + Wikimedia trees | **Library** tab (Essentials / Planting / Hardscape / AI CAD) |

## Behaviour

1. **Dock always on** in CAD / survey plan modes (hidden on Fit / focus / sketch / zone)
2. Pick a chip → arms Place (or retypes selection / sets Paint swatch)
3. Library chips map through `mapSymbolToStudioType` onto the drawing types
4. Digits 1–5 accelerate Soft/Hard paint swatches
5. Instruments still summon from empty margin — separate from inventory

## Files

- `features/kitInventory/KitAssetDock.tsx` — bottom inventory
- `features/kitInventory/nicheTools.ts` — zone carousel helpers (still used)
- `docs/AI-CAD-DESIGN-LIBRARY.md` — PlanZV / Osmic import
- Wired from `HandoffDesignStudio` (`kit-asset-dock`, `paint-swatch-*`)
