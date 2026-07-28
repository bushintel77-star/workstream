import { describe, expect, it } from "vitest";
import { resolvePlanMetres } from "./plan-metres";

describe("resolvePlanMetres", () => {
  it("prefers site_frame board width over survey span", () => {
    const plan = resolvePlanMetres({
      boardWidthM: 40,
      boardAspect: 0.75,
      surveySpan: {
        width_m: 55,
        height_m: 40,
        outdoor_area_m2: 200,
      },
    });
    expect(plan.source).toBe("site_frame");
    expect(plan.width_m).toBe(40);
    expect(plan.height_m).toBe(30);
    expect(plan.honesty).toBe("working_plan");
    expect(plan.outdoor_area_m2).toBe(200);
  });

  it("uses title/outdoor survey span when board width absent", () => {
    const plan = resolvePlanMetres({
      surveySpan: {
        width_m: 32,
        height_m: 18,
        outdoor_area_m2: 400,
      },
    });
    expect(plan.source).toBe("title_outdoor");
    expect(plan.width_m).toBe(32);
    expect(plan.height_m).toBe(18);
  });

  it("marks aerial survey span as aerial", () => {
    const plan = resolvePlanMetres({
      surveySpan: {
        width_m: 80,
        height_m: 60,
        outdoor_area_m2: 100,
        fromAerial: true,
      },
    });
    expect(plan.source).toBe("aerial");
  });

  it("falls back to a 20 m heuristic sheet", () => {
    const plan = resolvePlanMetres({});
    expect(plan.source).toBe("heuristic");
    expect(plan.width_m).toBe(20);
    expect(plan.height_m).toBe(20);
    expect(plan.outdoor_area_m2).toBeNull();
  });

  it("defaults board aspect to 1 when omitted", () => {
    const plan = resolvePlanMetres({ boardWidthM: 50 });
    expect(plan.height_m).toBe(50);
  });
});
