import type { Survey } from "./api";
import { isSeedSurveyLot } from "@workstream/domain";

/** Legacy 15×40 seed survey — areas are fiction; Trace the title instead. */
export function isMockSurveyLot(survey: Survey): boolean {
  return isSeedSurveyLot({
    lot_area_m2: survey.lot_area_m2,
    measurements: survey.measurements,
  });
}
