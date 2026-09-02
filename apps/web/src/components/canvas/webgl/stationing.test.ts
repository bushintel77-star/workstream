import { describe, expect, it } from "vitest";
import { buildStationTicks, niceStep, stationAtPct } from "./stationing";

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

  it("spans 0..scaleM with major ticks every 5 minors and a label", () => {
    const ticks = buildStationTicks(25);
    expect(ticks[0]!.metres).toBe(0);
    expect(ticks[0]!.major).toBe(true);
    expect(ticks[ticks.length - 1]!.metres).toBeCloseTo(25);
    expect(ticks[ticks.length - 1]!.major).toBe(true);
    const major = ticks.filter((t) => t.major);
    expect(major.map((t) => t.metres)).toEqual([0, 25]);
    // Minor interval for a 25m board = 5m.
    expect(ticks.map((t) => t.metres)).toEqual([0, 5, 10, 15, 20, 25]);
  });

  it("produces clean integer labels and one decimal where needed", () => {
    expect(buildStationTicks(25).map((t) => t.label)).toEqual([
      "0",
      "5",
      "10",
      "15",
      "20",
      "25",
    ]);
    // 25.4m board → 5m minors → last tick at 25, no ugly 5.08 labels.
    const t = buildStationTicks(25.4);
    expect(t[t.length - 1]!.metres).toBeLessThanOrEqual(25.4);
    expect(t[t.length - 1]!.metres).toBeGreaterThan(0);
  });
});
