/**
 * Live site readout for the sticky Site card — lot area + dwelling + easements.
 * Area prefers a surveyed `lotAreaM2`; else a shoelace estimate from the
 * board-% boundary at the current scale (indicative Workflow 1).
 */

import type { PctPoint } from "../../geometry";
import { polygonAreaM2 } from "../../geometry/polygon";
import {
  formatScheduleAreaM2,
  type LotDisagreement,
} from "../../geometry/siteScheduleDisplay";

export type SiteLiveMeta = {
  /** Best-known lot area in m² (0 when no boundary traced). */
  lotAreaM2: number;
  /** True when the area came from a surveyed source, not a % estimate. */
  areaSurveyed: boolean;
  hasDwelling: boolean;
  easementCount: number;
  /** Title / cadastral source label ("Vicmap") when known. */
  titleSource: string | null;
  /** Title-vs-drawn lot-area provenance — null when no cadastral figure or no boundary. */
  lotDisagreement: LotDisagreement | null;
  /** One-line face copy (no emoji — icon sits beside). */
  face: string;
  detail: string;
};

export function buildSiteLiveMeta(args: {
  boundary: PctPoint[];
  building: PctPoint[];
  easements: PctPoint[][];
  scaleM: number;
  boardAspect?: number;
  /** Surveyed lot area (m²) when available — wins over the % estimate. */
  lotAreaM2?: number | null;
  /** Cadastral source label for the face, e.g. "Vicmap". */
  titleSource?: string | null;
  /** Title-vs-drawn disagreement from `resolveSiteAreaDisplay`, when available. */
  lotDisagreement?: LotDisagreement | null;
}): SiteLiveMeta {
  const boardAspect = args.boardAspect ?? 1;
  const surveyed =
    args.lotAreaM2 != null && Number.isFinite(args.lotAreaM2) && args.lotAreaM2 > 0;
  const estimate =
    args.boundary.length >= 3
      ? polygonAreaM2(args.boundary, args.scaleM, boardAspect)
      : 0;
  const lotAreaM2 = surveyed ? (args.lotAreaM2 as number) : estimate;

  const hasDwelling = args.building.length >= 3;
  const easementCount = args.easements.filter((r) => r.length >= 3).length;
  const titleSource = args.titleSource?.trim() || null;
  const lotDisagreement = args.lotDisagreement ?? null;

  const face =
    lotAreaM2 > 0
      ? `${formatScheduleAreaM2(lotAreaM2)} m² · ${titleSource ?? "boundary"}`
      : "Site · boundary";

  const dwellingBit = hasDwelling ? "Dwelling" : "No dwelling";
  const easementBit =
    easementCount === 0
      ? "no easements"
      : `${easementCount} easement${easementCount === 1 ? "" : "s"}`;
  const parts = [dwellingBit, easementBit];
  if (lotDisagreement?.mismatch) {
    parts.push(
      `title ${formatScheduleAreaM2(lotDisagreement.cadastralLotM2!)} m² — confirm parcel`,
    );
  }
  const detail = parts.join(" · ");

  return {
    lotAreaM2,
    areaSurveyed: surveyed,
    hasDwelling,
    easementCount,
    titleSource,
    lotDisagreement,
    face,
    detail,
  };
}
