/**
 * seasonProgress is now DERIVED from (sunDatePreset, sunMin) and the domain's
 * melbourneSeason() is the single season-label authority. These tests pin both
 * properties so a future free-floating scrubber or label table cannot creep
 * back in and desync the toolbar from the rendered sun.
 */

import { describe, expect, it, afterEach } from "vitest";
import {
  melbourneSeasonFromSun,
  seasonProgressFromSun,
  useStudioStore,
} from "./studioStore";

// Fixed instants so "today" is deterministic (Melbourne wall-clock).
const AUG_NOON = new Date("2026-08-17T02:00:00Z"); // 12:00 AEST
const JAN_NOON = new Date("2026-01-01T01:00:00Z"); // 12:00 AEDT

describe("seasonProgressFromSun", () => {
  it("peaks the winter envelope at the June solstice (~0.47)", () => {
    expect(seasonProgressFromSun("winter", 12 * 60, AUG_NOON)).toBeCloseTo(
      0.47,
      1,
    );
  });

  it("peaks the summer envelope at the December solstice (~0.97)", () => {
    expect(seasonProgressFromSun("summer", 12 * 60, AUG_NOON)).toBeCloseTo(
      0.97,
      1,
    );
  });

  it("is near zero on Jan 1 and monotonic through the year", () => {
    expect(seasonProgressFromSun("today", 12 * 60, JAN_NOON)).toBeLessThan(0.01);
    expect(
      seasonProgressFromSun("march-equinox", 12 * 60, AUG_NOON),
    ).toBeGreaterThan(
      seasonProgressFromSun("today", 12 * 60, JAN_NOON),
    );
  });
});

describe("melbourneSeasonFromSun", () => {
  it("delegates season naming to the domain authority (SH labels)", () => {
    expect(melbourneSeasonFromSun("winter", 12 * 60, AUG_NOON).label).toContain(
      "winter",
    );
    expect(melbourneSeasonFromSun("winter", 12 * 60, AUG_NOON).month).toBe(
      "June",
    );
    expect(melbourneSeasonFromSun("summer", 12 * 60, AUG_NOON).label).toContain(
      "summer",
    );
  });

  it("agrees with the wall clock for the same instant", () => {
    const meta = melbourneSeasonFromSun("today", 12 * 60, AUG_NOON);
    expect(meta.label).toBe("Late winter");
    expect(meta.month).toBe("August");
  });
});

describe("studioStore temporal derivation", () => {
  afterEach(() => {
    // Reset the singleton so a mutated test cannot leak into the next one.
    useStudioStore.setState({
      sunDatePreset: "today",
      sunMin: 12 * 60,
      seasonProgress: seasonProgressFromSun("today", 12 * 60, AUG_NOON),
    });
  });

  it("recomputes seasonProgress from the sun date on setSunDatePreset", () => {
    useStudioStore.getState().setSunDatePreset("winter");
    expect(useStudioStore.getState().seasonProgress).toBeCloseTo(0.47, 1);
  });

  it("recomputes seasonProgress from the sun date on setSunMin", () => {
    const s = useStudioStore.getState();
    s.setSunDatePreset("winter");
    s.setSunMin(12 * 60 + 5 * 60); // 17:00 same day — still winter envelope
    expect(useStudioStore.getState().seasonProgress).toBeCloseTo(0.47, 1);
  });
});
