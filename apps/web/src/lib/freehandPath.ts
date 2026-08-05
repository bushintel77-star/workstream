import { getStroke } from "perfect-freehand";

type PctPoint = { x: number; y: number };

/**
 * Convert a percent-point stroke through the perfect-freehand algorithm
 * into a filled SVG path `d`. Points are percent-of-board (0-100).
 */
export function freehandPath(
  points: PctPoint[],
  options?: {
    size?: number;
    thinning?: number;
    smoothing?: number;
    streamline?: number;
    last?: boolean;
  },
): string {
  if (points.length < 2) return "";

  const outline = getStroke(points, {
    size: options?.size ?? 2.5,
    thinning: options?.thinning ?? 0.5,
    smoothing: options?.smoothing ?? 0.5,
    streamline: options?.streamline ?? 0.5,
    last: options?.last ?? true,
  });

  if (outline.length < 2) return "";

  return `M ${outline[0][0]} ${outline[0][1]} ` +
    outline.slice(1).map(([x, y]) => `L ${x} ${y}`).join(" ") +
    " Z";
}
