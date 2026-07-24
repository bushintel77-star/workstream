import { describe, expect, it } from "vitest";
import { buildEnvLiveMeta } from "./envLiveMeta";

describe("buildEnvLiveMeta", () => {
  it("builds a live face line with season and sun hours", () => {
    const meta = buildEnvLiveMeta({
      sunMin: 12 * 60 + 30,
      sunDatePreset: "today",
      growth: "mature",
      lat: -37.85,
      lng: 145.0,
      shadeOn: true,
    });
    expect(meta.face).toMatch(/^Env ·/);
    expect(meta.avgSunHours).toBeGreaterThan(0);
    expect(meta.detail).toMatch(/mesh on/);
    expect(meta.azimuthLabel.length).toBeGreaterThan(0);
  });
});
