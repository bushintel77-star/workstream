import { describe, it, expect } from "vitest";
import {
  canvasThumbnailPaths,
  canvasThumbnailSvg,
  THUMB_W,
  THUMB_H,
} from "./canvasThumbnail";
import type { CanvasStroke } from "@workstream/contracts";

function makeStroke(
  id: string,
  points: Array<{ x_pct: number; y_pct: number }>,
  canvasId: string | null = null,
  color = "#ff2ef6",
): CanvasStroke {
  return {
    id,
    points,
    color,
    width_px: 2,
    canvas_id: canvasId,
  };
}

describe("canvasThumbnailPaths", () => {
  it("returns empty string for no strokes", () => {
    expect(canvasThumbnailPaths([], "canvas-1")).toBe("");
  });

  it("returns empty string when no strokes match the canvas id", () => {
    const strokes = [
      makeStroke("s1", [{ x_pct: 0, y_pct: 0 }, { x_pct: 50, y_pct: 50 }], "other-canvas"),
    ];
    expect(canvasThumbnailPaths(strokes, "canvas-1")).toBe("");
  });

  it("excludes ground-plane strokes (canvas_id === null)", () => {
    const strokes = [
      makeStroke("s1", [{ x_pct: 0, y_pct: 0 }, { x_pct: 50, y_pct: 50 }], null),
    ];
    expect(canvasThumbnailPaths(strokes, "canvas-1")).toBe("");
  });

  it("renders a single matching stroke as one path", () => {
    const strokes = [
      makeStroke("s1", [{ x_pct: 0, y_pct: 0 }, { x_pct: 100, y_pct: 100 }], "canvas-1"),
    ];
    const result = canvasThumbnailPaths(strokes, "canvas-1");
    expect(result).toContain("<path");
    expect(result).toContain("M 0.0 0.0");
    expect(result).toContain(`L ${THUMB_W.toFixed(1)} ${THUMB_H.toFixed(1)}`);
  });

  it("renders multiple matching strokes as multiple paths", () => {
    const strokes = [
      makeStroke("s1", [{ x_pct: 0, y_pct: 0 }, { x_pct: 50, y_pct: 50 }], "canvas-1"),
      makeStroke("s2", [{ x_pct: 10, y_pct: 10 }, { x_pct: 90, y_pct: 90 }], "canvas-1"),
    ];
    const result = canvasThumbnailPaths(strokes, "canvas-1");
    expect(result.match(/<path/g)?.length).toBe(2);
  });

  it("filters to only the matching canvas when multiple canvases have strokes", () => {
    const strokes = [
      makeStroke("s1", [{ x_pct: 0, y_pct: 0 }, { x_pct: 50, y_pct: 50 }], "canvas-1"),
      makeStroke("s2", [{ x_pct: 10, y_pct: 10 }, { x_pct: 90, y_pct: 90 }], "canvas-2"),
    ];
    const result = canvasThumbnailPaths(strokes, "canvas-1");
    expect(result.match(/<path/g)?.length).toBe(1);
    expect(result).toContain("M 0.0 0.0");
  });

  it("scales board-% coordinates to the thumbnail viewBox", () => {
    const strokes = [
      makeStroke("s1", [{ x_pct: 0, y_pct: 0 }, { x_pct: 100, y_pct: 100 }], "canvas-1"),
    ];
    const result = canvasThumbnailPaths(strokes, "canvas-1");
    // 100% → THUMB_W / THUMB_H
    expect(result).toContain(`L ${THUMB_W.toFixed(1)} ${THUMB_H.toFixed(1)}`);
  });

  it("uses the stroke color", () => {
    const strokes = [
      makeStroke("s1", [{ x_pct: 0, y_pct: 0 }, { x_pct: 50, y_pct: 50 }], "canvas-1", "#00ff00"),
    ];
    const result = canvasThumbnailPaths(strokes, "canvas-1");
    expect(result).toContain('stroke="#00ff00"');
  });

  it("skips strokes with fewer than 2 points", () => {
    const strokes = [
      makeStroke("s1", [{ x_pct: 0, y_pct: 0 }], "canvas-1"),
    ];
    expect(canvasThumbnailPaths(strokes, "canvas-1")).toBe("");
  });
});

describe("canvasThumbnailSvg", () => {
  it("wraps paths in an svg with the correct viewBox", () => {
    const strokes = [
      makeStroke("s1", [{ x_pct: 0, y_pct: 0 }, { x_pct: 100, y_pct: 100 }], "canvas-1"),
    ];
    const result = canvasThumbnailSvg(strokes, "canvas-1");
    expect(result).toContain(`<svg viewBox="0 0 ${THUMB_W} ${THUMB_H}"`);
    expect(result).toContain("</svg>");
    expect(result).toContain("<path");
  });

  it("returns an empty svg for no matching strokes", () => {
    const result = canvasThumbnailSvg([], "canvas-1");
    expect(result).toContain(`<svg viewBox="0 0 ${THUMB_W} ${THUMB_H}"`);
    expect(result).not.toContain("<path");
  });
});
