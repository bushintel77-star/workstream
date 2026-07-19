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
  costHintFor?: (ghost: GhostPlacementSuggestion) => string | null;
};

/** Ephemeral AI placement ghosts — never persisted until accepted. */
export function SketchGhostLayer({
  ghosts,
  symbolById,
  onAccept,
  onDismiss,
  scanning,
  costHintFor,
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
        const costHint = costHintFor?.(ghost) ?? null;
        return (
          <div
            key={ghost.id}
            className={`${css.ghost}${ghost.stale ? ` ${css.ghostStale}` : ""}`}
            style={{ left: `${ghost.x_pct}%`, top: `${ghost.y_pct}%` }}
            data-testid="sketch-ghost-suggestion"
            data-stale={ghost.stale ? "1" : undefined}
            title={
              ghost.stale ? "Nearby edit — recheck this suggestion" : undefined
            }
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
              {costHint ? (
                <p className={css.ghostMeta} data-testid="ghost-cost-hint">
                  {costHint}
                </p>
              ) : null}
              {ghost.stale ? (
                <p className={css.ghostMeta}>Nearby edit — recheck</p>
              ) : null}
              <div className={css.ghostActions}>
                <button
                  type="button"
                  className={css.accept}
                  data-testid="sketch-ghost-accept"
                  onClick={() => onAccept(ghost)}
                >
                  Accept
                </button>
                <button
                  type="button"
                  className={css.dismiss}
                  data-testid="sketch-ghost-dismiss"
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
