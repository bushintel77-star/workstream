import { describe, expect, it } from "vitest";
import { sunDateFromPreset, sunDatePresetLabel } from "./sunDatePreset";

function melbourneYmdHm(date: Date): [number, number, number, number, number] {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Australia/Melbourne",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, Number(p.value)]),
  ) as Record<string, number>;
  return [parts.year!, parts.month!, parts.day!, parts.hour!, parts.minute!];
}

describe("sun date presets", () => {
  // Fixed Melbourne morning — TZ-safe for CI (UTC) and local AU runners.
  const now = new Date("2026-03-04T08:15:00+11:00");

  it("keeps today's Melbourne date while applying the selected time", () => {
    const date = sunDateFromPreset("today", 14 * 60 + 30, now);
    expect(melbourneYmdHm(date)).toEqual([2026, 3, 4, 14, 30]);
  });

  it("uses Melbourne's solstice and equinox dates (Melbourne wall-clock)", () => {
    const march = sunDateFromPreset("march-equinox", 12 * 60, now);
    const winter = sunDateFromPreset("winter", 12 * 60, now);
    const september = sunDateFromPreset("september-equinox", 12 * 60, now);
    const summer = sunDateFromPreset("summer", 12 * 60, now);
    expect(melbourneYmdHm(march).slice(1, 3)).toEqual([3, 20]);
    expect(melbourneYmdHm(winter).slice(1, 3)).toEqual([6, 21]);
    expect(melbourneYmdHm(september).slice(1, 3)).toEqual([9, 22]);
    expect(melbourneYmdHm(summer).slice(1, 3)).toEqual([12, 21]);
    expect(melbourneYmdHm(winter).slice(3)).toEqual([12, 0]);
    expect(sunDatePresetLabel("winter")).toBe("21 Jun");
    expect(sunDatePresetLabel("summer")).toBe("21 Dec");
  });
});
