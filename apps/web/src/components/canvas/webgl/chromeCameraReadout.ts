/**
 * Phase L.3 — 3D camera readout for the coordinate chip conversion.
 *
 * When the chrome contract says crosshairCoords converts in 3D, the E/N/Z chip
 * becomes eye height / bearing / fov. This derives those values from the live
 * camera rig (reactive store state), matching the FusedCamera position math
 * (cameraAnimation.ts computePosition) so the chip never disagrees with the
 * rendered view.
 *
 * Binding: docs/MENTAL-CANVAS-ROADMAP.md Phase L.3.
 */

import { cameraDistanceFor } from "./cameraAnimation";
import { blendTargetForPitch, type StudioCameraRig } from "./cameraRig";

/** The perspective FOV is constant at 30° (cameraAnimation.ts line 217). */
export const PERSP_FOV_DEG = 30;

/** VIEW_PADDING matches FusedCamera.tsx line 73. */
const VIEW_PADDING = 1.3;

export interface CameraReadout {
  /** Eye height in metres (camera Y). */
  eyeHeightM: number;
  /** Bearing in degrees (camera azimuth, 0–360). */
  bearingDeg: number;
  /** Perspective FOV in degrees (constant 30). */
  fovDeg: number;
}

/**
 * Derive the 3D camera readout from the rig state. Matches FusedCamera's
 * computePosition: height = distance * cos(tiltRad * blend), where blend is
 * eased but at rest in 3D mode blend=1 so effectiveTilt = tiltRad.
 */
export function cameraReadoutFor3D(
  rig: StudioCameraRig,
  scaleM: number,
  boardAspect: number,
  northBearingDeg: number | null,
): CameraReadout {
  const viewSize = Math.max(scaleM, scaleM * boardAspect) * VIEW_PADDING;
  const distance = cameraDistanceFor(viewSize, boardAspect, rig.zoom);
  const blend = blendTargetForPitch(rig.tiltDeg);
  // At rest in 3D, blend=1 and effectiveTilt = tiltRad. During transition the
  // eased blend differs, but the chip reads the committed rig (reactive),
  // not the per-frame spring — so it shows the target, not the in-flight arc.
  const tiltRad = (rig.tiltDeg * Math.PI) / 180;
  const effectiveTilt = tiltRad * blend;
  const eyeHeightM = distance * Math.cos(effectiveTilt);

  // Bearing: the rig's rotateDeg is the camera azimuth. Adjust for north if
  // calibrated. 0° = north, clockwise.
  let bearing = rig.rotateDeg % 360;
  if (bearing < 0) bearing += 360;
  if (northBearingDeg != null && Number.isFinite(northBearingDeg)) {
    bearing = (bearing + northBearingDeg) % 360;
    if (bearing < 0) bearing += 360;
  }

  return {
    eyeHeightM,
    bearingDeg: bearing,
    fovDeg: PERSP_FOV_DEG,
  };
}

/** Format the 3D readout as a single chip string: "H 12.4m · BRG 045° · FOV 30°". */
export function formatCameraReadout(readout: CameraReadout): string {
  const h = readout.eyeHeightM.toFixed(1);
  const brg = Math.round(readout.bearingDeg).toString().padStart(3, "0");
  const fov = Math.round(readout.fovDeg);
  return `H ${h}m \u00b7 BRG ${brg}\u00b0 \u00b7 FOV ${fov}\u00b0`;
}
