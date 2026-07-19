"use client";

import css from "./existTreeInspector.module.css";

type Props = {
  dbhM: number;
  locked: boolean;
  onDbhM: (n: number) => void;
};

/**
 * Calm TPZ authoring when an existing tree is selected — AS 4970 DBH → ring.
 * Kept off the SelectionRing chrome fog path (monograph).
 */
export function ExistTreeInspector({ dbhM, locked, onDbhM }: Props) {
  const tpzM = Math.max(2, 12 * dbhM);
  return (
    <div className={css.root} data-testid="exist-tree-inspector">
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
