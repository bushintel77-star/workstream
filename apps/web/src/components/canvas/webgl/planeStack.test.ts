import { describe, it, expect } from "vitest";
import {
  FIXED_PLANES,
  KIND_TO_PLANE,
  planeZ,
  fixedPlaneById,
} from "./planeStack";

describe("planeStack", () => {
  it("ground, planting, and massing are all drawable", () => {
    const ground = fixedPlaneById("ground")!;
    const planting = fixedPlaneById("planting")!;
    const massing = fixedPlaneById("massing")!;
    expect(ground.drawable).toBe(true);
    expect(planting.drawable).toBe(true);
    expect(massing.drawable).toBe(true);
  });

  it("survey base remains non-drawable and read-only", () => {
    const survey = fixedPlaneById("survey")!;
    expect(survey.drawable).toBe(false);
    expect(survey.readOnly).toBe(true);
  });

  it("maps wall to massing, bed to planting, ditch/path to ground", () => {
    expect(KIND_TO_PLANE.wall).toBe("massing");
    expect(KIND_TO_PLANE.bed).toBe("planting");
    expect(KIND_TO_PLANE.ditch).toBe("ground");
    expect(KIND_TO_PLANE.path).toBe("ground");
  });

  it("planeZ returns correct Z-heights", () => {
    expect(planeZ("ground")).toBe(0.0);
    expect(planeZ("planting")).toBe(1.5);
    expect(planeZ("massing")).toBe(4.0);
  });

  it("FIXED_PLANES has 4 planes with correct Z ordering", () => {
    expect(FIXED_PLANES.length).toBe(4);
    const zValues = FIXED_PLANES.map((p) => p.z);
    expect(zValues).toEqual([-0.02, 0.0, 1.5, 4.0]);
  });
});
