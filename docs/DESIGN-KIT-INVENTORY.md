# Design kit inventory UX

The Add / Paint pickers use **game inventory logic**, not Windows toolbar chips.

## Patterns borrowed from inventory UX

| Game pattern | Studio application |
|--------------|-------------------|
| Slot grid | Square icon slots with plan glyphs |
| Equipped frame | “Equipped · …” paper-doll row |
| Bag tabs | Softscape / Hardscape / Trees / Water |
| Hover inspect | Name + indicative rate under the grid |
| Hotbar 1–9 | Digit keys quick-equip visible slots |
| Loadout language | “Design kit” / “Paint loadout” / “Zone loadout” |

## Not Windows

- No horizontal text-chip strips as the primary picker
- No segmented-control caption rows for materials
- Selection is **equip a slot**, then click the plan

## Files

- `features/kitInventory/DesignKitInventory.tsx`
- `studioCatalog.ts` → `KIT_BAGS`
- Wired from `HandoffDesignStudio` (preserves `add-symbol-strip`, `paint-swatch-*` test ids)
