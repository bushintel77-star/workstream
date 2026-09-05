import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import * as THREE from "three";
import type { CanvasStroke, SketchCanvas } from "@workstream/contracts";
import { TidyHud } from "./TidyHud";
import { useStudioStore } from "./studioStore";

const q = new THREE.Quaternion().setFromAxisAngle(
  new THREE.Vector3(1, 0, 0),
  -Math.PI / 2,
);
const STANDING = [q.x, q.y, q.z, q.w] as SketchCanvas["rotation"];

const CANVAS: SketchCanvas = {
  id: "c-standing",
  label: "Wall study",
  position: [0, 0, 0],
  rotation: STANDING,
  season_tag: "ALL",
};

const WALL_SQUARE = [
  { x_pct: 45, y_pct: 30 },
  { x_pct: 55, y_pct: 30 },
  { x_pct: 55, y_pct: 27 },
  { x_pct: 45, y_pct: 27 },
  { x_pct: 45, y_pct: 30 },
];

const wallStroke = {
  id: "s-wall",
  points: WALL_SQUARE,
  color: "#3B3B3B",
  width_px: 2,
  nib: "ink-03",
  canvas_id: "c-standing",
} as unknown as CanvasStroke;

function renderHud(strokeId = "s-wall"): string {
  return renderToStaticMarkup(
    createElement(TidyHud, { x: 10, y: 10, strokeId, onDismiss: () => {} }),
  );
}

/**
 * Static render reads zustand's SERVER snapshot, which is getInitialState()
 * (the PaletteWidget lesson) — seed the initial snapshot, not the live state.
 */
function seedInitial(patch: Record<string, unknown>) {
  Object.assign(useStudioStore.getInitialState(), patch);
}

describe("<TidyHud> wall preset (Phase 4 seam)", () => {
  it("renders the massing preset with drawn height and reconciliation chip", () => {
    seedInitial({
      sketchStrokes: [wallStroke],
      sketchCanvases: [CANVAS],
      boardScale: { scaleM: 100, boardAspect: 1 },
      siteBoundary: [
        { x: 20, y: 15 },
        { x: 80, y: 15 },
        { x: 80, y: 85 },
        { x: 20, y: 85 },
      ],
    });
    const html = renderHud();
    expect(html).toContain("WALL");
    expect(html).toContain('data-testid="tidy-wall-preset"');
    expect(html).toContain("3.0 m drawn");
    // Contained footprint — the calm chip, not conflict crimson.
    expect(html).toContain('data-reconciliation="contained"');
    expect(html).not.toContain('data-reconciliation="crosses"');
    expect(html).toContain('data-testid="tidy-commit"');
  });

  it("flags the crossing state conflict-crimson when the footprint exits the title", () => {
    // The same wall, but the project's boundary sits far to the east — the
    // footprint at x 45–55% now lies OUTSIDE the ring.
    seedInitial({
      sketchStrokes: [wallStroke],
      sketchCanvases: [CANVAS],
      boardScale: { scaleM: 100, boardAspect: 1 },
      siteBoundary: [
        { x: 5, y: 15 },
        { x: 15, y: 15 },
        { x: 15, y: 85 },
        { x: 5, y: 85 },
      ],
    });
    const html = renderHud();
    expect(html).toContain('data-reconciliation="crosses"');
  });

  it("keeps the plane cycle for non-wall ink (ground bed keeps its routing)", () => {
    const bedStroke = {
      id: "s-bed",
      points: [
        { x_pct: 40, y_pct: 40 },
        { x_pct: 60, y_pct: 40 },
        { x_pct: 60, y_pct: 60 },
        { x_pct: 40, y_pct: 60 },
        { x_pct: 40, y_pct: 40 },
      ],
      color: "#3B3B3B",
      width_px: 4,
      nib: "graphite-6b",
    } as unknown as CanvasStroke;
    seedInitial({
      sketchStrokes: [bedStroke],
      sketchCanvases: [],
      boardScale: { scaleM: 100, boardAspect: 1 },
    });
    const html = renderHud("s-bed");
    expect(html).toContain('data-testid="tidy-plane-toggle"');
    expect(html).not.toContain('data-testid="tidy-wall-preset"');
  });
});
