import { describe, expect, it } from "vitest";
import { buildEnvLiveMeta, resolveEnvWeatherCondition } from "./envLiveMeta";

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
    expect(meta.face).toMatch(/h ·/);
    expect(meta.avgSunHours).toBeGreaterThan(0);
    expect(meta.detail).toMatch(/mesh on/);
    expect(meta.azimuthLabel.length).toBeGreaterThan(0);
    expect(meta.weatherCondition).toMatch(/sun|cloud|rain|wind/);
  });

  it("maps rainy Open-Meteo days to the rain icon", () => {
    expect(
      resolveEnvWeatherCondition(
        { precipitation_mm: 8, wind_speed_kmh: 12, temp_max_c: 18 },
        40,
      ),
    ).toBe("rain");
  });

  it("surfaces humidity, frost, and heat from the Open-Meteo day", () => {
    const meta = buildEnvLiveMeta({
      sunMin: 10 * 60,
      sunDatePreset: "today",
      growth: "plant",
      shadeOn: false,
      weatherDay: {
        precipitation_mm: 0,
        wind_max_kph: 12,
        temp_max_c: 36,
        temp_min_c: 1,
        humidity_pct: 61,
      },
    });
    expect(meta.humidityLabel).toBe("61%");
    expect(meta.frostRisk).toBe("risk");
    expect(meta.frostLabel).toMatch(/frost risk/);
    expect(meta.heatRisk).toBe("excessive");
    expect(meta.heatLabel).toMatch(/excessive heat/);
  });

  it("shows pending dashes when weather has not loaded", () => {
    const meta = buildEnvLiveMeta({
      sunMin: 10 * 60,
      sunDatePreset: "today",
      growth: "plant",
      shadeOn: false,
    });
    expect(meta.humidityLabel).toBe("—");
    expect(meta.frostLabel).toBe("—");
    expect(meta.heatLabel).toBe("—");
  });
});
