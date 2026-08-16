/**
 * Gold Standard 2026 — camera rig types (Fused Rendering Context).
 *
 * Binding: docs/GOLD-STANDARD-2026-ARCHITECTURE.md §1.3
 *
 * The camera is a FUSED ortho↔perspective system:
 *   - viewBlendTarget=0: orthographic, top-down (CAD plan view, no distortion)
 *   - viewBlendTarget=1: perspective, oblique (3D spatial depth)
 *   - Between: the FusedCamera interpolates the projection matrix + arcs the
 *     camera position — one continuous motion, no hard cut.
 *
 * The tiltDeg still controls the OBLIQUE ANGLE (how steep the 3D view is), while
 * viewBlendTarget controls WHETHER we're in plan or 3D. At blend=0 the tilt is
 * invisible (camera is directly overhead); at blend=1 the full tilt is applied.
 *
 * Pan/zoom are driven by pointer + wheel. Rotation is driven by the existing
 * view rotation gesture.
 */

export interface StudioCameraRig {
  /** Pan offset in world units (metres). */
  panX: number;
  panY: number;
  /** Orthographic zoom factor (1 = fit, >1 = zoomed in). */
  zoom: number;
  /** Plan rotation in degrees (0 = north up). */
  rotateDeg: number;
  /** Tilt angle in degrees (0 = top-down, 55 = default oblique, 90 = horizon). */
  tiltDeg: number;
  /** Focus point for zoom anchoring, in % space (0–100). */
  focusX: number;
  focusY: number;
}

/** Default rig: fit, top-down (plan view), north up, no tilt. */
export const DEFAULT_CAMERA_RIG: StudioCameraRig = {
  panX: 0,
  panY: 0,
  zoom: 1,
  rotateDeg: 0,
  tiltDeg: 55, // default oblique angle (used when viewBlendTarget=1)
  focusX: 50,
  focusY: 50,
};

/**
 * Check if the tilt view is active. In the fused system, "tilted" means the
 * view blend is in 3D mode (the user sees perspective + oblique angle).
 * Used to lock editing when the camera is not in plan view.
 */
export function isRigTilted(rig: StudioCameraRig): boolean {
  // Delegate to the store's viewBlendTarget for the fused system.
  // This function is kept for backward compat — callers that check tiltDeg
  // directly should migrate to checking viewBlendTarget.
  return rig.tiltDeg > 0.5;
}
