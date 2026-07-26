import { describe, expect, it } from "vitest";
import {
  isViewRotatedFromNorth,
  normalizeViewRotationDeg,
  resetViewRotationToNorth,
  resolvePlanRotateDeg,
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

  it("resolvePlanRotateDeg applies garden axon yaw outside CAD", () => {
    expect(
      resolvePlanRotateDeg({
        mode: "survey",
        frameOn: false,
        clientView: false,
        tiltDeg: 55,
        viewRotationDeg: 90,
      }),
    ).toBe(90);
    expect(
      resolvePlanRotateDeg({
        mode: "sketch",
        frameOn: false,
        clientView: false,
        tiltDeg: 55,
        viewRotationDeg: 180,
      }),
    ).toBe(180);
    expect(
      resolvePlanRotateDeg({
        mode: "sketch",
        frameOn: false,
        clientView: false,
        tiltDeg: 0,
        viewRotationDeg: 90,
      }),
    ).toBe(0);
    expect(
      resolvePlanRotateDeg({
        mode: "cad",
        frameOn: false,
        clientView: false,
        tiltDeg: 0,
        viewRotationDeg: 45,
      }),
    ).toBe(45);
    expect(
      resolvePlanRotateDeg({
        mode: "cad",
        frameOn: true,
        clientView: false,
        tiltDeg: 55,
        viewRotationDeg: 90,
      }),
    ).toBe(0);
  });
});
