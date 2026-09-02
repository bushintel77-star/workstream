import { describe, expect, it } from "vitest";
import {
  buildStationTicks,
  niceStep,
  stationAtPct,
  STATION_MAJOR_M,
  STATION_MINOR_M,
} from "./stationing";

describe("stationing — single source of ruler truth (2.1)", () => {
  it("converts board-% to metre chainage", () => {
    expect(stationAtPct(0, 110)).toBe(0);
    expect(stationAtPct(50, 110)).toBe(55);
    expect(stationAtPct(100, 25.4)).toBeCloseTo(25.4);
  });

  it("snaps the minor interval to a clean ladder", () => {
    expect(niceStep(22)).toBe(20);
    expect(niceStep(5)).toBe(5);
    expect(niceStep(0.5)).toBe(0.5);
  });

  it("uses the spec ladder — minor 2m, major 10m, origin tick 0 (2.3)", () => {
    expect(STATION_MINOR_M).toBe(2);
    expect(STATION_MAJOR_M).toBe(10);
    const ticks = buildStationTicks(25);
    expect(ticks[0]!.metres).toBe(0);
    expect(ticks[0]!.major).toBe(true);
    // Board edge always lands as a major tick, even off-ladder (25m).
    expect(ticks[ticks.length - 1]!.metres).toBeCloseTo(25);
    expect(ticks[ticks.length - 1]!.major).toBe(true);
    const majors = ticks.filter((t) => t.major).map((t) => t.metres);
    expect(majors).toEqual([0, 10, 20, 25]);
    const minors = ticks.filter((t) => !t.major).map((t) => t.metres);
    // 2m minors between the majors: 2,4,6,8 | 12,14,16,18 | 22,24.
    expect(minors).toEqual([2, 4, 6, 8, 12, 14, 16, 18, 22, 24]);
  });

  it("produces clean integer labels and one decimal where needed", () => {
    const labels = buildStationTicks(25)
      .filter((t) => t.major)
      .map((t) => t.label);
    expect(labels).toEqual(["0", "10", "20", "25"]);
    // 25.4m board → off-ladder edge lands as the closing major tick.
    const t = buildStationTicks(25.4);
    expect(t[t.length - 1]!.metres).toBeCloseTo(25.4);
    expect(t[t.length - 1]!.major).toBe(true);
  });
});
