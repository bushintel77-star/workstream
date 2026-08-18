import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  pitchRadians,
  clampPitchDeg,
  blendTargetForPitch,
  facadeNormalAzimuthDeg,
  isElevationRig,
  settleOrbitRig,
  DEFAULT_CAMERA_RIG,
} from "./cameraRig";
import { FusedCameraScratch } from "./cameraAnimation";

/* -------------------------------------------------------------------------- */
/* Full-orbit pitch — the single continuous camera axis (0° plan → 90° horizon) */
/* -------------------------------------------------------------------------- */

describe("pitchRadians", () => {
  it("maps plan (0°) and horizon (90°) exactly", () => {
    expect(pitchRadians(0)).toBe(0);
    expect(pitchRadians(90)).toBeCloseTo(Math.PI / 2, 10);
  });

  it("clamps out-of-range pitch into the 0…90° orbit", () => {
    expect(pitchRadians(-20)).toBe(0);
    expect(pitchRadians(140)).toBeCloseTo(Math.PI / 2, 10);
    expect(pitchRadians(Number.NaN)).toBe(0);
  });

  it("keeps rising past the old 55° cap (no dead stop)", () => {
    const fiftyFive = pitchRadians(55);
    const seventySix = pitchRadians(76);
    const eighty = pitchRadians(80);
    expect(seventySix).toBeGreaterThan(fiftyFive);
    expect(eighty).toBeGreaterThan(seventySix);
  });

  it("default rig starts at a mid-orbit oblique angle", () => {
    expect(DEFAULT_CAMERA_RIG.tiltDeg).toBe(55);
    expect(pitchRadians(DEFAULT_CAMERA_RIG.tiltDeg)).toBeGreaterThan(0);
    expect(pitchRadians(DEFAULT_CAMERA_RIG.tiltDeg)).toBeLessThan(Math.PI / 2);
  });
});

describe("clampPitchDeg / blendTargetForPitch (single pitch axis)", () => {
  it("clamps pitch into the 0…90° orbit", () => {
    expect(clampPitchDeg(-5)).toBe(0);
    expect(clampPitchDeg(45)).toBe(45);
    expect(clampPitchDeg(90)).toBe(90);
    expect(clampPitchDeg(120)).toBe(90);
    expect(clampPitchDeg(Number.NaN)).toBe(0);
  });

  it("commits plan (0) at flat pitch and 3D (1) above the 0.5° snap", () => {
    expect(blendTargetForPitch(0)).toBe(0);
    expect(blendTargetForPitch(0.4)).toBe(0);
    expect(blendTargetForPitch(0.6)).toBe(1);
    expect(blendTargetForPitch(76)).toBe(1);
    expect(blendTargetForPitch(90)).toBe(1);
  });
});

describe("elevation snap (φ=90° + facade normal)", () => {
  const RIG = { ...DEFAULT_CAMERA_RIG };

  it("snaps azimuth to the nearest facade normal inside tolerance", () => {
    expect(facadeNormalAzimuthDeg(0)).toBe(0);
    expect(facadeNormalAzimuthDeg(88.5)).toBe(90);
    expect(facadeNormalAzimuthDeg(271.5)).toBe(270);
    expect(facadeNormalAzimuthDeg(359.8)).toBe(0);
    expect(facadeNormalAzimuthDeg(45)).toBeNull();
  });

  it("is elevation only at the exact orthographic snap", () => {
    expect(isElevationRig({ ...RIG, tiltDeg: 90, rotateDeg: 0 })).toBe(true);
    expect(isElevationRig({ ...RIG, tiltDeg: 90, rotateDeg: 180 })).toBe(true);
    expect(isElevationRig({ ...RIG, tiltDeg: 90, rotateDeg: 45 })).toBe(false); // oblique azimuth
    expect(isElevationRig({ ...RIG, tiltDeg: 87, rotateDeg: 0 })).toBe(false); // near-90 oblique pitch
    expect(isElevationRig({ ...RIG, tiltDeg: 55, rotateDeg: 0 })).toBe(false);
  });

  it("treats a pinned photo's boundary bearing as a facade normal", () => {
    // Title boundaries are rarely cardinal — a 15° fence line is a facade
    // in its own right while its photo is pinned.
    expect(
      isElevationRig({ ...RIG, tiltDeg: 90, rotateDeg: 15 }, 15),
    ).toBe(true);
    expect(
      isElevationRig({ ...RIG, tiltDeg: 90, rotateDeg: 16.5 }, 15),
    ).toBe(true); // inside the 2° azimuth tolerance
    expect(
      isElevationRig({ ...RIG, tiltDeg: 90, rotateDeg: 20 }, 15),
    ).toBe(false); // swivelled away from the bearing
    expect(
      isElevationRig({ ...RIG, tiltDeg: 80, rotateDeg: 15 }, 15),
    ).toBe(false); // pitch still gates the facade
    // Cardinal snap behaviour is unchanged when no override is set.
    expect(isElevationRig({ ...RIG, tiltDeg: 90, rotateDeg: 15 }, null)).toBe(
      false,
    );
  });

  it("settles a release into the exact elevation state when near the snap", () => {
    const settled = settleOrbitRig({ ...RIG, tiltDeg: 89.2, rotateDeg: 91.5 });
    expect(settled.tiltDeg).toBe(90);
    expect(settled.rotateDeg).toBe(90);
  });

  it("leaves oblique releases untouched", () => {
    const obliquePitch = { ...RIG, tiltDeg: 80, rotateDeg: 91.5 };
    expect(settleOrbitRig(obliquePitch)).toBe(obliquePitch);
    const obliqueAzimuth = { ...RIG, tiltDeg: 89.2, rotateDeg: 45 };
    expect(settleOrbitRig(obliqueAzimuth)).toBe(obliqueAzimuth);
  });
});

describe("FusedCameraScratch full-orbit position", () => {
  it("reaches a true horizon at 90° pitch (camera on the ground plane)", () => {
    const scratch = new FusedCameraScratch();
    const pos = new THREE.Vector3();
    const look = new THREE.Vector3();
    scratch.computePosition(pos, look, 1, pitchRadians(90), 200, 0, 0);

    expect(pos.y).toBeCloseTo(0, 6); // height collapses to zero at the horizon
    expect(pos.z).toBeCloseTo(200, 6); // full horizontal offset = distance
    expect(look.y).toBe(0); // still looking at the ground origin
  });

  it("descends monotonically from overhead to horizon (no sign flip)", () => {
    const scratch = new FusedCameraScratch();
    let previous = Number.POSITIVE_INFINITY;
    for (let deg = 0; deg <= 90; deg += 5) {
      const pos = new THREE.Vector3();
      scratch.computePosition(pos, new THREE.Vector3(), 1, pitchRadians(deg), 200, 0, 0);
      expect(pos.y).toBeLessThanOrEqual(previous + 1e-9); // strictly descending
      expect(pos.y).toBeGreaterThanOrEqual(0); // never below the ground plane
      previous = pos.y;
    }
  });
});
