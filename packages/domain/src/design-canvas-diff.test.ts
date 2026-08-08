import { describe, expect, it } from "vitest";
import type { DesignCanvas } from "@workstream/contracts";
import { diffDesignCanvas } from "./design-canvas-diff";
import { mergeDesignCanvas } from "./design-canvas-merge";

function canvas(
  partial: Partial<DesignCanvas> & { placements: DesignCanvas["placements"] },
): DesignCanvas {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    project_id: "22222222-2222-4222-8222-222222222222",
    strokes: [],
    irrigation_zones: [],
    construction_trenches: [],
    annotations: [],
    image_layers: [],
    features: [],
    updated_at: "2026-08-01T00:00:00.000Z",
    ...partial,
  };
}

describe("diffDesignCanvas", () => {
  it("detects added and removed placements", () => {
    const a = canvas({
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
    });
    const b = canvas({
      placements: [
        {
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          symbol_id: "lomandra-mass",
          x_pct: 20,
          y_pct: 20,
          rotation_deg: 0,
          scale: 1,
        },
      ],
    });
    const d = diffDesignCanvas(a, b);
    expect(d.added).toBe(1);
    expect(d.removed).toBe(1);
  });
});

describe("mergeDesignCanvas", () => {
  it("auto-merges non-overlapping additions", () => {
    const base = canvas({ placements: [] });
    const ours = canvas({
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
    });
    const theirs = canvas({
      placements: [
        {
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          symbol_id: "lomandra-mass",
          x_pct: 40,
          y_pct: 40,
          rotation_deg: 0,
          scale: 1,
        },
      ],
      construction_trenches: [
        {
          id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          name: "Irrig main",
          kind: "irrig_main",
          points: [
            { x_pct: 10, y_pct: 10 },
            { x_pct: 50, y_pct: 10 },
          ],
          depth_mm: 400,
          source: "auto",
        },
      ],
    });
    const result = mergeDesignCanvas({ base, ours, theirs });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.canvas.placements).toHaveLength(2);
    expect(result.canvas.construction_trenches).toHaveLength(1);
  });

  it("surfaces conflicts when both sides edit the same id", () => {
    const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const base = canvas({
      placements: [
        {
          id,
          symbol_id: "hornbeam-pleached",
          x_pct: 10,
          y_pct: 10,
          rotation_deg: 0,
          scale: 1,
        },
      ],
    });
    const ours = canvas({
      placements: [
        {
          id,
          symbol_id: "hornbeam-pleached",
          x_pct: 12,
          y_pct: 10,
          rotation_deg: 0,
          scale: 1,
        },
      ],
    });
    const theirs = canvas({
      placements: [
        {
          id,
          symbol_id: "hornbeam-pleached",
          x_pct: 10,
          y_pct: 18,
          rotation_deg: 0,
          scale: 1,
        },
      ],
    });
    const conflicted = mergeDesignCanvas({ base, ours, theirs });
    expect(conflicted.ok).toBe(false);
    if (conflicted.ok) return;
    expect(conflicted.conflicts[0]?.id).toBe(id);

    const resolved = mergeDesignCanvas({
      base,
      ours,
      theirs,
      resolutions: { [id]: "theirs" },
    });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.canvas.placements[0]?.y_pct).toBe(18);
  });
});
