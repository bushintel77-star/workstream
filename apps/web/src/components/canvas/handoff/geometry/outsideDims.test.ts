import { describe, expect, it } from "vitest";
import { edgeSegments } from "./polygon";
import { buildOutsideDims } from "./outsideDims";

const lot = [
  { x: 40, y: 20 },
  { x: 55, y: 20 },
  { x: 55, y: 80 },
  { x: 40, y: 80 },
];

describe("buildOutsideDims", () => {
  it("offsets B dims outside a rectangular lot", () => {
    const segs = edgeSegments(lot, "B", 110);
    const dims = buildOutsideDims(segs, lot);
    expect(dims).toHaveLength(4);
    const c = { x: 47.5, y: 50 };
    for (const d of dims) {
      const midX = (d.x1 + d.x2) / 2;
      const midY = (d.y1 + d.y2) / 2;
      const edgeMid = segs.find((s) => s.key === d.key)!.mid;
      const dimDist = (midX - c.x) ** 2 + (midY - c.y) ** 2;
      const edgeDist = (edgeMid.x - c.x) ** 2 + (edgeMid.y - c.y) ** 2;
      expect(dimDist).toBeGreaterThan(edgeDist);
    }
  });
});
