import { describe, expect, it } from "vitest";
import {
  ZOOM_MAX,
  ZOOM_MIN,
  clampZoom,
  zoomByKeyStep,
  zoomByRibbonDelta,
  zoomFromWheel,
} from "./canvasZoom";

describe("canvasZoom", () => {
  it("allows deep zoom past the old 2.2 ceiling", () => {
    let z = 1;
    for (let i = 0; i < 40; i++) z = zoomByRibbonDelta(z, 0.1);
    expect(z).toBeGreaterThan(2.2);
    expect(z).toBeLessThanOrEqual(ZOOM_MAX);
  });

  it("refuses to shrink the parchment below board-fill (no postage stamp)", () => {
    let z = 1;
    for (let i = 0; i < 40; i++) z = zoomByRibbonDelta(z, -0.1);
    expect(z).toBe(ZOOM_MIN);
    expect(zoomFromWheel(1, 400)).toBe(ZOOM_MIN);
    expect(clampZoom(0.05)).toBe(ZOOM_MIN);
  });

  it("wheel zooms smoothly and clamps", () => {
    expect(zoomFromWheel(1, -400)).toBeGreaterThan(1);
    expect(zoomFromWheel(2, 400)).toBeLessThan(2);
    expect(zoomFromWheel(2, 400)).toBeGreaterThanOrEqual(ZOOM_MIN);
    expect(clampZoom(0)).toBe(1);
    expect(clampZoom(999)).toBe(ZOOM_MAX);
  });

  it("keyboard steps match ribbon geometry", () => {
    expect(zoomByKeyStep(1, 1)).toBe(zoomByRibbonDelta(1, 0.1));
    expect(zoomByKeyStep(1, -1)).toBe(zoomByRibbonDelta(1, -0.1));
  });
});
