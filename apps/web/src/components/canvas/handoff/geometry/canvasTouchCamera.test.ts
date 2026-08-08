import { describe, expect, it } from "vitest";
import {
  isTwoFingerCameraGesture,
  panFromTouchMidpoint,
  touchDistance,
  touchMidpoint,
  zoomFromPinch,
} from "./canvasTouchCamera";

describe("canvasTouchCamera", () => {
  it("midpoint is the average of two points", () => {
    expect(touchMidpoint({ x: 0, y: 0 }, { x: 10, y: 20 })).toEqual({
      x: 5,
      y: 10,
    });
  });

  it("distance is Euclidean", () => {
    expect(touchDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it("pinch zoom scales by distance ratio and clamps", () => {
    expect(zoomFromPinch(1, 100, 200)).toBe(2);
    expect(zoomFromPinch(1, 100, 50)).toBe(0.5);
    expect(zoomFromPinch(1, 4, 400)).toBe(1); // prevDist too small
    expect(zoomFromPinch(1, 100, 0)).toBe(1);
  });

  it("pan follows midpoint delta from a drag-start base", () => {
    expect(
      panFromTouchMidpoint(
        { x: 10, y: -5 },
        { x: 100, y: 100 },
        { x: 130, y: 80 },
      ),
    ).toEqual({ x: 40, y: -25 });
  });

  it("two-finger camera needs at least two pointers", () => {
    expect(isTwoFingerCameraGesture(1)).toBe(false);
    expect(isTwoFingerCameraGesture(2)).toBe(true);
    expect(isTwoFingerCameraGesture(3)).toBe(true);
  });
});
