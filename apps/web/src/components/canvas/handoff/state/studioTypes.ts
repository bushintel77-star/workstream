import type { StudioItem, StudioItemType, StudioMode, StudioTool } from "../studioCatalog";
import type { PaperSize, PctPoint } from "../geometry";

export type LayerKey = "survey" | "boundary" | "council" | "vegetation";

export type LayerOpacity = Record<LayerKey, number>;

export type GrowthStage = "plant" | "5yr" | "mature";

export type StudioSnapshot = {
  boundary: PctPoint[];
  building: PctPoint[];
  items: StudioItem[];
  easements: PctPoint[][];
};

export type StudioUiState = {
  mode: StudioMode;
  tool: StudioTool;
  locked: boolean;
  frameOn: boolean;
  paper: PaperSize;
  sheetElevOn: boolean;
  darkOn: boolean;
  focusOn: boolean;
  clientView: boolean;
  layersOpen: boolean;
  layerOpacity: LayerOpacity;
  setbackOn: boolean;
  growth: GrowthStage;
  /** Minutes past midnight Melb-ish; handoff uses sunMin */
  sunMin: number;
  elevAxis: "x" | "y";
  selectedId: string | null;
  hoverId: string | null;
  ghostIdx: number;
  factorsOpen: boolean;
  cmdOpen: boolean;
  cmdQuery: string;
  sitesOpen: boolean;
  addOpen: boolean;
  armed: StudioItemType | null;
  mitigated: Record<string, boolean>;
  coachStep: number;
};

export const DEFAULT_LAYER_OPACITY: LayerOpacity = {
  survey: 1,
  boundary: 1,
  council: 1,
  vegetation: 1,
};

export const SURVEY_LAYER_PRESET: LayerOpacity = {
  survey: 1,
  boundary: 1,
  council: 0.15,
  vegetation: 0.15,
};

export const DESIGN_LAYER_PRESET: LayerOpacity = {
  survey: 0.2,
  boundary: 1,
  council: 1,
  vegetation: 1,
};

export const ITEM_LAYER: Record<StudioItemType, LayerKey> = {
  canopy: "vegetation",
  feature: "vegetation",
  hedge: "vegetation",
  bed: "vegetation",
  lawn: "vegetation",
  exist: "survey",
  paving: "boundary",
  deck: "boundary",
  frenchdrain: "boundary",
};
