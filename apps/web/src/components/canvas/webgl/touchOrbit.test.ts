import { describe, expect, it } from "vitest";
import { DEFAULT_CAMERA_RIG } from "./cameraRig";
import {
  beginTouchOrbit,
  isTwoFingerDoubleTap,
  isTwoFingerGesture,
  touchAngleDeg,
  touchDistance,
  touchOrbitMove,
} from "./touchOrbit";
import { ORBIT_TILT_SENSITIVITY } from "./cameraRigGesture";

describe("touchOrbit primitives", () => {
  it("computes Euclidean distance and atan2 angle", () => {
    expect(touchDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(touchAngleDeg({ x: 0, y: 0 }, { x: 10, y: 0 })).toBe(0);
    expect(touchAngleDeg({ x: 0, y: 0 }, { x: 0, y: 10 })).toBeCloseTo(90, 6);
  });

  it("treats two or more pointers as a camera gesture", () => {
    expect(isTwoFingerGesture(1)).toBe(false);
    expect(isTwoFingerGesture(2)).toBe(true);
    expect(isTwoFingerGesture(3)).toBe(true);
  });
});

describe("touchOrbitMove", () => {
  const rig = { ...DEFAULT_CAMERA_RIG, zoom: 2, tiltDeg: 30, rotateDeg: 90 };

  it("pinch zooms by the distance ratio", () => {
    const st = beginTouchOrbit(rig, { x: 0, y: 0 }, { x: 100, y: 0 });
    const out = touchOrbitMove(st, rig, { x: 0, y: 0 }, { x: 200, y: 0 });
    expect(out.nextRig.zoom).toBeCloseTo(4, 6); // 2 × (200/100)
  });

  it("twist rotates azimuth by the angle delta and wraps", () => {
    const st = beginTouchOrbit(rig, { x: 0, y: 0 }, { x: 0, y: 100 }); // angle 90
    const out = touchOrbitMove(st, rig, { x: 0, y: 0 }, { x: 100, y: 0 }); // angle 0
    expect(out.nextRig.rotateDeg).toBeCloseTo(0, 6); // 90 + (0 − 90)
  });

  it("vertical midpoint drag drives pitch (down = steeper)", () => {
    const st = beginTouchOrbit(rig, { x: 0, y: 100 }, { x: 100, y: 100 });
    const out = touchOrbitMove(st, rig, { x: 0, y: 200 }, { x: 100, y: 200 });
    expect(out.nextRig.tiltDeg).toBeCloseTo(
      30 + 100 * ORBIT_TILT_SENSITIVITY,
      6,
    );
  });

  it("clamps pitch into the 0…90° orbit", () => {
    const st = beginTouchOrbit(rig, { x: 0, y: 100 }, { x: 100, y: 100 });
    const up = touchOrbitMove(st, rig, { x: 0, y: -1000 }, { x: 100, y: -1000 });
    expect(up.nextRig.tiltDeg).toBe(0);
    const down = touchOrbitMove(st, rig, { x: 0, y: 1000 }, { x: 100, y: 1000 });
    expect(down.nextRig.tiltDeg).toBe(90);
  });

  it("ignores a degenerate pinch span", () => {
    const st = beginTouchOrbit(rig, { x: 0, y: 0 }, { x: 4, y: 0 }); // startDist 4 (<8)
    const out = touchOrbitMove(st, rig, { x: 0, y: 0 }, { x: 400, y: 0 });
    expect(out.nextRig.zoom).toBe(2); // unchanged
  });
});

describe("isTwoFingerDoubleTap (return to plan)", () => {
  it("fires when a second two-finger tap lands within the window", () => {
    expect(isTwoFingerDoubleTap(1000, 1300)).toBe(true); // 300ms
    expect(isTwoFingerDoubleTap(1000, 1301)).toBe(false); // 301ms
  });

  it("does not fire without a prior two-finger tap", () => {
    expect(isTwoFingerDoubleTap(null, 1300)).toBe(false);
  });
});
