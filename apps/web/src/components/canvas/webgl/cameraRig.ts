/**
 * Gold Standard 2026 — camera rig types.
 *
 * Binding: docs/GOLD-STANDARD-2026-ARCHITECTURE.md §1.3
 *
 * The camera is an ortho-with-tilt hybrid:
 *   - Default: orthographic, top-down (the CAD plan view, no perspective distortion)
 *   - Tilt: camera lowers to oblique for the 3D "Vertical Truth" view
 *
 * Pan/zoom are driven by pointer + wheel (ported from the SVG board's
 * canvasPan/canvasZoom maths). Rotation is driven by the existing view
 * rotation gesture. Tilt is a separate axis (the old CSS rotateX on .zoomWorld
 * becomes a real camera pitch).
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

/** Default rig: fit, top-down, north up, no tilt. */
export const DEFAULT_CAMERA_RIG: StudioCameraRig = {
  panX: 0,
  panY: 0,
  zoom: 1,
  rotateDeg: 0,
  tiltDeg: 0,
  focusX: 50,
  focusY: 50,
};

/**
 * Check if the tilt view is active (editing locks out under tilt, same as the
 * old isTiltActive threshold).
 */
export function isRigTilted(rig: StudioCameraRig): boolean {
  return rig.tiltDeg > 0.5;
}
