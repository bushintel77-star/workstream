import { describe, it, expect } from "vitest";

/**
 * Phase K — NumericSlider pure logic tests.
 *
 * The component itself is a thin React wrapper around a slider + number
 * input. The critical logic is the clamping: a typed value must be
 * clamped to [min, max] before being passed to onChange. These tests
 * exercise the same clamp math the component uses.
 */

function clamp(value: number, min: number, max: number): number {
  // The component only calls onChange when parseFloat returns a finite
  // number. Non-finite values are silently rejected (no onChange call).
  if (!Number.isFinite(value)) return value;
  return Math.max(min, Math.min(max, value));
}

function deriveDecimals(step: number): number {
  return step < 1
    ? Math.max(0, step.toString().split(".")[1]?.length ?? 0)
    : 0;
}

describe("Phase K — NumericSlider clamp logic", () => {
  it("clamps below min to min", () => {
    expect(clamp(0.1, 0.5, 20)).toBe(0.5);
  });

  it("clamps above max to max", () => {
    expect(clamp(50, 0.5, 20)).toBe(20);
  });

  it("passes through values within range", () => {
    expect(clamp(7.3, 0.5, 20)).toBe(7.3);
    expect(clamp(3.5, 0.5, 20)).toBe(3.5);
  });

  it("returns non-finite values unchanged (component skips onChange for them)", () => {
    // The component checks Number.isFinite before calling onChange.
    // NaN, Infinity, -Infinity are all rejected (no commit).
    expect(Number.isFinite(clamp(NaN, 0.5, 20))).toBe(false);
    expect(Number.isFinite(clamp(Infinity, 0.5, 20))).toBe(false);
    expect(Number.isFinite(clamp(-Infinity, 0.5, 20))).toBe(false);
  });

  it("derives decimal places from step", () => {
    expect(deriveDecimals(0.5)).toBe(1);
    expect(deriveDecimals(0.05)).toBe(2);
    expect(deriveDecimals(0.25)).toBe(2);
    expect(deriveDecimals(1)).toBe(0);
    expect(deriveDecimals(5)).toBe(0);
  });

  it("handles edge case: step = 0.1 → 1 decimal place", () => {
    expect(deriveDecimals(0.1)).toBe(1);
  });
});
