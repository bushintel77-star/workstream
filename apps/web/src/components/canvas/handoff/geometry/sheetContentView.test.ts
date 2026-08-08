import { describe, expect, it } from "vitest";
import { plotBoxFor, sheetBoxFor, titlePanelWidth } from "./sheetBox";
import {
  SHEET_PAPER_WIDTH_MM,
  SHEET_REF_DENOM,
  SHEET_SCALE_STEPS,
  sheetContentView,
  sheetMmPerPx,
  snapDenomUp,
  trueZoomForDenom,
} from "./sheetContentView";

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
  const scaleM = 110;
  const sheet = sheetBoxFor(boardW, boardH, "a3");
  const titleW = titlePanelWidth(sheet.boxW);
  const plot = plotBoxFor(sheet, { titleW });
  const base = {
    boundary: LOT,
    building: HOUSE,
    scaleM,
    boardW,
    boardH,
    plot,
    paper: "a3" as const,
    sheetW: sheet.boxW,
  };

  it("zoom is proportional to 1:N (half the denom, twice the size)", () => {
    const at100 = sheetContentView({ ...base, scaleDenom: 100 });
    const at50 = sheetContentView({ ...base, scaleDenom: 50 });
    const at200 = sheetContentView({ ...base, scaleDenom: 200 });
    expect(at100.zoom).toBeGreaterThan(0.05);
    expect(at50.zoom).toBeCloseTo(at100.zoom * 2, 2);
    expect(at200.zoom).toBeCloseTo(at100.zoom * 0.5, 2);
    expect(SHEET_REF_DENOM).toBe(100);
  });

  it("renders a TRUE 1:N — printed mm of a known span matches the label", () => {
    const denom = 200;
    const v = sheetContentView({ ...base, scaleDenom: denom });
    // LOT spans 60% of the board → real-world metres via scaleM calibration.
    const spanM = (60 / 100) * scaleM;
    const spanPxOnScreen = (60 / 100) * boardW * v.zoom;
    const mmPerPx = SHEET_PAPER_WIDTH_MM.a3 / sheet.boxW;
    const printedMm = spanPxOnScreen * mmPerPx;
    expect(printedMm).toBeCloseTo((spanM * 1000) / denom, 0);
  });

  it("autoDenom fits the lot inside the plot; one step finer would not", () => {
    const v = sheetContentView({ ...base, scaleDenom: 100 });
    expect(SHEET_SCALE_STEPS).toContain(v.autoDenom);
    expect(v.autoDenom).toBeGreaterThanOrEqual(v.rawDenom - 1e-6);
    // At autoDenom the lot must sit inside the plot.
    const atAuto = sheetContentView({ ...base, scaleDenom: v.autoDenom });
    const lotWPx = (60 / 100) * boardW * atAuto.zoom;
    const lotHPx = (60 / 100) * boardH * atAuto.zoom;
    expect(lotWPx).toBeLessThanOrEqual(plot.boxW + 0.5);
    expect(lotHPx).toBeLessThanOrEqual(plot.boxH + 0.5);
    // Auto is the tightest honest ladder fit — the next finer step overflows.
    const idx = SHEET_SCALE_STEPS.indexOf(
      v.autoDenom as (typeof SHEET_SCALE_STEPS)[number],
    );
    if (idx > 0) {
      const finer = SHEET_SCALE_STEPS[idx - 1]!;
      expect(finer).toBeLessThan(v.rawDenom);
    }
  });

  it("A4 auto scale is coarser or equal to A3 for the same lot", () => {
    const a4Sheet = sheetBoxFor(boardW, boardH, "a4");
    const a4Plot = plotBoxFor(a4Sheet, { titleW: 0, elevH: 168 });
    const a3 = sheetContentView({ ...base, scaleDenom: 100 });
    const a4 = sheetContentView({
      ...base,
      plot: a4Plot,
      paper: "a4",
      sheetW: a4Sheet.boxW,
      scaleDenom: 100,
    });
    expect(a4.autoDenom).toBeGreaterThanOrEqual(a3.autoDenom);
  });

  it("centres the lot on the A3/A4 plot via pan after scale", () => {
    const v = sheetContentView({
      ...base,
      boundary: SKEWED_LOT,
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

  it("keeps focus on the lot centre", () => {
    const v = sheetContentView({ ...base, scaleDenom: 100 });
    expect(v.focusX).toBeCloseTo(50, 0);
    expect(v.focusY).toBeCloseTo(50, 0);
  });
});

describe("snapDenomUp / trueZoomForDenom / sheetMmPerPx", () => {
  it("snaps up the ladder and clamps at the coarsest step", () => {
    expect(snapDenomUp(40)).toBe(50);
    expect(snapDenomUp(50)).toBe(50);
    expect(snapDenomUp(101)).toBe(150);
    expect(snapDenomUp(153)).toBe(200);
    expect(snapDenomUp(260)).toBe(300);
    expect(snapDenomUp(320)).toBe(400);
    expect(snapDenomUp(9000)).toBe(500);
  });

  it("true zoom halves when denom doubles and is calibration-only", () => {
    const argsAt = (denom: number) => ({
      scaleM: 110,
      boardW: 1200,
      mmPerPx: sheetMmPerPx("a3", 1000),
      denom,
    });
    const z100 = trueZoomForDenom(argsAt(100));
    const z200 = trueZoomForDenom(argsAt(200));
    expect(z200).toBeCloseTo(z100 / 2, 6);
  });
});
