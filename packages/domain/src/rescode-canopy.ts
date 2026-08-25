/**
 * ResCode Standard A2-6 (Clause 54.02-6) — tree canopy, pure assessment.
 *
 * Victoria Planning Provisions, Amendment VC298 (effective 2025-09-08):
 * one canopy tree per 100 m² of site area for a dwelling on a lot, each
 * tree reaching at least 6 m height and 4 m canopy width AT MATURITY.
 * Sources (verified 2026-08-25, recorded in
 * docs/AEC-2026-RESEARCH-ADOPTION.md §1):
 *   - https://www.planning.vic.gov.au/news/articles/new-streamlined-requirements-for-single-dwellings-and-small-second-dwellings
 *   - https://www.planning.vic.gov.au/guides-and-resources/guides/all-guides/residential-development/single-home-code
 *   - https://planning-schemes.app.planning.vic.gov.au/Victoria%2520Planning%2520Provisions/histories/VC298/ordinance/17668343
 *
 * Honesty constraints (binding, see the adoption doc):
 * - The exact rounding/bracket table of A2-6 is NOT verbatim-verified.
 *   Secondary sources disagree at the margins (e.g. a 250 m² lot read as
 *   "2 trees" by one commentary vs 3 by strict ceil). This module rounds
 *   the required count UP (safe direction: never under-warns compliance).
 *   Flip TREES rounding here, in one place, once the VPP table is
 *   transcribed verbatim.
 * - A single-standard assessment is NEVER a VicSmart/permit eligibility
 *   claim. `standard` travels with every result so surfaces can stamp it.
 * - Maturity is the SPECIES-EXPECTED mature size (the standard's own
 *   wording), not the current measured size: callers must pass mature
 *   dimensions (e.g. resolveItemMatureHeightM / symbol spread in the web
 *   studio), using measured/source sizes only as a floor for existing
 *   trees.
 */

export const RESCODE_A2_6 = {
  standardId: "A2-6",
  clause: "54.02-6",
  amendment: "VC298",
  effectiveDate: "2025-09-08",
  /** Canopy trees required per 100 m² of site area. */
  treesPer100M2: 1,
  /** Minimum height at maturity (m). */
  minHeightM: 6,
  /** Minimum canopy WIDTH at maturity (m) — callers hold radius. */
  minCanopyWidthM: 4,
  sources: [
    "https://www.planning.vic.gov.au/news/articles/new-streamlined-requirements-for-single-dwellings-and-small-second-dwellings",
    "https://www.planning.vic.gov.au/guides-and-resources/guides/all-guides/residential-development/single-home-code",
    "https://planning-schemes.app.planning.vic.gov.au/Victoria%2520Planning%2520Provisions/histories/VC298/ordinance/17668343",
  ],
} as const;

/** A tree candidate for the canopy count. Dimensions are AT MATURITY. */
export interface CanopyTreeCandidate {
  id: string;
  label?: string;
  /** Expected mature height in metres; null when no species/source data. */
  matureHeightM: number | null | undefined;
  /** Expected mature canopy RADIUS in metres (width = 2 × radius). */
  matureCanopyRadiusM: number | null | undefined;
  /** Provenance tag, e.g. vicmap_tree / canopy / operator (display only). */
  source?: string;
}

export interface ImmatureCanopyTree {
  id: string;
  label?: string;
  source?: string;
  reason: "height" | "canopy-width" | "unknown-dimensions";
  matureHeightM: number | null;
  matureCanopyWidthM: number | null;
}

export type CanopyComplianceAssessment =
  | {
      status: "insufficient-data";
      /** Site area unknown — no requirement is asserted, none is satisfied. */
      required: null;
      standard: typeof RESCODE_A2_6;
    }
  | {
      status: "compliant" | "shortfall";
      /** Required canopy trees (rounded up — see module doc). */
      required: number;
      /** Total tree candidates considered. */
      provided: number;
      /** Candidates passing the maturity gate — only these count. */
      matureProvided: number;
      immature: ImmatureCanopyTree[];
      /** max(0, required − matureProvided). */
      shortfall: number;
      standard: typeof RESCODE_A2_6;
    };

/**
 * Required canopy trees for a site area. Rounds UP per the module doc
 * (unverified bracket table; never under-warn). Returns null when the area
 * is unknown or non-positive — insufficient data, never a silent pass.
 */
export function requiredCanopyTrees(
  siteAreaM2: number | null | undefined,
): number | null {
  if (siteAreaM2 == null || !Number.isFinite(siteAreaM2) || siteAreaM2 <= 0) {
    return null;
  }
  return Math.ceil((siteAreaM2 / 100) * RESCODE_A2_6.treesPer100M2);
}

/**
 * The maturity gate: ≥ 6 m height and ≥ 4 m canopy width at maturity.
 * Unknown dimensions do not pass — the standard requires trees that will
 * reach the minimums, and unproven is not proven.
 */
export function isMatureCanopyTree(tree: CanopyTreeCandidate): boolean {
  if (tree.matureHeightM == null || tree.matureCanopyRadiusM == null) {
    return false;
  }
  const widthM = tree.matureCanopyRadiusM * 2;
  return (
    tree.matureHeightM >= RESCODE_A2_6.minHeightM &&
    widthM >= RESCODE_A2_6.minCanopyWidthM
  );
}

function immatureReason(tree: CanopyTreeCandidate): ImmatureCanopyTree["reason"] {
  if (tree.matureHeightM == null || tree.matureCanopyRadiusM == null) {
    return "unknown-dimensions";
  }
  if (tree.matureHeightM < RESCODE_A2_6.minHeightM) {
    return "height";
  }
  return "canopy-width";
}

/**
 * Assess a site against A2-6. `trees` should be every tree candidate on
 * the site (placements with tree symbols — existing Vicmap trees, drawn
 * canopies, operator-placed stock). Reads only; places nothing; no
 * boundary-reconciliation event (the boundary stays the single source of
 * truth for site area upstream).
 */
export function assessCanopyCompliance(input: {
  siteAreaM2: number | null | undefined;
  trees: CanopyTreeCandidate[];
}): CanopyComplianceAssessment {
  const required = requiredCanopyTrees(input.siteAreaM2);
  if (required == null) {
    return { status: "insufficient-data", required: null, standard: RESCODE_A2_6 };
  }
  const immature: ImmatureCanopyTree[] = [];
  let matureProvided = 0;
  for (const tree of input.trees) {
    if (isMatureCanopyTree(tree)) {
      matureProvided += 1;
    } else {
      immature.push({
        id: tree.id,
        ...(tree.label != null ? { label: tree.label } : {}),
        ...(tree.source != null ? { source: tree.source } : {}),
        reason: immatureReason(tree),
        matureHeightM: tree.matureHeightM ?? null,
        matureCanopyWidthM:
          tree.matureCanopyRadiusM != null ? tree.matureCanopyRadiusM * 2 : null,
      });
    }
  }
  const shortfall = Math.max(0, required - matureProvided);
  return {
    status: shortfall === 0 ? "compliant" : "shortfall",
    required,
    provided: input.trees.length,
    matureProvided,
    immature,
    shortfall,
    standard: RESCODE_A2_6,
  };
}
