import { describe, expect, it } from "vitest";
import {
  PLAN_LINES_DARK,
  PLAN_LINES_LIGHT,
  planLinesFor,
  type PlanLineKind,
} from "./planLineStyles";

const KINDS: PlanLineKind[] = [
  "boundary",
  "building",
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
});
