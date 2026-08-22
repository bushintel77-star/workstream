export type SurveyedAnnotationCategory =
  | "property_line"
  | "elevation_rl"
  | "plant_tag"
  | "material_hatch"
  | "detail_callout"
  | "scope_outline";

export type AnnotationDialect =
  | "technical"
  | "architectural"
  | "creative"
  | "hybrid";

export type MaterialHatchFamily = "brick" | "stone" | "gravel" | "concrete";

export interface DraftingLineHierarchy {
  boundaryPx: number;
  annotationPx: number;
  guidePx: number;
}

export interface CategoryStyle {
  stroke: string;
  strokeWidth: number;
  text: string;
  fill?: string;
  dash?: string;
}

export interface DialectStyleProfile {
  dialect: AnnotationDialect;
  hierarchy: DraftingLineHierarchy;
  categories: Record<SurveyedAnnotationCategory, CategoryStyle>;
}

export interface PropertyLineNotation {
  id: string;
  /** Edge key matching the dimension ring (`B1`…), which renders this edge. */
  key: string;
  fromPct: { x: number; y: number };
  toPct: { x: number; y: number };
  /** Empty when north is uncalibrated — a DMS bearing off an uncalibrated
   *  frame is a precise-looking fiction, so it is omitted rather than shown. */
  bearing: string;
  distanceM: string;
  label: string;
}

export interface ElevationMarkNotation {
  id: string;
  atPct: { x: number; y: number };
  rlText: string;
  source: "existing" | "proposed";
}

export interface PlantTagNotation {
  id: string;
  atPct: { x: number; y: number };
  code: string;
  scheduleLabel: string;
  symbolId: string;
}

export interface MaterialHatchNotation {
  id: string;
  family: MaterialHatchFamily;
  ringPct: Array<{ x: number; y: number }>;
  label: string;
}

export interface DetailCalloutNotation {
  id: string;
  detailId: string;
  atPct: { x: number; y: number };
  /**
   * Front-loaded with the distinguishing token (plant code / material name),
   * because the callout box ellipsis-truncates and the tail is what gets eaten.
   */
  text: string;
  /** How many placements or polygons this callout speaks for (grouped). */
  count: number;
}

export interface ScopeOutlineNotation {
  id: string;
  ringPct: Array<{ x: number; y: number }>;
  label: string;
}

export interface SurveyedPlanLegendEntry {
  id: string;
  category: SurveyedAnnotationCategory;
  group:
    | "boundaries"
    | "levels"
    | "plants"
    | "materials"
    | "callouts"
    | "scope"
    | "conventions";
  label: string;
  value: string;
}

export interface SurveyedPlanNotationModel {
  dialect: AnnotationDialect;
  styleProfile: DialectStyleProfile;
  lineHierarchy: DraftingLineHierarchy;
  propertyLines: PropertyLineNotation[];
  elevationMarks: ElevationMarkNotation[];
  plantTags: PlantTagNotation[];
  materialHatches: MaterialHatchNotation[];
  callouts: DetailCalloutNotation[];
  scopeOutlines: ScopeOutlineNotation[];
  legendEntries: SurveyedPlanLegendEntry[];
}

export const DRAFTING_LINE_HIERARCHY: DraftingLineHierarchy = {
  boundaryPx: 2.2,
  annotationPx: 1.2,
  guidePx: 0.8,
};
