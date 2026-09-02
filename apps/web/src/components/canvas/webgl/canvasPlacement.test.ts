import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  CANVAS_PRESETS,
  computePlanePose,
  foldQuaternion,
  poseForPreset,
} from "./canvasPlacement";

describe("foldQuaternion", () => {
  it("is identity at angle 0 (flat, matching a legacy flat plane)", () => {
    const q = foldQuaternion(0);
    expect(q.x).toBeCloseTo(0);
    expect(q.y).toBeCloseTo(0);
    expect(q.z).toBeCloseTo(0);
    expect(q.w).toBeCloseTo(1);
  });

  it("stands the plane's normal fully horizontal at angle 90, bearing 0", () => {
    const q = foldQuaternion(90, 0);
    const normal = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    // A flat plane's +Y normal, tilted 90°, should now lie in the XZ plane.
    expect(normal.y).toBeCloseTo(0, 5);
  });

  it("rotates the fold direction by bearing", () => {
    const north = foldQuaternion(90, 0);
    const east = foldQuaternion(90, 90);
    const normalNorth = new THREE.Vector3(0, 1, 0).applyQuaternion(north);
    const normalEast = new THREE.Vector3(0, 1, 0).applyQuaternion(east);
    // Different bearings must fold toward different horizontal directions.
    expect(normalNorth.angleTo(normalEast)).toBeGreaterThan(0.1);
  });

  it("sweeps continuously between 0 and 90 (no discontinuity mid-fold)", () => {
    const q45 = foldQuaternion(45, 0);
    const normal45 = new THREE.Vector3(0, 1, 0).applyQuaternion(q45);
    // Halfway through the fold, the normal should be roughly 45° from +Y.
    const up = new THREE.Vector3(0, 1, 0);
    expect(normal45.angleTo(up)).toBeCloseTo(Math.PI / 4, 1);
  });
});

describe("computePlanePose", () => {
  it("places a flat plane at the given height with identity rotation", () => {
    const pose = computePlanePose("flat", 1.5);
    expect(pose.position).toEqual([0, 1.5, 0]);
    expect(pose.rotation).toEqual([0, 0, 0, 1]);
  });

  it("places a standing plane at 90° folded, honouring bearing", () => {
    const pose = computePlanePose("standing", 0, 180);
    const q = new THREE.Quaternion(...pose.rotation);
    const normal = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    expect(normal.y).toBeCloseTo(0, 5);
  });
});

describe("CANVAS_PRESETS", () => {
  it("has exactly the five spec presets", () => {
    expect(CANVAS_PRESETS.map((p) => p.id)).toEqual([
      "ground",
      "terrace",
      "canopy",
      "boundary-wall",
      "hedge-line",
    ]);
  });

  it("ground and terrace are flat presets at their spec'd heights", () => {
    const ground = CANVAS_PRESETS.find((p) => p.id === "ground")!;
    const terrace = CANVAS_PRESETS.find((p) => p.id === "terrace")!;
    expect(ground.orientation).toBe("flat");
    expect(ground.heightM).toBe(0);
    expect(terrace.orientation).toBe("flat");
    expect(terrace.heightM).toBe(1.2);
  });

  it("boundary wall and hedge line are standing presets", () => {
    const wall = CANVAS_PRESETS.find((p) => p.id === "boundary-wall")!;
    expect(wall.orientation).toBe("standing");
  });

  it("every preset produces a valid unit-length rotation quaternion", () => {
    for (const preset of CANVAS_PRESETS) {
      const pose = poseForPreset(preset);
      const q = new THREE.Quaternion(...pose.rotation);
      expect(q.length()).toBeCloseTo(1, 5);
    }
  });
});
