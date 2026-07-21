/**
 * Drag-to-pan viewport translation — CAD/drafting convention (Figma,
 * Illustrator, AutoCAD): space+drag or middle-mouse-drag translates the
 * view without disturbing selection. Distinct from zoom (canvasZoom.ts),
 * which anchors around a focus point rather than translating.
 */

/** Practical px cap — guards against runaway drift, not a real use limit. */
const PAN_ABS_MAX = 100_000;

export function clampPan(v: number): number {
  if (Number.isNaN(v)) return 0;
  return Math.max(-PAN_ABS_MAX, Math.min(PAN_ABS_MAX, v));
}

/**
 * A pointerdown starts a pan drag on middle-mouse (button 1) at any time,
 * or on the primary button (0) while Space is held — never on marquee-select
 * drags (primary button, no Space).
 */
export function isPanGesture(opts: {
  button: number;
  spaceHeld: boolean;
}): boolean {
  if (opts.button === 1) return true;
  return opts.button === 0 && opts.spaceHeld;
}

/** Absolute pan offset from a drag-start base plus the pointer's screen delta. */
export function nextPanOffset(
  base: { x: number; y: number },
  dxPx: number,
  dyPx: number,
): { x: number; y: number } {
  return {
    x: clampPan(base.x + dxPx),
    y: clampPan(base.y + dyPx),
  };
}
