import { describe, expect, it } from "vitest";
import { resolveHandoffChrome } from "./handoffChrome";

const base = {
  tool: "pan" as const,
  focusOn: false,
  frameOn: false,
  clientView: false,
};

describe("resolveHandoffChrome", () => {
  it("hides Live BOM and utility in Sketch", () => {
    const c = resolveHandoffChrome({ ...base, mode: "sketch" });
    expect(c.liveBom).toBe(false);
    expect(c.utilityDrawer).toBe(false);
    expect(c.horizon).toBe(false);
    expect(c.aiCoach).toBe(true);
  });

  it("hides Live BOM in Survey", () => {
    const c = resolveHandoffChrome({ ...base, mode: "survey" });
    expect(c.liveBom).toBe(false);
    expect(c.utilityDrawer).toBe(false);
    expect(c.sunGrowth).toBe(false);
  });

  it("allows floating Live BOM and horizon in CAD", () => {
    const c = resolveHandoffChrome({ ...base, mode: "cad" });
    expect(c.liveBom).toBe(true);
    expect(c.utilityDrawer).toBe(true);
    expect(c.horizon).toBe(true);
    expect(c.volumeIsolith).toBe(true);
    expect(c.tradeMargin).toBe(true);
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
    expect(c.volumeIsolith).toBe(true);
    expect(c.tradeMargin).toBe(true);
  });

  it("hides Isolith and trade margin in Sketch", () => {
    const c = resolveHandoffChrome({ ...base, mode: "sketch" });
    expect(c.volumeIsolith).toBe(false);
    expect(c.tradeMargin).toBe(false);
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

  it("Fit sheet freezes floating cost chrome but keeps Isolith", () => {
    const c = resolveHandoffChrome({
      ...base,
      mode: "cad",
      frameOn: true,
    });
    expect(c.utilityDrawer).toBe(false);
    expect(c.horizon).toBe(false);
    expect(c.aiCoach).toBe(false);
    expect(c.volumeIsolith).toBe(true);
    expect(c.tradeMargin).toBe(true);
  });

  it("Stage 1 foundation cleanse suppresses AI and trade chrome", () => {
    const c = resolveHandoffChrome({
      ...base,
      mode: "survey",
      foundationCleanse: true,
    });
    expect(c.floraRing).toBe(false);
    expect(c.volumeIsolith).toBe(false);
    expect(c.tradeMargin).toBe(false);
    expect(c.horizon).toBe(false);
    expect(c.sunGrowth).toBe(false);
    expect(c.aiCoach).toBe(true);
  });
});
