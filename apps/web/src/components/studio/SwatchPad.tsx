"use client";

import type { BrushRecipe, CatalogSymbol } from "@workstream/contracts";
import { DesignAssetGlyph } from "./DesignAssetGlyph";
import css from "./swatchPad.module.css";

type Props = {
  slots: BrushRecipe[];
  activeId: string | null;
  symbolById: Map<string, CatalogSymbol>;
  onSelect: (recipe: BrushRecipe) => void;
  onToggleCopy: (
    recipeId: string,
    key: "copy_geometry" | "copy_material" | "copy_pricing",
  ) => void;
};

const KEYS = ["1", "2", "3", "4", "5"] as const;

export function SwatchPad({
  slots,
  activeId,
  symbolById,
  onSelect,
  onToggleCopy,
}: Props) {
  if (slots.length === 0) return null;

  const active = slots.find((r) => r.id === activeId) ?? slots[0]!;

  return (
    <div className={css.pad} data-testid="swatch-pad" role="toolbar" aria-label="Brush swatches">
      <div className={css.slots}>
        {KEYS.map((key, i) => {
          const recipe = slots[i];
          if (!recipe) {
            return (
              <div key={key} className={css.empty} aria-hidden>
                <span className={css.key}>{key}</span>
              </div>
            );
          }
          const sym = symbolById.get(recipe.symbol_id);
          const selected = recipe.id === activeId;
          return (
            <button
              key={recipe.id}
              type="button"
              className={`${css.slot} ${selected ? css.slotActive : ""}`}
              onClick={() => onSelect(recipe)}
              title={recipe.label ?? sym?.label ?? recipe.symbol_id}
              data-testid={`swatch-slot-${i + 1}`}
            >
              <span className={css.key}>{key}</span>
              {sym ? <DesignAssetGlyph symbol={sym} size="sm" /> : null}
            </button>
          );
        })}
      </div>
      <div className={css.toggles} aria-label="Format painter">
        {(
          [
            ["copy_geometry", "Geom"],
            ["copy_material", "Mat"],
            ["copy_pricing", "Price"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`${css.toggle} ${active[key] ? css.toggleOn : ""}`}
            onClick={() => onToggleCopy(active.id, key)}
            aria-pressed={active[key]}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
