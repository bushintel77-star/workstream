/**
 * Spatial Sketching — canvas thumbnail renderer (Phase B).
 *
 * Pure function: strokes (board-% space, keyed by `canvas_id`) → inline SVG
 * path data, scaled to a 74×46 viewBox (spec §4 Geometry: "Sketch planes rail
 * | cards 74×46"). No WebGL context, no React — unit-testable in isolation.
 *
 * Strokes already carry `canvas_id` + board-% points (`CanvasStrokeSchema`).
 * We filter to the target canvas, project 0–100% → 0–74/0–46, and emit one
 * SVG `<path>` per stroke. The caller wraps this in an `<svg>` element.
 */

import type { CanvasStroke } from "@workstream/contracts";

/** Spec §4: cards 74×46. */
export const THUMB_W = 74;
export const THUMB_H = 46;

/** Default stroke color for the thumbnail (read from the stroke, fallback). */
const DEFAULT_COLOR = "#e8e6e0";

/** Default stroke width in thumbnail px (scaled down from board-% width). */
const DEFAULT_THUMB_WIDTH = 1.2;

/** Sanitize a stroke color for safe SVG embedding — hex or named colors only.
 *  The stroke color comes from the Zod-validated schema (z.string()), so it
 *  could theoretically carry malicious content. This guard ensures only safe
 *  hex values reach the SVG string used with dangerouslySetInnerHTML. */
function safeColor(raw: string | undefined): string {
  const c = raw ?? DEFAULT_COLOR;
  if (/^#[0-9a-fA-F]{3,8}$/.test(c)) return c;
  return DEFAULT_COLOR;
}

/**
 * Build the inner SVG content (paths) for a canvas thumbnail.
 * Returns a string of `<path>` elements ready to drop inside an `<svg>`.
 *
 * Strokes with `canvas_id` matching `canvasId` are included. Strokes with
 * `canvas_id === null` (ground plane strokes) are excluded — the ground plane
 * has no card in the rail.
 */
export function canvasThumbnailPaths(
  strokes: readonly CanvasStroke[],
  canvasId: string,
): string {
  const canvasStrokes = strokes.filter((s) => s.canvas_id === canvasId);
  if (canvasStrokes.length === 0) return "";

  const paths = canvasStrokes.map((stroke) => {
    const pts = stroke.points;
    if (pts.length < 2) return "";

    const color = safeColor(stroke.color);
    const width = DEFAULT_THUMB_WIDTH;

    // Board-% (0–100) → thumbnail px (0–THUMB_W / 0–THUMB_H).
    // y is flipped: board-% y=0 is top, SVG y=0 is top — no flip needed
    // (both are top-down in screen space).
    const d = pts
      .map((p, i) => {
        const x = (p.x_pct / 100) * THUMB_W;
        const y = (p.y_pct / 100) * THUMB_H;
        return i === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : `L ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");

    return `<path d="${d}" stroke="${color}" stroke-width="${width}" fill="none" stroke-linecap="round" stroke-linejoin="round" />`;
  });

  return paths.filter(Boolean).join("");
}

/**
 * Build a complete inline SVG string for a canvas thumbnail.
 * The SVG has a 74×46 viewBox and no background (transparent — the card
 * provides the background).
 */
export function canvasThumbnailSvg(
  strokes: readonly CanvasStroke[],
  canvasId: string,
): string {
  const paths = canvasThumbnailPaths(strokes, canvasId);
  return `<svg viewBox="0 0 ${THUMB_W} ${THUMB_H}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">${paths}</svg>`;
}
