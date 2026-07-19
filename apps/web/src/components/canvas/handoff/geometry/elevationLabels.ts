/**
 * Elevation label collision stacking — Workflow 1 SVG viewBox space.
 * When two anchors are within `collisionThresh` (≈120 CSS px on a wide board),
 * step the later label up by `stackStep` (≈24 CSS px).
 */

export type ElevLabelAnchor = {
  id: string;
  /** Horizontal anchor (viewBox x). */
  x: number;
};

/**
 * Assign stack indices (0 = baseline). Sorted left→right; each near neighbour
 * increments the stack so labels fan upward instead of colliding.
 */
export function assignElevationLabelStacks(
  anchors: ElevLabelAnchor[],
  collisionThresh = 12,
): Map<string, number> {
  const sorted = [...anchors].sort((a, b) => a.x - b.x || a.id.localeCompare(b.id));
  const stacks = new Map<string, number>();
  let prevX = -Infinity;
  let prevStack = 0;
  for (const a of sorted) {
    const stack =
      Number.isFinite(prevX) && a.x - prevX < collisionThresh
        ? prevStack + 1
        : 0;
    stacks.set(a.id, stack);
    prevX = a.x;
    prevStack = stack;
  }
  return stacks;
}

/** Vertical offset in viewBox units for a stack index (≈24px at ~700px wide). */
export function elevationLabelOffsetY(stack: number, step = 2.8): number {
  return Math.max(0, stack) * step;
}
