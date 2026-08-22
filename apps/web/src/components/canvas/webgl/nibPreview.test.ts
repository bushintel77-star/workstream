import { describe, expect, it } from "vitest";
import { NIBS } from "./nibs";
import {
  NIB_PREVIEW_H,
  NIB_PREVIEW_W,
  nibPreview,
  type NibPreview,
} from "./nibPreview";

const KINDS = ["graphite-6b", "ink-03", "chisel-marker", "stipple"] as const;

function bounds(preview: NibPreview): { minX: number; maxX: number; minY: number; maxY: number } {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const dot of preview.dots) {
    xs.push(dot.x - dot.r, dot.x + dot.r);
    ys.push(dot.y - dot.r, dot.y + dot.r);
  }
  if (preview.path) {
    // Path coords are the control points; the curve stays inside their hull.
    for (const match of preview.path.matchAll(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)) {
      xs.push(Number(match[1]));
      ys.push(Number(match[2]));
    }
    const half = preview.strokeWidth / 2;
    return {
      minX: Math.min(...xs) - half,
      maxX: Math.max(...xs) + half,
      minY: Math.min(...ys) - half,
      maxY: Math.max(...ys) + half,
    };
  }
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

describe("nibPreview", () => {
  it("takes colour, opacity and width from the nib spec, not its own table", () => {
    for (const kind of KINDS) {
      const preview = nibPreview(kind);
      expect(preview.color).toBe(NIBS[kind].color);
      expect(preview.opacity).toBe(NIBS[kind].opacity);
    }
  });

  it("draws a continuous stroke for continuous nibs and dots for stipple", () => {
    expect(nibPreview("ink-03").path).toMatch(/^M /);
    expect(nibPreview("ink-03").dots).toEqual([]);
    expect(nibPreview("stipple").path).toBeNull();
    expect(nibPreview("stipple").dots.length).toBeGreaterThan(1);
  });

  it("keeps every nib's ink inside the preview box", () => {
    for (const kind of KINDS) {
      const box = bounds(nibPreview(kind));
      expect(box.minX, kind).toBeGreaterThanOrEqual(0);
      expect(box.minY, kind).toBeGreaterThanOrEqual(0);
      expect(box.maxX, kind).toBeLessThanOrEqual(NIB_PREVIEW_W);
      expect(box.maxY, kind).toBeLessThanOrEqual(NIB_PREVIEW_H);
    }
  });

  it("reads the four nibs apart on width, cap and edge", () => {
    const graphite = nibPreview("graphite-6b");
    const ink = nibPreview("ink-03");
    const chisel = nibPreview("chisel-marker");

    // A marker band is wider than graphite, which is wider than a 0.3mm pen.
    expect(chisel.strokeWidth).toBeGreaterThan(graphite.strokeWidth);
    expect(graphite.strokeWidth).toBeGreaterThan(ink.strokeWidth);
    // Only the chisel lays a flat band.
    expect(chisel.linecap).toBe("butt");
    expect(ink.linecap).toBe("round");
    // Only graphite feathers its edge (edgeSoft 0.45).
    expect(graphite.soft).toBe(true);
    expect(ink.soft).toBe(false);
    expect(chisel.soft).toBe(false);
  });

  it("is deterministic", () => {
    expect(nibPreview("stipple")).toEqual(nibPreview("stipple"));
    expect(nibPreview("graphite-6b")).toEqual(nibPreview("graphite-6b"));
  });
});
