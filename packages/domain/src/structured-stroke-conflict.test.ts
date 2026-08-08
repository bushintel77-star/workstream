import { describe, expect, it } from "vitest";
import { assessStructuredStrokeConflicts } from "./structured-stroke-conflict";

describe("assessStructuredStrokeConflicts", () => {
  it("flags ditch near tree root zone", () => {
    const conflicts = assessStructuredStrokeConflicts(
      [
        { x_pct: 40, y_pct: 40 },
        { x_pct: 42, y_pct: 40 },
      ],
      [
        {
          id: "t1",
          layer: "softscape",
          label: "Feature tree",
          symbol_id: "tree-canopy",
          source: "placement",
          area_m2: 0,
          length_m: 0,
          count: 1,
          x_pct: 40,
          y_pct: 40,
          root_radius_m: 3,
        },
      ],
      "ditch",
    );
    expect(conflicts[0]?.severity).toBe("critical");
  });
});
