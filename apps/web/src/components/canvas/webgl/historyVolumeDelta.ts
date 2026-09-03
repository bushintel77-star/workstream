/**
 * Phase P.1 — the history scrub's volume delta readout ("then vs delta now").
 *
 * Scrubbing the head back is a proposal: release it and the work after that
 * point branches. The one number that says what that costs on a landscape job
 * is earthworks — how much cut and fill the drawing carried THEN against what
 * it carries NOW. Without it the operator is scrubbing blind through a track
 * of undifferentiated steps.
 *
 * Every number here is derived from the same `padStrokes` / `padCutFill`
 * integral the cut/fill readout uses, against the same terrain sampler, so
 * the scrub cannot disagree with the readout it sits above.
 *
 * Binding: docs/MENTAL-CANVAS-ROADMAP.md Phase P.1.
 */

import type { CanvasStroke, LandscapeFeature } from "@workstream/contracts";
import { CUT_FILL_CELL_M, padCutFill, padStrokes } from "./cutFill";

/** Cut and fill volumes in cubic metres. */
export interface CutFillVolumes {
  cutM3: number;
  fillM3: number;
}

export const ZERO_VOLUMES: CutFillVolumes = { cutM3: 0, fillM3: 0 };

/**
 * Integrate cut and fill for one document state.
 *
 * Returns zeros when there is no terrain to cut into — an honest zero, not a
 * guess: without a heightmap there is no existing grade to measure against.
 */
export function volumesForState(
  strokes: CanvasStroke[],
  features: LandscapeFeature[],
  sampler: ((x: number, z: number) => number) | null,
  scaleM: number,
  boardAspect: number,
): CutFillVolumes {
  if (!sampler) return ZERO_VOLUMES;
  const pads = padStrokes(strokes, scaleM, boardAspect, features);
  if (pads.length === 0) return ZERO_VOLUMES;
  let cutM3 = 0;
  let fillM3 = 0;
  for (const pad of pads) {
    const r = padCutFill(sampler, pad.worldXZ, pad.heightM, CUT_FILL_CELL_M);
    cutM3 += r.cutM3;
    fillM3 += r.fillM3;
  }
  return { cutM3: Math.round(cutM3), fillM3: Math.round(fillM3) };
}

/** The comparison the scrub readout states. */
export interface VolumeDelta {
  then: CutFillVolumes;
  now: CutFillVolumes;
  /** now − then, signed. Positive = the work since adds volume. */
  cutDeltaM3: number;
  fillDeltaM3: number;
  /** True when nothing would change — scrubbing here costs no earthworks. */
  unchanged: boolean;
}

export function volumeDelta(
  then: CutFillVolumes,
  now: CutFillVolumes,
): VolumeDelta {
  const cutDeltaM3 = now.cutM3 - then.cutM3;
  const fillDeltaM3 = now.fillM3 - then.fillM3;
  return {
    then,
    now,
    cutDeltaM3,
    fillDeltaM3,
    unchanged: cutDeltaM3 === 0 && fillDeltaM3 === 0,
  };
}

/** Signed volume, e.g. `+12 m³` / `−4 m³` / `0 m³`. */
export function formatSignedM3(value: number): string {
  if (value === 0) return "0 m³";
  const sign = value > 0 ? "+" : "−";
  return `${sign}${Math.abs(value)} m³`;
}

/**
 * The readout line. States THEN and the delta, never the delta alone — a bare
 * "−40 m³" does not say what it is 40 m³ less than.
 */
export function formatVolumeDelta(d: VolumeDelta): string {
  if (d.unchanged) {
    return `then cut ${d.then.cutM3} m³ · fill ${d.then.fillM3} m³ — no earthworks change`;
  }
  return (
    `then cut ${d.then.cutM3} m³ · fill ${d.then.fillM3} m³` +
    ` — now ${formatSignedM3(d.cutDeltaM3)} cut, ${formatSignedM3(d.fillDeltaM3)} fill`
  );
}
