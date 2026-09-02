import type { CanvasMode } from "../../../lib/canvas-mode";

/**
 * Tier-1 pure gate for the guided first-sketch handoff.
 *
 * The studio shows the one-line hint only when:
 *   - the board has no design content yet (no ink/placements/features),
 *   - the operator is in Sketch (the default landing mode, turn 15), and
 *   - the environment is not e2e (specs seed their own tool state).
 *
 * The boundary gate was removed (turn 15): "drawing must never wait on
 * setup" — a blank unscaled board shows the hint too, not just a board
 * with a confirmed title boundary. The UNSCALED badge (Phase D) carries
 * the scale story separately.
 *
 * Pure so the decision is unit-testable without mounting the studio.
 */
export function guideFirstSketch(args: {
  boundaryPointCount: number;
  hasDesignContent: boolean;
  mode: CanvasMode;
  isE2e: boolean;
}): boolean {
  return (
    !args.hasDesignContent &&
    args.mode === "sketch" &&
    !args.isE2e
  );
}
