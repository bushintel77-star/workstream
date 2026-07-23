import { describe, expect, it } from "vitest";
import {
  TILT_DEG,
  TILT_EAVE_M,
  TILT_MAX,
  TILT_SNAP_FLAT,
  TILT_ANIM_MS_FAST,
  TILT_ANIM_MS_SLOW,
  billboardStyle,
  isTiltActive,
  poleMatrix3d,
  pxPerMetre,
  settleTiltDeg,
  tiltFromDragDelta,
  wallQuadMatrix3d,
} from "./tiltMath";

/** Apply a CSS column-major matrix3d(...) string to a local point. */
function applyMatrix3d(
  matrixStr: string,
  local: { x: number; y: number; z: number },
): { x: number; y: number; z: number } {
  const nums = matrixStr
    .slice(matrixStr.indexOf("(") + 1, matrixStr.lastIndexOf(")"))
    .split(",")
    .map(Number);
  const [
    m11, m21, m31, ,
    m12, m22, m32, ,
    m13, m23, m33, ,
    m14, m24, m34,
  ] = nums;
  const { x, y, z } = local;
  return {
    x: m11! * x + m12! * y + m13! * z + m14!,
    y: m21! * x + m22! * y + m23! * z + m24!,
    z: m31! * x + m32! * y + m33! * z + m34!,
  };
}

/** Apply `translate3d(x,y,z) rotateX(-90deg)` — same convention as poleMatrix3d. */
function applyPoleTransform(
  x0: number,
  y0: number,
  z0: number,
  local: { x: number; y: number; z: number },
): { x: number; y: number; z: number } {
  // rotateX(-90deg): (x,y,z) -> (x, z, -y)
  const rotated = { x: local.x, y: local.z, z: -local.y };
  return { x: rotated.x + x0, y: rotated.y + y0, z: rotated.z + z0 };
}

describe("tiltMath", () => {
  it("exports the canonical settle angle", () => {
    expect(TILT_DEG).toBe(55);
    expect(TILT_MAX).toBe(60);
    expect(TILT_SNAP_FLAT).toBe(15);
    expect(TILT_EAVE_M).toBe(5);
    expect(TILT_ANIM_MS_FAST).toBe(700);
    expect(TILT_ANIM_MS_SLOW).toBe(2500);
  });

  it("pxPerMetre scales with board width and zoom", () => {
    // 1100 px board spanning 110 m → 10 px/m at zoom 1
    expect(pxPerMetre(1100, 110, 1)).toBeCloseTo(10, 5);
    expect(pxPerMetre(1100, 110, 2)).toBeCloseTo(20, 5);
  });

  it("billboard height for a 6 m tree at zoom 1 and zoom 2", () => {
    const ppm1 = pxPerMetre(1100, 110, 1);
    const ppm2 = pxPerMetre(1100, 110, 2);
    const at1 = billboardStyle(6, ppm1, TILT_DEG);
    const at2 = billboardStyle(6, ppm2, TILT_DEG);
    expect(at1.height).toBe("60px");
    expect(at2.height).toBe("120px");
    expect(at1.transform).toBe(`rotateX(-${TILT_DEG}deg)`);
    expect(at1.transformOrigin).toBe("bottom center");
  });

  it("isTiltActive only when meaningfully tilted", () => {
    expect(isTiltActive(0)).toBe(false);
    expect(isTiltActive(0.2)).toBe(false);
    expect(isTiltActive(TILT_DEG)).toBe(true);
  });

  it("drag delta increases tilt and clamps to TILT_MAX", () => {
    expect(tiltFromDragDelta(0, 100)).toBeCloseTo(18, 5);
    expect(tiltFromDragDelta(50, 1000)).toBe(TILT_MAX);
    expect(tiltFromDragDelta(10, -200)).toBe(0);
  });

  it("settle snaps below threshold flat, keeps above", () => {
    expect(settleTiltDeg(10)).toBe(0);
    expect(settleTiltDeg(14.9)).toBe(0);
    expect(settleTiltDeg(15)).toBe(15);
    expect(settleTiltDeg(55)).toBe(55);
  });

  describe("wallQuadMatrix3d — true-3D wall/roof registration", () => {
    it("maps the wall's four corners onto the ground edge and the roofline", () => {
      const ax = 10;
      const ay = 20;
      const bx = 40;
      const by = 20;
      const eavePx = 50;
      const m = wallQuadMatrix3d(ax, ay, bx, by, eavePx);
      const len = Math.hypot(bx - ax, by - ay);

      // Top-left (local origin) — roofline directly above A.
      expect(applyMatrix3d(m, { x: 0, y: 0, z: 0 })).toEqual({
        x: ax,
        y: ay,
        z: eavePx,
      });
      // Top-right — roofline directly above B.
      const topRight = applyMatrix3d(m, { x: len, y: 0, z: 0 });
      expect(topRight.x).toBeCloseTo(bx, 5);
      expect(topRight.y).toBeCloseTo(by, 5);
      expect(topRight.z).toBeCloseTo(eavePx, 5);
      // Bottom-left — ground at A (z = 0).
      const bottomLeft = applyMatrix3d(m, { x: 0, y: eavePx, z: 0 });
      expect(bottomLeft.x).toBeCloseTo(ax, 5);
      expect(bottomLeft.y).toBeCloseTo(ay, 5);
      expect(bottomLeft.z).toBeCloseTo(0, 5);
      // Bottom-right — ground at B (z = 0).
      const bottomRight = applyMatrix3d(m, { x: len, y: eavePx, z: 0 });
      expect(bottomRight.x).toBeCloseTo(bx, 5);
      expect(bottomRight.y).toBeCloseTo(by, 5);
      expect(bottomRight.z).toBeCloseTo(0, 5);
    });

    it("registers correctly for a non-axis-aligned edge too", () => {
      const ax = 5;
      const ay = 5;
      const bx = 35;
      const by = 45;
      const eavePx = 30;
      const m = wallQuadMatrix3d(ax, ay, bx, by, eavePx);
      const len = Math.hypot(bx - ax, by - ay);

      const roofAtB = applyMatrix3d(m, { x: len, y: 0, z: 0 });
      expect(roofAtB.x).toBeCloseTo(bx, 5);
      expect(roofAtB.y).toBeCloseTo(by, 5);
      expect(roofAtB.z).toBeCloseTo(eavePx, 5);

      const groundAtB = applyMatrix3d(m, { x: len, y: eavePx, z: 0 });
      expect(groundAtB.x).toBeCloseTo(bx, 5);
      expect(groundAtB.y).toBeCloseTo(by, 5);
      expect(groundAtB.z).toBeCloseTo(0, 5);
    });

    it("is a proper rotation (no mirroring) — det(R) = +1", () => {
      const m = wallQuadMatrix3d(0, 0, 10, 0, 20);
      const nums = m
        .slice(m.indexOf("(") + 1, m.lastIndexOf(")"))
        .split(",")
        .map(Number);
      // Columns 0,1,2 (each length-4, ignoring the translation column 3).
      const c1 = [nums[0]!, nums[1]!, nums[2]!];
      const c2 = [nums[4]!, nums[5]!, nums[6]!];
      const c3 = [nums[8]!, nums[9]!, nums[10]!];
      const cross = [
        c1[1]! * c2[2]! - c1[2]! * c2[1]!,
        c1[2]! * c2[0]! - c1[0]! * c2[2]!,
        c1[0]! * c2[1]! - c1[1]! * c2[0]!,
      ];
      expect(cross[0]).toBeCloseTo(c3[0]!, 5);
      expect(cross[1]).toBeCloseTo(c3[1]!, 5);
      expect(cross[2]).toBeCloseTo(c3[2]!, 5);
    });
  });

  describe("poleMatrix3d — corner post shares the wall's Z convention", () => {
    it("spans exactly from ground (z=0) to the roofline (z=eavePx)", () => {
      const x = 12;
      const y = 34;
      const eavePx = 45;
      // Same reduction poleMatrix3d documents: translate3d(x,y,eavePx) rotateX(-90deg).
      const top = applyPoleTransform(x, y, eavePx, { x: 0, y: 0, z: 0 });
      expect(top).toEqual({ x, y, z: eavePx });
      const bottom = applyPoleTransform(x, y, eavePx, { x: 0, y: eavePx, z: 0 });
      expect(bottom.x).toBeCloseTo(x, 5);
      expect(bottom.y).toBeCloseTo(y, 5);
      expect(bottom.z).toBeCloseTo(0, 5);
    });

    it("produces the documented translate3d/rotateX(-90deg) string", () => {
      expect(poleMatrix3d(1, 2, 3)).toBe(
        "translate3d(1.00px, 2.00px, 3.00px) rotateX(-90deg)",
      );
    });
  });
});
