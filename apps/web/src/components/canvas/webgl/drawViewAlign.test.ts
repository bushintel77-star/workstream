import { describe, it, expect } from "vitest";
import { alignRigToCanvas, alignRigToGround, alignRigToActiveCanvas } from "./drawViewAlign";
import { foldQuaternion } from "./canvasPlacement";
import type { StudioCameraRig } from "./cameraRig";

const baseRig: StudioCameraRig = {
  panX: 10,
  panY: 5,
  zoom: 2,
  rotateDeg: 30,
  tiltDeg: 45,
  focusX: 50,
  focusY: 50,
};

describe("drawViewAlign", () => {
  it("ground plane → plan view (tilt=0, rotate=0)", () => {
    const rig = alignRigToGround(baseRig);
    expect(rig.tiltDeg).toBe(0);
    expect(rig.rotateDeg).toBe(0);
    // Pan/zoom/focus preserved.
    expect(rig.panX).toBe(10);
    expect(rig.panY).toBe(5);
    expect(rig.zoom).toBe(2);
  });

  it("flat canvas (identity quaternion) → plan view", () => {
    const rig = alignRigToCanvas([0, 0, 0, 1], baseRig);
    expect(rig.tiltDeg).toBeCloseTo(0, 1);
    expect(rig.rotateDeg).toBeCloseTo(0, 1);
  });

  it("standing canvas at bearing 0 → tilt 90, rotate 0", () => {
    const q = foldQuaternion(90, 0);
    const rig = alignRigToCanvas([q.x, q.y, q.z, q.w], baseRig);
    expect(rig.tiltDeg).toBeCloseTo(90, 1);
    expect(rig.rotateDeg).toBeCloseTo(0, 1);
  });

  it("standing canvas at bearing 90 → tilt 90, rotate 90", () => {
    const q = foldQuaternion(90, 90);
    const rig = alignRigToCanvas([q.x, q.y, q.z, q.w], baseRig);
    expect(rig.tiltDeg).toBeCloseTo(90, 1);
    expect(rig.rotateDeg).toBeCloseTo(90, 1);
  });

  it("partial fold at 45° → tilt 45", () => {
    const q = foldQuaternion(45, 0);
    const rig = alignRigToCanvas([q.x, q.y, q.z, q.w], baseRig);
    expect(rig.tiltDeg).toBeCloseTo(45, 1);
  });

  it("preserves pan/zoom/focus when aligning", () => {
    const q = foldQuaternion(90, 45);
    const rig = alignRigToCanvas([q.x, q.y, q.z, q.w], baseRig);
    expect(rig.panX).toBe(10);
    expect(rig.panY).toBe(5);
    expect(rig.zoom).toBe(2);
    expect(rig.focusX).toBe(50);
    expect(rig.focusY).toBe(50);
  });

  it("alignRigToActiveCanvas: null id → ground", () => {
    const rig = alignRigToActiveCanvas(null, [], baseRig);
    expect(rig.tiltDeg).toBe(0);
    expect(rig.rotateDeg).toBe(0);
  });

  it("alignRigToActiveCanvas: valid id → face-on to that canvas", () => {
    const q = foldQuaternion(90, 180);
    const canvases = [{ id: "c1", rotation: [q.x, q.y, q.z, q.w] as [number, number, number, number] }];
    const rig = alignRigToActiveCanvas("c1", canvases, baseRig);
    expect(rig.tiltDeg).toBeCloseTo(90, 1);
    expect(rig.rotateDeg).toBeCloseTo(180, 1);
  });

  it("alignRigToActiveCanvas: missing id → ground fallback", () => {
    const rig = alignRigToActiveCanvas("nonexistent", [], baseRig);
    expect(rig.tiltDeg).toBe(0);
    expect(rig.rotateDeg).toBe(0);
  });
});
