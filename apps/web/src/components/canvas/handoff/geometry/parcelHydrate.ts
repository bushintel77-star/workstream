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
  /** Vicmap easement LineStrings in canvas metres (same frame as title verts). */
  easement_lines_canvas?: Array<{
    points: Array<{ x: number; y: number }>;
    pfi?: string | null;
    status?: string | null;
  }> | null;
  easement_source?: "vicmap" | null;
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
 *
 * Vicmap easement lines hydrate onto Services corridors when the operator
 * has not already authored corridors (same honesty as dwelling hydrate).
 */
export function applyAutoTraceParcelSnap(args: {
  snap: ReprojectableDoc & { services?: PctPoint[][] };
  res: AutoTraceParcelInput;
  keepTracedBuilding: boolean;
}): (ParcelSnapResult & {
  fit: CanvasMetresFit;
  boundarySource: "vicmap" | "manual";
  /** Set when Vicmap easement lines replace empty services. */
  services?: PctPoint[][];
  easementSource?: "vicmap" | null;
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

  const existingServices = args.snap.services ?? [];
  let services: PctPoint[][] | undefined;
  let easementSource: "vicmap" | null | undefined;
  if (
    fit.transform &&
    args.res.easement_source === "vicmap" &&
    (args.res.easement_lines_canvas?.length ?? 0) > 0 &&
    existingServices.length === 0
  ) {
    services = (args.res.easement_lines_canvas ?? [])
      .map((line) => applyCanvasMetresTransform(line.points, fit.transform!))
      .filter((ring) => ring.length >= 2);
    easementSource = services.length > 0 ? "vicmap" : null;
  }

  return {
    ...snapped,
    fit,
    boundarySource:
      args.res.boundary.source_kind === "vicmap" ? "vicmap" : "manual",
    ...(services ? { services, easementSource } : {}),
  };
}
