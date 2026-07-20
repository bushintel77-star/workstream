"use client";

import type { CSSProperties } from "react";
import css from "./existTreeInspector.module.css";

type Props = {
  /** Board % — parked south of the selection (prime pixel). */
  xPct: number;
  yPct: number;
  dbhM: number;
  locked: boolean;
  onDbhM: (n: number) => void;
};

/**
 * AS 4970 DBH authoring — stays near the selected tree (Fitts proximity),
 * not a bottom-of-screen stretch from the selection.
 */
export function ExistTreeInspector({
  xPct,
  yPct,
  dbhM,
  locked,
  onDbhM,
}: Props) {
  const tpzM = Math.max(2, 12 * dbhM);
  const ax = Math.max(12, Math.min(88, xPct));
  const ay = Math.max(14, Math.min(86, yPct));
  return (
    <div
      className={css.root}
      data-testid="exist-tree-inspector"
      style={{ left: `${ax}%`, top: `${ay}%` } as CSSProperties}
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
  );
}
