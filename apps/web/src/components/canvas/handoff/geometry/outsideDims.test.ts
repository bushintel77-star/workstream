import { describe, expect, it } from "vitest";
import { edgeSegments } from "./polygon";
import { buildOutsideDims, readableUpDeg } from "./outsideDims";

describe("readableUpDeg", () => {
  it("keeps angles already readable", () => {
    expect(readableUpDeg(0)).toBe(0);
    expect(readableUpDeg(45)).toBe(45);
    expect(readableUpDeg(90)).toBe(90);
    expect(readableUpDeg(-60)).toBe(-60);
  });

  it("flips upside-down angles by 180° (never mirrored text)", () => {
    expect(readableUpDeg(180)).toBe(0);
    expect(readableUpDeg(91)).toBe(-89);
    expect(readableUpDeg(200)).toBe(20);
    expect(readableUpDeg(270)).toBe(90);
    expect(readableUpDeg(-135)).toBe(45);
  });

  it("result is always within the readable window (-90, 90]", () => {
    for (let d = -720; d <= 720; d += 7) {
      const r = readableUpDeg(d);
      expect(r).toBeGreaterThan(-90.000001);
      expect(r).toBeLessThanOrEqual(90);
    }
  });
});

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

  it("includes witness extension segments past the dim string", () => {
    const segs = edgeSegments(lot, "B", 110);
    const dims = buildOutsideDims(segs, lot, {
      offsetPct: 2.4,
      gapPct: 0.35,
      overshootPct: 0.5,
    });
    for (const d of dims) {
      expect(d.extA).toBeDefined();
      expect(d.extB).toBeDefined();
      // Extension end should sit outside the dim string (further from centroid).
      const c = { x: 47.5, y: 50 };
      const dimMid = { x: (d.x1 + d.x2) / 2, y: (d.y1 + d.y2) / 2 };
      const extEnd = { x: d.extA.x2, y: d.extA.y2 };
      const dimDist = (dimMid.x - c.x) ** 2 + (dimMid.y - c.y) ** 2;
      const extDist = (extEnd.x - c.x) ** 2 + (extEnd.y - c.y) ** 2;
      expect(extDist).toBeGreaterThan(dimDist);
    }
  });
});
