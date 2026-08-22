import type { SurveyedPlanLegendEntry, SurveyedPlanNotationModel } from "./model";

export interface LegendFilter {
  propertyLines: boolean;
  elevations: boolean;
  plants: boolean;
  materials: boolean;
  callouts: boolean;
  scope: boolean;
}

const CATEGORY_BY_FILTER = {
  propertyLines: ["property_line"],
  elevations: ["elevation_rl"],
  plants: ["plant_tag"],
  materials: ["material_hatch"],
  callouts: ["detail_callout"],
  scope: ["scope_outline"],
} as const;

const GROUP_ORDER: SurveyedPlanLegendEntry["group"][] = [
  "boundaries",
  "levels",
  "plants",
  "materials",
  "callouts",
  "scope",
  "conventions",
];

export function visibleLegendEntries(
  model: SurveyedPlanNotationModel,
  filter: LegendFilter,
): SurveyedPlanLegendEntry[] {
  const activeCategories = new Set<string>();
  (Object.keys(CATEGORY_BY_FILTER) as Array<keyof typeof CATEGORY_BY_FILTER>).forEach(
    (key) => {
      if (!filter[key]) return;
      for (const category of CATEGORY_BY_FILTER[key]) activeCategories.add(category);
    },
  );
  return model.legendEntries.filter(
    (entry) =>
      entry.group === "conventions" || activeCategories.has(entry.category),
  );
}

export function groupedLegendEntries(entries: SurveyedPlanLegendEntry[]): Array<{
  group: SurveyedPlanLegendEntry["group"];
  entries: SurveyedPlanLegendEntry[];
}> {
  return GROUP_ORDER.map((group) => ({
    group,
    entries: entries.filter((entry) => entry.group === group),
  })).filter((group) => group.entries.length > 0);
}
