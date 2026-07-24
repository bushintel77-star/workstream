import { describe, expect, it } from "vitest";
import {
  hardscapeWhy,
  pathWidthToGlyphScale,
  snapPathWidthM,
} from "./hardscape-grammar";

describe("hardscape-grammar", () => {
  it("snaps free widths onto residential locks", () => {
    expect(snapPathWidthM(1.0)).toBe(0.9);
    expect(snapPathWidthM(1.25)).toBe(1.2);
    expect(snapPathWidthM(1.7)).toBe(1.8);
  });

  it("scales glyphs around the 1.2 m module", () => {
    expect(pathWidthToGlyphScale(1.2)).toBeCloseTo(1, 5);
    expect(pathWidthToGlyphScale(1.8)).toBeGreaterThan(1);
    expect(pathWidthToGlyphScale(0.9)).toBeLessThan(1);
  });

  it("formats honesty microcopy", () => {
    expect(hardscapeWhy(1.2, "sawn")).toMatch(/1\.2 m path/);
    expect(hardscapeWhy(1.2, "sawn")).toMatch(/Sawn/);
    expect(hardscapeWhy(1.2, "soldier", 0.6)).toMatch(/R0\.6 fillet/);
  });
});
