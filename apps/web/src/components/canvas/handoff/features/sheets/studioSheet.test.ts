import { describe, expect, it } from "vitest";
import {
  nextSheetSnap,
  sheetSafeBottomPx,
  STUDIO_SHEET_FAB_CLEAR_PX,
  STUDIO_SHEET_PEEK_PX,
} from "./studioSheet";

describe("nextSheetSnap", () => {
  it("cycles peek → half → full → peek", () => {
    expect(nextSheetSnap("peek")).toBe("half");
    expect(nextSheetSnap("half")).toBe("full");
    expect(nextSheetSnap("full")).toBe("peek");
  });
});

describe("sheetSafeBottomPx", () => {
  it("raises the safe inset for an open sheet peek", () => {
    expect(
      sheetSafeBottomPx({ sheetOpen: true, fabOn: false, sunOn: false }),
    ).toBeGreaterThanOrEqual(STUDIO_SHEET_PEEK_PX);
  });

  it("keeps room for the primary FAB", () => {
    expect(
      sheetSafeBottomPx({ sheetOpen: false, fabOn: true, sunOn: false }),
    ).toBeGreaterThanOrEqual(STUDIO_SHEET_FAB_CLEAR_PX);
  });

  it("takes the max when sheet, fab, and sun compete", () => {
    const n = sheetSafeBottomPx({
      sheetOpen: true,
      fabOn: true,
      sunOn: true,
    });
    expect(n).toBe(96);
  });
});
