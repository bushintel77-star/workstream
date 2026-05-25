import type { CatalogSymbol } from "@workstream/contracts";
import type { GhostPlacementSuggestion } from "@workstream/domain";
import { DesignAssetGlyph } from "./DesignAssetGlyph";
import g from "./ghostPlacement.module.css";

type Props = {
  ghosts: GhostPlacementSuggestion[];
  symbolById: Map<string, CatalogSymbol>;
};

export function GhostPlacementOverlay({ ghosts, symbolById }: Props) {
  if (ghosts.length === 0) return null;
  return (
    <>
      {ghosts.map((ghost) => {
        const sym = symbolById.get(ghost.symbol_id);
        if (!sym) return null;
        return (
          <div
            key={ghost.id}
            className={g.ghost}
            style={{ left: `${ghost.x_pct}%`, top: `${ghost.y_pct}%` }}
            aria-hidden
            data-testid={`ghost-${ghost.id}`}
          >
            <div className={g.ghostInner}>
              <DesignAssetGlyph symbol={sym} size="md" />
            </div>
            <span className={g.ghostLabel}>AI hint</span>
          </div>
        );
      })}
    </>
  );
}
