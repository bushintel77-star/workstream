import { describe, expect, it } from "vitest";
import {
  buildToolChips,
  toolChipActive,
  toolChipTestId,
} from "./toolChips";

describe("buildToolChips", () => {
  it("includes primary tools and grid trail", () => {
    const chips = buildToolChips(false);
    expect(chips.map((c) => c.id)).toEqual([
      "trace",
      "select",
      "add",
      "paint",
      "zone",
      "measure",
      "lock",
      "grid",
    ]);
    expect(chips.at(-1)?.trail).toBe(true);
  });

  it("appends survey service tools when authoring", () => {
    const chips = buildToolChips(true);
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
