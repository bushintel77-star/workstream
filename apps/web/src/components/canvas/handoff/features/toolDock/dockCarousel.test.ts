import { describe, expect, it } from "vitest";
import {
  clampDockFocus,
  DOCK_CURVE,
  dockChipPose,
  dockFocusFromPointer,
  spinDockFocus,
} from "./dockCarousel";

describe("dockChipPose", () => {
  it("crest chip gets full lean, scale and opacity", () => {
    const pose = dockChipPose(3, 3);
    expect(pose.leanPx).toBeCloseTo(DOCK_CURVE.reachPx);
    expect(pose.scale).toBeCloseTo(DOCK_CURVE.maxScale);
    expect(pose.opacity).toBeCloseTo(1);
  });

  it("falls off symmetrically and settles outside the window", () => {
    const up = dockChipPose(2, 3);
    const down = dockChipPose(4, 3);
    expect(up.leanPx).toBeCloseTo(down.leanPx);
    expect(up.scale).toBeGreaterThan(1);
    expect(up.scale).toBeLessThan(DOCK_CURVE.maxScale);

    const far = dockChipPose(0, 6);
    expect(far.leanPx).toBe(0);
    expect(far.scale).toBe(DOCK_CURVE.minScale);
    expect(far.opacity).toBe(DOCK_CURVE.minOpacity);
  });

  it("rest amplitude keeps a lower standing curve", () => {
    const rest = dockChipPose(3, 3, DOCK_CURVE.restAmplitude);
    expect(rest.leanPx).toBeCloseTo(
      DOCK_CURVE.reachPx * DOCK_CURVE.restAmplitude,
    );
    expect(rest.scale).toBeLessThan(DOCK_CURVE.maxScale);
    expect(rest.opacity).toBeLessThan(1);
  });
});

describe("crest tracking", () => {
  it("clamps focus into the chip range", () => {
    expect(clampDockFocus(-2, 9)).toBe(0);
    expect(clampDockFocus(42, 9)).toBe(8);
    expect(clampDockFocus(3.4, 9)).toBeCloseTo(3.4);
  });

  it("maps pointer y to a fractional index at chip pitch", () => {
    // Pointer over the centre of the third chip (pitch 50px).
    expect(dockFocusFromPointer(125, 50, 9)).toBeCloseTo(2);
    expect(dockFocusFromPointer(-40, 50, 9)).toBe(0);
    expect(dockFocusFromPointer(0, 0, 9)).toBe(0);
  });

  it("wheel spin travels the crest and clamps at the ends", () => {
    const spun = spinDockFocus(2, 100, 9);
    expect(spun).toBeCloseTo(2 + 100 * DOCK_CURVE.wheelGain);
    expect(spinDockFocus(8, 9_999, 9)).toBe(8);
    expect(spinDockFocus(0, -9_999, 9)).toBe(0);
  });
});
