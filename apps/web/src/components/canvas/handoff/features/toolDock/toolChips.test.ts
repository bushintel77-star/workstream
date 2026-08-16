import { describe, expect, it } from "vitest";
import {
  buildToolChips,
  toolChipActive,
  toolChipTestId,
} from "./toolChips";

describe("buildToolChips", () => {
  it("includes primary tools and grid trail", () => {
    const chips = buildToolChips(false);
    // buildToolChips(false) → mode "sketch", no survey extras.
    // Sketch mode allows: select, add, paint, path, zone, measure, grid.
    expect(chips.map((c) => c.id)).toEqual([
      "select",
      "add",
      "paint",
      "zone",
      "path",
      "measure",
      "grid",
    ]);
    expect(chips.at(-1)?.trail).toBe(true);
  });

  it("appends survey service tools when authoring", () => {
    // buildToolChips(true) → surveyServicesAuthoring=true, mode defaults to "sketch".
    // Survey extras (calib/level/service) are only appended in survey mode, so
    // test with explicit survey mode + authoring flag.
    const chips = buildToolChips("survey", true);
    expect(chips.some((c) => c.id === "service")).toBe(true);
  });
});

describe("toolChipActive", () => {
  it("marks the armed tool", () => {
    expect(
      toolChipActive(
        { id: "trace", label: "Trace", icon: "✎" },
        { tool: "trace", locked: false, gridOn: false },
      ),
    ).toBe(true);
  });

  it("marks grid from gridOn, not tool", () => {
    expect(
      toolChipActive(
        { id: "grid", label: "Grid", icon: "▦" },
        { tool: "select", locked: false, gridOn: true },
      ),
    ).toBe(true);
  });
});

describe("toolChipTestId", () => {
  it("keeps measure id stable for e2e", () => {
    expect(toolChipTestId({ id: "measure", label: "Measure", icon: "⟋" })).toBe(
      "canvas-tool-measure",
    );
  });
});
