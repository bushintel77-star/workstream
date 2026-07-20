import type { StudioMode } from "../../studioCatalog";
import type { LiveMeasureRow } from "./buildLiveMeasures";

export type MeasureSummaryItem = {
  id: string;
  label: string;
  value: string;
};

export type CanvasMeasureSummary = {
  kicker: string;
  items: MeasureSummaryItem[];
};

function rowItem(
  rows: LiveMeasureRow[],
  id: string,
  label?: string,
): MeasureSummaryItem | null {
  const row = rows.find((candidate) => candidate.id === id);
  if (!row) return null;
  return { id: row.id, label: label ?? row.label, value: row.value };
}

/** Select the three measurements most useful at the active design stage. */
export function buildCanvasMeasureSummary(args: {
  mode: StudioMode;
  rows: LiveMeasureRow[];
  acceptedItemCount: number;
}): CanvasMeasureSummary {
  const { mode, rows, acceptedItemCount } = args;
  const lot = rowItem(rows, "lot", "Title");
  const buildingRow = rows.find((row) => row.id === "building");
  const building: MeasureSummaryItem | null = buildingRow
    ? {
        id: buildingRow.id,
        label: "Existing house",
        value: buildingRow.numeric > 0 ? buildingRow.value : "Not traced",
      }
    : null;
  const outdoor = rowItem(rows, "outdoor", "Outdoor");
  const perimeter = rowItem(rows, "perimeter", "Perimeter");
  const coverage = rowItem(rows, "coverage", "Coverage");
  const selection = rows.find((row) => row.group === "selection");
  const selected = selection
    ? { id: selection.id, label: "Selected", value: selection.value }
    : null;
  const assets: MeasureSummaryItem = {
    id: "assets",
    label: "Assets",
    value: String(acceptedItemCount),
  };

  const candidates =
    mode === "survey"
      ? [lot, building, outdoor]
      : mode === "sketch"
        ? [outdoor, assets, perimeter]
        : [outdoor, selected ?? coverage, assets];

  return {
    kicker:
      mode === "survey"
        ? "Site measures"
        : mode === "sketch"
          ? "Concept measures"
          : "CAD measures",
    items: candidates.filter(
      (item): item is MeasureSummaryItem => item != null,
    ),
  };
}
