import { describe, expect, it } from "vitest";
import { weatherConditionFromDay } from "./weather-condition";

describe("weatherConditionFromDay", () => {
  it("returns rain above 4 mm", () => {
    expect(weatherConditionFromDay(4.1, 10, 1)).toBe("rain");
  });

  it("returns wind above 40 km/h", () => {
    expect(weatherConditionFromDay(0, 41, 1)).toBe("wind");
  });

  it("returns cloud above 0.5 mm when not rain or wind", () => {
    expect(weatherConditionFromDay(0.6, 20, 2)).toBe("cloud");
  });

  it("returns sun for today index with dry calm weather", () => {
    expect(weatherConditionFromDay(0, 20, 0)).toBe("sun");
  });

  it("returns cloud for later days with light precip", () => {
    expect(weatherConditionFromDay(0.3, 10, 3)).toBe("cloud");
  });
});
