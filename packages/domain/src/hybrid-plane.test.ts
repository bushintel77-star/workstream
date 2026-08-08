import { describe, expect, it } from "vitest";
import {
  hybridPlaneForItem,
  itemFootprintMetres,
  localMToPct,
  pctToLocalM,
} from "./hybrid-plane";

describe("hybrid-plane", () => {
  it("round-trips pct ↔ local metres at scale 100", () => {
    const m = pctToLocalM(25, 50, 100, 1);
    expect(m.x_m).toBeCloseTo(25, 8);
    expect(m.y_m).toBeCloseTo(50, 8);
    const back = localMToPct(m.x_m, m.y_m, 100, 1);
    expect(back.x_pct).toBeCloseTo(25, 8);
    expect(back.y_pct).toBeCloseTo(50, 8);
  });

  it("rect footprint yields area and true perimeter", () => {
    // 80×40 px at scale 1 → 2×1 m
    const foot = itemFootprintMetres({
      wPx: 80,
      hPx: 40,
      scale: 1,
      areaKind: "rect",
    });
    expect(foot.width_m).toBeCloseTo(2, 8);
    expect(foot.height_m).toBeCloseTo(1, 8);
    expect(foot.area_m2).toBeCloseTo(2, 8);
    expect(foot.perimeter_m).toBeCloseTo(6, 8);
  });

  it("hybridPlaneForItem exposes dual canvas + physical planes", () => {
    const h = hybridPlaneForItem({
      x_pct: 40,
      y_pct: 60,
      wPx: 110,
      hPx: 80,
      scale: 1,
      scaleM: 110,
      areaKind: "rect",
    });
    expect(h.canvas.x_pct).toBe(40);
    expect(h.physical.origin_m.x_m).toBeCloseTo(44, 5);
    expect(h.physical.area_m2).toBeCloseTo((110 / 40) * (80 / 40), 5);
    expect(h.physical.perimeter_m).toBeCloseTo(
      2 * (110 / 40 + 80 / 40),
      5,
    );
  });
});
