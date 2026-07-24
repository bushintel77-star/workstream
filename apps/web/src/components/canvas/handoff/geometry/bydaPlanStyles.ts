import type { BydaAssetKind } from "@workstream/contracts";
import { PALETTE } from "../../../../styles/colorTokens";
import type { PlanLineStyle } from "./planLineStyles";

/**
 * BYDA typed asset stroke language — APWA locate colours (mode-invariant).
 * Never reuse title easement slate for dig assets.
 */
export const BYDA_PLAN_LINES_LIGHT: Record<BydaAssetKind, PlanLineStyle> = {
  sewer: {
    stroke: PALETTE.apwaSewer,
    strokeWidth: 1.05,
    dash: "5 1.5 1.5 1.5",
  },
  stormwater: {
    stroke: PALETTE.waterL500,
    strokeWidth: 1.0,
    dash: "4 2",
  },
  water: {
    stroke: PALETTE.apwaWater,
    strokeWidth: 1.0,
    dash: "3 1.5 1 1.5",
  },
  gas: {
    stroke: PALETTE.apwaGas,
    strokeWidth: 1.05,
    dash: "2 1.2",
  },
  power: {
    stroke: PALETTE.apwaElectric,
    strokeWidth: 1.1,
    dash: "6 2 1.5 2",
  },
  nbn: {
    stroke: PALETTE.apwaComms,
    strokeWidth: 0.95,
    dash: "1.5 1.5",
  },
  other: {
    stroke: PALETTE.apwaReclaimed,
    strokeWidth: 0.95,
    dash: "3 2",
  },
};

/** Dark board — same APWA hues (safety standard, not brand-lifted). */
export const BYDA_PLAN_LINES_DARK: Record<BydaAssetKind, PlanLineStyle> = {
  ...BYDA_PLAN_LINES_LIGHT,
  stormwater: {
    stroke: PALETTE.waterD400,
    strokeWidth: 1.0,
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
