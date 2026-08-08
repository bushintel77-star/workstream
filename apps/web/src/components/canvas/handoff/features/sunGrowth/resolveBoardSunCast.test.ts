import { describe, expect, it } from "vitest";
import { resolveBoardSunCast } from "./resolveBoardSunCast";

describe("resolveBoardSunCast", () => {
  it("returns null when shade is off", () => {
    expect(
      resolveBoardSunCast({
        shadeOn: false,
        sunMin: 12 * 60 + 26,
        datePreset: "today",
        growth: "mature",
      }),
    ).toBeNull();
  });

  it("returns a live cast when shade is on", () => {
    const cast = resolveBoardSunCast({
      shadeOn: true,
      sunMin: 12 * 60,
      datePreset: "winter",
      growth: "mature",
      lat: -37.85,
      lng: 144.99,
    });
    expect(cast).not.toBeNull();
    expect(cast!.lengthM).toBeGreaterThan(0);
  });

  it("grows shadow length with canopy maturity", () => {
    const plant = resolveBoardSunCast({
      shadeOn: true,
      sunMin: 10 * 60,
      datePreset: "winter",
      growth: "plant",
      lat: -37.85,
      lng: 144.99,
    });
    const mature = resolveBoardSunCast({
      shadeOn: true,
      sunMin: 10 * 60,
      datePreset: "winter",
      growth: "mature",
      lat: -37.85,
      lng: 144.99,
    });
    expect(mature!.lengthM).toBeGreaterThan(plant!.lengthM);
  });
});
