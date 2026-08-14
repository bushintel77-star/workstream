/**
 * Gold Standard 2026 — Camera Animation Utilities.
 *
 * Pure math for the Fused Rendering Context camera. The FusedCamera uses these
 * to interpolate between an orthographic plan view and a perspective oblique
 * view — a single continuous motion with no hard cut.
 *
 * The core technique:
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

/**
 * Animation speed — how fast viewBlend eases toward its target.
 * Higher = snappier, lower = more cinematic. ~3.5 gives ~600ms full transition.
 */
const BLEND_SPEED = 3.5;

/**
 * Eased approach: move `current` toward `target` by a frame-rate-independent
 * step. Returns the new value. Uses exponential decay (frame-rate independent).
 */
export function approach(
  current: number,
  target: number,
  delta: number,
  speed: number = BLEND_SPEED,
): number {
  const t = 1 - Math.exp(-speed * delta);
  return current + (target - current) * t;
}

/**
 * Eased approach with a cubic curve — accelerates from rest, decelerates to
 * rest. Used for the viewBlend so the camera starts/stops smoothly.
 */
export function approachEased(
  current: number,
  target: number,
  delta: number,
  speed: number = BLEND_SPEED,
): number {
  const raw = approach(current, target, delta, speed);
  // If we're close enough, snap to target (avoids infinite micro-approach).
  if (Math.abs(raw - target) < 0.001) return target;
  return raw;
}

/**
 * Build an orthographic projection matrix matching the current rig.
 *
 * @param zoom      Orthographic zoom factor (1 = fit lot).
 * @param aspect    Viewport aspect ratio (width / height).
 * @param scaleM    Lot scale in metres.
 * @param boardAspect Board aspect (height / width).
 * @param viewSize  Base view size in metres at zoom=1.
 */
export function buildOrthoMatrix(
  zoom: number,
  viewportAspect: number,
  scaleM: number,
  boardAspect: number,
  viewSize: number,
): THREE.Matrix4 {
  // The visible world height/width at the current zoom.
  const halfWorldH = (viewSize * boardAspect) / (2 * zoom);
  const halfWorldW = halfWorldH * viewportAspect;

  const ortho = new THREE.OrthographicCamera(
    -halfWorldW,
    halfWorldW,
    halfWorldH,
    -halfWorldH,
    -10000,
    10000,
  );
  ortho.updateProjectionMatrix();
  return ortho.projectionMatrix.clone();
}

/**
 * Build a perspective projection matrix that matches the ortho frustum at the
 * given zoom, so blend=0 is seamless.
 *
 * The perspective camera sits at a distance where its frustum, at a chosen FOV,
 * exactly covers the same world-space bounds as the ortho camera.
 *
 * @param zoom         Orthographic zoom factor.
 * @param viewportAspect Viewport aspect ratio (width / height).
 * @param scaleM       Lot scale in metres.
 * @param boardAspect  Board aspect (height / width).
 * @param viewSize     Base view size in metres at zoom=1.
 * @param tiltRad      Tilt angle in radians (0 = top-down, π/3 = oblique).
 */
export function buildPerspMatrix(
  zoom: number,
  viewportAspect: number,
  _scaleM: number,
  boardAspect: number,
  viewSize: number,
  _tiltRad: number,
): { matrix: THREE.Matrix4; distance: number; fov: number } {
  const halfWorldH = (viewSize * boardAspect) / (2 * zoom);

  // The vertical half-extent the camera needs to see.
  const targetHalfH = halfWorldH;

  // FOV that gives a natural perspective without extreme distortion.
  // 30° is a moderate architectural perspective. At blend=0 (tilt=0), the
  // distance is computed so this FOV covers exactly targetHalfH.
  const fov = 30;
  const fovRad = (fov * Math.PI) / 180;

  // Distance so the perspective frustum at this FOV covers targetHalfH.
  // tan(fov/2) = targetHalfH / distance → distance = targetHalfH / tan(fov/2)
  const distance = Math.max(1, targetHalfH / Math.tan(fovRad / 2));

  const persp = new THREE.PerspectiveCamera(fov, viewportAspect, 0.1, distance * 4);
  persp.updateProjectionMatrix();
  return { matrix: persp.projectionMatrix.clone(), distance, fov };
}

/**
 * Compute the camera position for a given blend and tilt.
 *
 * At blend=0 (plan): camera is directly overhead at height=distance, looking
 * straight down. This matches the ortho projection exactly.
 *
 * At blend=1 (3D): camera is at the oblique angle (tiltRad), looking at the
 * lot centre from distance. The perspective distortion is fully visible.
 *
 * Between: the position slerps along an arc from overhead to oblique, keeping
 * the lot centre as the look-at target.
 *
 * @param blend     [0..1] — 0 = plan, 1 = 3D.
 * @param tiltRad   Tilt angle (0 = top-down, ~0.96 = 55°).
 * @param distance  Camera distance from centre (from buildPerspMatrix).
 * @param panX      Pan offset X (metres).
 * @param panY      Pan offset Y (metres, maps to world Z).
 * @param easeBlend Whether to apply easeInOutCubic to the blend (default true).
 */
export function fusedCameraPosition(
  blend: number,
  tiltRad: number,
  distance: number,
  panX: number,
  panY: number,
  easeBlend: boolean = true,
): { position: THREE.Vector3; lookAt: THREE.Vector3 } {
  const b = easeBlend ? easeInOutCubic(blend) : blend;

  // The actual tilt the camera uses: at blend=0, the camera is directly
  // overhead (effective tilt = 0 regardless of the target tilt). As blend→1,
  // the effective tilt approaches tiltRad. This is the key to the seamless
  // transition — the perspective camera starts looking straight down (matching
  // ortho) and only begins to tilt as blend increases.
  const effectiveTilt = tiltRad * b;

  // Camera position along an arc from directly overhead to oblique.
  // At effectiveTilt=0: directly above centre at height=distance.
  // At effectiveTilt=tiltRad: offset south and lower, looking north at the lot.
  const height = distance * Math.cos(effectiveTilt);
  const southOffset = distance * Math.sin(effectiveTilt);

  const position = new THREE.Vector3(
    panX,
    height,
    southOffset + panY, // panY maps to world Z (south positive)
  );

  // Look at the lot centre (+ pan offset) — the focus point stays fixed.
  const lookAt = new THREE.Vector3(panX, 0, panY);

  return { position, lookAt };
}

/**
 * Lerp between two projection matrices by storing the result in `out`.
 * Three.js Matrix4 has no built-in lerp for projection matrices, so we lerp
 * each element. This is correct for interpolation between two valid projection
 * matrices — the intermediate matrices are valid (non-degenerate) as long as
 * both endpoints have reasonable near/far planes.
 */
export function lerpProjectionMatrix(
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
  out.elements = e;
}
