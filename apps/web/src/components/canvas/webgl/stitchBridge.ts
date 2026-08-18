/**
 * Gold Standard 2026 — Stitch Bridge (domain stitcher ↔ persisted canvas).
 *
 * Converts between the domain stitching engine (`@workstream/domain`
 * canvasStitcher — world-metre `StitchedFeature`s) and the persisted
 * `DesignCanvas` contract (`LandscapeFeature` board-% geometry):
 *
 *   - `stitchSketchStrokesToFeatures` — board-% ink → world metres →
 *     `stitchCanvasStrokes` → `LandscapeFeature[]` + `StitchRecord[]`
 *     provenance (so a merged path can be split again).
 *   - `unstitchFeatureToSketchStrokes` — a `StitchRecord` back into board-%
 *     sketch strokes (the non-destructive split primitive).
 *
 * Source ink is always kept (SVG convert parity): stitching never removes
 * the strokes it welds — undo and un-stitch both stay lossless.
 */

import type { CanvasStroke, LandscapeFeature } from "@workstream/contracts";
import {
  stitchCanvasStrokes,
  stitchRecordOf,
  type LayerID,
  type SpatialStroke,
  type StitchRecord,
  type StitchedFeature,
} from "@workstream/domain";
import type { FeatureLayer } from "@workstream/contracts";
import { pctToWorld, worldToPct } from "./coordTransform";

const clampPct = (v: number): number => Math.max(0, Math.min(100, v));

/** Domain Layer Registry id → contract FeatureLayer (rendering group). */
const LAYER_TO_FEATURE_LAYER: Partial<Record<LayerID, FeatureLayer>> = {
  "softscape.planting": "softscape_beds",
  "hardscape.paving": "hardscape",
  "civil.irrigation_main": "irrigation",
};

const FEATURE_LABELS: Partial<Record<LayerID, string>> = {
  "softscape.planting": "Stitched planting bed",
  "hardscape.paving": "Stitched paving linework",
  "civil.trench": "Stitched trench run",
  "civil.irrigation_main": "Stitched irrigation run",
  "civil.lighting_low_volt": "Stitched lighting run",
  "services.gas": "Stitched gas run",
  "vicmap.easement": "Stitched easement",
  "cadastre.title_boundary": "Stitched boundary line",
  "cadastre.building_footprint": "Stitched footprint",
  "draft.user_draft": "Stitched draft line",
};

/** World-metre `StitchedFeature` → board-% `LandscapeFeature`. */
export function stitchedToLandscapeFeature(
  feature: StitchedFeature,
  scaleM: number,
  boardAspect: number,
): LandscapeFeature {
  const isPolygon = feature.kind === "polygon";
  const src = isPolygon ? feature.ring : feature.points;
  const pts = src.map((p, i) => {
    const pct = worldToPct(p.x, p.y, scaleM, boardAspect);
    return {
      id: `${feature.id}-v${i}`,
      pct: { x_pct: clampPct(pct.x), y_pct: clampPct(pct.y) },
    };
  });
  let points = pts;
  if (isPolygon && pts.length >= 3) {
    const first = pts[0]!;
    const last = pts[pts.length - 1]!;
    if (first.pct.x_pct !== last.pct.x_pct || first.pct.y_pct !== last.pct.y_pct) {
      points = [...pts, { id: `${feature.id}-close`, pct: { ...first.pct } }];
    }
  }
  return {
    id: feature.id,
    type: "LandscapeFeature",
    metadata: {
      layer: LAYER_TO_FEATURE_LAYER[feature.layerId] ?? "other",
      friendly_name: FEATURE_LABELS[feature.layerId] ?? "Stitched linework",
      timestamp_created: new Date().toISOString(),
      source_attribution: "human_drawn",
      user_modification_state: "draft",
    },
    geometry: {
      type: isPolygon ? "Polygon" : "LineString",
      spatial_reference: "EPSG:3857",
      canvas_origin_pct: { x_pct: 0, y_pct: 0 },
      points,
    },
  };
}

export interface StitchBridgeResult {
  features: LandscapeFeature[];
  /** featureId → provenance record for the un-stitch primitive. */
  records: Record<string, StitchRecord>;
  count: number;
}

/**
 * Stitch the current board-% sketch ink into persisted CAD features.
 * Photo-trace strokes stay elevation-space and are never fed here.
 */
export function stitchSketchStrokesToFeatures(
  strokes: CanvasStroke[],
  scaleM: number,
  boardAspect: number,
  epsilonM: number,
): StitchBridgeResult {
  const spatial: SpatialStroke[] = strokes.map((s) => ({
    id: s.id,
    points: (s.points ?? []).map((p) => {
      const [x, z] = pctToWorld({ x: p.x_pct, y: p.y_pct }, scaleM, boardAspect);
      return { x, y: z };
    }),
    source: "user_stroke",
  }));
  const stitched = stitchCanvasStrokes(spatial, { epsilonM });
  const features: LandscapeFeature[] = [];
  const records: Record<string, StitchRecord> = {};
  for (const f of stitched) {
    features.push(stitchedToLandscapeFeature(f, scaleM, boardAspect));
    records[f.id] = stitchRecordOf(f);
  }
  return { features, records, count: stitched.length };
}

/**
 * Un-stitch a merged entity: split its fused runs back into board-% sketch
 * strokes (the non-destructive split primitive). The caller keeps the
 * entity and its undo snapshot; the returned ink reconnects at the welds.
 */
export function unstitchFeatureToSketchStrokes(
  record: StitchRecord,
  scaleM: number,
  boardAspect: number,
): CanvasStroke[] {
  return record.segments.map((seg) => ({
    id: crypto.randomUUID(),
    points: seg.map((p) => {
      const pct = worldToPct(p.x, p.y, scaleM, boardAspect);
      return { x_pct: clampPct(pct.x), y_pct: clampPct(pct.y) };
    }),
    color: "#ff2ef6",
    width_px: 2.5,
    kind: "ink",
  }));
}
