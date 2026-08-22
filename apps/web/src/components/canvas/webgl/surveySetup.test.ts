import { describe, expect, it } from "vitest";
import { buildSurveySetup, surveySetupPercent, type SurveySetupInput } from "./surveySetup";
import type { StudioItem } from "../handoff/studioCatalog";

const EMPTY: SurveySetupInput = {
  boundary: [],
  building: [],
  items: [],
  levels: [],
  services: [],
  easements: [],
};

const RING = [
  { x: 10, y: 10 },
  { x: 90, y: 10 },
  { x: 90, y: 90 },
  { x: 10, y: 90 },
];

/** An existing tree — `BY_TYPE[t].existing` is what the checklist reads. */
function existingTree(): StudioItem {
  return { id: "t1", t: "exist", x: 50, y: 50 } as unknown as StudioItem;
}

describe("buildSurveySetup", () => {
  it("reports five items, none done, on an empty project", () => {
    const setup = buildSurveySetup(EMPTY);
    expect(setup.total).toBe(5);
    expect(setup.done).toBe(0);
    expect(setup.complete).toBe(false);
    expect(setup.items.every((item) => !item.done)).toBe(true);
  });

  it("derives completion from real data, never a manual tick", () => {
    const setup = buildSurveySetup({ ...EMPTY, boundary: RING });
    const boundary = setup.items.find((item) => item.id === "boundary")!;
    expect(boundary.done).toBe(true);
    expect(setup.done).toBe(1);
    // A ring of two points is not a traced boundary.
    const partial = buildSurveySetup({ ...EMPTY, boundary: RING.slice(0, 2) });
    expect(partial.items.find((item) => item.id === "boundary")!.done).toBe(false);
  });

  it("routes trees to the asset dock and everything else to the import", () => {
    const setup = buildSurveySetup(EMPTY);
    const byId = Object.fromEntries(setup.items.map((item) => [item.id, item]));
    expect(byId.trees!.action).toBe("assets");
    for (const id of ["boundary", "dwelling", "levels", "services"]) {
      expect(byId[id]!.action, id).toBe("import");
    }
  });

  it("gives every row a stable id and a helper line", () => {
    const setup = buildSurveySetup(EMPTY);
    expect(setup.items.map((item) => item.id)).toEqual([
      "boundary",
      "dwelling",
      "trees",
      "levels",
      "services",
    ]);
    expect(setup.items.every((item) => item.helper.length > 0)).toBe(true);
    expect(new Set(setup.items.map((item) => item.id)).size).toBe(5);
  });

  it("flags complete only when every row is backed by data", () => {
    const setup = buildSurveySetup({
      boundary: RING,
      building: RING,
      items: [existingTree()],
      levels: [{ x: 1, y: 1, z: 50, provenance: "authored" }] as never,
      services: [RING],
      easements: [],
    });
    expect(setup.done).toBe(5);
    expect(setup.complete).toBe(true);
  });

  it("never reports complete on an empty checklist", () => {
    expect(buildSurveySetup(EMPTY).complete).toBe(false);
  });
});

describe("surveySetupPercent", () => {
  it("maps done/total onto 0-100", () => {
    expect(surveySetupPercent({ done: 0, total: 5 })).toBe(0);
    expect(surveySetupPercent({ done: 2, total: 5 })).toBe(40);
    expect(surveySetupPercent({ done: 5, total: 5 })).toBe(100);
  });

  it("does not divide by zero", () => {
    expect(surveySetupPercent({ done: 0, total: 0 })).toBe(0);
  });
});
