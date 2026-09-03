import { describe, expect, it } from "vitest";
import {
  cameraReadoutFor3D,
  formatCameraReadout,
  PERSP_FOV_DEG,
  type CameraReadout,
} from "./chromeCameraReadout";
import type { StudioCameraRig } from "./cameraRig";

const baseRig: StudioCameraRig = {
  panX: 0,
  panY: 0,
  zoom: 1,
  rotateDeg: 0,
  tiltDeg: 76,
  focusX: 0,
  focusY: 0,
};

describe("cameraReadoutFor3D — Phase L.3 helper", () => {
  it("returns the constant 30° FOV", () => {
    const r = cameraReadoutFor3D(baseRig, 50, 1, null);
    expect(r.fovDeg).toBe(PERSP_FOV_DEG);
    expect(r.fovDeg).toBe(30);
  });

  it("eye height is positive in 3D (tilt > 0, blend = 1)", () => {
    const r = cameraReadoutFor3D(baseRig, 50, 1, null);
    expect(r.eyeHeightM).toBeGreaterThan(0);
  });

  it("bearing is 0–360", () => {
    const r = cameraReadoutFor3D(baseRig, 50, 1, null);
    expect(r.bearingDeg).toBeGreaterThanOrEqual(0);
    expect(r.bearingDeg).toBeLessThan(360);
  });

  it("bearing wraps negative rotation to positive", () => {
    const rig: StudioCameraRig = { ...baseRig, rotateDeg: -90 };
    const r = cameraReadoutFor3D(rig, 50, 1, null);
    expect(r.bearingDeg).toBeCloseTo(270, 0);
  });

  it("north bearing is added when calibrated", () => {
    const rig: StudioCameraRig = { ...baseRig, rotateDeg: 10 };
    const r = cameraReadoutFor3D(rig, 50, 1, 45);
    expect(r.bearingDeg).toBeCloseTo(55, 0);
  });

  it("formatCameraReadout produces H / BRG / FOV string", () => {
    const r: CameraReadout = { eyeHeightM: 12.4, bearingDeg: 45, fovDeg: 30 };
    const s = formatCameraReadout(r);
    expect(s).toContain("H 12.4m");
    expect(s).toContain("BRG 045");
    expect(s).toContain("FOV 30");
  });
});
