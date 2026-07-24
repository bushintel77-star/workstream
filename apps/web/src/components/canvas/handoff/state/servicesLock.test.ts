import { describe, expect, it } from "vitest";
import {
  lockServicesOnMode,
  servicesLayerOpacityEditable,
  surveyServicesAuthoringAllowed,
} from "./servicesLock";

describe("servicesLock", () => {
  it("locks on quote and share modes", () => {
    expect(lockServicesOnMode("quote")).toBe(true);
    expect(lockServicesOnMode("share")).toBe(true);
    expect(lockServicesOnMode("cad")).toBe(false);
    expect(lockServicesOnMode("survey")).toBe(false);
  });

  it("allows survey authoring only before lock", () => {
    expect(
      surveyServicesAuthoringAllowed({ mode: "survey", servicesLocked: false }),
    ).toBe(true);
    expect(
      surveyServicesAuthoringAllowed({ mode: "survey", servicesLocked: true }),
    ).toBe(false);
    expect(
      surveyServicesAuthoringAllowed({ mode: "cad", servicesLocked: false }),
    ).toBe(false);
  });

  it("freezes services layer opacity slider after lock", () => {
    expect(servicesLayerOpacityEditable(false)).toBe(true);
    expect(servicesLayerOpacityEditable(true)).toBe(false);
  });
});
