import type { IrrigationZone, IrrigationZoneKind } from "@workstream/contracts";
import type {
  SketchStroke,
  SpotLevel,
  StudioItem,
  StudioItemType,
  StudioMode,
  StudioTool,
} from "../studioCatalog";
import type { PaperSize, PctPoint } from "../geometry";

export type LayerKey = "survey" | "boundary" | "council" | "vegetation";

export type LayerOpacity = Record<LayerKey, number>;

export type GrowthStage = "plant" | "5yr" | "mature";

export type TraceTarget = "boundary" | "building";

export type StudioSnapshot = {
  boundary: PctPoint[];
  building: PctPoint[];
  items: StudioItem[];
  easements: PctPoint[][];
  strokes: SketchStroke[];
  /** Survey spot levels (RL m) — prototype Level tool. */
  levels: SpotLevel[];
  /** Survey service / easement polylines — prototype Servc tool. */
  services: PctPoint[][];
  /** Authored drip / lighting paths — DesignCanvas.irrigation_zones. */
  irrigationZones: IrrigationZone[];
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
  groupIds: string[];
  hoverId: string | null;
  ghostIdx: number;
  /** Expand confidence-factor breakdown inside the ghost review card. */
  factorsOpen: boolean;
  /** Show the ghost review card itself. */
  ghostReviewOpen: boolean;
  cmdOpen: boolean;
  cmdQuery: string;
  sitesOpen: boolean;
  addOpen: boolean;
  armed: StudioItemType | null;
  mitigated: Record<string, boolean>;
  coachStep: number;
  /** In-progress polygon while tool === 'trace' */
  drawPoly: PctPoint[] | null;
  drawCursor: PctPoint | null;
  traceTarget: TraceTarget;
  /** Zone tool kind — drip irrigation or lighting run. */
  zoneKind: IrrigationZoneKind;
  gridGrain: "fine" | "medium" | "coarse";
  gridSnap: boolean;
  paintSwatch: StudioItemType;
  siteIdx: number;
  canopyScanning: boolean;
  sunPlay: boolean;
  zoom: number;
  savedTick: number;
  aerialUri: string | null;
  /** AI engine busy flag — drives draft badge + coach dock. */
  aiBusy: "idle" | "scanning" | "assisting";
  coachOpen: boolean;
  assistReply: string | null;
  utilityPanel: "compliance" | "bom" | null;
  councilTip: string | null;
  sheetScaleDenom: 50 | 100 | 200 | 250 | 500;
  parchmentPeel: number;
  saveStatus: "idle" | "saving" | "saved" | "error";
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
