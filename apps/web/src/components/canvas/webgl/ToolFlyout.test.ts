import { describe, expect, it } from "vitest";
import { FLYOUT_TOOLS } from "./ToolFlyout";

/** The flyout must only render for tools with real backing state — never a
 *  dead second-tier column. This is the honest-UI contract (spec §0.1). */
describe("ToolFlyout flyout registration", () => {
  it("registers only draw + plant tools (real state-backed content)", () => {
    expect(FLYOUT_TOOLS.has("pen")).toBe(true);
    expect(FLYOUT_TOOLS.has("line")).toBe(true);
    expect(FLYOUT_TOOLS.has("spline")).toBe(true);
    expect(FLYOUT_TOOLS.has("tree")).toBe(true);
    expect(FLYOUT_TOOLS.has("bed")).toBe(true);
  });

  it("does not register tools with no real parameter surface", () => {
    // GRADE/BUILD/MEASURE tools have no genuine per-tool parameter state yet,
    // so a flyout must NOT appear (would be a dead control).
    for (const tool of ["contour", "slope", "cutfill", "mass", "path", "dim", "section"] as const) {
      expect(FLYOUT_TOOLS.has(tool)).toBe(false);
    }
  });

  it("does not register utility tiles or none", () => {
    expect(FLYOUT_TOOLS.has("layers")).toBe(false);
    expect(FLYOUT_TOOLS.has("history")).toBe(false);
    expect(FLYOUT_TOOLS.has("none")).toBe(false);
  });
});
