import { describe, expect, it } from "vitest";
import {
  proposeIrrigationAssist,
  proposeLightingAssist,
} from "./irrigation-assist";

describe("irrigation-assist", () => {
  it("proposes one zone for small sites, two for large", () => {
    let n = 0;
    const idFactory = () => `z-${++n}`;
    expect(
      proposeIrrigationAssist({ openAreaM2: 60, idFactory }),
    ).toHaveLength(1);
    expect(
      proposeIrrigationAssist({ openAreaM2: 140, idFactory }),
    ).toHaveLength(2);
  });

  it("places lighting near trees", () => {
    const pts = proposeLightingAssist(
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
          mature_canopy_m: 4,
        },
      ],
      () => "light-1",
    );
    expect(pts).toHaveLength(1);
    expect(pts[0]!.fixture).toMatch(/uplight/i);
  });
});
