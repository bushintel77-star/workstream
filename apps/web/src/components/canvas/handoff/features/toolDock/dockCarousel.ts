/**
 * Curve-carousel math for the left tool dock — pure and deterministic.
 *
 * The dock itself is the carousel: chips ride a vertical arc (C-curve
 * bulging toward the board) with 3D depth at the crest. The frost rail
 * spine follows that same arc. Crest tracks the pointer, spins with the
 * wheel, and settles on the active tool at rest.
 */

export const DOCK_CURVE = {
  /** Max lean of a slot toward the board at the crest (px). */
  reachPx: 28,
  /** Neighbours influenced either side of the crest. */
  window: 2.6,
  /** Standing curve when the pointer is away — the active tool still crests. */
  restAmplitude: 0.55,
  minScale: 0.92,
  maxScale: 1.14,
  minOpacity: 0.55,
  /** Crest chip comes forward toward the camera (px). */
  depthPx: 18,
  /** Off-crest chips yaw away from the board (deg). */
  yawDeg: 14,
  /** Wheel delta → crest travel (chips per wheel px). */
  wheelGain: 0.012,
  /** Rail stroke inset from the chip column's left edge (px). */
  railInsetPx: 10,
} as const;

export type DockChipPose = {
  /** Arc offset toward the drawing surface, px. */
  leanPx: number;
  scale: number;
  opacity: number;
  /** Depth toward the camera at the crest, px. */
  depthPx: number;
  /** Yaw away from the board when off-crest, deg. */
  yawDeg: number;
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
  const signed = (index - focus) / DOCK_CURVE.window;
  const yaw =
    Math.max(-1, Math.min(1, signed)) * DOCK_CURVE.yawDeg * amplitude;
  return {
    leanPx: DOCK_CURVE.reachPx * w,
    scale:
      DOCK_CURVE.minScale + (DOCK_CURVE.maxScale - DOCK_CURVE.minScale) * w,
    opacity: DOCK_CURVE.minOpacity + (1 - DOCK_CURVE.minOpacity) * w,
    depthPx: DOCK_CURVE.depthPx * w,
    yawDeg: yaw,
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

/**
 * SVG path for the frost rail spine that follows the carousel arc.
 * Coordinates are local to a viewBox of width=`viewW`, height=`count * pitch`.
 * The path bulges toward +x (the board) at the crest.
 */
export function dockRailPath(
  count: number,
  focus: number,
  amplitude: number,
  pitchPx: number,
  viewW: number,
): string {
  if (count <= 0 || pitchPx <= 0) return "";
  const inset = DOCK_CURVE.railInsetPx;
  const samples = Math.max(count * 4, 12);
  const pts: Array<{ x: number; y: number }> = [];
  for (let s = 0; s <= samples; s += 1) {
    const t = s / samples;
    const index = t * (count - 1);
    const pose = dockChipPose(index, focus, amplitude);
    const y = t * count * pitchPx;
    const x = Math.min(viewW - 4, inset + pose.leanPx * 0.85);
    pts.push({ x, y });
  }
  if (pts.length === 0) return "";
  let d = `M ${pts[0]!.x.toFixed(1)} ${pts[0]!.y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i += 1) {
    d += ` L ${pts[i]!.x.toFixed(1)} ${pts[i]!.y.toFixed(1)}`;
  }
  return d;
}
