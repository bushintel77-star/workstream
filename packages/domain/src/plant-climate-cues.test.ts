import { describe, expect, it } from "vitest";
import {
  frostRiskFromMinTemp,
  frostRiskLabel,
  heatRiskFromMaxTemp,
  heatRiskLabel,
} from "./plant-climate-cues";

describe("frostRiskFromMinTemp", () => {
  it("flags hard frost at or below 0°C", () => {
    expect(frostRiskFromMinTemp(0)).toBe("hard");
    expect(frostRiskFromMinTemp(-1.2)).toBe("hard");
  });

  it("flags risk between 0 and 2°C", () => {
    expect(frostRiskFromMinTemp(1.5)).toBe("risk");
    expect(frostRiskFromMinTemp(2)).toBe("risk");
  });

  it("is clear above 2°C", () => {
    expect(frostRiskFromMinTemp(2.1)).toBe("clear");
    expect(frostRiskLabel("clear")).toBe("clear");
  });
});

describe("heatRiskFromMaxTemp", () => {
  it("flags excessive heat at or above 35°C", () => {
    expect(heatRiskFromMaxTemp(35)).toBe("excessive");
    expect(heatRiskLabel("excessive")).toBe("excessive heat");
  });

  it("flags warm band from 32°C", () => {
    expect(heatRiskFromMaxTemp(33)).toBe("warm");
    expect(heatRiskLabel("warm")).toBe("warm");
  });

  it("is ok below 32°C", () => {
    expect(heatRiskFromMaxTemp(28)).toBe("ok");
    expect(heatRiskLabel("ok")).toBe("ok");
  });
});
