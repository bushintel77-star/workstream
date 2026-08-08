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

  it("prints canopy DIAMETER (spread), not the radius mislabelled as canopy", () => {
    // canopy_radius_m = 4.3 -> 8.6 m across. "~4.3 m canopy" reads as a 4.3 m
    // tree on a council drawing and understates the canopy by 2×.
    const ghosts = urbanTreesToExistGhosts({
      trees: [{ x: 0, y: 0, canopy_radius_m: 4.3, height_m: 10 }],
      toPct: (pt) => ({ x: pt.x, y: pt.y }),
    });
    expect(ghosts[0]!.reason).toContain("~8.6 m canopy spread");
    expect(ghosts[0]!.reason).not.toMatch(/~4\.3 m canopy$/);
  });

  it("carries the Vicmap LiDAR height onto the placement for the elevation", () => {
    const ghosts = urbanTreesToExistGhosts({
      trees: [{ x: 0, y: 0, canopy_radius_m: 4.3, height_m: 10.4 }],
      toPct: (pt) => ({ x: pt.x, y: pt.y }),
    });
    expect(ghosts[0]!.heightM).toBe(10.4);
    // Plan label uses toFixed(1) so it matches the elevation callout exactly.
    expect(ghosts[0]!.reason).toContain("~10.4 m high");
  });

  it("flags a physically impossible height (1 m tree, 8.6 m canopy)", () => {
    // Vicmap Tree Urban was trained on trees > ~2 m. A 1 m height carrying an
    // 8.6 m canopy is a LiDAR artifact or a shrub — never silently rendered as
    // a plausible tree on a drawing reaching council or an arborist.
    const ghosts = urbanTreesToExistGhosts({
      trees: [{ x: 0, y: 0, canopy_radius_m: 4.3, height_m: 1 }],
      toPct: (pt) => ({ x: pt.x, y: pt.y }),
    });
    expect(ghosts[0]!.reason).toContain("height suspect");
    expect(ghosts[0]!.heightM).toBe(1);
  });

  it("flags a height below the Vicmap training threshold even without a canopy", () => {
    const ghosts = urbanTreesToExistGhosts({
      trees: [{ x: 0, y: 0, canopy_radius_m: null, height_m: 1.5 }],
      toPct: (pt) => ({ x: pt.x, y: pt.y }),
    });
    expect(ghosts[0]!.reason).toContain("height suspect");
  });

  it("does not flag a plausible mature spreading tree", () => {
    // 8 m tall, 14 m canopy spread (1.75x) — a real mature fig.
    const ghosts = urbanTreesToExistGhosts({
      trees: [{ x: 0, y: 0, canopy_radius_m: 7, height_m: 8 }],
      toPct: (pt) => ({ x: pt.x, y: pt.y }),
    });
    expect(ghosts[0]!.reason).not.toMatch(/height suspect/i);
  });
});
