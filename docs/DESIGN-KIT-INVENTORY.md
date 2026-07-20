# Material fan UX (canvas-first)

Point of difference: borrow **structure** from inventory / utility UX
(radial slots, progressive disclosure, digit accelerators, skim-then-commit),
then render it as calm CAD / architectural studio chrome — never as a game.

**Spatial rule:** the selected object stays clear. Material inventory docks at
the **instrument anchor** (same Soft / Hard / Trees / Water fan as Place).
Selection actions (delete / lock / Ask AI / deselect) orbit **outside** the
glyph so the drawing stays visible and draggable.

## Structure we keep

| Borrowed idea | Studio surface |
|---------------|----------------|
| Slot clarity | Material glyphs in a short fan |
| Progressive disclosure | Soft / Hard (/ Trees / Water) → materials |
| Atelier linger | Linger → near-rest fade |
| Digit 1–9 | Accelerator keys for **visible** materials |
| Skim then commit | Pointer mark preview in settings |

## Surface we refuse

- No material carousel centred on the selected object
- No opaque hub covering the glyph
- No “loadout / equip / hotbar / bag” language in the UI
- No sticky instrument hub when not summoned
- Selecting geometry does **not** summon the instrument ribbon

## Behaviour

1. **Selection** → kit dock at instrument anchor; orbit actions clear of the object
2. **Add armed** → same Soft / Hard / Trees / Water fan at the instrument anchor
3. **Pointer** → personal garden mark when idle; function follows tool / handle hover
4. **Instruments** → summon only (empty margin / tool arm)

## Files

- `features/kitInventory/NicheToolCarousel.tsx` — contextual fan
- `features/kitInventory/nicheTools.ts` — bag / place / selection / zone tools
- `features/pointer/resolveStudioCursor.ts` — context-aware cursor
- Wired from `HandoffDesignStudio` (keeps `add-symbol-strip`, `paint-swatch-*`, `material-fan` test ids)
