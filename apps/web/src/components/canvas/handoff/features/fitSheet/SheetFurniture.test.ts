import { describe, expect, it } from "vitest";
import { sheetFurnitureVisible } from "./SheetFurniture";

describe("sheetFurnitureVisible", () => {
  it("shows only for the technical pen with a valid frame", () => {
    expect(
      sheetFurnitureVisible({
        technical: true,
        scaleM: 20,
        frameWidthPx: 800,
      }),
    ).toBe(true);
  });

  it("hides for concept pens", () => {
    expect(
      sheetFurnitureVisible({
        technical: false,
        scaleM: 20,
        frameWidthPx: 800,
      }),
    ).toBe(false);
  });

  it("hides when scale or frame is invalid", () => {
    expect(
      sheetFurnitureVisible({
        technical: true,
        scaleM: 0,
        frameWidthPx: 800,
      }),
    ).toBe(false);
    expect(
      sheetFurnitureVisible({
        technical: true,
        scaleM: 20,
        frameWidthPx: 0,
      }),
    ).toBe(false);
  });
});
