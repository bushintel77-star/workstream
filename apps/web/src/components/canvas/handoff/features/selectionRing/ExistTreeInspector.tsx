"use client";

import { computeAs4970ProtectionZones } from "@workstream/domain";
import type { BoardCamera } from "../../geometry/cameraPointer";
import { CameraChrome, type CameraChromePlace } from "../../CameraChrome";
import kit from "../chromeKit/summonedDock.module.css";
import css from "./existTreeInspector.module.css";

type Props = {
  /** Board % — parked south of the selection (prime pixel). */
  xPct: number;
  yPct: number;
  /** Live board camera — CameraChrome project so zoom/pan stay honest. */
  cam: BoardCamera;
  dbhM: number;
  /** Multi-stem DBHs when authored; empty/undefined = single stem. */
  stemDbhM?: number[];
  locked: boolean;
  onDbhM: (n: number) => void;
  onStemDbhM?: (stems: number[]) => void;
};

/**
 * AS 4970-2025 DBH authoring — Fitts-near the selected tree via CameraChrome.
 * Multi-stem: √ΣDi² combined DBH for NRZ/SRZ.
 */
export function ExistTreeInspector({
  xPct,
  yPct,
  cam,
  dbhM,
  stemDbhM,
  locked,
  onDbhM,
  onStemDbhM,
}: Props) {
  const stems =
    stemDbhM && stemDbhM.length > 0 ? stemDbhM : [dbhM > 0 ? dbhM : 0.45];
  const zones = computeAs4970ProtectionZones(stems);
  const place: CameraChromePlace = {
    kind: "project",
    pct: { x: xPct, y: yPct },
    cam,
    transform: "translate(-50%, 52px)",
  };

  const commitStems = (next: number[]) => {
    const clean = next
      .map((n) => Math.min(2, Math.max(0.05, n)))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (clean.length === 0) return;
    if (onStemDbhM) onStemDbhM(clean);
    else onDbhM(clean[0]!);
  };

  return (
    <CameraChrome place={place} testId="exist-tree-inspector-chrome">
      <div
        className={`${kit.dock} ${css.root}`}
        data-testid="exist-tree-inspector"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <p className={`${kit.kicker} ${css.kicker}`}>
          Existing tree · AS 4970-2025
        </p>
        {stems.map((stem, idx) => (
          <label key={idx} className={css.field}>
            <span>{stems.length > 1 ? `Stem ${idx + 1}` : "DBH m"}</span>
            <input
              type="number"
              min={0.05}
              max={2}
              step={0.01}
              inputMode="decimal"
              disabled={locked}
              value={stem}
              aria-label={
                stems.length > 1
                  ? `Existing tree stem ${idx + 1} DBH in metres`
                  : "Existing tree DBH in metres"
              }
              data-testid={
                stems.length > 1
                  ? `exist-tree-stem-${idx}`
                  : "exist-tree-dbh"
              }
              onChange={(e) => {
                const n = Number.parseFloat(e.target.value);
                if (!Number.isFinite(n) || n <= 0) return;
                const next = stems.slice();
                next[idx] = n;
                commitStems(next);
              }}
            />
          </label>
        ))}
        {onStemDbhM && !locked ? (
          <div className={css.stemActions}>
            <button
              type="button"
              className={css.stemBtn}
              data-testid="exist-tree-add-stem"
              onClick={() => commitStems([...stems, 0.2])}
            >
              Add stem
            </button>
            {stems.length > 1 ? (
              <button
                type="button"
                className={css.stemBtn}
                data-testid="exist-tree-remove-stem"
                onClick={() => commitStems(stems.slice(0, -1))}
              >
                Remove stem
              </button>
            ) : null}
          </div>
        ) : null}
        <p className={css.meta} data-testid="exist-tree-nrz-srz">
          {stems.length > 1
            ? `Combined DBH ≈ ${zones.dbh_m.toFixed(2)} m · `
            : null}
          NRZ ≈ {zones.nrz_radius_m.toFixed(1)} m · SRZ ≈{" "}
          {zones.srz_radius_m.toFixed(1)} m · indicative
        </p>
      </div>
    </CameraChrome>
  );
}
