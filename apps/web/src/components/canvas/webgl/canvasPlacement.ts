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

/**
 * Inverse of foldQuaternion's angle, given a KNOWN bearing.
 *
 * Hinge Projection (Phase A2) drags a plane's rotation incrementally around
 * its own LOCAL X axis (drei TransformControls, mode="rotate",
 * space="local", only the X ring shown). Because same-axis rotations
 * compose additively (Rx(-a) * Rx(-b) = Rx(-(a+b))), a pure local-X drag
 * starting from `foldQuaternion(angle, bearing)` always stays inside the
 * `Ry(bearing) * Rx(-angle)` family with bearing fixed — so the gizmo
 * captures bearing once at drag-start and this function recovers the
 * live angle on every subsequent tick.
 *
 * Not a general quaternion decomposition — only valid for quaternions of
 * exactly this Ry * Rx form, which is everything this app's canvas planes
 * are ever constructed from.
 */
export function angleFromQuaternionAtBearing(
  q: THREE.Quaternion,
  bearingDeg: number,
): number {
  const bearingInv = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 1, 0),
    -THREE.MathUtils.degToRad(bearingDeg),
  );
  // Ry(-bearing) * Q == Rx(-angle) alone.
  const xOnly = bearingInv.multiply(q);
  const angleRad = -2 * Math.atan2(xOnly.x, xOnly.w);
  return THREE.MathUtils.radToDeg(angleRad);
}

/**
 * Full decomposition of a fold quaternion into (angleDeg, bearingDeg) with
 * NEITHER known upfront — used once, at gizmo mount, to seed the drag
 * (angleFromQuaternionAtBearing then tracks angle for the rest of the
 * drag from that captured bearing, per its own doc comment).
 *
 * angle: the tilt of the plane's normal off vertical is convention-
 * independent — normal.y = cos(angleRad) always (a horizontal tilt axis
 * never touches the Y component), read via THREE's own applyQuaternion
 * rather than a hand-derived formula.
 *
 * bearing: found by comparing this normal's XZ direction against the
 * REFERENCE bearing-0 normal at the same angle (computed via
 * foldQuaternion itself, so this stays correct even if that function's
 * internal axis convention ever changes) — the angular offset between the
 * two, around Y, is the bearing. Meaningless at angle 0 (defaults to 0,
 * matching "a flat plane has no facing").
 */
export function decomposeFoldQuaternion(
  q: THREE.Quaternion,
): { angleDeg: number; bearingDeg: number } {
  const up = new THREE.Vector3(0, 1, 0);
  const normal = up.clone().applyQuaternion(q);
  const angleRad = Math.acos(THREE.MathUtils.clamp(normal.y, -1, 1));
  const angleDeg = THREE.MathUtils.radToDeg(angleRad);

  if (angleDeg < 1e-3) return { angleDeg: 0, bearingDeg: 0 };

  const reference = up.clone().applyQuaternion(foldQuaternion(angleDeg, 0));
  const bearingRad =
    Math.atan2(normal.x, normal.z) - Math.atan2(reference.x, reference.z);
  const bearingDeg =
    ((THREE.MathUtils.radToDeg(bearingRad) % 360) + 360) % 360;
  return { angleDeg, bearingDeg };
}

export interface SnapGlyph {
  angleDeg: number;
  /** Sides of the polygon glyph the handle morphs into at this snap —
   *  octagon 45° / hexagon 60° / pentagon 72° / square 90°, per §14b. */
  sides: 8 | 6 | 5 | 4;
}

export const HINGE_SNAP_ANGLES: readonly SnapGlyph[] = [
  { angleDeg: 45, sides: 8 },
  { angleDeg: 60, sides: 6 },
  { angleDeg: 72, sides: 5 },
  { angleDeg: 90, sides: 4 },
];

const SNAP_EPSILON_DEG = 3;

/** The snap glyph the current fold angle is within range of, or null when
 *  mid-fold and not near any named angle. */
export function nearestSnap(angleDeg: number): SnapGlyph | null {
  let best: SnapGlyph | null = null;
  let bestDelta = Infinity;
  for (const snap of HINGE_SNAP_ANGLES) {
    const delta = Math.abs(angleDeg - snap.angleDeg);
    if (delta < SNAP_EPSILON_DEG && delta < bestDelta) {
      best = snap;
      bestDelta = delta;
    }
  }
  return best;
}

/** Clamp a live-dragged fold angle to the valid 0°–90° range (a plane
 *  can't fold past standing or back past flat). */
export function clampFoldAngle(angleDeg: number): number {
  return Math.min(90, Math.max(0, angleDeg));
}
