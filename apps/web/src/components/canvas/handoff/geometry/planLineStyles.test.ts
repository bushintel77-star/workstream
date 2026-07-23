import { describe, expect, it } from "vitest";
import {
  PLAN_LINES_DARK,
  PLAN_LINES_LIGHT,
  planLineKindForItem,
  planLinesFor,
  type PlanLineKind,
} from "./planLineStyles";

const KINDS: PlanLineKind[] = [
  "boundary",
  "building",
  "hardscape",
  "planting",
  "existing",
  "context",
  "easement",
  "service",
  "setback",
  "dim",
];

describe("planLineStyles", () => {
  it("gives each light-mode kind a distinct stroke colour", () => {
    const strokes = KINDS.map((k) => PLAN_LINES_LIGHT[k].stroke);
    expect(new Set(strokes).size).toBe(KINDS.length);
  });

  it("gives each dark-mode kind a distinct stroke colour", () => {
    const strokes = KINDS.map((k) => PLAN_LINES_DARK[k].stroke);
    expect(new Set(strokes).size).toBe(KINDS.length);
  });

  it("keeps boundary ≠ building when title is locked", () => {
    const lines = planLinesFor({
      darkOn: false,
      titleSolid: true,
      fitSheet: false,
    });
    expect(lines.boundary.stroke).not.toBe(lines.building.stroke);
    expect(lines.building.stroke).toBe(PLAN_LINES_LIGHT.building.stroke);
  });

  it("keeps colour hierarchy on fit sheet", () => {
    const lines = planLinesFor({
      darkOn: false,
      titleSolid: true,
      fitSheet: true,
    });
    expect(lines.boundary.stroke).not.toBe(lines.building.stroke);
    expect(lines.service.stroke).not.toBe(lines.easement.stroke);
  });

  it("orders the line-weight ladder in light maps", () => {
    const light = planLinesFor({
      darkOn: false,
      titleSolid: true,
      fitSheet: false,
    });
    expect(light.boundary.strokeWidth).toBeGreaterThan(light.building.strokeWidth);
    expect(light.building.strokeWidth).toBeGreaterThan(light.hardscape.strokeWidth);
    expect(light.hardscape.strokeWidth).toBeGreaterThan(light.planting.strokeWidth);
    expect(light.planting.strokeWidth).toBe(light.existing.strokeWidth);
    expect(light.boundary.strokeWidth).toBe(1.4);
    expect(light.building.strokeWidth).toBe(1.05);
    expect(light.hardscape.strokeWidth).toBe(0.6);
    expect(light.planting.strokeWidth).toBe(0.4);
  });

  it("orders the line-weight ladder in dark maps", () => {
    const dark = planLinesFor({
      darkOn: true,
      titleSolid: true,
      fitSheet: false,
    });
    expect(dark.boundary.strokeWidth).toBeGreaterThan(dark.building.strokeWidth);
    expect(dark.building.strokeWidth).toBeGreaterThan(dark.hardscape.strokeWidth);
    expect(dark.hardscape.strokeWidth).toBeGreaterThan(dark.planting.strokeWidth);
    expect(dark.boundary.strokeWidth).toBe(1.4);
    expect(dark.building.strokeWidth).toBe(1.05);
    expect(dark.hardscape.strokeWidth).toBe(0.6);
    expect(dark.planting.strokeWidth).toBe(0.4);
  });

  it("keeps the same ladder weights on fit sheet (print)", () => {
    const fit = planLinesFor({
      darkOn: true,
      titleSolid: true,
      fitSheet: true,
    });
    // Fit sheet forces parchment (light) even when darkOn — weights still ladder.
    expect(fit.boundary.strokeWidth).toBe(1.4);
    expect(fit.building.strokeWidth).toBe(1.05);
    expect(fit.hardscape.strokeWidth).toBe(0.6);
    expect(fit.planting.strokeWidth).toBe(0.4);
  });

  it("maps item types onto ladder kinds", () => {
    expect(planLineKindForItem("exist")).toBe("existing");
    expect(planLineKindForItem("paving")).toBe("hardscape");
    expect(planLineKindForItem("deck")).toBe("hardscape");
    expect(planLineKindForItem("canopy")).toBe("planting");
    expect(planLineKindForItem("lawn")).toBe("planting");
  });
});
