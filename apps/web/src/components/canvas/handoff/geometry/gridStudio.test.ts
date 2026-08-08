import { describe, expect, it } from "vitest";
import {
  GRID_FORMATIONS,
  GRID_INKS,
  nextInRing,
} from "./gridStudio";

describe("gridStudio", () => {
  it("cycles formations and inks in a ring", () => {
    expect(nextInRing(GRID_FORMATIONS, "ortho")).toBe("dots");
    expect(nextInRing(GRID_FORMATIONS, "veil")).toBe("ortho");
    expect(nextInRing(GRID_INKS, "charcoal")).toBe("slate");
    expect(nextInRing(GRID_INKS, "signal")).toBe("charcoal");
  });
});
