import { describe, expect, it } from "vitest";
import { clampPan, isPanGesture, nextPanOffset } from "./canvasPan";

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
});
