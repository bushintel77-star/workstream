/**
 * Curve-carousel math for the left tool dock — pure and deterministic.
 *
 * The dock chips sit on a gentle arc: whichever chip is at the crest leans
 * toward the drawing surface, grows and brightens, with a cosine falloff
 * across its neighbours. The crest follows the pointer (fisheye), spins with
 * the wheel, and settles on the active tool at rest.
 *
 * Only the chip's inner body is transformed — the 44px hit target never
 * shrinks (docs/STUDIO-STYLING-AND-UX.md, tap-target rule).
 */

export const DOCK_CURVE = {
  /** Max lean toward the board at the crest (px). */
  reachPx: 12,
  /** Neighbours influenced either side of the crest. */
  window: 2.4,
  /** Standing curve when the pointer is away — the active tool still crests. */
  restAmplitude: 0.45,
  minScale: 1,
  maxScale: 1.16,
  minOpacity: 0.6,
  /** Wheel delta → crest travel (chips per wheel px). */
  wheelGain: 0.012,
} as const;

export type DockChipPose = {
  /** Lean toward the drawing surface, px. */
  leanPx: number;
  scale: number;
  opacity: number;
};

/** Cosine-eased weight of a chip at `index` for a crest at `focus`. */
function crestWeight(index: number, focus: number): number {
  const d = Math.abs(index - focus) / DOCK_CURVE.window;
  if (d >= 1) return 0;
  return (1 - Math.cos(Math.PI * (1 - d))) / 2;
}

export function dockChipPose(
  index: number,
  focus: number,
  amplitude = 1,
): DockChipPose {
  const w = crestWeight(index, focus) * amplitude;
  return {
    leanPx: DOCK_CURVE.reachPx * w,
    scale:
      DOCK_CURVE.minScale + (DOCK_CURVE.maxScale - DOCK_CURVE.minScale) * w,
    opacity:
      DOCK_CURVE.minOpacity + (1 - DOCK_CURVE.minOpacity) * w,
  };
}

export function clampDockFocus(focus: number, count: number): number {
  if (count <= 0) return 0;
  return Math.min(count - 1, Math.max(0, focus));
}

/** Pointer y (px from list top) → fractional crest index. */
export function dockFocusFromPointer(
  offsetY: number,
  pitchPx: number,
  count: number,
): number {
  if (pitchPx <= 0) return 0;
  return clampDockFocus(offsetY / pitchPx - 0.5, count);
}

/** Wheel spin — travel the crest along the arc. */
export function spinDockFocus(
  focus: number,
  deltaY: number,
  count: number,
): number {
  return clampDockFocus(focus + deltaY * DOCK_CURVE.wheelGain, count);
}
