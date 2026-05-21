import { detectMunicipality, type PlanningCategory, type PlanningSeverity } from "./planning-context";

export type TitlePlanningBadge = {
  id: string;
  category: PlanningCategory;
  label: string;
  severity: PlanningSeverity;
};

/** Overlay hints for title card — confirm on certificate / Vicmap. */
export function assessTitlePlanningBadges(address: string): TitlePlanningBadge[] {
  const municipality = detectMunicipality(address);
  const badges: TitlePlanningBadge[] = [];

  if (municipality === "stonnington") {
    badges.push({
      id: "council-stonnington",
      category: "council",
      label: "Stonnington",
      severity: "clear",
    });
    badges.push({
      id: "stonnington-stormwater",
      category: "stormwater",
      label: "Stormwater",
      severity: "review",
    });
  } else if (municipality === "yarra") {
    badges.push({
      id: "council-yarra",
      category: "council",
      label: "Yarra",
      severity: "clear",
    });
    badges.push({
      id: "yarra-heritage",
      category: "heritage",
      label: "Heritage",
      severity: "review",
    });
  } else {
    badges.push({
      id: "council-unknown",
      category: "council",
      label: "Confirm council",
      severity: "review",
    });
  }

  badges.push({
    id: "tree-check",
    category: "tree_protection",
    label: "TPZ / trees",
    severity: "review",
  });

  return badges;
}
