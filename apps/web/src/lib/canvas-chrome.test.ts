import { describe, expect, it } from "vitest";
import { resolveCanvasChrome } from "./canvas-chrome";

const base = {
  titleRevealActive: false,
  hasSketchBundle: true,
  cadDrawArmed: false,
};

describe("resolveCanvasChrome", () => {
  it("hides all chrome during title reveal", () => {
    const c = resolveCanvasChrome({
      ...base,
      mode: "survey",
      titleRevealActive: true,
    });
    expect(c.surveyDock).toBe(false);
    expect(c.liveBom).toBe(false);
    expect(c.walk).toBe(false);
  });

  it("Survey: dock + boundary, no BOM or Walk", () => {
    const c = resolveCanvasChrome({ ...base, mode: "survey" });
    expect(c.surveyDock).toBe(true);
    expect(c.boundary).toBe(true);
    expect(c.liveBom).toBe(false);
    expect(c.walk).toBe(false);
    expect(c.sketchDock).toBe(false);
  });

  it("Sketch: paint dock + Instant Planner; no Walk / CAD dock", () => {
    const c = resolveCanvasChrome({ ...base, mode: "sketch" });
    expect(c.sketchDock).toBe(true);
    expect(c.liveBom).toBe(true);
    expect(c.walk).toBe(false);
    expect(c.cadDock).toBe(false);
    expect(c.quoteDock).toBe(false);
  });

  it("Sketch without bundle hides sketch dock", () => {
    const c = resolveCanvasChrome({
      ...base,
      mode: "sketch",
      hasSketchBundle: false,
    });
    expect(c.sketchDock).toBe(false);
  });

  it("CAD: dock + compact BOM + Walk; boundary until line armed", () => {
    const idle = resolveCanvasChrome({ ...base, mode: "cad" });
    expect(idle.cadDock).toBe(true);
    expect(idle.liveBom).toBe(true);
    expect(idle.walk).toBe(true);
    expect(idle.boundary).toBe(true);

    const drawing = resolveCanvasChrome({
      ...base,
      mode: "cad",
      cadDrawArmed: true,
    });
    expect(drawing.boundary).toBe(false);
  });

  it("Quote: BOM + Walk; no survey/sketch/cad docks", () => {
    const c = resolveCanvasChrome({ ...base, mode: "quote" });
    expect(c.quoteDock).toBe(true);
    expect(c.liveBom).toBe(true);
    expect(c.walk).toBe(true);
    expect(c.cadDock).toBe(false);
    expect(c.surveyDock).toBe(false);
  });

  it("Share: Walk + share dock; no Live BOM", () => {
    const c = resolveCanvasChrome({ ...base, mode: "share" });
    expect(c.shareDock).toBe(true);
    expect(c.walk).toBe(true);
    expect(c.liveBom).toBe(false);
    expect(c.quoteDock).toBe(false);
  });
});
