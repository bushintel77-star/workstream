/**
 * Scan choreography — the category-aware site-truth reveal plan (pure).
 *
 * Turns the hydrated site-truth inventory into an ordered sequence of
 * reveal events, each with its category's visual language:
 *   cadastre (title boundary) → draw-on vector line
 *   parcels (buildings + neighbours) → extrude-up masses
 *   services (easements + BYDA lines) → ant-path dashes
 *   terrain (heightmap + contours) → foundational fade
 *   flora (existing trees) → organic canopy grow
 *
 * Zero-mock law: absent categories emit no event — the reveal never
 * invents entities. Labels carry the real counts ("Placing 31 existing
 * trees"). The zod schemas live in @workstream/contracts
 * (scan-choreography.ts) so web code validates without importing zod
 * directly; the output is parsed through ScanChoreographySchema, keeping
 * the store clock, the overlay labels and the scene director on one
 * checked contract.
 */

import {
  ScanChoreographySchema,
  type ScanChoreography,
  type ScanStageEvent,
} from "@workstream/contracts";

export type { ScanChoreography, ScanStageEvent, ScanStageName, ScanRevealMode } from "@workstream/contracts";

export interface ScanChoreographyInput {
  boundaryPts: number;
  buildingCount: number;
  neighbourCount: number;
  easementCount: number;
  serviceLineCount: number;
  hasTerrain: boolean;
  contourRingCount: number;
  treeCount: number;
}

/** Trees reveal slightly longer as the count grows (capped for big sites). */
function floraDurationMs(treeCount: number): number {
  return Math.min(2200, 600 + treeCount * 50);
}

export function buildScanChoreography(
  input: ScanChoreographyInput,
): ScanChoreography | null {
  const events: ScanStageEvent[] = [];
  if (input.boundaryPts >= 3) {
    events.push({
      stage: "cadastre",
      mode: "draw",
      durationMs: 900,
      label: `Tracing title boundary · ${input.boundaryPts} points`,
      count: input.boundaryPts,
    });
  }
  const structures = input.buildingCount + input.neighbourCount;
  if (structures > 0) {
    events.push({
      stage: "parcels",
      mode: "extrude",
      durationMs: 900,
      label: `Raising structures · ${structures} building${structures === 1 ? "" : "s"}`,
      count: structures,
    });
  }
  const lines = input.easementCount + input.serviceLineCount;
  if (lines > 0) {
    events.push({
      stage: "services",
      mode: "antpath",
      durationMs: 900,
      label: `Tracing services · ${lines} line${lines === 1 ? "" : "s"}`,
      count: lines,
    });
  }
  const terrainLayers =
    (input.hasTerrain ? 1 : 0) + (input.contourRingCount > 0 ? 1 : 0);
  if (terrainLayers > 0) {
    events.push({
      stage: "terrain",
      mode: "fade",
      durationMs: 900,
      label: `Building terrain · ${terrainLayers === 2 ? "contours + heightmap" : terrainLayers === 1 && input.hasTerrain ? "heightmap" : "contours"}`,
      count: terrainLayers,
    });
  }
  if (input.treeCount > 0) {
    events.push({
      stage: "flora",
      mode: "grow",
      durationMs: floraDurationMs(input.treeCount),
      label: `Placing ${input.treeCount} existing tree${input.treeCount === 1 ? "" : "s"}`,
      count: input.treeCount,
    });
  }
  if (events.length === 0) return null;
  return ScanChoreographySchema.parse({ events });
}
