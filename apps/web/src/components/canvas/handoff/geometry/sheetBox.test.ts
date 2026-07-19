import { describe, expect, it } from "vitest";
import {
  paperAspect,
  plotBoxFor,
  sheetBoxFor,
  titlePanelWidth,
  SHEET_OUTER_PAD,
} from "./sheetBox";

describe("sheetBoxFor", () => {
  it("fits landscape A3 into a wide board and centres it", () => {
    const box = sheetBoxFor(1200, 800, "a3");
    expect(box.boxW / box.boxH).toBeCloseTo(420 / 297, 3);
    expect(box.boxLeft + box.boxW / 2).toBeCloseTo(600, 0);
    expect(box.boxTop + box.boxH / 2).toBeCloseTo(400, 0);
    expect(box.boxW).toBeLessThanOrEqual(1200 - SHEET_OUTER_PAD);
    expect(box.boxH).toBeLessThanOrEqual(800 - SHEET_OUTER_PAD);
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

describe("titlePanelWidth", () => {
  it("keeps a schedule column on typical A4 sheet widths", () => {
    const a4 = sheetBoxFor(960, 640, "a4");
    expect(a4.boxW).toBeLessThan(420);
    expect(titlePanelWidth(a4.boxW)).toBeGreaterThanOrEqual(148);
  });

  it("uses full width schedule on wide A3", () => {
    const a3 = sheetBoxFor(1200, 800, "a3");
    expect(titlePanelWidth(a3.boxW)).toBe(262);
  });
});

describe("plotBoxFor", () => {
  it("reserves title column and inner margin so plot clears the schedule", () => {
    const sheet = sheetBoxFor(1200, 800, "a3");
    const titleW = titlePanelWidth(sheet.boxW);
    const plot = plotBoxFor(sheet, { titleW });
    expect(plot.boxLeft).toBeGreaterThan(sheet.boxLeft);
    expect(plot.boxLeft + plot.boxW).toBeLessThan(
      sheet.boxLeft + sheet.boxW - titleW,
    );
    expect(plot.boxH).toBeLessThan(sheet.boxH);
  });

  it("shrinks further when elevations are stacked", () => {
    const sheet = sheetBoxFor(1200, 800, "a3");
    const titleW = titlePanelWidth(sheet.boxW);
    const plain = plotBoxFor(sheet, { titleW });
    const withElev = plotBoxFor(sheet, { titleW, elevH: 146 });
    expect(withElev.boxH).toBeLessThan(plain.boxH);
  });
});
