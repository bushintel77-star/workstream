# Material fan UX (canvas-first)

Point of difference: borrow **structure** from inventory / utility UX
(radial slots, progressive disclosure, digit accelerators, skim-then-commit),
then render it as calm CAD / architectural studio chrome — never as a game.

**Spatial rule (Fitts’s Law + Gestalt proximity):** object-local actions
(materials, lock, delete, Ask AI) sit at the **prime pixel** — the selection —
inside a short marking-menu radius. Place palette uses the same Soft / Hard /
Trees / Water taxonomy at the instrument summon point.

## Structure we keep

| Borrowed idea | Studio surface |
|---------------|----------------|
| Slot clarity | Material glyphs in a short fan |
| Progressive disclosure | Soft / Hard (/ Trees / Water) → materials |
| Atelier linger | Linger → near-rest fade (slots ~0.22) |
| Digit 1–9 | Accelerator keys for **visible** materials |
| Skim then commit | Pointer mark preview in settings |

## Surface we refuse

- No “loadout / equip / hotbar / bag” language in the UI
- No permanent left inventory album covering the plan
- No sticky instrument hub when not summoned
- No flat dump of every paint swatch around the selection
- Selecting geometry does **not** summon the instrument ribbon

## Behaviour

1. **Selection** → bag fan at the object (Soft / Hard) + SelectionRing (delete / lock / Ask AI)
2. **Add armed** → same Soft / Hard / Trees / Water fan at the instrument anchor
3. **Pointer** → personal garden mark when idle; function follows tool / handle hover
4. **Instruments** → summon only (empty margin / tool arm); disappear when dismissed

## Files

- `features/kitInventory/NicheToolCarousel.tsx` — contextual fan
- `features/kitInventory/nicheTools.ts` — bag / place / selection / zone tools
- `features/pointer/resolveStudioCursor.ts` — context-aware cursor
- `features/pointer/*` — cursor mark settings
- Wired from `HandoffDesignStudio` (keeps `add-symbol-strip`, `paint-swatch-*`, `material-fan` test ids)
