/**
 * Spatial Sketching — Canvas Placement (Mental Canvas roadmap, Phase A1).
 *
 * Pure math for placing a SketchCanvas plane: the five spec presets
 * (docs/MENTAL-CANVAS-ROADMAP.md, ArchitecturalLandscapeUI design handoff
 * §14b) and the fold quaternion shared by Parallel Projection (height-only,
 * angle stays 0) and Hinge Projection (angle sweeps 0°→90°).
 *
 * A plane's pose is fully described by three numbers:
 *   - angleDeg  — 0 = lying flat on the ground, 90 = standing vertical.
 *     Intermediate values are a genuine mid-fold (Hinge Projection, A2).
 *   - bearingDeg — compass heading the plane faces once standing. Meaningless
 *     at angle 0 (a flat plane has no facing) but still stored so a partial
 *     fold doesn't lose the operator's chosen direction.
 *   - heightM — for a flat plane, its Z-stack height (Parallel Projection,
 *     A1). For a standing plane, the height of its base/hinge line above
 *     the ground.
 *
 * Rotation convention: identity quaternion = flat, normal facing +Y (up),
 * matching every other flat SketchCanvas already in the store (see
 * FloatingChrome.tsx's retired createCanvas helper — rotation: [0,0,0,1]).
 * Folding tilts the plane's normal from +Y toward the horizontal, rotating
 * around a horizontal axis derived from the bearing (the hinge line itself),
 * then bearing further orients which way "up the wall" points.
 */

import * as THREE from "three";

export type PlaneOrientation = "flat" | "standing";

export interface CanvasPreset {
  id: string;
  /** Short label shown on the flyout's preset button. */
  label: string;
  orientation: PlaneOrientation;
  /** Height (m) for a flat preset; base height (m) for a standing one. */
  heightM: number;
  /** Bearing (deg) for a standing preset. Ignored for flat presets. */
  bearingDeg?: number;
}

/** The five presets from design-handoff §14b: "ground 0.00, upper terrace
 *  +1.20, canopy +4.50, boundary wall, hedge line." Boundary wall and hedge
 *  line are standing presets — a wall/hedge is a vertical plane, not a
 *  height in the Z-stack — defaulted to north-facing (0°); the flyout lets
 *  the operator pick a different bearing before or after placing. */
export const CANVAS_PRESETS: readonly CanvasPreset[] = [
  { id: "ground", label: "Ground", orientation: "flat", heightM: 0 },
  { id: "terrace", label: "Upper terrace", orientation: "flat", heightM: 1.2 },
  { id: "canopy", label: "Canopy", orientation: "flat", heightM: 4.5 },
  { id: "boundary-wall", label: "Boundary wall", orientation: "standing", heightM: 0, bearingDeg: 0 },
  { id: "hedge-line", label: "Hedge line", orientation: "standing", heightM: 0, bearingDeg: 0 },
];

/**
 * The fold quaternion for a plane at a given angle/bearing.
 *
 * angleDeg 0 → identity (flat, normal +Y).
 * angleDeg 90 → the plane stands vertical, its normal rotated to face the
 * bearing direction (0° = world +Z / north, matching this studio's other
 * bearing conventions — see northBearingDeg usage elsewhere in webgl/).
 *
 * Implementation: tilt around the horizontal axis perpendicular to the
 * bearing (so the fold "hinges" along the bearing line itself, exactly like
 * folding a page up along a crease), then the tilt axis is itself rotated by
 * the bearing so the fold direction matches. Composing as
 * bearingRotation * tiltRotation keeps the hinge LINE fixed under the
 * bearing's own rotation, which is what "fold along a chosen wall line"
 * means physically.
 */
export function foldQuaternion(angleDeg: number, bearingDeg = 0): THREE.Quaternion {
  const angleRad = THREE.MathUtils.degToRad(angleDeg);
  const bearingRad = THREE.MathUtils.degToRad(bearingDeg);

  // Tilt around world +X (the hinge line when bearing = 0, i.e. the fold
  // line runs east-west and the plane rises facing north as angle → 90).
  const tilt = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(1, 0, 0),
    -angleRad,
  );
  // Rotate the whole fold (hinge line + rising direction) around world +Y
  // by the bearing, so the operator's chosen wall direction is honoured.
  const bearing = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 1, 0),
    bearingRad,
  );
  return bearing.multiply(tilt);
}

export interface PlanePose {
  position: [number, number, number];
  rotation: [number, number, number, number];
}

/** Compute a full SketchCanvas pose from orientation + numeric input. */
export function computePlanePose(
  orientation: PlaneOrientation,
  value: number,
  bearingDeg = 0,
): PlanePose {
  const angleDeg = orientation === "standing" ? 90 : 0;
  const q = foldQuaternion(angleDeg, bearingDeg);
  return {
    position: [0, value, 0],
    rotation: [q.x, q.y, q.z, q.w],
  };
}

/** Preset → full pose, ready for `addSketchCanvas`. */
export function poseForPreset(preset: CanvasPreset): PlanePose {
  return computePlanePose(preset.orientation, preset.heightM, preset.bearingDeg ?? 0);
}
