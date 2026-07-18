import { describe, expect, it } from "vitest";
import type { CadDocument } from "@workstream/contracts";
import { cadQuantitySurvey } from "./cad-quantities";
import { buildFromCad } from "./cad-build";

function withVerification(
  entity: CadDocument["entities"][number],
): CadDocument["entities"][number] {
  const unverified = entity.ghost === true;
  return {
    ...entity,
    ghost: unverified,
    verification_state: unverified ? "UNVERIFIED" : "VERIFIED",
  };
}

function doc(
  entities: Array<Omit<CadDocument["entities"][number], "verification_state"> & {
    verification_state?: "UNVERIFIED" | "VERIFIED";
  }>,
): CadDocument {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    project_id: "22222222-2222-2222-2222-222222222222",
    version: 1,
    units: "m",
    origin: { x: 0, y: 0 },
    width_m: 20,
    height_m: 15,
    layers: [{ name: "HARDSCAPE" }, { name: "PLANTING" }],
    entities: entities.map((e) =>
      withVerification(e as CadDocument["entities"][number]),
    ),
    blocks: [],
    ai_run_id: null,
    source_sketch_id: null,
    updated_at: new Date().toISOString(),
  };
}

describe("cadQuantitySurvey", () => {
  it("measures closed polyline as m2 and skips ghosts when committedOnly", () => {
    const survey = cadQuantitySurvey(
      doc([
        {
          id: "33333333-3333-3333-3333-333333333333",
          kind: "polyline",
          layer: "HARDSCAPE",
          ghost: false,
          verification_state: "VERIFIED",
          closed: true,
          points: [
            { x: 0, y: 0 },
            { x: 4, y: 0 },
            { x: 4, y: 2.5 },
            { x: 0, y: 2.5 },
          ],
        },
        {
          id: "44444444-4444-4444-4444-444444444444",
          kind: "circle",
          layer: "HARDSCAPE",
          ghost: true,
          verification_state: "UNVERIFIED",
          center: { x: 1, y: 1 },
          radius: 1,
        },
      ]),
      { committedOnly: true },
    );
    expect(survey.rows).toHaveLength(1);
    expect(survey.rows[0]!.unit).toBe("m2");
    expect(survey.rows[0]!.qty).toBe(10);
    expect(survey.totals.hardscape_m2).toBe(10);
  });

  it("counts inserts as ea", () => {
    const survey = cadQuantitySurvey(
      doc([
        {
          id: "55555555-5555-5555-5555-555555555555",
          kind: "insert",
          layer: "PLANTING",
          ghost: false,
          verification_state: "VERIFIED",
          block_name: "olive-tree",
          position: { x: 3, y: 3 },
          scale: 1,
          rotation_deg: 0,
        },
      ]),
    );
    expect(survey.totals.planting_ea).toBe(1);
  });
});

describe("buildFromCad", () => {
  it("prices hardscape from rate card", () => {
    const schedule = buildFromCad(
      doc([
        {
          id: "66666666-6666-6666-6666-666666666666",
          kind: "polyline",
          layer: "HARDSCAPE",
          ghost: false,
          verification_state: "VERIFIED",
          closed: true,
          points: [
            { x: 0, y: 0 },
            { x: 2, y: 0 },
            { x: 2, y: 2 },
            { x: 0, y: 2 },
          ],
        },
      ]),
      [
        {
          id: "77777777-7777-7777-7777-777777777777",
          owner_id: "owner",
          sku: "PAV-BLU",
          label: "Bluestone paving",
          unit: "m2",
          rate: 180,
          category: "hardscape",
          effective_from: new Date().toISOString(),
        },
      ],
      { scenario: "standard" },
    );
    expect(schedule.line_items[0]!.sku).toBe("PAV-BLU");
    expect(schedule.line_items[0]!.qty).toBe(4);
    expect(schedule.line_items[0]!.total).toBe(720);
    expect(schedule.total).toBeGreaterThan(720);
  });
});
