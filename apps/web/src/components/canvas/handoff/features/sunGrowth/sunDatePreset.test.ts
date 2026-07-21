import { describe, expect, it } from "vitest";
import { sunDateFromPreset, sunDatePresetLabel } from "./sunDatePreset";

describe("sun date presets", () => {
  const now = new Date(2026, 2, 4, 8, 15);

  it("keeps today's date while applying the selected time", () => {
    const date = sunDateFromPreset("today", 14 * 60 + 30, now);
    expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([
      2026, 2, 4,
    ]);
    expect([date.getHours(), date.getMinutes()]).toEqual([14, 30]);
  });

  it("uses Melbourne's solstice and equinox dates", () => {
    const march = sunDateFromPreset("march-equinox", 12 * 60, now);
    const winter = sunDateFromPreset("winter", 12 * 60, now);
    const september = sunDateFromPreset("september-equinox", 12 * 60, now);
    const summer = sunDateFromPreset("summer", 12 * 60, now);
    expect([march.getMonth(), march.getDate()]).toEqual([2, 20]);
    expect([winter.getMonth(), winter.getDate()]).toEqual([5, 21]);
    expect([september.getMonth(), september.getDate()]).toEqual([8, 22]);
    expect([summer.getMonth(), summer.getDate()]).toEqual([11, 21]);
    expect(sunDatePresetLabel("winter")).toBe("21 Jun");
    expect(sunDatePresetLabel("summer")).toBe("21 Dec");
  });
});
