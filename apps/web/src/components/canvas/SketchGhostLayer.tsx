"use client";

import type { CatalogSymbol, GhostPlacementSuggestion } from "@workstream/contracts";
import { DesignAssetGlyph } from "../studio/DesignAssetGlyph";
import css from "./sketchGhostLayer.module.css";

type Props = {
  ghosts: GhostPlacementSuggestion[];
  symbolById: Map<string, CatalogSymbol>;
  onAccept: (ghost: GhostPlacementSuggestion) => void;
  onDismiss: (ghostId: string) => void;
  scanning: boolean;
};

/** Ephemeral AI placement ghosts — never persisted until accepted. */
export function SketchGhostLayer({
  ghosts,
  symbolById,
  onAccept,
  onDismiss,
  scanning,
}: Props) {
  if (scanning) {
    return (
      <div className={css.scanBanner} data-testid="sketch-ghost-scanning">
        Scanning aerial for layout suggestions…
      </div>
    );
  }

  if (ghosts.length === 0) return null;

  return (
    <>
      {ghosts.map((ghost) => {
        const sym = symbolById.get(ghost.symbol_id);
        if (!sym) return null;
        return (
          <div
            key={ghost.id}
            className={css.ghost}
            style={{ left: `${ghost.x_pct}%`, top: `${ghost.y_pct}%` }}
            data-testid="sketch-ghost-suggestion"
          >
            <div className={css.ghostGlyph}>
              <DesignAssetGlyph symbol={sym} size="sm" />
            </div>
            <div className={css.ghostCard}>
              <p className={css.ghostTitle}>{sym.label}</p>
              <p className={css.ghostReason}>{ghost.reason}</p>
              <p className={css.ghostMeta}>
                AI {Math.round(ghost.confidence * 100)}% · indicative only
              </p>
              <div className={css.ghostActions}>
                <button
                  type="button"
                  className={css.accept}
                  onClick={() => onAccept(ghost)}
                >
                  Accept
                </button>
                <button
                  type="button"
                  className={css.dismiss}
                  onClick={() => onDismiss(ghost.id)}
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}
