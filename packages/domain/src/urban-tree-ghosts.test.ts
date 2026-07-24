import { describe, expect, it } from "vitest";
import {
  canopyRadiusToGlyphScale,
  urbanTreesToExistGhosts,
} from "./urban-tree-ghosts";

describe("canopyRadiusToGlyphScale", () => {
  it("defaults to 1 without radius", () => {
    expect(canopyRadiusToGlyphScale(null)).toBe(1);
  });

  it("scales with canopy radius", () => {
    expect(canopyRadiusToGlyphScale(6)).toBeCloseTo(1, 5);
    expect(canopyRadiusToGlyphScale(12)).toBeGreaterThan(1);
    expect(canopyRadiusToGlyphScale(2)).toBeLessThan(1);
  });
});

describe("urbanTreesToExistGhosts", () => {
  it("maps canvas metres to exist ghosts without inventing DBH", () => {
    const ghosts = urbanTreesToExistGhosts({
      trees: [
        {
          x: 10,
          y: 20,
          canopy_radius_m: 5,
          height_m: 12,
          label: "Plane",
        },
      ],
      toPct: (pt) => ({ x: pt.x * 2, y: pt.y * 2 }),
    });
    expect(ghosts).toHaveLength(1);
    expect(ghosts[0]!.symbol_id).toBe("existing-tree-retain");
    expect(ghosts[0]!.x_pct).toBe(20);
    expect(ghosts[0]!.y_pct).toBe(40);
    expect(ghosts[0]!.reason).toContain("DBH");
    expect(ghosts[0]!.reason).not.toMatch(/dbh\s*=/i);
  });
});
