import { describe, expect, it } from "vitest";
import { communicationProfileForMode } from "./modeProfile";

describe("communication profile by canvas mode", () => {
  it("defaults Survey to technical surveyed-plan communication", () => {
    const profile = communicationProfileForMode("survey");
    expect(profile?.defaultDialect).toBe("technical");
    expect(profile?.modes).toEqual(["technical", "architectural", "hybrid"]);
  });

  it("defaults CAD to architectural communication", () => {
    const profile = communicationProfileForMode("cad");
    expect(profile?.defaultDialect).toBe("architectural");
    expect(profile?.modes).toEqual(["architectural", "technical", "hybrid"]);
  });

  it("defaults Sketch to creative communication", () => {
    const profile = communicationProfileForMode("sketch");
    expect(profile?.defaultDialect).toBe("creative");
    expect(profile?.modes).toEqual(["creative", "architectural", "technical"]);
  });
});
