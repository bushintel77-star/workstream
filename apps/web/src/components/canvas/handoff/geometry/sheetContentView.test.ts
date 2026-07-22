import { describe, expect, it } from "vitest";
import { plotBoxFor, sheetBoxFor, titlePanelWidth } from "./sheetBox";
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

/** Skewed lot sitting off-centre — must still land inside the plot. */
const SKEWED_LOT = [
  { x: 48, y: 28 },
  { x: 72, y: 32 },
  { x: 68, y: 58 },
  { x: 44, y: 54 },
];

describe("sheetContentView", () => {
  const boardW = 1200;
  const boardH = 800;
  const sheet = sheetBoxFor(boardW, boardH, "a3");
  const titleW = titlePanelWidth(sheet.boxW);
  const plot = plotBoxFor(sheet, { titleW });

  it("fits the title boundary into the plot and scales with 1:N", () => {
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

  it("centres the lot on the A3/A4 plot via pan after scale", () => {
    const v = sheetContentView({
      boundary: SKEWED_LOT,
      building: HOUSE,
      boardW,
      boardH,
      plot,
      scaleDenom: 100,
    });
    const plotCx = ((plot.boxLeft + plot.boxW / 2) / boardW) * 100;
    const plotCy = ((plot.boxTop + plot.boxH / 2) / boardH) * 100;
    // After scale-around-focus, translate moves focus → plot centre.
    const landedX = v.focusX + (v.panX / boardW) * 100;
    const landedY = v.focusY + (v.panY / boardH) * 100;
    expect(landedX).toBeCloseTo(plotCx, 1);
    expect(landedY).toBeCloseTo(plotCy, 1);
  });

  it("fits the full lot — not a zoomed-in outdoor remnant that clips the boundary", () => {
    const v = sheetContentView({
      boundary: LOT,
      building: HOUSE,
      boardW,
      boardH,
      plot,
      scaleDenom: 100,
      pad: 0.8,
    });
    // Lot spans 60% of the board; plot is smaller. Zoom must bring the
    // 60%-span lot inside the plot width (with pad), not blow past it.
    const plotWPct = (plot.boxW / boardW) * 100;
    const lotSpan = 60;
    const maxZoom = (plotWPct * 0.8) / lotSpan;
    expect(v.zoom).toBeLessThanOrEqual(maxZoom + 0.05);
  });

  it("keeps focus on the lot centre", () => {
    const v = sheetContentView({
      boundary: LOT,
      building: HOUSE,
      boardW,
      boardH,
      plot,
      scaleDenom: 100,
    });
    expect(v.focusX).toBeCloseTo(50, 0);
    expect(v.focusY).toBeCloseTo(50, 0);
  });

  it("fits A4 portrait plot as well as A3 landscape", () => {
    const a4 = sheetBoxFor(boardW, boardH, "a4");
    const a4Plot = plotBoxFor(a4, { titleW: titlePanelWidth(a4.boxW) });
    const v = sheetContentView({
      boundary: LOT,
      building: HOUSE,
      boardW,
      boardH,
      plot: a4Plot,
      scaleDenom: 100,
    });
    const plotCx = ((a4Plot.boxLeft + a4Plot.boxW / 2) / boardW) * 100;
    const plotCy = ((a4Plot.boxTop + a4Plot.boxH / 2) / boardH) * 100;
    expect(v.focusX + (v.panX / boardW) * 100).toBeCloseTo(plotCx, 1);
    expect(v.focusY + (v.panY / boardH) * 100).toBeCloseTo(plotCy, 1);
    expect(v.zoom).toBeGreaterThan(0.05);
  });
});
