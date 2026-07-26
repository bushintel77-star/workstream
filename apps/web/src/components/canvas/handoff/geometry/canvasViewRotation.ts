/**
 * CAD viewport camera rotation — AutoCAD/Revit model:
 * rotate the camera, never geometry coordinates.
 *
 * Degrees clockwise from north-up (board default). Increment steps only —
 * freeform angles are rejected so survey-grade measures stay trustworthy.
 */

export const VIEW_ROTATION_STEPS_DEG = [15, 45, 90] as const;
export type ViewRotationStepDeg = (typeof VIEW_ROTATION_STEPS_DEG)[number];

export const DEFAULT_VIEW_ROTATION_STEP: ViewRotationStepDeg = 15;

/** Normalize to (−180, 180] for stable HUD + equality with north. */
export function normalizeViewRotationDeg(deg: number): number {
  if (!Number.isFinite(deg)) return 0;
  let d = deg % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  // Snap near-zero float noise to exact north
  if (Math.abs(d) < 1e-6) return 0;
  return Number(d.toFixed(4));
}

export function isViewRotatedFromNorth(deg: number): boolean {
  return normalizeViewRotationDeg(deg) !== 0;
}

/** Step camera by ±increment (CAD view only). */
export function stepViewRotationDeg(
  current: number,
  dir: 1 | -1,
  step: ViewRotationStepDeg = DEFAULT_VIEW_ROTATION_STEP,
): number {
  return normalizeViewRotationDeg(current + dir * step);
}

export function resetViewRotationToNorth(): number {
  return 0;
}

/**
 * Live camera yaw for `.zoomWorld`.
 *
 * - CAD free plan: View north control (always, north-up when 0).
 * - Survey / Sketch / CAD: Looking N/E/S/W garden axon while tilt is on
 *   (or mid tilt animation). Flat Sketch/Survey stays north-up.
 * - Fit sheet / quote / share / elevation: never.
 */
export function resolvePlanRotateDeg(args: {
  mode: string;
  frameOn: boolean;
  clientView: boolean;
  tiltDeg: number;
  viewRotationDeg: number;
  /** True while the temporary tilt transition class is mounted. */
  tiltAnimating?: boolean;
}): number {
  if (args.frameOn) return 0;
  const planMode =
    args.mode === "survey" || args.mode === "sketch" || args.mode === "cad";
  if (!planMode) return 0;
  const cadFree = args.mode === "cad" && !args.clientView;
  const gardenAxon =
    (Number.isFinite(args.tiltDeg) && args.tiltDeg > 0.5) ||
    Boolean(args.tiltAnimating);
  if (!cadFree && !gardenAxon) return 0;
  return normalizeViewRotationDeg(args.viewRotationDeg);
}
