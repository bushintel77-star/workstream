import { describe, expect, it } from "vitest";
import {
  clampPan,
  isPanGesture,
  nextPanOffset,
  zoomWorldTransformString,
} from "./canvasPan";

describe("canvasPan", () => {
  it("middle-mouse always starts a pan, regardless of Space", () => {
    expect(isPanGesture({ button: 1, spaceHeld: false })).toBe(true);
    expect(isPanGesture({ button: 1, spaceHeld: true })).toBe(true);
  });

  it("primary button pans only while Space is held", () => {
    expect(isPanGesture({ button: 0, spaceHeld: true })).toBe(true);
    expect(isPanGesture({ button: 0, spaceHeld: false })).toBe(false);
  });

  it("never treats the secondary (context-menu) button as pan", () => {
    expect(isPanGesture({ button: 2, spaceHeld: true })).toBe(false);
  });

  it("pan tool armed lets a plain left-drag grab (sketch pad)", () => {
    expect(
      isPanGesture({ button: 0, spaceHeld: false, panToolArmed: true }),
    ).toBe(true);
    expect(
      isPanGesture({ button: 0, spaceHeld: false, panToolArmed: false }),
    ).toBe(false);
    expect(
      isPanGesture({ button: 2, spaceHeld: false, panToolArmed: true }),
    ).toBe(false);
  });

  it("tilt view lets a plain left-drag pan the drawing", () => {
    expect(
      isPanGesture({ button: 0, spaceHeld: false, tiltViewActive: true }),
    ).toBe(true);
    expect(
      isPanGesture({ button: 0, spaceHeld: false, tiltViewActive: false }),
    ).toBe(false);
  });

  it("accumulates offset from a drag-start base", () => {
    expect(nextPanOffset({ x: 10, y: -5 }, 20, 30)).toEqual({ x: 30, y: 25 });
  });

  it("clamps non-finite input back to a safe value", () => {
    expect(clampPan(Number.NaN)).toBe(0);
    expect(clampPan(Infinity)).toBe(100_000);
    expect(clampPan(-Infinity)).toBe(-100_000);
  });

  it("clamps extreme drift within the practical cap", () => {
    const result = nextPanOffset({ x: 0, y: 0 }, 1e9, -1e9);
    expect(result.x).toBe(100_000);
    expect(result.y).toBe(-100_000);
  });

  it("builds the zoomWorld transform with tilt → pan → rotate → scale", () => {
    expect(
      zoomWorldTransformString({
        tiltActive: false,
        tiltDeg: 0,
        panX: 12,
        panY: -8,
        rotateDeg: 0,
        zoom: 1,
      }),
    ).toBe("translate(12px, -8px) rotate(0deg) scale(1)");
  });

  it("prepends rotateX when the tilt lens is active", () => {
    expect(
      zoomWorldTransformString({
        tiltActive: true,
        tiltDeg: 45,
        panX: 0,
        panY: 0,
        rotateDeg: 90,
        zoom: 2.5,
      }),
    ).toBe("rotateX(45deg) translate(0px, 0px) rotate(90deg) scale(2.5)");
  });
});
