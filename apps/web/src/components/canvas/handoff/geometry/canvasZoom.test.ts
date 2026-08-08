import { describe, expect, it } from "vitest";
import {
  ZOOM_MAX,
  ZOOM_MIN,
  clampZoom,
  composeSheetZoom,
  zoomByKeyStep,
  zoomByRibbonDelta,
  zoomFromWheel,
} from "./canvasZoom";

describe("canvasZoom", () => {
  it("allows deep zoom-in past the old 2.2 ceiling", () => {
    let z = 1;
    for (let i = 0; i < 40; i++) z = zoomByRibbonDelta(z, 0.1);
    expect(z).toBeGreaterThan(2.2);
    expect(z).toBeLessThanOrEqual(ZOOM_MAX);
  });

  it("allows infinite zoom-out down to the soft floor", () => {
    let z = 1;
    for (let i = 0; i < 40; i++) z = zoomByRibbonDelta(z, -0.1);
    expect(z).toBeLessThan(0.6);
    expect(z).toBeGreaterThanOrEqual(ZOOM_MIN);
  });

  it("wheel zooms smoothly in and out and clamps", () => {
    expect(zoomFromWheel(1, -400)).toBeGreaterThan(1);
    expect(zoomFromWheel(1, 400)).toBeLessThan(1);
    expect(zoomFromWheel(1, 400)).toBeGreaterThanOrEqual(ZOOM_MIN);
    expect(clampZoom(0)).toBe(1);
    expect(clampZoom(999)).toBe(ZOOM_MAX);
    expect(ZOOM_MIN).toBe(0.05);
  });

  it("composes Fit sheet paper-fit with relative user zoom", () => {
    expect(composeSheetZoom(0.6, 1)).toBeCloseTo(0.6, 4);
    expect(composeSheetZoom(0.6, 2)).toBeCloseTo(1.2, 4);
    expect(composeSheetZoom(0.6, 0.1)).toBeGreaterThanOrEqual(ZOOM_MIN);
    expect(composeSheetZoom(1, ZOOM_MAX)).toBe(ZOOM_MAX);
  });

  it("keyboard +/- steps match the ribbon and clamp at both ends", () => {
    // zoomByKeyStep was imported here but never asserted, so the keyboard zoom
    // path had no coverage at all.
    expect(zoomByKeyStep(1, 1)).toBe(zoomByRibbonDelta(1, 1));
    expect(zoomByKeyStep(1, -1)).toBe(zoomByRibbonDelta(1, -1));
    expect(zoomByKeyStep(1, 1)).toBeGreaterThan(1);
    expect(zoomByKeyStep(1, -1)).toBeLessThan(1);
    expect(zoomByKeyStep(ZOOM_MAX, 1)).toBe(ZOOM_MAX);
    expect(zoomByKeyStep(ZOOM_MIN, -1)).toBe(ZOOM_MIN);
  });
});
