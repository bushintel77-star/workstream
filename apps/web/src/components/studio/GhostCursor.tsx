"use client";

import type { BrushRecipe, CatalogSymbol } from "@workstream/contracts";
import { DesignAssetGlyph } from "./DesignAssetGlyph";
import css from "./ghostCursor.module.css";

type Props = {
  recipe: BrushRecipe;
  symbol: CatalogSymbol;
  cursorPct: { x: number; y: number };
  /** Pixel size of the ghost ring from ground scale + default_width_m. */
  sizePx: number;
  /** Indicative width in metres (shown under the ghost). */
  sizeLabelM?: number | null;
};

/** Contextual ghost at cursor - real-ish scale from catalog metrics. */
export function GhostCursor({
  recipe,
  symbol,
  cursorPct,
  sizePx,
  sizeLabelM = null,
}: Props) {
  const size = Math.max(18, Math.min(160, sizePx * recipe.scale));
  return (
    <div
      className={css.ghost}
      style={{
        left: `${cursorPct.x}%`,
        top: `${cursorPct.y}%`,
        width: size,
        height: size,
        transform: `translate(-50%, -50%) rotate(${recipe.rotation_deg}deg)`,
      }}
      aria-hidden
      data-testid="ghost-cursor"
    >
      <div className={css.ring} />
      <div className={css.glyph}>
        <DesignAssetGlyph symbol={symbol} size="md" />
      </div>
      {sizeLabelM != null ? (
        <span className={css.sizeTag}>{sizeLabelM.toFixed(1)} m</span>
      ) : null}
    </div>
  );
}
