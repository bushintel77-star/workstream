import type { CanvasMode } from "../../../lib/canvas-mode";

/**
 * Tier-1 pure gate for the guided first-sketch handoff.
 *
 * The studio arms the pen and shows the one-line hint only when:
 *   - the title boundary is set (>= 3 points),
 *   - the board has no design content yet (no ink/placements/features),
 *   - the operator is in Sketch (the natural landing mode), and
 *   - the environment is not e2e (specs seed their own tool state).
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
    args.boundaryPointCount >= 3 &&
    !args.hasDesignContent &&
    args.mode === "sketch" &&
    !args.isE2e
  );
}
