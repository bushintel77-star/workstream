import { afterEach, describe, expect, it } from "vitest";
import type { CanvasStroke } from "@workstream/contracts";
import {
  stitchSketchStrokesToFeatures,
  unstitchFeatureToSketchStrokes,
} from "./stitchBridge";
import { useStudioStore } from "./studioStore";

const SCALE_M = 20;
const ASPECT = 1.25;

function inkStroke(
  id: string,
  pts: Array<[number, number] | { x_pct: number; y_pct: number }>,
): CanvasStroke {
  return {
    id,
    points: pts.map((p) =>
      Array.isArray(p) ? { x_pct: p[0]!, y_pct: p[1]! } : p,
    ),
    color: "#ff2ef6",
    width_px: 2.5,
    kind: "ink",
  };
}

afterEach(() => {
  // Reset every slice the stitch actions touch so tests cannot leak.
  useStudioStore.setState({
    sketchStrokes: [],
    features: [],
    stitchRecords: {},
    stitchNotice: null,
    historyPast: [],
    historyFuture: [],
    selection: [],
  });
});

describe("stitchSketchStrokesToFeatures (bridge)", () => {
  it("welds a four-stroke rectangle into one polygon feature + record", () => {
    // A 3 m × 2 m rectangle in the centre of a 20 m board → board-% corners.
    const cx = 50;
    const cy = 50;
    const halfW = (3 / 2 / SCALE_M) * 100; // 7.5 %
    const halfH = (2 / 2 / (SCALE_M * ASPECT)) * 100; // 4 %
    const strokes = [
      inkStroke("s1", [
        [cx - halfW, cy - halfH],
        [cx + halfW, cy - halfH],
      ]),
      inkStroke("s2", [
        [cx + halfW, cy - halfH],
        [cx + halfW, cy + halfH],
      ]),
      inkStroke("s3", [
        [cx + halfW, cy + halfH],
        [cx - halfW, cy + halfH],
      ]),
      inkStroke("s4", [
        [cx - halfW, cy + halfH],
        [cx - halfW, cy - halfH],
      ]),
    ];
    const { features, records, count } = stitchSketchStrokesToFeatures(
      strokes,
      SCALE_M,
      ASPECT,
      0.15,
    );
    expect(count).toBe(1);
    expect(features).toHaveLength(1);
    expect(features[0]!.geometry.type).toBe("Polygon");
    expect(features[0]!.metadata.layer).toBe("other");
    expect(records[features[0]!.id].segments).toHaveLength(4);
  });

  it("round-trips: un-stitched runs re-stitch to the same entity", () => {
    const { features, records, count } = stitchSketchStrokesToFeatures(
      [
        inkStroke("a", [
          { x_pct: 40, y_pct: 40 },
          { x_pct: 60, y_pct: 40 },
        ]),
        inkStroke("b", [
          { x_pct: 60, y_pct: 40 },
          { x_pct: 60, y_pct: 55 },
        ]),
      ],
      SCALE_M,
      ASPECT,
      0.15,
    );
    expect(count).toBe(1);
    const feature = features[0]!;
    const record = records[feature.id]!;
    const split = unstitchFeatureToSketchStrokes(record, SCALE_M, ASPECT);
    expect(split.length).toBeGreaterThanOrEqual(2);
    // The split ink welds again into the same single entity.
    const again = stitchSketchStrokesToFeatures(split, SCALE_M, ASPECT, 0.15);
    expect(again.count).toBe(1);
  });
});

describe("studioStore stitch actions", () => {
  it("stitchSketchStrokes appends a stitched feature + record (undoable)", () => {
    const store = useStudioStore.getState();
    store.setSketchStrokes([
      inkStroke("a", [
        { x_pct: 45, y_pct: 45 },
        { x_pct: 55, y_pct: 45 },
      ]),
      inkStroke("b", [
        { x_pct: 55, y_pct: 45 },
        { x_pct: 55, y_pct: 55 },
      ]),
      inkStroke("c", [
        { x_pct: 55, y_pct: 55 },
        { x_pct: 45, y_pct: 55 },
      ]),
      inkStroke("d", [
        { x_pct: 45, y_pct: 55 },
        { x_pct: 45, y_pct: 45 },
      ]),
    ]);
    const count = useStudioStore.getState().stitchSketchStrokes(SCALE_M, ASPECT);
    expect(count).toBe(1);
    const s = useStudioStore.getState();
    expect(s.features).toHaveLength(1);
    expect(Object.keys(s.stitchRecords)).toHaveLength(1);
    expect(s.sketchStrokes).toHaveLength(4); // source ink kept
    expect(s.historyPast.length).toBeGreaterThan(0);
    // Undo removes the stitched feature; redo restores it.
    useStudioStore.getState().undo();
    expect(useStudioStore.getState().features).toHaveLength(0);
    useStudioStore.getState().redo();
    expect(useStudioStore.getState().features).toHaveLength(1);
  });

  it("unstitchFeature splits a stitched feature back into sketch strokes", () => {
    const store = useStudioStore.getState();
    store.setSketchStrokes([
      inkStroke("a", [
        { x_pct: 45, y_pct: 45 },
        { x_pct: 55, y_pct: 45 },
      ]),
      inkStroke("b", [
        { x_pct: 55, y_pct: 45 },
        { x_pct: 55, y_pct: 55 },
      ]),
      inkStroke("c", [
        { x_pct: 55, y_pct: 55 },
        { x_pct: 45, y_pct: 55 },
      ]),
      inkStroke("d", [
        { x_pct: 45, y_pct: 55 },
        { x_pct: 45, y_pct: 45 },
      ]),
    ]);
    useStudioStore.getState().stitchSketchStrokes(SCALE_M, ASPECT);
    const s = useStudioStore.getState();
    const featureId = s.features[0]!.id;
    const strokesBefore = s.sketchStrokes.length;
    const split = s.unstitchFeature(featureId, SCALE_M, ASPECT);
    expect(split).toBe(4);
    const after = useStudioStore.getState();
    expect(after.features).toHaveLength(0);
    expect(after.sketchStrokes.length).toBe(strokesBefore + 4);
    expect(after.stitchRecords[featureId]).toBeUndefined();
    // Undo restores the feature and its record.
    useStudioStore.getState().undo();
    const restored = useStudioStore.getState();
    expect(restored.features).toHaveLength(1);
    expect(restored.stitchRecords[featureId]).toBeDefined();
  });
});
