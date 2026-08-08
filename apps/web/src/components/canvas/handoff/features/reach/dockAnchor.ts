/**
 * Anchor a summoned inventory / tool popup so it opens *into* the board from
 * the gutter and never clips off-canvas.
 *
 * The summon point is already pushed to a margin (see marginSummon). A popup
 * centred on that point (translate -50%) would overflow the viewport edge, so
 * we edge-anchor instead: left-gutter summons anchor their left edge and open
 * rightward; right-gutter summons anchor their right edge and open leftward.
 */
export type DockSide = "left" | "right";

export type DockAnchor = {
  /** Clamped horizontal anchor (board %). */
  x: number;
  /** Clamped vertical centre (board %). */
  y: number;
  /** Which edge is pinned to `x`; drives the CSS transform. */
  side: DockSide;
};

export function resolveDockAnchor(xPct: number, yPct: number): DockAnchor {
  const side: DockSide = xPct < 50 ? "left" : "right";
  // Keep the pinned edge just inside the board, and the vertical centre far
  // enough from top/bottom that a ~34%-tall popup stays fully visible.
  const x = Math.max(6, Math.min(94, xPct));
  const y = Math.max(28, Math.min(72, yPct));
  return { x, y, side };
}
