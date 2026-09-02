import { describe, expect, it } from "vitest";
import {
  FIXED_PLANE_LABELS,
  FIXED_PLANES,
  fixedPlaneById,
} from "./planeStack";

describe("planeStack — fixed four-plane registry (spec 1.1)", () => {
  it("defines the four planes at their spec z-heights in order", () => {
    expect(FIXED_PLANES.map((p) => p.id)).toEqual([
      "survey",
      "ground",
      "planting",
      "massing",
    ]);
    expect(FIXED_PLANES.map((p) => p.z)).toEqual([-0.02, 0, 1.5, 4]);
  });

  it("marks survey imported/read-only and ground as the only drawable plane", () => {
    const survey = fixedPlaneById("survey");
    const ground = fixedPlaneById("ground");
    expect(survey?.readOnly).toBe(true);
    expect(survey?.state).toBe("existing");
    expect(ground?.drawable).toBe(true);
    expect(FIXED_PLANES.filter((p) => p.drawable).map((p) => p.id)).toEqual([
      "ground",
    ]);
  });

  it("marks planting and massing as proposed, non-drawable targets", () => {
    for (const id of ["planting", "massing"] as const) {
      const p = fixedPlaneById(id);
      expect(p?.state).toBe("proposed");
      expect(p?.drawable).toBe(false);
    }
  });

  it("carries the 3-letter rail labels", () => {
    expect(FIXED_PLANE_LABELS.survey).toBe("SRV");
    expect(FIXED_PLANE_LABELS.ground).toBe("GRD");
    expect(FIXED_PLANE_LABELS.planting).toBe("PLT");
    expect(FIXED_PLANE_LABELS.massing).toBe("MAS");
  });
});
