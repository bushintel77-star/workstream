"use client";

import type { CatalogPlacement, CatalogSymbol } from "@workstream/contracts";
import { DesignAssetGlyph } from "./DesignAssetGlyph";
import ly from "./studioLayersPanel.module.css";

export type LayerRow = {
  placement: CatalogPlacement;
  symbol: CatalogSymbol;
  hidden: boolean;
  locked: boolean;
};

type Props = {
  rows: LayerRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggleHidden: (id: string) => void;
  onToggleLocked: (id: string) => void;
  onShowAll: () => void;
  onHideAll: () => void;
};

export function StudioLayersPanel({
  rows,
  selectedId,
  onSelect,
  onToggleHidden,
  onToggleLocked,
  onShowAll,
  onHideAll,
}: Props) {
  return (
    <div className={ly.panel}>
      <div className={ly.header}>
        <span className={ly.headerLabel}>elements ({rows.length})</span>
        <button type="button" className={ly.headerBtn} onClick={onShowAll}>
          show all
        </button>
        <button type="button" className={ly.headerBtn} onClick={onHideAll}>
          hide all
        </button>
      </div>
      <ul className={ly.list}>
        {rows.map(({ placement, symbol, hidden, locked }) => (
          <li key={placement.id}>
            <button
              type="button"
              className={`${ly.row} ${selectedId === placement.id ? ly.rowSelected : ""}`}
              onClick={() => onSelect(placement.id)}
            >
              <button
                type="button"
                className={ly.iconBtn}
                aria-label={hidden ? "Show" : "Hide"}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleHidden(placement.id);
                }}
              >
                {hidden ? "◌" : "◉"}
              </button>
              <button
                type="button"
                className={ly.iconBtn}
                aria-label={locked ? "Unlock" : "Lock"}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleLocked(placement.id);
                }}
              >
                {locked ? "🔒" : "🔓"}
              </button>
              <DesignAssetGlyph symbol={symbol} size="sm" />
              <span className={ly.label}>{placement.label ?? symbol.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
