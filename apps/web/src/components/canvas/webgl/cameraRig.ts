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
 * Full-orbit pitch → radians. 0° = top-down plan (camera overhead), 90° =
 * ground-level horizon (an elevation look when azimuth snaps to a facade
 * normal). Clamped into the 0…90° window; non-finite input collapses to plan.
 *
 * This is the single source of truth for the pitch bound — the previous
 * per-call `Math.min(…, 55°)` cap in FusedCamera is removed in favour of this
 * helper so the camera can drive the whole orbit, not just a 2.5D tilt.
 */
export function pitchRadians(tiltDeg: number): number {
  const deg = Number.isFinite(tiltDeg) ? tiltDeg : 0;
  return (Math.min(Math.max(deg, 0), 90) * Math.PI) / 180;
}

/** Maximum orbit pitch in degrees (0 = plan, 90 = horizon). */
export const PITCH_MAX_DEG = 90;

/** Clamp a pitch value into the 0…90° orbit window (non-finite → plan). */
export function clampPitchDeg(deg: number): number {
  return Number.isFinite(deg) ? Math.min(Math.max(deg, 0), PITCH_MAX_DEG) : 0;
}

/**
 * Committed plan/3D blend target derived from pitch — the collapse point that
 * makes pitch the SINGLE camera axis. φ = 0 commits to the orthographic plan
 * (editing unlocked); any pitch above the 0.5° snap commits to 3D (view-only).
 * FusedCamera derives its spring target from the LIVE pitch each frame with
 * this same rule; callers apply it once on gesture end for DOM subscribers.
 */
export function blendTargetForPitch(pitchDeg: number): 0 | 1 {
  return clampPitchDeg(pitchDeg) > 0.5 ? 1 : 0;
}

/** Facade-normal azimuth step (multiples of 90° — the N/E/S/W elevation looks). */
export const FACADE_NORMAL_STEP_DEG = 90;

/** How close pitch must be to 90° to count as the elevation snap (deg). */
export const ELEVATION_SNAP_PITCH_DEG = 1.5;

/** How close azimuth must be to a facade normal to snap (deg). */
export const ELEVATION_SNAP_AZIMUTH_DEG = 2;

/**
 * Nearest facade-normal azimuth if within tolerance, else null. Facade
 * normals are multiples of 90° — the cardinal elevation looks (N/E/S/W).
 */
export function facadeNormalAzimuthDeg(
  rotateDeg: number,
  tolDeg: number = ELEVATION_SNAP_AZIMUTH_DEG,
): number | null {
  if (!Number.isFinite(rotateDeg)) return null;
  const w = ((rotateDeg % 360) + 360) % 360;
  const nearest =
    Math.round(w / FACADE_NORMAL_STEP_DEG) * FACADE_NORMAL_STEP_DEG;
  const delta = Math.min(Math.abs(w - nearest), 360 - Math.abs(w - nearest));
  return delta <= tolDeg ? nearest % 360 : null;
}

/**
 * The exact elevation state — φ = 90° with azimuth snapped to a facade
 * normal. Only this exact orthographic snap unlocks editing at the horizon;
 * any oblique near-90° pitch stays view-only (CAD convention).
 */
export function isElevationRig(rig: StudioCameraRig): boolean {
  return (
    Math.abs(clampPitchDeg(rig.tiltDeg) - PITCH_MAX_DEG) <=
      ELEVATION_SNAP_PITCH_DEG &&
    facadeNormalAzimuthDeg(rig.rotateDeg) != null
  );
}

/**
 * Settle an orbit gesture release: snap to the EXACT elevation state when
 * within tolerance; otherwise leave the dragged values untouched.
 */
export function settleOrbitRig(rig: StudioCameraRig): StudioCameraRig {
  const snapped = facadeNormalAzimuthDeg(rig.rotateDeg);
  if (
    Math.abs(clampPitchDeg(rig.tiltDeg) - PITCH_MAX_DEG) <=
      ELEVATION_SNAP_PITCH_DEG &&
    snapped != null
  ) {
    return { ...rig, tiltDeg: PITCH_MAX_DEG, rotateDeg: snapped };
  }
  return rig;
}

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
