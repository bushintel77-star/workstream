/**
 * Photo Camera Calibrator — pinhole solve for plane-to-ground unwarping.
 *
 * P2 photogrammetric engine (docs/agent-prompts/... P2 directive §1). Given
 * ground reference points on a site photo (image px → known ground-plane
 * distances, e.g. points along the title boundary edge the photo faces) plus
 * one vertical landmark of known height (a fence post, doorway), solves the
 * pinhole camera: focal length (px), pitch (deg, positive = looking down),
 * camera height above the ground plane (m), and the horizon row (px).
 *
 * Model (camera at height h, pitched down φ, focal f, principal row cy):
 *
 *   A ground point at depth d projects to row
 *     y = cy + f·tan(atan(h/d) − φ)
 *   which re-parameterises with the horizon row y0 = cy − f·tanφ and
 *   c = h·tanφ, K = f·h·(1 + tan²φ) as the projective form
 *     y − y0 = K / (d + c)
 *
 * Solver (deterministic, no iteration drift):
 *   1. y0 (horizon) in closed form from THREE ground refs via the
 *      cross-ratio constraint c₁₂(y0) = c₂₃(y0).
 *   2. c, K from refs 1–2 at the solved y0.
 *   3. h (camera height) from the vertical landmark by a bounded bisection —
 *      the landmark base fixes its own depth d_b = K/(y_b − y0) − c, and the
 *      landmark top must satisfy the same projective model at height H.
 *   4. φ = atan(c/h), f = K / (h·(1 + tan²φ)).
 *
 * Edge cases are returned as `{ ok: false, reason }` — never thrown:
 *   - fewer than 3 ground refs, or refs with (near-)equal distances (the
 *     cross-ratio denominator → 0 — the horizon singularity);
 *   - a ground ref at/above the horizon (y ≤ y0 makes tan(θ) ≤ 0);
 *   - a landmark with non-positive height, or whose top crosses the horizon.
 *
 * The principal point defaults to the image centre; the returned calibration
 * carries the camera's world pose (origin + yaw) so raycastGround can place
 * the unwarped geometry on the board.
 */

export interface GroundReferencePoint {
  /** Image column (px, 0 = left). */
  xPx: number;
  /** Image row (px, 0 = top). */
  yPx: number;
  /** Ground-plane depth from the camera along the facing direction (m). */
  distanceM: number;
}

export interface VerticalLandmark {
  /** Where the landmark meets the ground (image px). */
  baseXPx: number;
  baseYPx: number;
  /** Top of the landmark (image px). */
  topXPx: number;
  topYPx: number;
  /** Known real height of the landmark (m) — the scale anchor. */
  heightM: number;
}

export interface CameraPose {
  /** World origin of the camera frame (m, board space). */
  originXm: number;
  originZm: number;
  /** Yaw (deg, 0 = identity: ground +x → world +x, ground +z → world +z). */
  yawDeg: number;
}

export interface PhotoCalibration {
  focalPx: number;
  /** Camera pitch, positive = looking down (deg). */
  pitchDeg: number;
  /** Camera height above the ground plane (m). */
  cameraHeightM: number;
  /** Image row of the horizon (px, 0 = top). */
  horizonYPx: number;
  principalXPx: number;
  principalYPx: number;
  /** Camera-frame world pose for raycastGround. */
  pose: CameraPose;
}

export type CalibrationResult =
  | { ok: true; calibration: PhotoCalibration }
  | { ok: false; reason: string };

export interface PhotoCalibrationInput {
  imageWidthPx: number;
  imageHeightPx: number;
  /** ≥ 3 ground reference points with distinct depths (sorted internally). */
  groundRefs: GroundReferencePoint[];
  /** One vertical landmark of known height — the scale anchor. */
  landmark: VerticalLandmark;
  /** Camera-frame world pose (default: identity at the origin). */
  pose?: CameraPose;
}

const DEG = 180 / Math.PI;

/**
 * Horizon row from three ground refs via the cross-ratio constraint
 * c₁₂(y0) = c₂₃(y0). Closed form; null on the singularity (near-equal
 * depths or rows making the denominator vanish).
 */
export function solveHorizonFromGroundRefs(
  refs: [GroundReferencePoint, GroundReferencePoint, GroundReferencePoint],
): number | null {
  const [r1, r2, r3] = refs;
  const y1 = r1.yPx;
  const y2 = r2.yPx;
  const y3 = r3.yPx;
  const d1 = r1.distanceM;
  const d2 = r2.distanceM;
  const d3 = r3.distanceM;
  // Denominator: A(d3−d2) − (d2−d1) with A = (y1−y2)/(y2−y3).
  const denom = (y1 - y2) / (y2 - y3) * (d3 - d2) - (d2 - d1);
  if (!Number.isFinite(denom) || Math.abs(denom) < 1e-9) return null;
  const y0 =
    (((y1 - y2) / (y2 - y3)) * (y3 * d3 - y2 * d2) - (y2 * d2 - y1 * d1)) /
    denom;
  if (!Number.isFinite(y0)) return null;
  return y0;
}

/** c and K from two refs at a given horizon row: (y−y0)(d+c) = K. */
function cAndK(
  a: GroundReferencePoint,
  b: GroundReferencePoint,
  y0: number,
): { c: number; K: number } | null {
  if (Math.abs(a.yPx - b.yPx) < 1e-9) return null;
  const c = ((b.yPx - y0) * b.distanceM - (a.yPx - y0) * a.distanceM) / (a.yPx - b.yPx);
  const K = (a.yPx - y0) * (a.distanceM + c);
  if (!Number.isFinite(c) || !Number.isFinite(K)) return null;
  return { c, K };
}

/**
 * Camera height from the vertical landmark. The landmark base sits at depth
 * d_b = K/(y_b − y0) − c; its top must satisfy the projective model at
 * height H. Expanding the top equation clears the denominators into a
 * POLE-FREE cubic in h:
 *
 *   (B(d_b+c) − K)·h³ + (K·H − B·c·H)·h² + (B·c²(d_b+c) + K·c·d_b)·h
 *     − B·c³·H = 0,   B = y_t − cy
 *
 * which bisection can solve reliably (no ray-direction poles). Null when no
 * root fits the physical range — the landmark is inconsistent with the
 * solved ground model.
 */
function cameraHeightFromLandmark(
  y0: number,
  c: number,
  K: number,
  landmark: VerticalLandmark,
  cy: number,
): number | null {
  const yb = landmark.baseYPx;
  const yt = landmark.topYPx;
  const H = landmark.heightM;
  const db = K / (yb - y0) - c;
  if (!Number.isFinite(db) || db <= 0) return null;

  const B = yt - cy;
  const A3 = B * (db + c) - K;
  const A2 = K * H - B * c * H;
  const A1 = B * c * c * (db + c) + K * c * db;
  const A0 = -B * c * c * c * H;
  const residual = (h: number): number =>
    A3 * h * h * h + A2 * h * h + A1 * h + A0;

  let lo = 0.05;
  const hi0 = 20;
  let rLo = residual(lo);
  const rHi = residual(hi0);
  if (!Number.isFinite(rLo) || !Number.isFinite(rHi)) return null;
  if (rLo * rHi > 0) return null; // no sign change — landmark inconsistent
  let hi = hi0;

  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const rMid = residual(mid);
    if (!Number.isFinite(rMid)) return null;
    if (Math.abs(rMid) < 1e-9) return mid;
    if (rLo * rMid < 0) {
      hi = mid;
    } else {
      lo = mid;
      rLo = rMid;
    }
  }
  const h = (lo + hi) / 2;
  return Number.isFinite(h) && h > 0 ? h : null;
}

/**
 * Solve the pinhole calibration. Deterministic; every failure is a
 * `{ ok: false, reason }` result with a human-readable edge case.
 */
export function calibratePhotoCamera(
  input: PhotoCalibrationInput,
): CalibrationResult {
  const { imageWidthPx, imageHeightPx, groundRefs, landmark, pose } = input;

  if (groundRefs.length < 3) {
    return { ok: false, reason: "Need at least 3 ground reference points" };
  }
  if (!Number.isFinite(landmark.heightM) || landmark.heightM <= 0) {
    return { ok: false, reason: "Landmark height must be positive" };
  }

  // Sort by depth so the cross-ratio pairing is canonical.
  const refs = [...groundRefs].sort((a, b) => a.distanceM - b.distanceM);
  const triple: [GroundReferencePoint, GroundReferencePoint, GroundReferencePoint] = [
    refs[0]!,
    refs[1]!,
    refs[2]!,
  ];
  if (Math.abs(refs[0]!.distanceM - refs[1]!.distanceM) < 1e-6) {
    return {
      ok: false,
      reason: "Horizon singularity: ground refs have (near-)equal depths",
    };
  }

  const y0 = solveHorizonFromGroundRefs(triple);
  if (y0 === null) {
    return {
      ok: false,
      reason: "Horizon singularity: degenerate ground-ref geometry",
    };
  }
  // Every ground ref must sit BELOW the horizon.
  if (refs.some((r) => r.yPx <= y0)) {
    return {
      ok: false,
      reason: "A ground reference sits at or above the solved horizon",
    };
  }

  const ck = cAndK(triple[0]!, triple[1]!, y0);
  if (ck === null) {
    return { ok: false, reason: "Horizon singularity: refs share a row" };
  }
  const { c, K } = ck;

  const cy = imageHeightPx / 2;
  const cx = imageWidthPx / 2;

  const h = cameraHeightFromLandmark(y0, c, K, landmark, cy);
  if (h === null) {
    return {
      ok: false,
      reason: "Landmark does not fit the solved ground model (crosses the horizon?)",
    };
  }

  const tanPhi = c / h;
  const focalPx = K / (h * (1 + tanPhi * tanPhi));
  const pitchDeg = Math.atan(tanPhi) * DEG;

  return {
    ok: true,
    calibration: {
      focalPx,
      pitchDeg,
      cameraHeightM: h,
      horizonYPx: y0,
      principalXPx: cx,
      principalYPx: cy,
      pose: pose ?? { originXm: 0, originZm: 0, yawDeg: 0 },
    },
  };
}
