import { describe, expect, it } from "vitest";
import {
  proposeIrrigationAssist,
  proposeLightingAssist,
  summariseIrrigationAssist,
  summariseLightingAssist,
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

  it("summarises irrigation coverage and indicative cost", () => {
    const zones = proposeIrrigationAssist({
      openAreaM2: 140,
      idFactory: (() => {
        let n = 0;
        return () => `z-${++n}`;
      })(),
    });
    const summary = summariseIrrigationAssist(zones, 140);
    expect(summary.zone_count).toBe(2);
    expect(summary.open_area_m2).toBe(140);
    expect(summary.cost_aud).toBeGreaterThan(0);
    expect(summary.label).toMatch(/drip zone/i);
  });

  it("summarises lighting fixture cost", () => {
    const summary = summariseLightingAssist([
      {
        id: "l1",
        fixture: "Brass uplight",
        x_pct: 40,
        y_pct: 40,
        count: 2,
      },
    ]);
    expect(summary.fixture_count).toBe(2);
    expect(summary.cost_aud).toBeGreaterThan(0);
  });
});
