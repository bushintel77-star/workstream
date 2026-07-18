import { describe, expect, it } from "vitest";
import { buildFirstRunSeedPlacements } from "./first-run-seed";

describe("first-run seed", () => {
  it("places lawn, paving, and a tree for starter massing", () => {
    let n = 0;
    const placements = buildFirstRunSeedPlacements(
      () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`,
    );
    expect(placements).toHaveLength(3);
    expect(placements.map((p) => p.symbol_id).sort()).toEqual([
      "bluestone-paver",
      "existing-tree-retain",
      "lawn-turf",
    ]);
  });
});
