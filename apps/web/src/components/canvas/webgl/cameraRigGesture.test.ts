import { describe, expect, it } from "vitest";
import { DEFAULT_CAMERA_RIG } from "./cameraRig";
import {
  beginPanDrag,
  panDragMove,
  zoomRigAt,
  type PanDragState,
} from "./cameraRigGesture";

const RIG = { ...DEFAULT_CAMERA_RIG, zoom: 2, panX: 10, panY: -5 };

describe("beginPanDrag", () => {
  it("anchors the drag to the current rig's pan", () => {
    const d = beginPanDrag(RIG, 120, 80);
    expect(d).toMatchObject({
      active: true,
      isPan: false,
      moved: false,
      startX: 120,
      startY: 80,
      startPanX: 10,
      startPanY: -5,
    });
  });
});

describe("panDragMove", () => {
  it("does not pan below the 3px threshold (no commit, no movement)", () => {
    const d = beginPanDrag(RIG, 120, 80);
    const r = panDragMove(d, RIG, 122, 82);
    expect(r.isPan).toBe(false);
    expect(r.nextRig).toBe(RIG);
  });

  it("pans in world units derived from the pointer delta and zoom", () => {
    const d = beginPanDrag(RIG, 120, 80);
    const r = panDragMove(d, RIG, 140, 60);
    expect(r.isPan).toBe(true);
    // worldDx = -20 / (2 * 8) = -1.25, worldDy = -20 / 16 = -1.25 (dy is NOT
    // negated — matches the historical StudioControls math, preserved exactly).
    expect(r.nextRig.panX).toBeCloseTo(10 - 1.25, 6);
    expect(r.nextRig.panY).toBeCloseTo(-5 - 1.25, 6);
  });

  it("anchors to the drag START pan, not the latest live pan (no mid-drag jump)", () => {
    const d = beginPanDrag({ ...RIG, panX: 10, panY: -5 }, 120, 80);
    // A move after the rig has already been panned live to (30, 20) must
    // still compute from startPan (10, -5), not the live value.
    const live = { ...RIG, panX: 30, panY: 20 };
    const r = panDragMove(d, live, 140, 60);
    expect(r.nextRig.panX).toBeCloseTo(10 - 1.25, 6);
    expect(r.nextRig.panY).toBeCloseTo(-5 - 1.25, 6);
  });

  it("keeps panning once the threshold is crossed, even if the pointer pauses", () => {
    const d: PanDragState = { ...beginPanDrag(RIG, 120, 80), isPan: true, moved: true };
    const r = panDragMove(d, RIG, 121, 81);
    expect(r.isPan).toBe(true);
    expect(r.nextRig.panX).not.toBe(RIG.panX);
  });
});

describe("zoomRigAt", () => {
  const rect = { width: 800, height: 600 };

  it("clamps zoom to [0.1, 50]", () => {
    const r = zoomRigAt({ ...RIG, zoom: 46 }, -100, 400, 300, rect, 20);
    expect(r.zoom).toBe(50);
    const r2 = zoomRigAt({ ...RIG, zoom: 0.05 }, 100, 400, 300, rect, 20);
    expect(r2.zoom).toBe(0.1);
  });

  it("applies the standard 1.1 / 0.9 factors", () => {
    const out = zoomRigAt(RIG, -100, 400, 300, rect, 20);
    expect(out.zoom).toBeCloseTo(2 * 1.1, 6);
    const out2 = zoomRigAt(RIG, 100, 400, 300, rect, 20);
    expect(out2.zoom).toBeCloseTo(2 * 0.9, 6);
  });

  it("shifts pan proportional to the zoom delta, anchored at the pointer", () => {
    // Pointer at the right edge (nx = +1). Zoom-in (1.1) → zoomRatio is
    // negative, so panX shifts negative — the preserved historical sign.
    const r = zoomRigAt(RIG, -100, 800, 300, rect, 20);
    expect(r.panX).toBeCloseTo(10 - 0.5, 6);
    expect(r.panY).toBe(RIG.panY);
  });

  it("clamps the pan shift to a fraction of the lot scale", () => {
    // Pointer at the far edge with a small lot → the shift must be bounded.
    const r = zoomRigAt(RIG, -100, 800, 300, rect, 0.5);
    const maxShift = Math.max(1, 0.5 * 0.5);
    expect(Math.abs(r.panX - RIG.panX)).toBeLessThanOrEqual(maxShift + 1e-9);
  });
});
