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
  pxPerMetre,
  settleTiltDeg,
  tiltFromDragDelta,
} from "./tiltMath";

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
});
