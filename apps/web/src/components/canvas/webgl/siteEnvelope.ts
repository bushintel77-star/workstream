/**
 * Site Envelope bridge — web-side fusion feeding the domain envelope.
 *
 * Translates real studio data into evidence records the domain can consume
 * without inventing anything:
 *  - Vicmap overlay flags (flood / wetland / acid sulfate / EVC label);
 *  - terrain-derived ponding + streams (the SAME D8 flow grid the drainage
 *    layer renders — one truth, two consumers);
 *  - slope from the spot-level steepest fall (the meta chip math).
 *
 * The domain result is runtime-validated against the zod contract at this
 * boundary (SiteEnvelopeSchema.parse) — schema drift fails loudly here, not
 * silently in the UI. Null when there is no site truth (no pin) — the chip
 * simply does not exist (zero-mock law).
 */

import { SiteEnvelopeSchema } from "@workstream/contracts";
import type {
  DesignKeylessOverlay,
  SiteEnvelope,
  WetnessDriver,
} from "@workstream/contracts";
import {
  buildSiteEnvelope,
  type SiteEnvelopeInput,
} from "@workstream/domain";
import { createElevationSampler } from "./terrainMath";
import type { HeightmapPoint } from "./coordTransform";
import { buildStudioFlowGrid, findPondingPoints, traceStreamNetwork } from "./flowField";
import { steepestFall } from "./metaChips";

/** Only ponding deeper than this is a planting-relevant wetness driver. */
const POND_DRIVER_MIN_DEPTH_M = 0.05;
/** Stream paths below this count are background drainage, not a driver. */
const STREAM_DRIVER_MIN_PATHS = 1;

function overlay(overlays: DesignKeylessOverlay[], kind: string): DesignKeylessOverlay | undefined {
  return overlays.find((o) => o.kind === kind);
}

export function buildStudioSiteEnvelope(input: {
  lat?: number | null;
  lng?: number | null;
  overlays: DesignKeylessOverlay[];
  heightmapPoints: HeightmapPoint[];
  scaleM: number;
  boardAspect: number;
  month?: number;
}): SiteEnvelope | null {
  if (input.lat == null || input.lng == null) return null;

  const drivers: WetnessDriver[] = [];
  const flood = overlay(input.overlays, "flood");
  if (flood) {
    drivers.push({
      kind: "flood_overlay",
      evidence: `${flood.label?.trim() || "Overland flow"} overlay (Vicmap)`,
    });
  }
  const wetland = overlay(input.overlays, "wetland");
  if (wetland) {
    drivers.push({
      kind: "wetland_overlay",
      evidence: `${wetland.label?.trim() || "Wetland"} overlay (Vicmap)`,
    });
  }

  if (input.heightmapPoints.length >= 3) {
    const sampler = createElevationSampler(input.heightmapPoints, input.scaleM, input.boardAspect);
    if (sampler) {
      const grid = buildStudioFlowGrid(sampler, input.scaleM, input.boardAspect);
      const ponding = findPondingPoints(grid);
      const relevant = ponding.filter((p) => p.depthM >= POND_DRIVER_MIN_DEPTH_M);
      if (relevant.length > 0) {
        const maxDepth = Math.max(...relevant.map((p) => p.depthM));
        drivers.push({
          kind: "ponding",
          evidence: `${relevant.length} ponding point${relevant.length === 1 ? "" : "s"}, max ${maxDepth.toFixed(2)} m (terrain D8)`,
        });
      }
      const streams = traceStreamNetwork(grid);
      if (streams.length >= STREAM_DRIVER_MIN_PATHS) {
        drivers.push({
          kind: "streams",
          evidence: `${streams.length} overland flow path${streams.length === 1 ? "" : "s"} (terrain D8)`,
        });
      }
    }
  }

  const fall = steepestFall(input.heightmapPoints);
  const envelopeInput: SiteEnvelopeInput = {
    lat: input.lat,
    lng: input.lng,
    ...(input.month != null ? { month: input.month } : {}),
    wetnessDrivers: drivers,
    slope: fall ? { slopeDeg: fall.slopeDeg, aspect: fall.aspect } : null,
    acidSulfate: overlay(input.overlays, "acid_sulfate") != null,
    nativeVegetationLabel: overlay(input.overlays, "native_vegetation")?.label?.trim() || null,
  };

  return SiteEnvelopeSchema.parse(buildSiteEnvelope(envelopeInput));
}
