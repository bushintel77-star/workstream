import type { BydaAssetKind } from "@workstream/contracts";
import { PALETTE } from "../../../../styles/colorTokens";
import type { PlanLineStyle } from "./planLineStyles";
import { weightFor } from "../features/render/lineWeight";

/** Base BYDA stroke width — the "byda" role on the line-weight ladder. */
const BYDA_BASE = weightFor("byda");

/**
 * BYDA typed asset stroke language — APWA locate colours (mode-invariant).
 * Never reuse title easement slate for dig assets. BYDA assets are visually
 * dominant on the plan — they carry dig-safety weight, so they render heavier
 * than title easements and trench runs. Source label ("BYDA" / "traced" /
 * "assumed") is stamped at the asset midpoint on the CadPlanBoard.
 *
 * Stroke widths derive from the line-weight ladder (`byda` role = "thick" =
 * 0.8). Per-kind multipliers preserve intra-BYDA hierarchy (power heaviest,
 * nbn lightest) without leaving the ladder.
 */
export const BYDA_PLAN_LINES_LIGHT: Record<BydaAssetKind, PlanLineStyle> = {
  sewer: {
    stroke: PALETTE.apwaSewer,
    strokeWidth: BYDA_BASE * 1.05,
    dash: "5 1.5 1.5 1.5",
  },
  stormwater: {
    stroke: PALETTE.waterL500,
    strokeWidth: BYDA_BASE,
    dash: "4 2",
  },
  water: {
    stroke: PALETTE.apwaWater,
    strokeWidth: BYDA_BASE,
    dash: "3 1.5 1 1.5",
  },
  gas: {
    stroke: PALETTE.apwaGas,
    strokeWidth: BYDA_BASE * 1.05,
    dash: "2 1.2",
  },
  power: {
    stroke: PALETTE.apwaElectric,
    strokeWidth: BYDA_BASE * 1.12,
    dash: "6 2 1.5 2",
  },
  nbn: {
    stroke: PALETTE.apwaComms,
    strokeWidth: BYDA_BASE * 0.97,
    dash: "1.5 1.5",
  },
  other: {
    stroke: PALETTE.apwaReclaimed,
    strokeWidth: BYDA_BASE * 0.97,
    dash: "3 2",
  },
};

/** Dark board — same APWA hues (safety standard, not brand-lifted). */
export const BYDA_PLAN_LINES_DARK: Record<BydaAssetKind, PlanLineStyle> = {
  ...BYDA_PLAN_LINES_LIGHT,
  stormwater: {
    stroke: PALETTE.waterD400,
    strokeWidth: BYDA_BASE,
    dash: "4 2",
  },
};

export function bydaPlanLine(
  kind: BydaAssetKind,
  darkOn: boolean,
): PlanLineStyle {
  return darkOn ? BYDA_PLAN_LINES_DARK[kind] : BYDA_PLAN_LINES_LIGHT[kind];
}

export const BYDA_KIND_LABEL: Record<BydaAssetKind, string> = {
  sewer: "Sewer",
  stormwater: "Stormwater",
  water: "Water",
  gas: "Gas",
  power: "Power",
  nbn: "NBN / telecom",
  other: "Other utility",
};
