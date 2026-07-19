import { describe, expect, it } from "vitest";
import { snapDragPct, snapPointPctToGrid } from "./canvas-snap";

describe("snapPointPctToGrid", () => {
  it("snaps to 2.5% grid", () => {
    expect(snapPointPctToGrid(11, 13, 2.5, true)).toEqual({
      x_pct: 10,
      y_pct: 12.5,
    });
  });
});

describe("snapDragPct", () => {
  it("snaps to nearby placement axes", () => {
    const r = snapDragPct(
      50.8,
      30.2,
      [
        { id: "a", x_pct: 50, y_pct: 10 },
        { id: "b", x_pct: 20, y_pct: 30 },
      ],
      1.25,
    );
    expect(r.x_pct).toBe(50);
    expect(r.y_pct).toBe(30);
    expect(r.guides.some((g) => g.axis === "x" && g.pct === 50)).toBe(true);
    expect(r.guides.some((g) => g.axis === "y" && g.pct === 30)).toBe(true);
  });

  it("leaves point unsnapped when far from others", () => {
    const r = snapDragPct(40, 40, [{ id: "a", x_pct: 10, y_pct: 10 }], 1);
    expect(r.x_pct).toBe(40);
    expect(r.y_pct).toBe(40);
    expect(r.guides).toEqual([]);
  });
});
