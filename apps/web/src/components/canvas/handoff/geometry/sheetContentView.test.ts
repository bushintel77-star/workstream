import { describe, expect, it } from "vitest";
import { plotBoxFor, sheetBoxFor } from "./sheetBox";
import { SHEET_REF_DENOM, sheetContentView } from "./sheetContentView";

const LOT = [
  { x: 20, y: 20 },
  { x: 80, y: 20 },
  { x: 80, y: 80 },
  { x: 20, y: 80 },
];

const HOUSE = [
  { x: 35, y: 35 },
  { x: 65, y: 35 },
  { x: 65, y: 55 },
  { x: 35, y: 55 },
];

describe("sheetContentView", () => {
  const boardW = 1200;
  const boardH = 800;
  const sheet = sheetBoxFor(boardW, boardH, "a3");
  const plot = plotBoxFor(sheet, { titleW: 220 });

  it("fits remnant into the plot and scales with 1:N", () => {
    const at100 = sheetContentView({
      boundary: LOT,
      building: HOUSE,
      boardW,
      boardH,
      plot,
      scaleDenom: 100,
    });
    const at50 = sheetContentView({
      boundary: LOT,
      building: HOUSE,
      boardW,
      boardH,
      plot,
      scaleDenom: 50,
    });
    const at200 = sheetContentView({
      boundary: LOT,
      building: HOUSE,
      boardW,
      boardH,
      plot,
      scaleDenom: 200,
    });

    expect(at100.zoom).toBeGreaterThan(0.2);
    expect(at50.zoom).toBeCloseTo(at100.zoom * 2, 2);
    expect(at200.zoom).toBeCloseTo(at100.zoom * 0.5, 2);
    expect(SHEET_REF_DENOM).toBe(100);
  });

  it("keeps focus on the remnant / plot centre", () => {
    const v = sheetContentView({
      boundary: LOT,
      building: HOUSE,
      boardW,
      boardH,
      plot,
      scaleDenom: 100,
    });
    expect(v.focusX).toBeGreaterThan(20);
    expect(v.focusX).toBeLessThan(80);
    expect(v.focusY).toBeGreaterThan(20);
    expect(v.focusY).toBeLessThan(80);
  });
});
