import { describe, expect, it } from "vitest";
import {
  isViewRotatedFromNorth,
  normalizeViewRotationDeg,
  resetViewRotationToNorth,
  stepViewRotationDeg,
} from "./canvasViewRotation";

describe("canvasViewRotation", () => {
  it("normalizes to (−180, 180] and treats near-zero as north", () => {
    expect(normalizeViewRotationDeg(0)).toBe(0);
    expect(normalizeViewRotationDeg(360)).toBe(0);
    expect(normalizeViewRotationDeg(-15)).toBe(-15);
    expect(normalizeViewRotationDeg(270)).toBe(-90);
    expect(normalizeViewRotationDeg(90)).toBe(90);
  });

  it("steps by fixed increments only", () => {
    expect(stepViewRotationDeg(0, 1, 15)).toBe(15);
    expect(stepViewRotationDeg(15, 1, 45)).toBe(60);
    expect(stepViewRotationDeg(0, -1, 90)).toBe(-90);
    expect(stepViewRotationDeg(180, 1, 15)).toBe(-165);
  });

  it("reset returns exact north", () => {
    expect(resetViewRotationToNorth()).toBe(0);
    expect(isViewRotatedFromNorth(15)).toBe(true);
    expect(isViewRotatedFromNorth(0)).toBe(false);
  });
});
