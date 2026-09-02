/**
 * Spatial Sketching — Bird's-Eye HUD geometry (Mental Canvas roadmap,
 * Phase A3).
 *
 * Pure math for the secondary mini-viewport shown while a sketch plane is
 * being placed (Parallel Projection height drag, A1; Hinge Projection fold
 * drag, A2). The HUD renders in its OWN @react-three/fiber <Canvas> — it
 * cannot reach into the main canvas's scene graph or read its camera
 * object, so everything it draws has to be rebuilt from the numbers the
 * store publishes: the main camera's live pose (_liveCameraPosition,
 * written every frame by FusedCamera) and the plane's own position +
 * rotation.
 *
 * All of it lives here rather than in BirdsEyeHud.tsx because no test in
 * apps/web mounts an R3F <Canvas> in jsdom — maths inside the component
 * would be untestable by construction. Same split canvasPlacement.ts
 * carries for A1/A2's fold quaternions.
 *
 * The write* functions fill a caller-supplied Float32Array instead of
 * returning fresh geometry: the HUD rewrites both wireframes every frame
 * of a drag, and FusedCameraScratch already sets the zero-allocation
 * discipline for this app's hot loops.
 */

import * as THREE from "three";

/** The main canvas camera's field of view — WebGLStudio.tsx's <Canvas
 *  camera={{ fov: 30 }}>. The HUD draws that camera's frustum, so it must
 *  agree with it. */
export const MAIN_CAMERA_FOV_DEG = 30;

export interface CameraPose {
  /** World-space camera position [x, y, z]. */
  position: readonly number[];
  /** World-space look-at target [x, y, z]. */
  target: readonly number[];
}

export interface FrustumOptions {
  fovDeg: number;
  /** Main viewport aspect (width / height). */
  aspect: number;
  /** How far down the view axis to draw the far rectangle, in metres.
   *  Purely presentational — the real far plane (500 m) would draw a
   *  wedge far larger than the lot. */
  depthM: number;
  /**
   * Screen-up direction of the main camera. Optional: when omitted the up
   * is derived from the view direction, falling back to world -Z (the plan
   * view's screen-up) where the view axis is parallel to world up — which
   * is exactly the overhead plan case, and exactly what FusedCamera itself
   * uses there. Pass mainCameraUp() for an exact match at tilt.
   */
  up?: readonly number[];
}

/** 4 apex-to-corner rays + the 4 far-rectangle edges, 2 vertices each. */
export const FRUSTUM_VERTEX_COUNT = 16;

/** 4 edges of the plane's square outline, 2 vertices each. */
export const PLANE_OUTLINE_VERTEX_COUNT = 8;

/**
 * The main camera's up vector, mirroring FusedCamera's arc-tangent up (the
 * fixed (0,1,0) up is degenerate at the plan view, so the rig uses one that
 * stays non-degenerate through the overhead pass). Duplicated rather than
 * read because the HUD's canvas has no access to the main camera object;
 * if that formula ever changes, this is the other place to change.
 *
 * @param rotateDeg  rig.rotateDeg — plan rotation, 0 = north up.
 * @param effTiltRad the EASED tilt in radians (pitchRadians(rig.tiltDeg)
 *                   scaled by easeInOutCubic(viewBlend)), matching what
 *                   FusedCamera applies for the current blend.
 */
export function mainCameraUp(
  rotateDeg: number,
  effTiltRad: number,
): [number, number, number] {
  const rotateRad = THREE.MathUtils.degToRad(rotateDeg);
  return [
    -Math.cos(effTiltRad) * Math.sin(rotateRad),
    Math.sin(effTiltRad),
    -Math.cos(effTiltRad) * Math.cos(rotateRad),
  ];
}

function resolveUp(forward: THREE.Vector3, up?: readonly number[]): THREE.Vector3 {
  if (up) {
    const given = new THREE.Vector3(up[0] ?? 0, up[1] ?? 1, up[2] ?? 0);
    // A caller-supplied up parallel to the view axis is as degenerate as
    // the default one — fall through to the derived up rather than
    // emitting NaN corners.
    if (
      given.lengthSq() > 1e-8 &&
      Math.abs(given.clone().normalize().dot(forward)) < 0.999
    ) {
      return given.normalize();
    }
  }
  const worldUp = new THREE.Vector3(0, 1, 0);
  if (Math.abs(worldUp.dot(forward)) > 0.999) {
    // Looking straight down (or up): world up gives no screen-up at all.
    // -Z is north, which is what the plan view puts at the top of screen.
    return new THREE.Vector3(0, 0, -1);
  }
  return worldUp;
}

/**
 * The camera's apex and the four corners of its frustum at depthM along the
 * view axis, in world space. Corner order runs around the rectangle: top
 * left, top right, bottom right, bottom left, as seen from the apex.
 */
export function frustumCorners(
  pose: CameraPose,
  opts: FrustumOptions,
): { apex: THREE.Vector3; corners: THREE.Vector3[] } {
  const apex = new THREE.Vector3(
    pose.position[0] ?? 0,
    pose.position[1] ?? 0,
    pose.position[2] ?? 0,
  );
  const target = new THREE.Vector3(
    pose.target[0] ?? 0,
    pose.target[1] ?? 0,
    pose.target[2] ?? 0,
  );

  const forward = target.clone().sub(apex);
  if (forward.lengthSq() < 1e-8) {
    // Degenerate pose (camera sitting on its own target — the store's
    // zero-initialised value, before FusedCamera's first frame). Point it
    // straight down rather than emitting NaN corners.
    forward.set(0, -1, 0);
  }
  forward.normalize();

  const up = resolveUp(forward, opts.up);
  const right = forward.clone().cross(up).normalize();
  // Re-orthogonalise: the supplied up need not be perpendicular to the view
  // axis (FusedCamera's arc-tangent up is not, mid-blend).
  const screenUp = right.clone().cross(forward).normalize();

  const halfHeight =
    Math.tan(THREE.MathUtils.degToRad(opts.fovDeg) / 2) * opts.depthM;
  const halfWidth = halfHeight * opts.aspect;

  const centre = apex.clone().addScaledVector(forward, opts.depthM);
  const dx = right.clone().multiplyScalar(halfWidth);
  const dy = screenUp.clone().multiplyScalar(halfHeight);

  return {
    apex,
    corners: [
      centre.clone().sub(dx).add(dy),
      centre.clone().add(dx).add(dy),
      centre.clone().add(dx).sub(dy),
      centre.clone().sub(dx).sub(dy),
    ],
  };
}

function writeSegment(
  out: Float32Array,
  index: number,
  a: THREE.Vector3,
  b: THREE.Vector3,
) {
  out[index * 6 + 0] = a.x;
  out[index * 6 + 1] = a.y;
  out[index * 6 + 2] = a.z;
  out[index * 6 + 3] = b.x;
  out[index * 6 + 4] = b.y;
  out[index * 6 + 5] = b.z;
}

/**
 * Fill `out` (FRUSTUM_VERTEX_COUNT * 3 floats) with the frustum wireframe
 * as line segments: four apex-to-corner rays, then the far rectangle.
 */
export function writeFrustumSegments(
  pose: CameraPose,
  opts: FrustumOptions,
  out: Float32Array,
): Float32Array {
  const { apex, corners } = frustumCorners(pose, opts);
  for (let i = 0; i < 4; i += 1) {
    writeSegment(out, i, apex, corners[i]!);
    writeSegment(out, 4 + i, corners[i]!, corners[(i + 1) % 4]!);
  }
  return out;
}

/**
 * The sketch plane's real extent in the main scene — SketchCanvasGroup.tsx's
 * `planeSize`, the square raycast mesh a stroke can be drawn anywhere on.
 * Deliberately generous (five lot widths), which is why the HUD draws
 * something smaller: see hudPlaneExtentM.
 */
export function sketchPlaneExtentM(scaleM: number): number {
  return scaleM * 5;
}

/**
 * The extent the HUD draws the plane at.
 *
 * Not the real one: at five lot widths the outline crosses the whole
 * mini-viewport whatever the fold angle, burying the site silhouette it is
 * supposed to be read against. Clamped to the lot's long side, the frame
 * says what the HUD exists to say — where the plane sits and which way it
 * faces — at a size that reads against the boundary.
 */
export function hudPlaneExtentM(scaleM: number, boardAspect: number): number {
  return Math.min(
    sketchPlaneExtentM(scaleM),
    Math.max(scaleM, scaleM * boardAspect),
  );
}

/**
 * The four world-space corners of a square plane of `extentM` across, at a
 * canvas's position + rotation.
 *
 * The local frame must stay in lockstep with SketchCanvasGroup.tsx's
 * CanvasPlane: its mesh is rotated -PI/2 about local X (so an
 * identity-quaternion plane lies flat in the local XZ plane) inside a group
 * carrying the canvas's position + rotation. That rotation maps a
 * plane-geometry corner (x, y, 0) to (x, 0, -y), which is where the
 * half-extents below come from. If the two ever disagree, the HUD draws the
 * plane facing somewhere the main canvas does not.
 */
export function planeOutlineCorners(
  position: readonly number[],
  rotation: readonly number[],
  extentM: number,
): THREE.Vector3[] {
  const half = extentM / 2;
  const quaternion = new THREE.Quaternion(
    rotation[0] ?? 0,
    rotation[1] ?? 0,
    rotation[2] ?? 0,
    rotation[3] ?? 1,
  );
  const origin = new THREE.Vector3(
    position[0] ?? 0,
    position[1] ?? 0,
    position[2] ?? 0,
  );
  const local: [number, number][] = [
    [-half, -half],
    [half, -half],
    [half, half],
    [-half, half],
  ];
  return local.map((corner) =>
    new THREE.Vector3(corner[0], 0, corner[1])
      .applyQuaternion(quaternion)
      .add(origin),
  );
}

/**
 * Fill `out` (PLANE_OUTLINE_VERTEX_COUNT * 3 floats) with the plane's
 * outline as a closed loop of line segments.
 */
export function writePlaneOutlineSegments(
  position: readonly number[],
  rotation: readonly number[],
  extentM: number,
  out: Float32Array,
): Float32Array {
  const corners = planeOutlineCorners(position, rotation, extentM);
  for (let i = 0; i < 4; i += 1) {
    writeSegment(out, i, corners[i]!, corners[(i + 1) % 4]!);
  }
  return out;
}

/** The HUD panel's viewport, in CSS pixels. Mirrored in
 *  BirdsEyeHud.module.css — the framing zoom below is derived from it, so
 *  the two must agree. */
export const HUD_WIDTH_PX = 208;
export const HUD_HEIGHT_PX = 156;

/** Breathing room around the lot in the mini-viewport, so the frustum wedge
 *  stays readable when the main camera looks off-site. */
const HUD_FIT_PADDING = 1.6;

export interface HudFraming {
  /** Orthographic zoom — R3F's ortho default camera reads this as pixels
   *  per world unit at the canvas's pixel size. */
  zoom: number;
  /** How far above the lot the HUD camera sits. */
  cameraHeightM: number;
  /** Far plane — everything the HUD draws sits well inside this. */
  farM: number;
}

/**
 * The fixed overhead framing for the mini-viewport: north up, lot centred,
 * fitted to whichever axis is tighter so the whole site stays visible
 * regardless of the board's aspect.
 */
export function hudFraming(scaleM: number, boardAspect: number): HudFraming {
  const lotWidthM = Math.max(scaleM, 1e-3);
  const lotDepthM = Math.max(scaleM * boardAspect, 1e-3);
  const zoom = Math.min(
    HUD_WIDTH_PX / (lotWidthM * HUD_FIT_PADDING),
    HUD_HEIGHT_PX / (lotDepthM * HUD_FIT_PADDING),
  );
  const cameraHeightM = Math.max(lotWidthM, lotDepthM) * 2;
  return { zoom, cameraHeightM, farM: cameraHeightM * 4 };
}

/** The HUD camera's up: world -Z, so north is up on the mini-viewport — the
 *  same screen-up the main plan view uses. */
export const HUD_CAMERA_UP: readonly [number, number, number] = [0, 0, -1];
