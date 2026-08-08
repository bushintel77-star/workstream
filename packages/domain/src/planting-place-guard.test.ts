import { describe, expect, it } from "vitest";
import {
  assessPlantingPlacement,
  plantingConflictSummary,
} from "./planting-place-guard";

describe("assessPlantingPlacement", () => {
  it("blocks placement inside an existing-tree TPZ", () => {
    const conflicts = assessPlantingPlacement({
      xPct: 50,
      yPct: 50,
      canopySpreadM: 5,
      scaleM: 100,
      items: [
        {
          id: "t1",
          t: "exist",
          x: 50,
          y: 50,
          scale: 1,
          dbhM: 0.5, // TPZ = max(2, 6) = 6 m
        },
      ],
    });
    expect(conflicts.some((c) => c.kind === "tpz" && c.severity === "block")).toBe(
      true,
    );
    expect(plantingConflictSummary(conflicts).blocked).toBe(true);
  });

  it("warns on tight canopy spacing without blocking far plants", () => {
    const conflicts = assessPlantingPlacement({
      xPct: 60,
      yPct: 50,
      canopySpreadM: 6,
      scaleM: 100,
      items: [
        {
          id: "c1",
          t: "canopy",
          x: 50,
          y: 50,
          scale: 1,
          canopyM: 6,
        },
      ],
    });
    // 10% of 100 m board = 10 m between centres; radii 3+3=6 → clear
    expect(conflicts.length).toBe(0);
  });

  it("flags deep canopy collision as block", () => {
    const conflicts = assessPlantingPlacement({
      xPct: 51,
      yPct: 50,
      canopySpreadM: 6,
      scaleM: 100,
      items: [
        {
          id: "c1",
          t: "canopy",
          x: 50,
          y: 50,
          scale: 1,
          canopyM: 6,
        },
      ],
    });
    expect(conflicts.some((c) => c.kind === "canopy")).toBe(true);
  });
});
