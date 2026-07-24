import type { BydaAssetKind } from "@workstream/contracts";
import type { PlanLineStyle } from "./planLineStyles";

/**
 * BYDA typed asset stroke language — never reuse title easement amber hatch.
 * Each utility has a distinct colour + dash so sewer ≠ gas ≠ NBN at a glance.
 */
export const BYDA_PLAN_LINES_LIGHT: Record<BydaAssetKind, PlanLineStyle> = {
  sewer: {
    stroke: "#7C3AED",
    strokeWidth: 1.05,
    dash: "5 1.5 1.5 1.5",
  },
  stormwater: {
    stroke: "#0E7490",
    strokeWidth: 1.0,
    dash: "4 2",
  },
  water: {
    stroke: "#1D4ED8",
    strokeWidth: 1.0,
    dash: "3 1.5 1 1.5",
  },
  gas: {
    stroke: "#CA8A04",
    strokeWidth: 1.05,
    dash: "2 1.2",
  },
  power: {
    stroke: "#DC2626",
    strokeWidth: 1.05,
    dash: "6 2 1.5 2",
  },
  nbn: {
    stroke: "#DB2777",
    strokeWidth: 0.95,
    dash: "1.5 1.5",
  },
  other: {
    stroke: "#475569",
    strokeWidth: 0.95,
    dash: "3 2",
  },
};

export const BYDA_PLAN_LINES_DARK: Record<BydaAssetKind, PlanLineStyle> = {
  sewer: {
    stroke: "#C4B5FD",
    strokeWidth: 1.05,
    dash: "5 1.5 1.5 1.5",
  },
  stormwater: {
    stroke: "#67E8F9",
    strokeWidth: 1.0,
    dash: "4 2",
  },
  water: {
    stroke: "#93C5FD",
    strokeWidth: 1.0,
    dash: "3 1.5 1 1.5",
  },
  gas: {
    stroke: "#FDE047",
    strokeWidth: 1.05,
    dash: "2 1.2",
  },
  power: {
    stroke: "#FCA5A5",
    strokeWidth: 1.05,
    dash: "6 2 1.5 2",
  },
  nbn: {
    stroke: "#F9A8D4",
    strokeWidth: 0.95,
    dash: "1.5 1.5",
  },
  other: {
    stroke: "#CBD5E1",
    strokeWidth: 0.95,
    dash: "3 2",
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
  nbn: "NBN",
  other: "Other utility",
};
