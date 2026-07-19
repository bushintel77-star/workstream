import { describe, expect, it } from "vitest";
import { paperAspect, sheetBoxFor } from "./sheetBox";

describe("sheetBoxFor", () => {
  it("fits landscape A3 into a wide board and centres it", () => {
    const box = sheetBoxFor(1200, 800, "a3");
    expect(box.boxW / box.boxH).toBeCloseTo(420 / 297, 3);
    expect(box.boxLeft + box.boxW / 2).toBeCloseTo(600, 0);
    expect(box.boxTop + box.boxH / 2).toBeCloseTo(400, 0);
    expect(box.boxW).toBeLessThanOrEqual(1200 - 48);
    expect(box.boxH).toBeLessThanOrEqual(800 - 48);
  });

  it("fits portrait A4 narrower than A3 on the same board", () => {
    const a3 = sheetBoxFor(1200, 800, "a3");
    const a4 = sheetBoxFor(1200, 800, "a4");
    expect(a4.boxW).toBeLessThan(a3.boxW);
    expect(a4.boxW / a4.boxH).toBeCloseTo(210 / 297, 3);
  });

  it("exposes ISO aspects", () => {
    expect(paperAspect("a3")).toBeCloseTo(420 / 297, 5);
    expect(paperAspect("a4")).toBeCloseTo(210 / 297, 5);
  });
});
