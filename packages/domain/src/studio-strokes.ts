import { getStroke } from "perfect-freehand";
import type { CanvasStroke } from "@workstream/contracts";

export type StrokePointPct = { x_pct: number; y_pct: number };

const DEFAULT_OPTIONS = {
  size: 8,
  thinning: 0.65,
  smoothing: 0.5,
  streamline: 0.5,
} as const;

/** Convert percentage points on the aerial to a closed SVG path `d` (viewBox = canvas px). */
export function strokePointsToPathD(
  points: StrokePointPct[],
  widthPx: number,
  heightPx: number,
  strokeWidthPx = 2,
): string {
  if (points.length < 2 || widthPx <= 0 || heightPx <= 0) return "";

  const outline = getStroke(
    points.map((p) => [
      (p.x_pct / 100) * widthPx,
      (p.y_pct / 100) * heightPx,
    ]),
    {
      ...DEFAULT_OPTIONS,
      size: Math.max(4, strokeWidthPx * 4),
    },
  );

  return getSvgPathFromStroke(outline);
}

/** Render a persisted stroke for SVG overlay (percentage coords). */
export function canvasStrokeToPathD(
  stroke: CanvasStroke,
  widthPx: number,
  heightPx: number,
): string {
  return strokePointsToPathD(stroke.points, widthPx, heightPx, stroke.width_px);
}

function getSvgPathFromStroke(stroke: number[][]): string {
  if (!stroke.length) return "";

  const max = stroke.length - 1;
  return stroke
    .reduce(
      (acc, point, i, arr) => {
        if (i === max) {
          acc.push(point[0], point[1]);
        } else {
          const next = arr[i + 1];
          const midX = (point[0] + next[0]) / 2;
          const midY = (point[1] + next[1]) / 2;
          acc.push(point[0], point[1], midX, midY);
        }
        return acc;
      },
      ["M", ...stroke[0], "Q"] as (string | number)[],
    )
    .concat(["Z"])
    .join(" ");
}
