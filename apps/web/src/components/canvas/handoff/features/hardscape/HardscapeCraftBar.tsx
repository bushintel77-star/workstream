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
import { CameraChrome } from "../../CameraChrome";
import css from "./hardscapeCraft.module.css";

type Props = {
  pathWidthM: PathWidthLockM;
  edgeType: HardscapeEdgeType;
  pathFilletM: PathFilletLockM;
  pathDrafting: boolean;
  onPathWidth: (w: PathWidthLockM) => void;
  onEdgeType: (e: HardscapeEdgeType) => void;
  onPathFillet: (r: PathFilletLockM) => void;
  onBeginPath: () => void;
};

/** Residential path grammar — width locks + edge type + fillet (not Civil 3D). */
export function HardscapeCraftBar({
  pathWidthM,
  edgeType,
  pathFilletM,
  pathDrafting,
  onPathWidth,
  onEdgeType,
  onPathFillet,
  onBeginPath,
}: Props) {
  return (
    <CameraChrome place={{ kind: "dock" }} testId="hardscape-craft-bar">
      <aside className={css.bar} data-testid="hardscape-craft-dock">
        <p className={css.kicker}>Path grammar</p>
        <div className={css.row} aria-label="Path width">
          {PATH_WIDTH_LOCKS_M.map((w) => (
            <button
              key={w}
              type="button"
              className={css.chip}
              data-active={pathWidthM === w ? "true" : "false"}
              data-testid={`path-width-${w}`}
              onClick={() => onPathWidth(w)}
            >
              {w.toFixed(1)} m
            </button>
          ))}
        </div>
        <div className={css.row} aria-label="Edge type">
          {HARDSCAPE_EDGE_TYPES.map((e) => (
            <button
              key={e}
              type="button"
              className={css.chip}
              data-active={edgeType === e ? "true" : "false"}
              data-testid={`edge-type-${e}`}
              onClick={() => onEdgeType(e)}
            >
              {HARDSCAPE_EDGE_LABELS[e]}
            </button>
          ))}
        </div>
        <div className={css.row} aria-label="Corner fillet">
          {PATH_FILLET_LOCKS_M.map((r) => (
            <button
              key={r}
              type="button"
              className={css.chip}
              data-active={pathFilletM === r ? "true" : "false"}
              data-testid={`path-fillet-${r}`}
              onClick={() => onPathFillet(r)}
            >
              {r === 0 ? "Sharp" : `R${r.toFixed(1)}`}
            </button>
          ))}
        </div>
        <div className={css.row}>
          <button
            type="button"
            className={css.chip}
            data-active={pathDrafting ? "true" : "false"}
            data-testid="path-draw-begin"
            onClick={onBeginPath}
          >
            {pathDrafting ? "Drawing path…" : "Draw path"}
          </button>
        </div>
        <p className={css.foot}>
          Click centreline · Enter (≥2 pts) · width buffer + edge hatch on plan
        </p>
      </aside>
    </CameraChrome>
  );
}
