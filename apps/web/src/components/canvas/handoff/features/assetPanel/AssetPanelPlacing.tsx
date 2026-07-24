"use client";

import {
  HARDSCAPE_EDGE_LABELS,
  HARDSCAPE_EDGE_TYPES,
  PATH_FILLET_LOCKS_M,
  PATH_WIDTH_LOCKS_M,
  type HardscapeEdgeType,
  type PathFilletLockM,
  type PathWidthLockM,
} from "@workstream/domain";
import css from "./assetPanel.module.css";

type Props = {
  pathWidthM: PathWidthLockM;
  edgeType: HardscapeEdgeType;
  pathFilletM: PathFilletLockM;
  pathDrafting: boolean;
  onBack: () => void;
  onPathWidth: (w: PathWidthLockM) => void;
  onEdgeType: (e: HardscapeEdgeType) => void;
  onPathFillet: (r: PathFilletLockM) => void;
  onBeginPath: () => void;
};

/** Path Grammar controls — State 3 of the unified asset panel. */
export function AssetPanelPlacing({
  pathWidthM,
  edgeType,
  pathFilletM,
  pathDrafting,
  onBack,
  onPathWidth,
  onEdgeType,
  onPathFillet,
  onBeginPath,
}: Props) {
  return (
    <div className={css.body} data-testid="asset-panel-placing">
      <div className={css.placingHead}>
        <button
          type="button"
          className={css.backBtn}
          data-testid="asset-panel-back"
          aria-label="Back to asset library"
          onClick={onBack}
        >
          ←
        </button>
        <p className={css.placingKicker}>Path grammar</p>
      </div>
      <div className={css.craftRow} aria-label="Path width">
        {PATH_WIDTH_LOCKS_M.map((w) => (
          <button
            key={w}
            type="button"
            className={css.craftChip}
            data-active={pathWidthM === w ? "true" : "false"}
            data-testid={`path-width-${w}`}
            onClick={() => onPathWidth(w)}
          >
            {w.toFixed(1)} m
          </button>
        ))}
      </div>
      <div className={css.craftRow} aria-label="Edge type">
        {HARDSCAPE_EDGE_TYPES.map((e) => (
          <button
            key={e}
            type="button"
            className={css.craftChip}
            data-active={edgeType === e ? "true" : "false"}
            data-testid={`edge-type-${e}`}
            onClick={() => onEdgeType(e)}
          >
            {HARDSCAPE_EDGE_LABELS[e]}
          </button>
        ))}
      </div>
      <div className={css.craftRow} aria-label="Corner fillet">
        {PATH_FILLET_LOCKS_M.map((r) => (
          <button
            key={r}
            type="button"
            className={css.craftChip}
            data-active={pathFilletM === r ? "true" : "false"}
            data-testid={`path-fillet-${r}`}
            onClick={() => onPathFillet(r)}
          >
            {r === 0 ? "Sharp" : `R${r.toFixed(1)}`}
          </button>
        ))}
      </div>
      <div className={css.craftRow}>
        <button
          type="button"
          className={css.craftChip}
          data-active={pathDrafting ? "true" : "false"}
          data-testid="path-draw-begin"
          onClick={onBeginPath}
        >
          {pathDrafting ? "Drawing path…" : "Draw path"}
        </button>
      </div>
      <p className={css.craftFoot}>
        Click centreline · Enter (≥2 pts) · width buffer + edge hatch on plan
      </p>
    </div>
  );
}
