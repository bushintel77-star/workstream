import { describe, expect, it } from "vitest";
import type { CadDocument } from "@workstream/contracts";
import {
  applyCadOps,
  acceptCadGhosts,
  acceptUnverified,
  countGhosts,
} from "./apply-ops";
import { cadDocumentToDxf } from "./export-dxf";
import { emptyCadDocument } from "./defaults";

function baseDoc(): CadDocument {
  const empty = emptyCadDocument({
    projectId: "00000000-0000-4000-8000-000000000001",
    width_m: 40,
    height_m: 30,
  });
  return {
    ...empty,
    id: "00000000-0000-4000-8000-000000000002",
    updated_at: new Date().toISOString(),
  };
}

describe("@workstream/cad", () => {
  it("applies polyline and circle ops as ghosts", () => {
    const { document, applied } = applyCadOps(baseDoc(), [
      {
        op: "add_polyline",
        layer: "HARDSCAPE",
        points: [
          { x: 2, y: 2 },
          { x: 10, y: 2 },
          { x: 10, y: 8 },
          { x: 2, y: 8 },
        ],
        closed: true,
        ghost: true,
      },
      {
        op: "add_circle",
        layer: "TRP",
        center: { x: 15, y: 15 },
        radius: 3,
        ghost: true,
      },
    ]);
    expect(applied).toBe(2);
    expect(countGhosts(document)).toBe(2);
    expect(
      document.entities.every((e) => e.verification_state === "UNVERIFIED"),
    ).toBe(true);
    const accepted = acceptUnverified(document);
    expect(countGhosts(accepted)).toBe(0);
    expect(
      accepted.entities.every(
        (e) => e.verification_state === "VERIFIED" && e.ghost === false,
      ),
    ).toBe(true);
    // Legacy alias
    expect(acceptCadGhosts(document).entities.every((e) => !e.ghost)).toBe(
      true,
    );
  });

  it("replace_entity restores a deleted entity by id", () => {
    const { document: withLine } = applyCadOps(baseDoc(), [
      {
        op: "add_line",
        layer: "HARDSCAPE",
        start: { x: 1, y: 1 },
        end: { x: 4, y: 4 },
        ghost: false,
      },
    ]);
    const entity = withLine.entities[0]!;
    const { document: deleted } = applyCadOps(withLine, [
      { op: "delete_entity", entity_id: entity.id },
    ]);
    expect(deleted.entities).toHaveLength(0);
    const { document: restored, applied } = applyCadOps(deleted, [
      { op: "replace_entity", entity },
    ]);
    expect(applied).toBe(1);
    expect(restored.entities).toHaveLength(1);
    expect(restored.entities[0]!.id).toBe(entity.id);
  });

  it("exports DXF with LAYER and ENTITIES", () => {
    const { document } = applyCadOps(baseDoc(), [
      {
        op: "add_line",
        layer: "ANNOTATION",
        start: { x: 0, y: 0 },
        end: { x: 5, y: 5 },
        ghost: false,
      },
    ]);
    const dxf = cadDocumentToDxf(document);
    expect(dxf).toContain("SECTION");
    expect(dxf).toContain("ENTITIES");
    expect(dxf).toContain("LINE");
    expect(dxf).toContain("EOF");
  });
});
