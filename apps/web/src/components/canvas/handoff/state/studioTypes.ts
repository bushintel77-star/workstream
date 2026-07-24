import type { IrrigationZone, IrrigationZoneKind, CanvasAnnotation } from "@workstream/contracts";
import type {
  DesignSchemeSnapshot,
  DrainageRun,
  HardscapeEdgeType,
  PathCorridor,
  SketchStroke,
  SpotLevel,
  StudioItem,
  StudioItemType,
  StudioMode,
  StudioTool,
} from "../studioCatalog";
import type { PaperSize, PctPoint } from "../geometry";
import type { SunDatePreset } from "../features/sunGrowth/sunDatePreset";
import type { RightDataPanel } from "../features/surfaces/rightDataLane";

export type LayerKey =
  | "survey"
  | "boundary"
  | "council"
  | "vegetation"
  | "services"
  | "notes";

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
  /** Indicative drainage runs linking spot RLs (Workflow 1 — no TIN). */
  drainageRuns: DrainageRun[];
  /** Authored path corridors (width / edge / fillet craft). */
  pathCorridors: PathCorridor[];
  /** Survey service / easement polylines — prototype Servc tool. */
  services: PctPoint[][];
  /** Authored drip / lighting paths — DesignCanvas.irrigation_zones. */
  irrigationZones: IrrigationZone[];
  /** Hand-lettered presentation notes — DesignCanvas.annotations. */
  annotations: CanvasAnnotation[];
};

export type { DesignSchemeSnapshot, DrainageRun, HardscapeEdgeType, PathCorridor };

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
  /**
   * Right data lane — one panel at a time (lane law). null = lane empty.
   * Layers / Measures / Demo Lots / Checklist share this slot exclusively.
   */
  rightDataPanel: RightDataPanel | null;
  layerOpacity: LayerOpacity;
  /** View-only layer isolation; never persisted to DesignCanvas. */
  isolatedLayer: LayerKey | null;
  /**
   * Services layer authoring on the CAD canvas — surfaces the Servc / Level /
   * Calibrate tools in place so services live as a toggleable layer, not a
   * separate survey tab. Canvas-first: one canvas, dynamic.
   */
  servicesEdit: boolean;
  setbackOn: boolean;
  growth: GrowthStage;
  /** Minutes past midnight Melb-ish; handoff uses sunMin */
  sunMin: number;
  /** Practical seasonal date presets for the indicative sun study. */
  sunDatePreset: SunDatePreset;
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
  gridFormation: "ortho" | "dots" | "diamond" | "veil";
  gridInk: "charcoal" | "slate" | "paper" | "mist" | "signal";
  paintSwatch: StudioItemType;
  siteIdx: number;
  canopyScanning: boolean;
  sunPlay: boolean;
  zoom: number;
  /** Zoom origin (%) — outdoor garden focus after Fit. */
  focusX: number;
  focusY: number;
  savedTick: number;
  /** Monotonic canvas revision after each successful autosave. */
  saveRevision: number;
  aerialUri: string | null;
  /** AI engine busy flag — drives draft badge + coach dock. */
  aiBusy: "idle" | "scanning" | "assisting";
  coachOpen: boolean;
  assistReply: string | null;
  utilityPanel: "compliance" | "bom" | null;
  councilTip: string | null;
  sheetScaleDenom: 50 | 100 | 150 | 200 | 250 | 300 | 400 | 500;
  parchmentPeel: number;
  saveStatus: "idle" | "saving" | "retrying" | "saved" | "error";
  /** Set when saveStatus is error — drives honest toast copy. */
  saveErrorKind: "unreachable" | "rejected" | null;
};

export const DEFAULT_LAYER_OPACITY: LayerOpacity = {
  survey: 1,
  boundary: 1,
  council: 1,
  vegetation: 1,
  services: 1,
  notes: 1,
};

export const SURVEY_LAYER_PRESET: LayerOpacity = {
  survey: 1,
  boundary: 1,
  council: 0.15,
  vegetation: 0.15,
  services: 1,
  notes: 0.35,
};

export const DESIGN_LAYER_PRESET: LayerOpacity = {
  survey: 0.2,
  boundary: 1,
  council: 1,
  vegetation: 1,
  // Services (drainage / utilities / RL levels) stay legible on the design
  // canvas — they are a toggleable layer, not a separate survey tab.
  services: 1,
  notes: 1,
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
  frenchdrain: "services",
};
