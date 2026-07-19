import { describe, expect, it } from "vitest";
import { buildFitSheetEdges } from "./fit-sheet-edges";

describe("buildFitSheetEdges", () => {
  it("labels boundary edges B1… and prefers longer edges", () => {
    const edges = buildFitSheetEdges(
      [
        {
          id: "lot",
          kind: "boundary",
          points: [
            { x: 0, y: 0 },
            { x: 20, y: 0 },
            { x: 20, y: 12 },
            { x: 0, y: 12 },
            { x: 0, y: 0 },
          ],
        },
      ],
      12,
    );
    expect(edges.length).toBe(4);
    expect(edges[0]!.label).toMatch(/^B\d/);
    expect(edges.every((e) => e.label.includes("m"))).toBe(true);
  });
});
