/**
 * Gold Standard 2026 — Cut/Fill (earthworks analysis against sketch pads).
 *
 * Pure module: compares the SHARED terrainMath sampler surface against a
 * design pad — a closed sketch stroke the operator extruded (CanvasStroke
 * with extrude_height_m, already persisted end-to-end). The analysis is
 * WYSIWYG in render space: the pad top sits at `extrude_height_m` world
 * metres and the terrain at the sampler's ×VERTICAL_SCALE-exaggerated value,
 * so "mass top visually level with the yard" ⇒ zero cut/fill at that spot.
 * Real-metre readouts divide by VERTICAL_SCALE — the same "×3 vert / Δ real"
 * convention as the SliceProfileCard.
 *
 *   diff = padTopY − terrainY   (exaggerated units)
 *     diff > 0 → fill (pad floats above the existing surface — build up)
 *     diff < 0 → cut  (pad sits below the surface — excavate down)
 *   real m³ = (|diff| / VERTICAL_SCALE) × cellArea
 *
 * This module is also the single definition of "what is a pad" (padStrokes
 * below), and it recognises TWO sources:
 *
 *   1. a closed sketch stroke carrying a positive extrude_height_m — the
 *      freehand drag-up gesture, earthworks' original and still-live input;
 *   2. a Polygon LandscapeFeature carrying a positive extrude_height_m — a
 *      region drawn with the Area drafting tool and then given a height.
 *
 * Both exist because creation and elevation are separate concerns: Area owns
 * creating a region, height is an edit on one. Persisting an Area as a feature
 * without teaching this module about features would have made Area pads
 * invisible to cut/fill — a silent regression against the freehand behaviour
 * (docs/precision-drafting-tools-spec.md §8.1). The scene renderer
 * (EarthworksLayer) and the DOM readout (EarthworksCard) both call
 * padStrokes(), so the volumes on screen always match the HUD.
 *
 * Binding: docs/GOLD-STANDARD-2026.md §3 Phase 2 (Vertical Truth consumers)
 */

import type { CanvasStroke, LandscapeFeature } from "@workstream/contracts";
import { pctToWorld } from "./coordTransform";
import { VERTICAL_SCALE } from "./terrainMath";

/** Rasterisation cell size (m) for the volume integral + zone mesh. */
export const CUT_FILL_CELL_M = 0.75;

/** Max first↔last point gap (world metres) for a stroke to read as closed. */
const CLOSED_EPSILON_M = 0.5;

/**
 * Point-in-polygon test (ray casting) in the XZ plane.
 *
 * Accepts any polygon of {x, z} points (THREE.Vector3 satisfies the shape —
 * FusedSketchLayer passes its world points straight through). Shared so the
 * extrusion hit-test and the cut/fill rasteriser can never disagree on
 * "inside".
 */
export function pointInPolygonXZ(
  x: number,
  z: number,
  polygon: ReadonlyArray<{ x: number; z: number }>,
): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i]!.x;
    const zi = polygon[i]!.z;
    const xj = polygon[j]!.x;
    const zj = polygon[j]!.z;
    const intersect =
      zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** A design pad — a closed, elevated footprint in world space. */
export interface PadStroke {
  /** Stable pad id — the source stroke id or the source feature id. */
  id: string;
  /** Set when the pad came from an extruded sketch stroke. */
  stroke?: CanvasStroke;
  /** Set when the pad came from a region carrying a height. */
  feature?: LandscapeFeature;
  /** Footprint polygon in world metres [{x, z}]. */
  worldXZ: Array<{ x: number; z: number }>;
  /** Pad top height in world (render) metres — the extrusion depth. */
  heightM: number;
}

/**
 * Select + convert every design pad in the document.
 *
 * A stroke pad = closed (first↔last within CLOSED_EPSILON_M) with
 * extrude_height_m > 0. Auto-closed strokes re-append their first point, so
 * committed pads match exactly; the epsilon also tolerates hand-drawn
 * near-closures.
 *
 * A feature pad = a Polygon LandscapeFeature (≥3 vertices, closed by
 * definition — the ring is not stored with a duplicated last point) with
 * extrude_height_m > 0.
 *
 * `features` is optional so existing callers that only have ink keep working.
 */
export function padStrokes(
  strokes: CanvasStroke[],
  scaleM: number,
  boardAspect: number,
  features: LandscapeFeature[] = [],
): PadStroke[] {
  const pads: PadStroke[] = [];
  for (const stroke of strokes) {
    const heightM = stroke.extrude_height_m ?? 0;
    if (heightM <= 0) continue;
    const pts = stroke.points ?? [];
    if (pts.length < 3) continue;

    const worldXZ = pts.map((p) => {
      const [x, z] = pctToWorld({ x: p.x_pct, y: p.y_pct }, scaleM, boardAspect);
      return { x, z };
    });

    const first = worldXZ[0]!;
    const last = worldXZ[worldXZ.length - 1]!;
    const gap = Math.hypot(last.x - first.x, last.z - first.z);
    if (gap > CLOSED_EPSILON_M) continue;

    pads.push({ id: stroke.id, stroke, worldXZ, heightM });
  }

  for (const feature of features) {
    const heightM = feature.extrude_height_m ?? 0;
    if (heightM <= 0) continue;
    if (feature.geometry.type !== "Polygon") continue;
    const ring = feature.geometry.points;
    if (ring.length < 3) continue;

    const worldXZ = ring.map((v) => {
      const [x, z] = pctToWorld(
        { x: v.pct.x_pct, y: v.pct.y_pct },
        scaleM,
        boardAspect,
      );
      return { x, z };
    });

    pads.push({ id: feature.id, feature, worldXZ, heightM });
  }

  return pads;
}

/** One raster cell of the cut/fill integral (renderer + readout share it). */
export interface CutFillCell {
  /** Cell centre, world metres. */
  x: number;
  z: number;
  /** Pad minus terrain, REAL metres. Positive = fill, negative = cut. */
  diffM: number;
}

export interface PadCutFillResult {
  /** Footprint area (cells inside the polygon). */
  areaM2: number;
  /** Excavation volume, real m³. */
  cutM3: number;
  /** Build-up volume, real m³. */
  fillM3: number;
  /** Deepest cut, real metres. */
  maxCutM: number;
  /** Highest fill above existing, real metres. */
  maxFillM: number;
  /** Inside cells, raster order (row-major over the bbox). */
  cells: CutFillCell[];
}

/**
 * Integrate cut/fill between the terrain surface and a flat pad top over the
 * pad footprint, by midpoint rasterisation at cellSizeM resolution.
 *
 * The sampler returns exaggerated metres; padTopY is in the same world units,
 * and every output is converted to real metres/volumes via VERTICAL_SCALE.
 */
export function padCutFill(
  sampler: (worldX: number, worldZ: number) => number,
  polygon: ReadonlyArray<{ x: number; z: number }>,
  padTopY: number,
  cellSizeM: number = CUT_FILL_CELL_M,
): PadCutFillResult {
  const result: PadCutFillResult = {
    areaM2: 0,
    cutM3: 0,
    fillM3: 0,
    maxCutM: 0,
    maxFillM: 0,
    cells: [],
  };
  if (polygon.length < 3 || cellSizeM <= 0) return result;

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const p of polygon) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.z < minZ) minZ = p.z;
    if (p.z > maxZ) maxZ = p.z;
  }

  const cellArea = cellSizeM * cellSizeM;
  const half = cellSizeM / 2;

  for (let z = minZ + half; z < maxZ; z += cellSizeM) {
    for (let x = minX + half; x < maxX; x += cellSizeM) {
      if (!pointInPolygonXZ(x, z, polygon)) continue;
      const diffReal = (padTopY - sampler(x, z)) / VERTICAL_SCALE;
      result.cells.push({ x, z, diffM: diffReal });
      result.areaM2 += cellArea;
      if (diffReal > 0) {
        result.fillM3 += diffReal * cellArea;
        if (diffReal > result.maxFillM) result.maxFillM = diffReal;
      } else if (diffReal < 0) {
        result.cutM3 += -diffReal * cellArea;
        if (-diffReal > result.maxCutM) result.maxCutM = -diffReal;
      }
    }
  }
  return result;
}
