/**
 * Gold Standard 2026 — photo-trace elevation math (pure, THREE-free).
 *
 * The photo-trace capstone pins a site photo as a frozen camera frame: the
 * photo stands as a vertical plane in the scene's metre-space and the camera
 * flies to an orthographic facade look at that plane. One reference line
 * drawn against a known real length calibrates the plane — after that every
 * trace on the plane is in true metres.
 *
 * Conventions (matching FusedCamera's orbit):
 *   - azimuth θ in degrees, 0 = camera looks along -Z (north look),
 *     +90 = camera looks along -X (east look).
 *   - plane-local space: u along the plane's horizontal axis (right as seen
 *     from the camera, metres from the plane centre), v up from the ground
 *     line (metres).
 *   - world space: y up; the lot is centred on the origin; the plane foot
 *     sits at (centre_x_m, ground_offset_m, centre_z_m).
 */

import type {
  PhotoElevation,
  PhotoTraceStroke,
  SitePhoto,
} from "@workstream/contracts";
import type { StudioCameraRig } from "./cameraRig";
import { pctToWorld, type PctPoint } from "./coordTransform";

export type Vec3 = { x: number; y: number; z: number };

/** The resolved geometry of a pinned photo plane. */
export interface PhotoPlane {
  /** Horizontal span in world metres (calibrated plane width). */
  widthM: number;
  /** Vertical span in world metres (width / natural aspect). */
  heightM: number;
  /** Azimuth the plane faces (deg). */
  azimuthDeg: number;
  /** Plane foot centre (world metres). */
  centreXM: number;
  centreZM: number;
  /** Vertical lift of the ground line off world y=0 (metres). */
  groundOffsetM: number;
}

/** A point in plane-local space (u = horizontal metres, v = metres above ground). */
export interface PlanePoint {
  u: number;
  v: number;
}

/** Provisional width (metres) for an uncalibrated plane — rescales on calibration. */
export const PROVISIONAL_PLANE_WIDTH_M = 12;

/** A resolved snap of a photo plane onto a title-boundary edge. */
export interface BoundarySnap {
  centreXM: number;
  centreZM: number;
  azimuthDeg: number;
  edgeIndex: number;
}

/**
 * Snap a photo plane onto the title boundary — the platform's single source
 * of truth for site geometry (gap-check rule: anything physically sited on
 * the property must reconcile with the title polygon, or be stamped
 * locational-indicative).
 *
 * Edge choice: the edge whose inward normal best matches the current camera
 * look direction (operator intent — rotate the plan to face the fence you
 * photographed, then pin); ties break toward the edge nearest the camera
 * target. The plane's foot lands ON that edge, centred at the projection of
 * the camera target onto the edge (clamped to the segment), and the plane's
 * azimuth follows the edge's real bearing — lots are rarely exactly
 * cardinal, and the fence follows the title line, not the compass.
 *
 * Returns null when the boundary ring is degenerate (< 3 points) — callers
 * keep the default centre and stamp the record locational-indicative.
 */
export function snapPhotoPlaneToBoundary(params: {
  boundaryPct: PctPoint[];
  scaleM: number;
  boardAspect: number;
  cameraAzimuthDeg: number;
  cameraTargetXM: number;
  cameraTargetZM: number;
}): BoundarySnap | null {
  const {
    boundaryPct,
    scaleM,
    boardAspect,
    cameraAzimuthDeg,
    cameraTargetXM,
    cameraTargetZM,
  } = params;
  if (boundaryPct.length < 3) return null;

  const world = boundaryPct.map((p) => {
    const [x, z] = pctToWorld(p, scaleM, boardAspect);
    return { x, z };
  });
  // Ring centroid — orients each edge's inward normal for ordinary (convex)
  // Melbourne lots. Interior-point tests would be needed for concave lots;
  // the centroid heuristic is the honest, documented simplification.
  const centroid = {
    x: world.reduce((s, p) => s + p.x, 0) / world.length,
    z: world.reduce((s, p) => s + p.z, 0) / world.length,
  };
  const camRad = (cameraAzimuthDeg * Math.PI) / 180;
  // The camera looks along -(sinθ, cosθ); the plane face the camera sees
  // points BACK at it along +(sinθ, cosθ) — match the edge's inward normal
  // against that (the direction from the fence toward the camera).
  const cameraBack = { x: Math.sin(camRad), z: Math.cos(camRad) };

  let best: {
    edgeIndex: number;
    score: number;
    centreXM: number;
    centreZM: number;
    inwardNormal: { x: number; z: number };
  } | null = null;

  for (let i = 0; i < world.length; i++) {
    const a = world[i]!;
    const b = world[(i + 1) % world.length]!;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    if (len < 1e-9) continue;

    // Perpendiculars (±z, ∓x); pick the one pointing toward the centroid.
    const perpA = { x: dz / len, z: -dx / len };
    const perpB = { x: -dz / len, z: dx / len };
    const towardCentre =
      perpA.x * (centroid.x - a.x) + perpA.z * (centroid.z - a.z);
    const inwardNormal = towardCentre >= 0 ? perpA : perpB;

    // Angular match between the camera look and the edge's inward normal —
    // the operator's current look decides which fence they are pinning.
    const dot = Math.max(
      -1,
      Math.min(
        1,
        cameraBack.x * inwardNormal.x + cameraBack.z * inwardNormal.z,
      ),
    );
    const angularPenalty = 1 - dot;

    // Foot centre: the camera target projected onto the edge, clamped to
    // the segment (the operator sees the middle of the fence).
    const t =
      ((cameraTargetXM - a.x) * dx + (cameraTargetZM - a.z) * dz) /
      (len * len);
    const clamped = Math.min(1, Math.max(0, t));
    const centreXM = a.x + clamped * dx;
    const centreZM = a.z + clamped * dz;

    // Primary: intent (angle). Secondary: distance to the edge line.
    const perpDistance = Math.abs(
      dx * (a.z - cameraTargetZM) - dz * (a.x - cameraTargetXM),
    ) / len;
    const score = angularPenalty * 1e6 + perpDistance;

    if (!best || score < best.score) {
      best = { edgeIndex: i, score, centreXM, centreZM, inwardNormal };
    }
  }

  if (!best) return null;

  // Plane azimuth from the edge's inward normal — the exact title-line
  // bearing, not a rounded cardinal (planeAxes: normal = (-sinθ, cosθ)).
  const azimuthDeg =
    ((Math.atan2(-best.inwardNormal.x, best.inwardNormal.z) * 180) / Math.PI +
      360) %
    360;

  return {
    centreXM: best.centreXM,
    centreZM: best.centreZM,
    azimuthDeg,
    edgeIndex: best.edgeIndex,
  };
}

/**
 * Create a fresh (uncalibrated) photo elevation record from a gallery photo,
 * pinned to a facade look azimuth. Uncalibrated records are honest: the sheet
 * and traces carry an "indicative" stamp until a reference line lands.
 *
 * Placement reconciles with the title boundary when a snap is supplied
 * (gap-check rule: sited geometry must reconcile with the title polygon, or
 * be stamped locational-indicative) — `boundarySnap` records which edge the
 * plane stands on; absent means the position is not boundary-verified.
 */
export function newPhotoElevation(
  photo: Pick<SitePhoto, "id" | "name" | "uri" | "natural_aspect">,
  azimuthDeg: number,
  opts?: {
    centreXM?: number;
    centreZM?: number;
    boundarySnap?: { edge_index: number; snapped_at: string } | null;
  },
): PhotoElevation {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    photo_id: photo.id,
    name: photo.name,
    uri: photo.uri,
    natural_aspect: photo.natural_aspect,
    azimuth_deg: ((azimuthDeg % 360) + 360) % 360,
    calibration: null,
    centre_x_m: opts?.centreXM ?? 0,
    centre_z_m: opts?.centreZM ?? 0,
    ground_offset_m: 0,
    boundary_snap: opts?.boundarySnap ?? null,
    strokes: [],
    created_at: now,
    updated_at: now,
  };
}

/** Calibration preset chips — Melbourne garden features with known lengths. */
export const CALIBRATION_PRESETS: Array<{ label: string; metres: number }> = [
  { label: "1.8 m fence line", metres: 1.8 },
  { label: "2.1 m door height", metres: 2.1 },
  { label: "0.9 m fence pail", metres: 0.9 },
  { label: "2.4 m ceiling", metres: 2.4 },
];

/** Fraction of the view height the pinned plane should occupy at the pin rig. */
const PIN_FRAME_FRACTION = 0.55;

/**
 * The plane's horizontal axis (camera-right) and outward normal (toward the
 * camera) in world XZ. Derived from FusedCamera's orbit: the camera at
 * elevation θ sits on the +normal side and looks along -normal.
 */
export function planeAxes(azimuthDeg: number): {
  right: { x: number; z: number };
  normal: { x: number; z: number };
} {
  const rad = (azimuthDeg * Math.PI) / 180;
  return {
    right: { x: Math.cos(rad), z: Math.sin(rad) },
    normal: { x: -Math.sin(rad), z: Math.cos(rad) },
  };
}

/** Resolve the plane geometry from a persisted elevation record. */
export function photoPlaneFromElevation(
  elev: Pick<PhotoElevation, "natural_aspect" | "azimuth_deg" | "centre_x_m" | "centre_z_m" | "ground_offset_m"> & {
    calibration: { plane_width_m: number } | null;
  },
): PhotoPlane {
  const widthM = elev.calibration?.plane_width_m ?? PROVISIONAL_PLANE_WIDTH_M;
  return {
    widthM,
    heightM: widthM / elev.natural_aspect,
    azimuthDeg: elev.azimuth_deg,
    centreXM: elev.centre_x_m,
    centreZM: elev.centre_z_m,
    groundOffsetM: elev.ground_offset_m,
  };
}

/** Plane foot (bottom-centre of the plane, on the ground line) in world space. */
export function planeFoot(plane: PhotoPlane): Vec3 {
  return { x: plane.centreXM, y: plane.groundOffsetM, z: plane.centreZM };
}

/** Convert a plane-local point to world space. */
export function planeToWorld(plane: PhotoPlane, p: PlanePoint): Vec3 {
  const axes = planeAxes(plane.azimuthDeg);
  const foot = planeFoot(plane);
  return {
    x: foot.x + p.u * axes.right.x,
    y: foot.y + p.v,
    z: foot.z + p.u * axes.right.z,
  };
}

/** Convert a world point to plane-local space (projection onto the plane). */
export function worldToPlane(plane: PhotoPlane, p: Vec3): PlanePoint {
  const axes = planeAxes(plane.azimuthDeg);
  const foot = planeFoot(plane);
  const dx = p.x - foot.x;
  const dz = p.z - foot.z;
  return {
    u: dx * axes.right.x + dz * axes.right.z,
    v: p.y - foot.y,
  };
}

/**
 * Intersect a ray with the plane. Returns the plane-space hit and the world
 * point, or null when the ray is parallel, points away, or misses the plane's
 * rectangle.
 */
export function rayPlaneHit(
  plane: PhotoPlane,
  origin: Vec3,
  dir: Vec3,
): { point: Vec3; plane: PlanePoint } | null {
  const { normal } = planeAxes(plane.azimuthDeg);
  const foot = planeFoot(plane);
  const denom = dir.x * normal.x + dir.z * normal.z;
  if (Math.abs(denom) < 1e-9) return null;
  const offset =
    (foot.x - origin.x) * normal.x + (foot.z - origin.z) * normal.z;
  const t = offset / denom;
  if (t <= 0 || !Number.isFinite(t)) return null;
  const point = {
    x: origin.x + t * dir.x,
    y: origin.y + t * dir.y,
    z: origin.z + t * dir.z,
  };
  const planePoint = worldToPlane(plane, point);
  const withinBounds =
    planePoint.u >= -plane.widthM / 2 &&
    planePoint.u <= plane.widthM / 2 &&
    planePoint.v >= 0 &&
    planePoint.v <= plane.heightM;
  if (!withinBounds) return null;
  return { point, plane: planePoint };
}

/** The natural aspect is width / height — recompute height from width directly. */
export function planeHeightFromWidth(widthM: number, naturalAspect: number): number {
  return widthM / naturalAspect;
}

/**
 * Reference-line calibration: the operator drew a line of length
 * `drawnLengthM` (plane-space metres at the current plane size) along a
 * feature whose real length is `referenceM`. Scale the plane so the drawn
 * length equals the reference — the single known dimension calibrates the
 * whole frame. Existing strokes rescale by the same factor so their true
 * metre size is preserved.
 */
export function applyReferenceCalibration(params: {
  plane: PhotoPlane;
  drawnA: PlanePoint;
  drawnB: PlanePoint;
  referenceM: number;
  label: string;
}): { plane: PhotoPlane; strokeScale: number } {
  const { plane, drawnA, drawnB, referenceM } = params;
  const drawnLengthM = Math.hypot(drawnB.u - drawnA.u, drawnB.v - drawnA.v);
  if (!Number.isFinite(drawnLengthM) || drawnLengthM <= 0) {
    throw new Error("Draw a reference line along a known length first");
  }
  if (!Number.isFinite(referenceM) || referenceM <= 0) {
    throw new Error("Reference length must be positive");
  }
  const factor = referenceM / drawnLengthM;
  const widthM = plane.widthM * factor;
  const naturalAspect = plane.widthM / plane.heightM;
  return {
    plane: {
      ...plane,
      widthM,
      heightM: planeHeightFromWidth(widthM, naturalAspect),
    },
    strokeScale: factor,
  };
}

/** Rescale plane-space stroke points by a factor (calibration re-scaling). */
export function rescaleStrokes(
  strokes: PhotoTraceStroke[],
  factor: number,
): PhotoTraceStroke[] {
  if (factor === 1) return strokes;
  return strokes.map((s) => ({
    ...s,
    points: s.points.map((p) => ({ x_m: p.x_m * factor, y_m: p.y_m * factor })),
  }));
}

/**
 * The frozen camera rig for a photo pin — φ=90° facade look at the plane's
 * azimuth, camera target on the plane centre, zoom framing the plane height
 * at ~55% of the view. The FusedCamera's existing blend + elevation springs
 * animate the plan→facade crossfade; the fly interpolates rig values.
 */
export function pinRigForPlane(
  plane: PhotoPlane,
  scaleM: number,
  boardAspect: number,
): StudioCameraRig {
  const viewSize = Math.max(scaleM, scaleM * boardAspect) * 1.3;
  const halfWorldH = Math.max(plane.heightM, 1) / 2 / PIN_FRAME_FRACTION;
  const zoom = Math.min(
    8,
    Math.max(0.2, (viewSize * boardAspect) / (2 * halfWorldH)),
  );
  return {
    panX: plane.centreXM,
    panY: plane.centreZM,
    zoom,
    rotateDeg: plane.azimuthDeg,
    tiltDeg: 90,
    focusX: 50,
    focusY: 50,
  };
}

/** Interpolate between two rigs — numeric fields lerp, azimuth takes the short arc. */
export function lerpRig(
  from: StudioCameraRig,
  to: StudioCameraRig,
  t: number,
): StudioCameraRig {
  const k = Math.min(1, Math.max(0, t));
  const lerp = (a: number, b: number) => a + (b - a) * k;
  const fromDeg = ((from.rotateDeg % 360) + 360) % 360;
  const toDeg = ((to.rotateDeg % 360) + 360) % 360;
  let delta = toDeg - fromDeg;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return {
    panX: lerp(from.panX, to.panX),
    panY: lerp(from.panY, to.panY),
    zoom: lerp(from.zoom, to.zoom),
    rotateDeg: (fromDeg + delta * k + 360) % 360,
    tiltDeg: lerp(from.tiltDeg, to.tiltDeg),
    focusX: lerp(from.focusX, to.focusX),
    focusY: lerp(from.focusY, to.focusY),
  };
}
