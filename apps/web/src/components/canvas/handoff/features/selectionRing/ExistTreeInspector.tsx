"use client";

import type { BoardCamera } from "../../geometry/cameraPointer";
import { CameraChrome, type CameraChromePlace } from "../../CameraChrome";
import css from "./existTreeInspector.module.css";

type Props = {
  /** Board % — parked south of the selection (prime pixel). */
  xPct: number;
  yPct: number;
  /** Live board camera — CameraChrome project so zoom/pan stay honest. */
  cam: BoardCamera;
  dbhM: number;
  locked: boolean;
  onDbhM: (n: number) => void;
};

/**
 * AS 4970 DBH authoring — Fitts-near the selected tree via CameraChrome.
 */
export function ExistTreeInspector({
  xPct,
  yPct,
  cam,
  dbhM,
  locked,
  onDbhM,
}: Props) {
  const tpzM = Math.max(2, 12 * dbhM);
  const place: CameraChromePlace = {
    kind: "project",
    pct: { x: xPct, y: yPct },
    cam,
    transform: "translate(-50%, 52px)",
  };

  return (
    <CameraChrome place={place} testId="exist-tree-inspector-chrome">
      <div
        className={css.root}
        data-testid="exist-tree-inspector"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <p className={css.kicker}>Existing tree · AS 4970</p>
        <label className={css.field}>
          <span>DBH m</span>
          <input
            type="number"
            min={0.05}
            max={2}
            step={0.01}
            inputMode="decimal"
            disabled={locked}
            value={dbhM}
            aria-label="Existing tree DBH in metres"
            onChange={(e) => {
              const n = Number.parseFloat(e.target.value);
              if (!Number.isFinite(n) || n <= 0) return;
              onDbhM(Math.min(2, Math.max(0.05, n)));
            }}
          />
        </label>
        <p className={css.meta}>
          TPZ ≈ {tpzM.toFixed(1)} m (12 × DBH, min 2 m) · indicative
        </p>
      </div>
    </CameraChrome>
  );
}
