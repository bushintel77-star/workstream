/**
 * Gold Standard 2026 — Camera Animation Utilities.
 *
 * Pure math for the Fused Rendering Context camera. The FusedCamera uses these
 * to interpolate between an orthographic plan view and a perspective oblique
 * view — a single continuous motion with no hard cut.
 *
 * SPRING PHYSICS (Cinematic & Polish Pass):
 *   The view blend is driven by a critically-damped mass-spring-damper, NOT
 *   exponential decay. This gives the camera physical weight:
 *     - 100% interruptible: if the user toggles back mid-transition, the
 *       spring's current velocity is preserved and redirected toward the new
 *       target. No reset, no jump, no snap.
 *     - Critically damped (ζ=1): fastest settle without overshoot — the
 *       "buttery" feel. A slightly under-damped spring (ζ≈0.92) gives a hint
 *       of settle bounce for organic weight.
 *     - Frame-rate independent: the integration uses semi-implicit Euler with
 *       sub-stepping for stability at large delta values.
 *
 * The core rendering technique:
 *   1. Maintain two projection matrices (ortho + persp), recomputed per frame.
 *   2. Lerp the camera's .projectionMatrix between them by `blend` [0..1].
 *   3. Slerp the camera position along an arc from overhead to oblique.
 *
 * The trick to avoiding a visual pop at blend=0: the perspective camera's FOV
 * and distance are chosen so its frustum EXACTLY matches the ortho frustum at
 * the current zoom. At blend=0 the two projections agree pixel-for-pixel, so
 * the transition starts invisibly.
 */

import * as THREE from "three";
import { easeInOutCubic } from "./studioStore";

/* -------------------------------------------------------------------------- */
/* Spring physics — critically-damped mass-spring-damper                      */
/* -------------------------------------------------------------------------- */

/**
 * Spring state — persists across frames inside a ref. The velocity is what
 * makes the spring interruptible: when the target changes mid-flight, the
 * existing velocity carries into the new trajectory naturally.
 */
export interface SpringState {
  position: number;
  velocity: number;
}

/**
 * Spring config — tuned for "buttery" camera motion.
 *
 * - stiffness (k): how strongly the spring pulls toward the target. Higher =
 *   snappier. ~170 gives a ~500ms settle for a full 0→1 blend.
 * - damping (c): resistive force proportional to velocity. At critical damping
 *   (c = 2√k), the spring settles as fast as possible without overshoot.
 *   We use a hair under critical (c ≈ 0.92 × 2√k) for a faint organic settle.
 * - mass: the "weight" of the camera. 1.0 is standard; higher mass makes the
 *   camera feel heavier (slower acceleration, longer glide).
 */
export interface SpringConfig {
  stiffness: number;
  damping: number;
  mass: number;
}

/** The tuned camera spring — ~500ms settle, faint organic weight. */
export const CAMERA_SPRING: SpringConfig = (() => {
  const stiffness = 170;
  const mass = 1;
  // Critical damping = 2 * sqrt(k * m). We use 0.92× for a hint of settle.
  const critical = 2 * Math.sqrt(stiffness * mass);
  return { stiffness, damping: critical * 0.92, mass };
})();

/**
 * Integrate one spring step using semi-implicit (symplectic) Euler.
 *
 * Force = -k(x - target) - c·v   (Hooke + damper)
 * acceleration = Force / mass
 * v_new = v + a · dt
 * x_new = x + v_new · dt
 *
 * Semi-implicit Euler is stable for stiff springs and conserves energy better
 * than explicit Euler. For very large frame deltas (e.g., tab-switch stutter),
 * we sub-step to avoid instability.
 *
 * @param state    Current spring state {position, velocity} — mutated in place.
 * @param target   The target position.
 * @param config   Spring constants.
 * @param delta    Frame delta in seconds.
 * @returns        The new position (state is also updated).
 */
export function springStep(
  state: SpringState,
  target: number,
  config: SpringConfig,
  delta: number,
): number {
  const { stiffness, damping, mass } = config;

  // Poison-delta guard: a negative, NaN, or infinite frame delta (system
  // clock adjustment, tab restore, headless timing hiccups) sends the
  // semi-implicit integrator runaway — in the field the blend spring
  // exploded to 1e41 and parked the camera at a garbage pitch, silently
  // killing every canvas raycast (the drawing stopped responding). A
  // non-positive delta is a no-op; large positive deltas are already
  // handled by the sub-stepping below.
  if (!Number.isFinite(delta) || delta <= 0) return state.position;
  if (!Number.isFinite(state.position) || !Number.isFinite(state.velocity)) {
    state.position = target;
    state.velocity = 0;
    return state.position;
  }

  // Sub-stepping: if delta is too large, the integration can blow up.
  // Max stable step ≈ 2 / ω where ω = sqrt(k/m). We use a safety factor.
  const omega = Math.sqrt(stiffness / mass);
  const maxStep = (2 / omega) * 0.5;
  const steps = Math.max(1, Math.ceil(delta / maxStep));
  const dt = delta / steps;

  for (let i = 0; i < steps; i++) {
    const displacement = state.position - target;
    const force = -stiffness * displacement - damping * state.velocity;
    const acceleration = force / mass;
    state.velocity += acceleration * dt;
    state.position += state.velocity * dt;
  }

  // Snap to target when effectively at rest (prevents infinite micro-oscillation).
  const atRest =
    Math.abs(state.position - target) < 0.0005 &&
    Math.abs(state.velocity) < 0.0005;
  if (atRest) {
    state.position = target;
    state.velocity = 0;
  }

  return state.position;
}

/* -------------------------------------------------------------------------- */
/* Projection matrix builders — zero-allocation per-frame variants             */
/* -------------------------------------------------------------------------- */

/**
 * Pre-allocated scratch context for the per-frame matrix operations.
 * Creating this ONCE per FusedCamera instance eliminates all per-frame GC
 * (no `new OrthographicCamera`, `new PerspectiveCamera`, or `new Vector3`
 * in the hot loop). On tablet hardware this is the difference between 60fps
 * and 30fps during rapid view toggling.
 */
export class FusedCameraScratch {
  readonly ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, -10000, 10000);
  readonly persp = new THREE.PerspectiveCamera(30, 1, 0.1, 10000);
  readonly tempPos = new THREE.Vector3();
  readonly tempLook = new THREE.Vector3();

  /**
   * Update the ortho camera's frustum and write its projection matrix into
   * `out`. Zero allocations.
   */
  updateOrtho(
    out: THREE.Matrix4,
    zoom: number,
    viewportAspect: number,
    boardAspect: number,
    viewSize: number,
  ): void {
    const halfWorldH = (viewSize * boardAspect) / (2 * zoom);
    const halfWorldW = halfWorldH * viewportAspect;
    this.ortho.left = -halfWorldW;
    this.ortho.right = halfWorldW;
    this.ortho.top = halfWorldH;
    this.ortho.bottom = -halfWorldH;
    this.ortho.near = -10000;
    this.ortho.far = 10000;
    this.ortho.updateProjectionMatrix();
    out.copy(this.ortho.projectionMatrix);
  }

  /**
   * Update the perspective camera's frustum and write its projection matrix
   * into `out`. Returns the computed distance (needed for camera positioning).
   * Zero allocations.
   */
  updatePersp(
    out: THREE.Matrix4,
    zoom: number,
    viewportAspect: number,
    boardAspect: number,
    viewSize: number,
  ): number {
    const halfWorldH = (viewSize * boardAspect) / (2 * zoom);
    const fov = 30;
    const fovRad = (fov * Math.PI) / 180;
    const distance = Math.max(1, halfWorldH / Math.tan(fovRad / 2));

    this.persp.fov = fov;
    this.persp.aspect = viewportAspect;
    this.persp.near = 0.1;
    this.persp.far = distance * 4;
    this.persp.updateProjectionMatrix();
    out.copy(this.persp.projectionMatrix);
    return distance;
  }

  /**
   * Compute the camera position + look-at for a given blend and tilt, writing
   * into the pre-allocated temp vectors. Zero allocations.
   *
   * @param outPos    Written with the camera position.
   * @param outLook   Written with the look-at target.
   * @param blend     [0..1] — 0 = plan, 1 = 3D.
   * @param tiltRad   Max tilt angle (0 = top-down, ~0.96 = 55°).
   * @param distance  Camera distance from centre.
   * @param panX      Pan offset X (metres).
   * @param panY      Pan offset Y (metres, maps to world Z).
   */
  computePosition(
    outPos: THREE.Vector3,
    outLook: THREE.Vector3,
    blend: number,
    tiltRad: number,
    distance: number,
    panX: number,
    panY: number,
  ): void {
    const b = easeInOutCubic(blend);
    const effectiveTilt = tiltRad * b;

    const height = distance * Math.cos(effectiveTilt);
    const southOffset = distance * Math.sin(effectiveTilt);

    outPos.set(panX, height, southOffset + panY);
    outLook.set(panX, 0, panY);
  }

  /**
   * Lerp two projection matrices in-place by writing directly to `out.elements`.
   * No intermediate arrays allocated.
   */
  lerpProjection(
    out: THREE.Matrix4,
    from: THREE.Matrix4,
    to: THREE.Matrix4,
    t: number,
  ): void {
    const a = from.elements;
    const b = to.elements;
    const e = out.elements;
    for (let i = 0; i < 16; i++) {
      e[i] = a[i]! + (b[i]! - a[i]!) * t;
    }
  }
}
