/**
 * ResCode A2-6 canopy compliance — web-side surface helper (pure).
 *
 * Bridges the studio's placements into the domain assessment
 * (`@workstream/domain` rescode-canopy) and adds the boundary overhang
 * advisory. Pure: no React, no DOM, no store.
 *
 * Maturity dimensions follow the platform's canonical resolvers
 * (geometry/itemHeight): the placed symbol's MATURE height/spread, with the
 * placement's measured `height_m` / `canopy_radius_m` (Vicmap LiDAR,
 * arborist measurement) as a floor — both mean "this tree will reach at
 * least this size", which is what A2-6 gates on.
 *
 * Advisory honesty: canopy discs MAY overhang the title fence by design
 * (`outdoorClamp.ts` — "we never clip crowns to the lot"), so overhang is
 * reported, never enforced.
 */

import type { CatalogPlacement } from "@workstream/contracts";
import {
  assessCanopyCompliance,
  type CanopyComplianceAssessment,
  type CanopyTreeCandidate,
} from "@workstream/domain";
import {
  resolveItemMatureHeightM,
  resolveItemSpreadM,
} from "../handoff/geometry/itemHeight";
import { LOT_AGREEMENT_FACTOR } from "../handoff/geometry/siteScheduleDisplay";
import { pointInPolygon } from "../handoff/geometry/polygon";
import { placementsToItems } from "../handoff/state/canvasBridge";
import type { StudioItem, StudioItemType } from "../handoff/studioCatalog";
import { boundaryAreaM2 } from "./metaChips";
import type { PctPoint } from "./coordTransform";

/** Scene item types that are trees (mirrors sceneItems SPECIES_TYPES). */
const TREE_TYPES: ReadonlySet<StudioItemType> = new Set(["canopy", "feature", "exist"]);

export interface CanopyComplianceInput {
  placements: CatalogPlacement[];
  boundary: PctPoint[];
  scaleM: number;
  boardAspect?: number;
  /** Cadastral lot area when known (title record); else derived off the ring. */
  lotAreaM2?: number | null;
}

export interface CanopyComplianceResult {
  assessment: CanopyComplianceAssessment;
  /** Trees whose mature canopy disc crosses the title boundary (advisory). */
  overhangingCount: number;
  /** Trees whose centre sits outside the title boundary entirely. */
  outsideCount: number;
  /**
   * Title lot area and the drawn ring disagree beyond
   * LOT_AGREEMENT_FACTOR — the operator must reconcile before trusting the
   * count (same discipline as the site schedule's lotDisagreement).
   */
  areaDisagreement: boolean;
}

/** board-% point → world metres (aspect = board height/width; the board is
 * square by law — page passes 1 — so this is metres per board-% both axes). */
function ptToM(p: PctPoint, scaleM: number, boardAspect: number): { x: number; y: number } {
  return { x: (p.x / 100) * scaleM, y: (p.y / 100) * (scaleM * boardAspect) };
}

/** Shortest distance from a point to a closed ring's edge segments (m). */
function minDistanceToRingM(
  px: number,
  py: number,
  ring: Array<{ x: number; y: number }>,
): number {
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / len2));
    const ex = a.x + t * dx - px;
    const ey = a.y + t * dy - py;
    best = Math.min(best, Math.hypot(ex, ey));
  }
  return best;
}

function candidateFor(item: StudioItem, placement: CatalogPlacement): CanopyTreeCandidate {
  // Measured values are a floor; the symbol/type mature resolvers are the
  // platform's one source of maturity truth (itemHeight doc).
  const measuredHeight = placement.height_m ?? 0;
  const resolvedHeight = resolveItemMatureHeightM(item);
  const matureHeightM = Math.max(measuredHeight, resolvedHeight);
  // resolveItemSpreadM returns the mature spread WIDTH (m); A2-6 candidates
  // carry radius; measured canopy_radius_m is already a radius.
  const measuredRadius = placement.canopy_radius_m ?? 0;
  const resolvedRadius = (resolveItemSpreadM(item) ?? 0) / 2;
  const matureCanopyRadiusM = Math.max(measuredRadius, resolvedRadius);
  return {
    id: item.id,
    ...(placement.label?.trim() ? { label: placement.label.trim() } : {}),
    ...(item.source ? { source: item.source } : {}),
    matureHeightM: matureHeightM > 0 ? matureHeightM : null,
    matureCanopyRadiusM: matureCanopyRadiusM > 0 ? matureCanopyRadiusM : null,
  };
}

/**
 * Build the A2-6 assessment for the studio. Returns null when there is no
 * site truth at all (no boundary AND no cadastral area) — absent data
 * produces an absent chip (zero-mock law), never a fabricated requirement.
 */
export function buildCanopyCompliance(input: CanopyComplianceInput): CanopyComplianceResult | null {
  const boardAspect = input.boardAspect ?? 1;
  const hasBoundary = input.boundary.length >= 3;
  if (!hasBoundary && (input.lotAreaM2 == null || input.lotAreaM2 <= 0)) return null;

  const areaM2 =
    input.lotAreaM2 != null && input.lotAreaM2 > 0
      ? input.lotAreaM2
      : boundaryAreaM2(input.boundary, input.scaleM, boardAspect);
  const ringAreaM2 = hasBoundary
    ? boundaryAreaM2(input.boundary, input.scaleM, boardAspect)
    : null;
  const areaDisagreement =
    input.lotAreaM2 != null &&
    input.lotAreaM2 > 0 &&
    ringAreaM2 != null &&
    ringAreaM2 > 0 &&
    (Math.max(input.lotAreaM2, ringAreaM2) /
      Math.min(input.lotAreaM2, ringAreaM2) >
      LOT_AGREEMENT_FACTOR);

  const items = placementsToItems(input.placements);
  const byId = new Map(input.placements.map((p) => [p.id, p]));
  const candidates: CanopyTreeCandidate[] = [];
  const ringM = hasBoundary
    ? input.boundary.map((p) => ptToM(p, input.scaleM, boardAspect))
    : [];

  let overhangingCount = 0;
  let outsideCount = 0;
  for (const item of items) {
    if (!TREE_TYPES.has(item.t)) continue;
    const placement = byId.get(item.id);
    if (!placement) continue;
    candidates.push(candidateFor(item, placement));

    if (ringM.length >= 3) {
      const centre = ptToM({ x: placement.x_pct, y: placement.y_pct }, input.scaleM, boardAspect);
      const inside = pointInPolygon(
        { x: placement.x_pct, y: placement.y_pct },
        input.boundary,
      );
      const radiusM = Math.max(
        placement.canopy_radius_m ?? 0,
        (resolveItemSpreadM(item) ?? 0) / 2,
      );
      if (!inside) {
        outsideCount += 1;
      } else if (radiusM > 0 && minDistanceToRingM(centre.x, centre.y, ringM) < radiusM) {
        overhangingCount += 1;
      }
    }
  }

  return {
    assessment: assessCanopyCompliance({ siteAreaM2: areaM2, trees: candidates }),
    overhangingCount,
    outsideCount,
    areaDisagreement,
  };
}
