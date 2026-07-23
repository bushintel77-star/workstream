import { describe, expect, it } from "vitest";
import { placeSpeciesLabels, SPECIES_LABEL_MIN_PX } from "./speciesLabels";

describe("placeSpeciesLabels", () => {
  it("drops candidates below the LOD screen-px gate", () => {
    const placed = placeSpeciesLabels(
      [
        {
          id: "a",
          xPct: 40,
          yPct: 40,
          text: "Canopy · 1",
          screenPx: SPECIES_LABEL_MIN_PX - 1,
        },
      ],
      (x, y) => ({ x: x * 10, y: y * 10 }),
    );
    expect(placed).toHaveLength(0);
  });

  it("stack-offsets overlapping labels in screen space", () => {
    const placed = placeSpeciesLabels(
      [
        {
          id: "a",
          xPct: 50,
          yPct: 50,
          text: "Canopy · 1",
          screenPx: 60,
        },
        {
          id: "b",
          xPct: 50.5,
          yPct: 50.2,
          text: "Feature · 1",
          screenPx: 55,
        },
      ],
      (x, y) => ({ x: x * 10, y: y * 10 }),
    );
    expect(placed).toHaveLength(2);
    expect(placed[0]!.offsetYPx).not.toBe(placed[1]!.offsetYPx);
    const y0 = 50 * 10 + placed[0]!.offsetYPx;
    const y1 = 50.2 * 10 + placed[1]!.offsetYPx;
    expect(Math.abs(y0 - y1)).toBeGreaterThanOrEqual(14);
  });
});
