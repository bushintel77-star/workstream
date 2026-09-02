import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  FRUSTUM_VERTEX_COUNT,
  HUD_HEIGHT_PX,
  HUD_WIDTH_PX,
  MAIN_CAMERA_FOV_DEG,
  PLANE_OUTLINE_VERTEX_COUNT,
  frustumCorners,
  hudFraming,
  hudPlaneExtentM,
  mainCameraUp,
  planeOutlineCorners,
  sketchPlaneExtentM,
  writeFrustumSegments,
  writePlaneOutlineSegments,
} from "./birdsEyeFrustum";
import { foldQuaternion } from "./canvasPlacement";

/** An overhead plan pose — the degenerate case for any world-up frustum
 *  basis, and the studio's own default camera. */
const PLAN_POSE = {
  position: [0, 100, 0],
  target: [0, 0, 0],
};

const OPTS = {
  fovDeg: MAIN_CAMERA_FOV_DEG,
  aspect: 16 / 9,
  depthM: 40,
};

describe("frustumCorners", () => {
  it("puts the apex exactly at the camera position", () => {
    const { apex } = frustumCorners(
      { position: [3, 12, -7], target: [0, 0, 0] },
      OPTS,
    );
    expect(apex.x).toBeCloseTo(3);
    expect(apex.y).toBeCloseTo(12);
    expect(apex.z).toBeCloseTo(-7);
  });

  it("centres the far rectangle on the view axis at depthM", () => {
    const { apex, corners } = frustumCorners(PLAN_POSE, OPTS);
    const centre = corners
      .reduce((acc, c) => acc.add(c), new THREE.Vector3())
      .multiplyScalar(0.25);
    // Looking straight down from y=100, the rectangle's centre sits
    // depthM metres along the view axis.
    expect(centre.x).toBeCloseTo(0, 5);
    expect(centre.z).toBeCloseTo(0, 5);
    expect(centre.y).toBeCloseTo(apex.y - OPTS.depthM, 5);
  });

  it("survives the overhead plan pose (world up is degenerate there)", () => {
    const { corners } = frustumCorners(PLAN_POSE, OPTS);
    for (const corner of corners) {
      expect(Number.isFinite(corner.x)).toBe(true);
      expect(Number.isFinite(corner.y)).toBe(true);
      expect(Number.isFinite(corner.z)).toBe(true);
    }
  });

  it("sizes the rectangle by fov and aspect", () => {
    const { corners } = frustumCorners(PLAN_POSE, OPTS);
    // Overhead with -Z up: width runs along X, height along Z.
    const width = Math.abs(corners[1]!.x - corners[0]!.x);
    const height = Math.abs(corners[0]!.z - corners[3]!.z);
    const expectedHeight =
      2 * Math.tan(THREE.MathUtils.degToRad(OPTS.fovDeg) / 2) * OPTS.depthM;
    expect(height).toBeCloseTo(expectedHeight, 4);
    expect(width / height).toBeCloseTo(OPTS.aspect, 4);
  });

  it("keeps opposite corners symmetric about the view axis", () => {
    const { corners } = frustumCorners(
      { position: [10, 20, 30], target: [1, 2, 3] },
      OPTS,
    );
    const centre = corners
      .reduce((acc, c) => acc.add(c), new THREE.Vector3())
      .multiplyScalar(0.25);
    // Diagonally opposite corners must mirror through the centre.
    const a = corners[0]!.clone().sub(centre);
    const c = corners[2]!.clone().sub(centre);
    expect(a.clone().add(c).length()).toBeCloseTo(0, 4);
  });

  it("scales linearly with depth", () => {
    const near = frustumCorners(PLAN_POSE, { ...OPTS, depthM: 10 });
    const far = frustumCorners(PLAN_POSE, { ...OPTS, depthM: 20 });
    const nearWidth = Math.abs(near.corners[1]!.x - near.corners[0]!.x);
    const farWidth = Math.abs(far.corners[1]!.x - far.corners[0]!.x);
    expect(farWidth).toBeCloseTo(nearWidth * 2, 4);
  });

  it("does not emit NaN for a camera sitting on its own target", () => {
    // The store's zero-initialised _liveCameraPosition, read before
    // FusedCamera's first frame.
    const { corners } = frustumCorners(
      { position: [0, 0, 0], target: [0, 0, 0] },
      OPTS,
    );
    for (const corner of corners) {
      expect(Number.isNaN(corner.x)).toBe(false);
      expect(Number.isNaN(corner.y)).toBe(false);
      expect(Number.isNaN(corner.z)).toBe(false);
    }
  });

  it("ignores a supplied up that is parallel to the view axis", () => {
    // mainCameraUp() returns exactly (0,-1,0)-parallel garbage nowhere, but
    // an eased blend can hand us an up very close to the view axis.
    const { corners } = frustumCorners(PLAN_POSE, { ...OPTS, up: [0, 1, 0] });
    for (const corner of corners) {
      expect(Number.isFinite(corner.x)).toBe(true);
    }
  });

  it("rolls the rectangle with a supplied up", () => {
    const plain = frustumCorners(
      { position: [0, 30, 30], target: [0, 0, 0] },
      OPTS,
    );
    const rolled = frustumCorners(
      { position: [0, 30, 30], target: [0, 0, 0] },
      { ...OPTS, up: mainCameraUp(90, Math.PI / 4) },
    );
    expect(plain.corners[0]!.distanceTo(rolled.corners[0]!)).toBeGreaterThan(1);
  });
});

describe("writeFrustumSegments", () => {
  it("fills exactly FRUSTUM_VERTEX_COUNT vertices", () => {
    const out = new Float32Array(FRUSTUM_VERTEX_COUNT * 3);
    writeFrustumSegments(PLAN_POSE, OPTS, out);
    expect(out.every((v) => Number.isFinite(v))).toBe(true);
  });

  it("starts every one of the first four segments at the apex", () => {
    const out = new Float32Array(FRUSTUM_VERTEX_COUNT * 3);
    writeFrustumSegments(PLAN_POSE, OPTS, out);
    for (let i = 0; i < 4; i += 1) {
      expect(out[i * 6 + 0]).toBeCloseTo(PLAN_POSE.position[0]!, 4);
      expect(out[i * 6 + 1]).toBeCloseTo(PLAN_POSE.position[1]!, 4);
      expect(out[i * 6 + 2]).toBeCloseTo(PLAN_POSE.position[2]!, 4);
    }
  });

  it("closes the far rectangle (last segment ends where the first began)", () => {
    const out = new Float32Array(FRUSTUM_VERTEX_COUNT * 3);
    writeFrustumSegments(PLAN_POSE, OPTS, out);
    // Segment 4 starts at corner 0; segment 7 ends at corner 0.
    expect(out[7 * 6 + 3]).toBeCloseTo(out[4 * 6 + 0]!, 4);
    expect(out[7 * 6 + 4]).toBeCloseTo(out[4 * 6 + 1]!, 4);
    expect(out[7 * 6 + 5]).toBeCloseTo(out[4 * 6 + 2]!, 4);
  });

  it("reuses the caller's array (no allocation per frame)", () => {
    const out = new Float32Array(FRUSTUM_VERTEX_COUNT * 3);
    expect(writeFrustumSegments(PLAN_POSE, OPTS, out)).toBe(out);
  });
});

describe("planeOutlineCorners", () => {
  const extentM = 100;
  const half = extentM / 2;

  it("lays a flat plane out horizontally at its own height", () => {
    const corners = planeOutlineCorners([0, 1.2, 0], [0, 0, 0, 1], extentM);
    for (const corner of corners) {
      expect(corner.y).toBeCloseTo(1.2, 6);
    }
  });

  it("spans the extent it is given", () => {
    const corners = planeOutlineCorners([0, 0, 0], [0, 0, 0, 1], extentM);
    // Adjacent corners are one edge apart; the square is planeSize across.
    expect(corners[0]!.distanceTo(corners[1]!)).toBeCloseTo(half * 2, 6);
  });

  it("stands a fully folded plane vertical", () => {
    const q = foldQuaternion(90, 0);
    const corners = planeOutlineCorners(
      [0, 0, 0],
      [q.x, q.y, q.z, q.w],
      extentM,
    );
    // A 90-degree fold puts the square in a vertical plane: its corners
    // must span the full height rather than sitting at constant Y.
    const ys = corners.map((c) => c.y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(half * 2, 4);
  });

  it("keeps a mid-fold plane between flat and standing", () => {
    const q = foldQuaternion(45, 0);
    const corners = planeOutlineCorners(
      [0, 0, 0],
      [q.x, q.y, q.z, q.w],
      extentM,
    );
    const ys = corners.map((c) => c.y);
    const span = Math.max(...ys) - Math.min(...ys);
    expect(span).toBeGreaterThan(0);
    expect(span).toBeLessThan(half * 2);
  });

  it("turns the standing plane with its bearing", () => {
    const north = foldQuaternion(90, 0);
    const east = foldQuaternion(90, 90);
    const a = planeOutlineCorners([0, 0, 0], [north.x, north.y, north.z, north.w], extentM);
    const b = planeOutlineCorners([0, 0, 0], [east.x, east.y, east.z, east.w], extentM);
    expect(a[0]!.distanceTo(b[0]!)).toBeGreaterThan(1);
  });

  it("translates with the plane's position", () => {
    const at = planeOutlineCorners([5, 2, -3], [0, 0, 0, 1], extentM);
    const origin = planeOutlineCorners([0, 0, 0], [0, 0, 0, 1], extentM);
    expect(at[0]!.x - origin[0]!.x).toBeCloseTo(5, 6);
    expect(at[0]!.y - origin[0]!.y).toBeCloseTo(2, 6);
    expect(at[0]!.z - origin[0]!.z).toBeCloseTo(-3, 6);
  });
});

describe("writePlaneOutlineSegments", () => {
  it("fills a closed loop of four edges", () => {
    const out = new Float32Array(PLANE_OUTLINE_VERTEX_COUNT * 3);
    writePlaneOutlineSegments([0, 0, 0], [0, 0, 0, 1], 20, out);
    expect(out.every((v) => Number.isFinite(v))).toBe(true);
    // The final vertex closes back onto the first.
    expect(out[21]).toBeCloseTo(out[0]!, 5);
    expect(out[22]).toBeCloseTo(out[1]!, 5);
    expect(out[23]).toBeCloseTo(out[2]!, 5);
  });
});

describe("plane extents", () => {
  it("reports the main scene's own five-lot-width raycast mesh", () => {
    expect(sketchPlaneExtentM(20)).toBeCloseTo(100, 6);
  });

  it("clamps the HUD's depiction to the lot's long side", () => {
    // The real mesh would cross the whole mini-viewport at any fold angle.
    expect(hudPlaneExtentM(20, 1)).toBeCloseTo(20, 6);
    expect(hudPlaneExtentM(20, 2)).toBeCloseTo(40, 6);
  });

  it("never draws the plane larger than it really is", () => {
    for (const boardAspect of [0.5, 1, 2, 9]) {
      expect(hudPlaneExtentM(20, boardAspect)).toBeLessThanOrEqual(
        sketchPlaneExtentM(20),
      );
    }
  });
});

describe("hudFraming", () => {
  it("fits a square lot inside the panel on both axes", () => {
    const { zoom } = hudFraming(30, 1);
    expect(30 * zoom).toBeLessThanOrEqual(HUD_WIDTH_PX);
    expect(30 * zoom).toBeLessThanOrEqual(HUD_HEIGHT_PX);
  });

  it("fits a deep lot by its tighter axis", () => {
    const scaleM = 30;
    const boardAspect = 2.5;
    const { zoom } = hudFraming(scaleM, boardAspect);
    expect(scaleM * zoom).toBeLessThanOrEqual(HUD_WIDTH_PX);
    expect(scaleM * boardAspect * zoom).toBeLessThanOrEqual(HUD_HEIGHT_PX);
  });

  it("fits a wide lot by its tighter axis", () => {
    const scaleM = 80;
    const boardAspect = 0.4;
    const { zoom } = hudFraming(scaleM, boardAspect);
    expect(scaleM * zoom).toBeLessThanOrEqual(HUD_WIDTH_PX);
    expect(scaleM * boardAspect * zoom).toBeLessThanOrEqual(HUD_HEIGHT_PX);
  });

  it("puts the camera above the lot with the far plane beyond it", () => {
    const { cameraHeightM, farM } = hudFraming(30, 1);
    expect(cameraHeightM).toBeGreaterThan(30);
    expect(farM).toBeGreaterThan(cameraHeightM);
  });

  it("stays finite for a degenerate (zero-scale) board", () => {
    const { zoom, cameraHeightM } = hudFraming(0, 0);
    expect(Number.isFinite(zoom)).toBe(true);
    expect(zoom).toBeGreaterThan(0);
    expect(Number.isFinite(cameraHeightM)).toBe(true);
  });
});

describe("mainCameraUp", () => {
  it("returns the plan view's -Z screen-up at zero tilt and rotation", () => {
    const [x, y, z] = mainCameraUp(0, 0);
    expect(x).toBeCloseTo(0, 6);
    expect(y).toBeCloseTo(0, 6);
    expect(z).toBeCloseTo(-1, 6);
  });

  it("approaches world up as the tilt reaches the horizon", () => {
    const [, y] = mainCameraUp(0, Math.PI / 2);
    expect(y).toBeCloseTo(1, 6);
  });

  it("stays a unit vector at every tilt and rotation", () => {
    for (const rotateDeg of [0, 37, 90, 180, 270]) {
      for (const tilt of [0, Math.PI / 6, Math.PI / 3, Math.PI / 2]) {
        const up = new THREE.Vector3(...mainCameraUp(rotateDeg, tilt));
        expect(up.length()).toBeCloseTo(1, 6);
      }
    }
  });
});
