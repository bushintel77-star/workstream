import { describe, expect, it } from "vitest";
import { WRIGHTS_SEED } from "../../studioCatalog";
import { buildSiteSchedule } from "../../geometry";
import { buildLiveMeasures } from "./buildLiveMeasures";

const SCALE = 110;

describe("buildLiveMeasures", () => {
  it("accumulates site and edge rows from the Wrights cadastral seed", () => {
    const schedule = buildSiteSchedule(
      WRIGHTS_SEED.boundary,
      WRIGHTS_SEED.building,
      SCALE,
    );
    const rows = buildLiveMeasures({
      boundary: WRIGHTS_SEED.boundary,
      building: WRIGHTS_SEED.building,
      items: WRIGHTS_SEED.items.filter((i) => !i.ghost),
      scaleM: SCALE,
      schedule,
      selected: null,
    });

    expect(rows.some((r) => r.id === "lot")).toBe(true);
    expect(rows.some((r) => r.id === "outdoor")).toBe(true);
    expect(rows.some((r) => r.group === "edge" && r.id.startsWith("edge-B"))).toBe(
      true,
    );
    // Planning-relevant existing tree only — no fabricated paving/lawn on open
    expect(rows.some((r) => r.id === "mat-exist")).toBe(true);
    expect(rows.some((r) => r.id === "mat-paving")).toBe(false);
  });

  it("adds a selection row when an item is selected", () => {
    const exist = WRIGHTS_SEED.items.find((i) => i.t === "exist")!;
    const rows = buildLiveMeasures({
      boundary: WRIGHTS_SEED.boundary,
      building: WRIGHTS_SEED.building,
      items: [exist],
      scaleM: SCALE,
      schedule: null,
      selected: exist,
    });
    expect(rows.some((r) => r.group === "selection")).toBe(true);
  });

  it("updates edge lengths when a vertex moves", () => {
    const a = buildLiveMeasures({
      boundary: WRIGHTS_SEED.boundary,
      building: [],
      items: [],
      scaleM: SCALE,
      schedule: null,
      selected: null,
    });
    const moved = WRIGHTS_SEED.boundary.map((p, i) =>
      i === 0 ? { x: p.x + 4, y: p.y } : p,
    );
    const b = buildLiveMeasures({
      boundary: moved,
      building: [],
      items: [],
      scaleM: SCALE,
      schedule: null,
      selected: null,
    });
    const aB1 = a.find((r) => r.id === "edge-B1")!.numeric;
    const bB1 = b.find((r) => r.id === "edge-B1")!.numeric;
    expect(Math.abs(aB1 - bB1)).toBeGreaterThan(0.05);
  });
});
