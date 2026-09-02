import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  CANVAS_PRESETS,
  computePlanePose,
  foldQuaternion,
  poseForPreset,
  angleFromQuaternionAtBearing,
  decomposeFoldQuaternion,
  nearestSnap,
  clampFoldAngle,
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

describe("angleFromQuaternionAtBearing", () => {
  it("round-trips every angle/bearing pair foldQuaternion can produce", () => {
    for (const bearingDeg of [0, 30, 90, 180, 270]) {
      for (const angleDeg of [0, 15, 45, 60, 72, 90]) {
        const q = foldQuaternion(angleDeg, bearingDeg);
        const recovered = angleFromQuaternionAtBearing(q, bearingDeg);
        expect(recovered).toBeCloseTo(angleDeg, 3);
      }
    }
  });

  it("stays correct after simulating an incremental local-X drag", () => {
    // Mirrors HingeProjectionGizmo: TransformControls applies successive
    // local-space rotations as Q_new = Q_old * deltaR — same-axis
    // rotations must compose additively for the gizmo's read-back to work.
    const bearingDeg = 40;
    let q = foldQuaternion(0, bearingDeg);
    const steps = [10, 10, 15, 20]; // sums to 55
    for (const stepDeg of steps) {
      const delta = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(1, 0, 0),
        -THREE.MathUtils.degToRad(stepDeg),
      );
      q = q.multiply(delta);
    }
    expect(angleFromQuaternionAtBearing(q, bearingDeg)).toBeCloseTo(55, 3);
  });
});

describe("decomposeFoldQuaternion", () => {
  it("round-trips every angle/bearing pair with neither known upfront", () => {
    for (const bearingDeg of [0, 30, 90, 180, 270, 359]) {
      for (const angleDeg of [15, 45, 60, 72, 90]) {
        const q = foldQuaternion(angleDeg, bearingDeg);
        const decomposed = decomposeFoldQuaternion(q);
        expect(decomposed.angleDeg).toBeCloseTo(angleDeg, 3);
        expect(decomposed.bearingDeg).toBeCloseTo(bearingDeg % 360, 3);
      }
    }
  });

  it("angle 0 decomposes to angle 0 regardless of bearing (flat has no facing)", () => {
    const q = foldQuaternion(0, 123);
    expect(decomposeFoldQuaternion(q).angleDeg).toBeCloseTo(0, 3);
  });

  it("seeds angleFromQuaternionAtBearing correctly for a mid-fold gizmo mount", () => {
    // Simulates HingeProjectionGizmo mounting on an already-mid-fold plane:
    // decompose once to get both, then confirm the cheaper bearing-known
    // function agrees for the rest of the drag.
    const q = foldQuaternion(37, 210);
    const { bearingDeg } = decomposeFoldQuaternion(q);
    expect(angleFromQuaternionAtBearing(q, bearingDeg)).toBeCloseTo(37, 3);
  });
});

describe("nearestSnap", () => {
  it("finds the exact named angles", () => {
    expect(nearestSnap(45)?.sides).toBe(8);
    expect(nearestSnap(60)?.sides).toBe(6);
    expect(nearestSnap(72)?.sides).toBe(5);
    expect(nearestSnap(90)?.sides).toBe(4);
  });

  it("snaps within the epsilon window", () => {
    expect(nearestSnap(91.5)?.sides).toBe(4);
    expect(nearestSnap(88.5)?.sides).toBe(4);
  });

  it("returns null mid-fold, away from any named angle", () => {
    expect(nearestSnap(20)).toBeNull();
    expect(nearestSnap(52)).toBeNull();
  });
});

describe("clampFoldAngle", () => {
  it("clamps to the 0-90 range", () => {
    expect(clampFoldAngle(-10)).toBe(0);
    expect(clampFoldAngle(120)).toBe(90);
    expect(clampFoldAngle(45)).toBe(45);
  });
});
