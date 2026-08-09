import type { StructuredToolKind } from "./structured-tools";
import { defaultStructuredToolProps } from "./structured-tools";

/** Indicative AUD rates for Instant Planner micro-cost while drafting. */
const RATE_AUD: Record<StructuredToolKind, { per_m: number; per_m2: number }> =
  {
    ditch: { per_m: 95, per_m2: 0 },
    path: { per_m: 0, per_m2: 220 },
    wall: { per_m: 380, per_m2: 0 },
    bed: { per_m: 0, per_m2: 65 },
  };

const PCT_TO_M = 0.3;

export type StructuredStrokeCostEstimate = {
  length_m: number;
  area_m2: number;
  cost_aud: number;
  label: string;
};

function lengthM(pts: Array<{ x_pct: number; y_pct: number }>): number {
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    len +=
      Math.hypot(
        pts[i]!.x_pct - pts[i - 1]!.x_pct,
        pts[i]!.y_pct - pts[i - 1]!.y_pct,
      ) * PCT_TO_M;
  }
  return Math.round(len * 100) / 100;
}

function polygonAreaM2(pts: Array<{ x_pct: number; y_pct: number }>): number {
  if (pts.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    sum += a.x_pct * b.y_pct - b.x_pct * a.y_pct;
  }
  return Math.round((Math.abs(sum) / 2) * PCT_TO_M * PCT_TO_M * 100) / 100;
}

/** Live micro-cost for the stroke currently being drawn. */
export function estimateStructuredStrokeCost(
  kind: StructuredToolKind,
  draft: Array<{ x_pct: number; y_pct: number }>,
): StructuredStrokeCostEstimate | null {
  if (draft.length < 2) return null;
  const props = defaultStructuredToolProps(kind);
  const rates = RATE_AUD[kind];
  const length_m = lengthM(draft);
  let area_m2 = 0;
  if (kind === "bed") {
    area_m2 = polygonAreaM2(draft);
  } else if (kind === "path" && props.width_m > 0) {
    area_m2 = Math.round(length_m * props.width_m * 100) / 100;
  }
  const cost =
    length_m * rates.per_m + area_m2 * rates.per_m2;
  return {
    length_m,
    area_m2,
    cost_aud: Math.round(cost),
    label: props.friendly_name,
  };
}
