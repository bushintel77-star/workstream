import type { Survey } from "./api";

/** Mock survey uses fixed 15×40 m lot and edge ids front/east/back/west. */
export function isMockSurveyLot(survey: Survey): boolean {
  const ids = new Set(survey.measurements.map((m) => m.edge_id));
  return (
    survey.lot_area_m2 === 600 &&
    ids.has("front") &&
    ids.has("east") &&
    ids.has("back") &&
    ids.has("west")
  );
}
