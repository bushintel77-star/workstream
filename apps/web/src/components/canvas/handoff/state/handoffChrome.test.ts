import { describe, expect, it } from "vitest";
import { resolveHandoffChrome } from "./handoffChrome";

const base = {
  tool: "pan" as const,
  focusOn: false,
  frameOn: false,
  clientView: false,
};

describe("resolveHandoffChrome", () => {
  it("hides Live BOM and floating consumer docks in Sketch", () => {
    const c = resolveHandoffChrome({ ...base, mode: "sketch" });
    expect(c.liveBom).toBe(false);
    expect(c.utilityDrawer).toBe(false);
    expect(c.horizon).toBe(false);
    expect(c.aiCoach).toBe(false);
    expect(c.sunGrowth).toBe(false);
  });

  it("hides Live BOM in Survey", () => {
    const c = resolveHandoffChrome({ ...base, mode: "survey" });
    expect(c.liveBom).toBe(false);
    expect(c.utilityDrawer).toBe(false);
    expect(c.sunGrowth).toBe(false);
  });

  it("keeps utility hub in CAD without floating coach/sun/trade", () => {
    const c = resolveHandoffChrome({ ...base, mode: "cad" });
    expect(c.liveBom).toBe(true);
    expect(c.utilityDrawer).toBe(true);
    expect(c.horizon).toBe(false);
    expect(c.volumeIsolith).toBe(false);
    expect(c.tradeMargin).toBe(false);
    expect(c.aiCoach).toBe(false);
    expect(c.sunGrowth).toBe(false);
  });

  it("diets Cad chrome while AI ghosts are pending", () => {
    const c = resolveHandoffChrome({
      ...base,
      mode: "cad",
      pendingGhosts: 11,
    });
    expect(c.sunGrowth).toBe(false);
    expect(c.horizon).toBe(false);
    expect(c.volumeIsolith).toBe(false);
    expect(c.tradeMargin).toBe(false);
    expect(c.floraRing).toBe(false);
    expect(c.utilityDrawer).toBe(false);
  });

  it("collapses utility while Trace is armed", () => {
    const c = resolveHandoffChrome({
      ...base,
      mode: "cad",
      tool: "trace",
    });
    expect(c.collapseUtility).toBe(true);
    expect(c.horizon).toBe(false);
    expect(c.selectionRing).toBe(false);
  });

  it("Quote keeps estimate path without draw chrome", () => {
    const c = resolveHandoffChrome({ ...base, mode: "quote" });
    expect(c.liveBom).toBe(true);
    expect(c.utilityDrawer).toBe(false);
    expect(c.drawTools).toBe(false);
    expect(c.horizon).toBe(false);
  });

  it("Share hides Live BOM and draw tools", () => {
    const c = resolveHandoffChrome({ ...base, mode: "share" });
    expect(c.liveBom).toBe(false);
    expect(c.utilityDrawer).toBe(false);
    expect(c.drawTools).toBe(false);
    expect(c.horizon).toBe(false);
    expect(c.aiCoach).toBe(false);
  });

  it("Fit sheet is paper-only — no Isolith, trade, or ribbon", () => {
    const c = resolveHandoffChrome({
      ...base,
      mode: "cad",
      frameOn: true,
    });
    expect(c.utilityDrawer).toBe(false);
    expect(c.horizon).toBe(false);
    expect(c.aiCoach).toBe(false);
    expect(c.volumeIsolith).toBe(false);
    expect(c.tradeMargin).toBe(false);
    expect(c.ambientRibbon).toBe(false);
  });

  it("Focus mode clears ambient chrome for a single composition", () => {
    const c = resolveHandoffChrome({
      ...base,
      mode: "cad",
      focusOn: true,
    });
    expect(c.ambientRibbon).toBe(false);
    expect(c.volumeIsolith).toBe(false);
    expect(c.floraRing).toBe(false);
  });

  it("Stage 1 title overlay stays monograph — no floating coach", () => {
    const c = resolveHandoffChrome({
      ...base,
      mode: "cad",
      foundationCleanse: true,
    });
    expect(c.volumeIsolith).toBe(false);
    expect(c.tradeMargin).toBe(false);
    expect(c.aiCoach).toBe(false);
    expect(c.floraRing).toBe(false);
  });
});
