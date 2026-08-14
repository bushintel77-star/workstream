/**
 * Gold Standard 2026 — Flora World (ranked planting suggestions, pure math).
 *
 * The WebGL flora-ring engine: the SVG studio's proven `placeArmed` flora
 * recipe, expressed with PROJECT lat/lng (the SVG reference hardcodes
 * Prahran). Everything is pure — the ring layer memos over (session point,
 * placements, sun scrubber, address) so suggestions re-rank live as the
 * operator scrubs the sun or adds canopy.
 *
 * Chain: buildIndicativeShadeGrid (one sun sample → 8×8 sun-hours cells)
 *   → sunHoursAtPct (click cell; default 6h)
 *   → countNearbyCanopy (accepted canopy/exist/feature within 8% board)
 *   → rankCurtisFloraCandidates (≤3 real catalog candidates, height
 *     hard-filter, form hoist, municipality style-boost)
 *
 * The sun-hours + exposure readout is the Solar Impact delta — delivered
 * here as a by-product of ranking.
 *
 * Binding: docs/GOLD-STANDARD-2026.md §3 (flora intelligence layer)
 */

import {
  buildIndicativeShadeGrid,
  countNearbyCanopy,
  FLORA_HEIGHT_BY_FORM,
  rankCurtisFloraCandidates,
  sunHoursAtPct,
  type FloraCandidate,
  type FloraStudioForm,
} from "@workstream/domain";
import { preferredSunForHours } from "@workstream/domain";
import { sunDateFromPreset } from "../handoff/features/sunGrowth/sunDatePreset";
import { TYPE_TO_SYMBOL } from "../handoff/state/canvasBridge";

/** Reverse map: the dock's plant symbol ids → flora forms. */
const SYMBOL_TO_FORM: Record<string, FloraStudioForm> = {
  [TYPE_TO_SYMBOL.canopy]: "canopy",
  [TYPE_TO_SYMBOL.feature]: "feature",
  [TYPE_TO_SYMBOL.hedge]: "hedge",
  [TYPE_TO_SYMBOL.bed]: "bed",
  [TYPE_TO_SYMBOL.lawn]: "lawn",
};

/** The flora form for an armed symbol id — null for hardscape/exist. */
export function symbolToFloraForm(symbolId: string): FloraStudioForm | null {
  return SYMBOL_TO_FORM[symbolId] ?? null;
}

/** Structural item shape both canopy counting and the guard accept. */
export interface FloraItem {
  id: string;
  t: string;
  x: number;
  y: number;
  scale: number;
  ghost?: boolean;
  dbhM?: number;
  canopyM?: number;
}

/**
 * Rank candidates at a click point. `sunMin` is the live sun scrubber value
 * (minutes past midnight) — the same axis that drives the 3D sun rig, so
 * the ranking matches the shadows on screen.
 */
export function rankAtPoint(args: {
  form: FloraStudioForm;
  xPct: number;
  yPct: number;
  items: FloraItem[];
  lat: number;
  lng: number;
  sunMin: number;
  address: string;
}): { candidates: FloraCandidate[]; sunHours: number } {
  const cells = buildIndicativeShadeGrid(
    args.lat,
    args.lng,
    sunDateFromPreset("today", args.sunMin),
  );
  const sunHours = sunHoursAtPct(args.xPct, args.yPct, cells);
  const nearbyCanopyCount = countNearbyCanopy(args.xPct, args.yPct, args.items);
  const candidates = rankCurtisFloraCandidates({
    address: args.address,
    sunHours,
    nearbyCanopyCount,
    maxHeightM: FLORA_HEIGHT_BY_FORM[args.form],
    preferredForm: args.form,
  });
  return { candidates, sunHours };
}

/** Exposure label from the shared thresholds (no local duplication). */
export function exposureLabel(sunHours: number): string {
  const preferred = preferredSunForHours(sunHours);
  const band = preferred[0] ?? "partial";
  return band === "full" ? "Full sun" : band === "partial" ? "Partial shade" : "Shade";
}

/** Placement scale from the candidate's mature spread (SVG acceptFlora parity). */
export function placementScaleFor(candidate: FloraCandidate): number {
  return Math.min(1.25, Math.max(0.45, candidate.canopySpreadM / 5));
}
