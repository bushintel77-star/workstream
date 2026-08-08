import { BY_TYPE, type SpotLevel, type StudioItem } from "../../studioCatalog";
import type { PctPoint } from "../../geometry";

/**
 * Survey completeness rows — the five items that must be captured before the
 * base is ready for CAD. Shared between the SurveyChecklist panel (right data
 * lane) and the compact progress pill in the frame band so the two can never
 * disagree on the count.
 */
export type SurveyChecklistRow = {
  label: string;
  ok: boolean;
};

export function surveyChecklistRows(input: {
  boundary: PctPoint[];
  building: PctPoint[];
  items: StudioItem[];
  levels: SpotLevel[];
  services: PctPoint[][];
  easements?: PctPoint[][];
}): SurveyChecklistRow[] {
  const { boundary, building, items, levels, services, easements = [] } = input;
  const dwellingOk = building.length >= 3;
  return [
    { label: "Boundary traced", ok: boundary.length >= 3 },
    { label: "Existing dwelling", ok: dwellingOk },
    { label: "Existing trees", ok: items.some((i) => BY_TYPE[i.t]?.existing) },
    { label: "Spot levels", ok: levels.length > 0 },
    {
      label: "Services / easements",
      ok: services.length > 0 || easements.some((r) => r.length >= 3),
    },
  ];
}

export function surveyChecklistProgress(input: {
  boundary: PctPoint[];
  building: PctPoint[];
  items: StudioItem[];
  levels: SpotLevel[];
  services: PctPoint[][];
  easements?: PctPoint[][];
}): { done: number; total: number; complete: boolean } {
  const rows = surveyChecklistRows(input);
  const done = rows.filter((r) => r.ok).length;
  return { done, total: rows.length, complete: done === rows.length };
}
