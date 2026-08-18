import { describe, expect, it } from "vitest";
import type { DesignCanvas } from "@workstream/contracts";
import {
  ensureMainBranch,
  getTipCanvas,
  writeTipCanvas,
  createBranchFromRevision,
  getRevision,
} from "./design-vcs";

describe("design-vcs tip resolution", () => {
  it("migrates legacy canvas to main tip", () => {
    const projectId = "22222222-2222-4222-8222-222222222222";
    const ownerId = "dev-user";
    const legacy: DesignCanvas = {
      id: "11111111-1111-4111-8111-111111111111",
      project_id: projectId,
      placements: [
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          symbol_id: "hornbeam-pleached",
          x_pct: 10,
          y_pct: 10,
          rotation_deg: 0,
          scale: 1,
        },
      ],
      strokes: [],
      irrigation_zones: [],
      construction_trenches: [],
      annotations: [],
      image_layers: [],
      photo_elevations: [],
      features: [],
      updated_at: "2026-08-01T00:00:00.000Z",
    };
    const arrays = {
      branches: [],
      revisions: [],
      canvases: [legacy],
    };
    const main = ensureMainBranch(arrays, ownerId, projectId, ownerId);
    expect(main.name).toBe("main");
    const tip = getTipCanvas(arrays, main);
    expect(tip?.placements).toHaveLength(1);

    const from = getRevision(arrays, main.tip_revision_id)!;
    const { branch } = createBranchFromRevision(
      arrays,
      ownerId,
      projectId,
      "Option A",
      from,
      ownerId,
    );
    writeTipCanvas(arrays, branch, {
      placements: [
        ...legacy.placements,
        {
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          symbol_id: "lomandra-mass",
          x_pct: 40,
          y_pct: 40,
          rotation_deg: 0,
          scale: 1,
        },
      ],
    });
    expect(getTipCanvas(arrays, branch)?.placements).toHaveLength(2);
    expect(getTipCanvas(arrays, main)?.placements).toHaveLength(1);
  });
});
