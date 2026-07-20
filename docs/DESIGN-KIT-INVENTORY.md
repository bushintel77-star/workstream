# Material fan UX (canvas-first)

Point of difference: borrow **structure** from inventory / utility UX
(radial slots, progressive disclosure, digit accelerators, skim-then-commit),
then render it as calm CAD / architectural studio chrome — never as a game.

## Structure we keep

| Borrowed idea | Studio surface |
|---------------|----------------|
| Slot clarity | Material glyphs in a short fan |
| Contextual radial | Fan above the selected object (marking menu) |
| Progressive disclosure | Linger → rest fade (atelier timing) |
| Digit 1–9 | Accelerator keys for the active fan |
| Skim then commit | Pointer mark preview in settings |

## Surface we refuse

- No “loadout / equip / hotbar / bag” language in the UI
- No permanent left inventory album covering the plan
- No combat-HUD snap fades
- Selecting geometry does **not** summon the instrument ribbon

## Behaviour

1. **Selection** → materials fan above the object (plus lock)
2. **Add armed** → place palette docked at the instrument anchor (margin)
3. **Pointer marks** → settings only (garden craft glyphs, cursor personalisation)
4. **Instruments** → summon from empty canvas **off the lot**, or header tools

## Files

- `features/kitInventory/NicheToolCarousel.tsx` — contextual fan
- `features/kitInventory/nicheTools.ts` — place / selection / zone tools
- `features/pointer/*` — cursor mark settings
- Wired from `HandoffDesignStudio` (keeps `add-symbol-strip`, `paint-swatch-*`, `material-fan` test ids)
