import type { DesignBuildingSource } from "@workstream/contracts";
import type { PctPoint } from "./types";
import {
  applyCanvasMetresTransform,
  fitCanvasMetresRing,
  type CanvasMetresFit,
  type CanvasMetresTransform,
} from "./geoToPct";
import {
  reprojectDocToBoundary,
  reprojectRingFromRing,
  type ReprojectableDoc,
} from "./reprojectToBoundary";

export type ParcelSnapBuildingSource = DesignBuildingSource;

export type ParcelSnapResult = {
  snap: ReprojectableDoc;
  buildingSource: ParcelSnapBuildingSource;
};

export type AutoTraceParcelInput = {
  boundary: {
    source_kind: string;
    vertices: Array<{
      sequence_index: number;
      canvas_coords: { x: number; y: number };
    }>;
  };
  building_canvas?: Array<{ x: number; y: number }> | null;
  building_source?: "vicmap" | null;
};

/**
 * After a Vicmap/title parcel snap: rebind items/strokes into the new lot,
 * and set the dwelling from co-registered Vicmap house verts — never from
 * the demo seed parallelogram.
 *
 * - Operator-traced dwelling is preserved (reprojected into the new lot).
 * - Otherwise Vicmap/survey house canvas-metres are fitted with the title
 *   transform.
 * - If neither exists, building is cleared (`empty`) so seed cannot leak.
 */
export function applyParcelSnap(args: {
  snap: ReprojectableDoc;
  nextBoundary: PctPoint[];
  houseCanvasVerts?: Array<{ x: number; y: number }> | null;
  transform: CanvasMetresTransform | null;
  keepTracedBuilding: boolean;
}): ParcelSnapResult {
  const {
    snap,
    nextBoundary,
    houseCanvasVerts,
    transform,
    keepTracedBuilding,
  } = args;

  if (
    keepTracedBuilding &&
    snap.building.length >= 3 &&
    snap.boundary.length >= 3
  ) {
    const building = reprojectRingFromRing(
      snap.building,
      snap.boundary,
      nextBoundary,
    );
    return {
      snap: reprojectDocToBoundary(snap, nextBoundary, { building }),
      buildingSource: "traced",
    };
  }

  if (
    houseCanvasVerts &&
    houseCanvasVerts.length >= 3 &&
    transform != null
  ) {
    const building = applyCanvasMetresTransform(houseCanvasVerts, transform);
    return {
      snap: reprojectDocToBoundary(snap, nextBoundary, { building }),
      buildingSource: "vicmap",
    };
  }

  return {
    snap: reprojectDocToBoundary(snap, nextBoundary, {
      building: "reproject-items-only",
    }),
    buildingSource: "empty",
  };
}

/**
 * Apply an `/boundary/auto-trace` response onto a studio snapshot.
 * Returns null when the title ring is unusable.
 */
export function applyAutoTraceParcelSnap(args: {
  snap: ReprojectableDoc;
  res: AutoTraceParcelInput;
  keepTracedBuilding: boolean;
}): (ParcelSnapResult & {
  fit: CanvasMetresFit;
  boundarySource: "vicmap" | "manual";
}) | null {
  const verts = [...args.res.boundary.vertices]
    .sort((a, b) => a.sequence_index - b.sequence_index)
    .map((v) => v.canvas_coords);
  const fit = fitCanvasMetresRing(verts);
  if (fit.points.length < 3) return null;
  const snapped = applyParcelSnap({
    snap: args.snap,
    nextBoundary: fit.points,
    houseCanvasVerts: args.res.building_canvas,
    transform: fit.transform,
    keepTracedBuilding: args.keepTracedBuilding,
  });
  return {
    ...snapped,
    fit,
    boundarySource:
      args.res.boundary.source_kind === "vicmap" ? "vicmap" : "manual",
  };
}
