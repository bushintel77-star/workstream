import type {
  IrrigationZone,
  IrrigationZoneKind,
  CanvasAnnotation,
  ConstructionTrench,
  DesignBydaAsset,
  DesignKeylessOverlay,
  BydaAssetKind,
  PresentationPack,
} from "@workstream/contracts";
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
import type {
  LeftAssetPanel,
  LeftAssetRestore,
} from "../features/assetPanel/leftAssetPanel";

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
  /** Typed BYDA utility assets — distinct stroke language from easements. */
  bydaAssets: DesignBydaAsset[];
  /** KEYLESS Vicmap washes (planning / bushfire / contour / flood / heritage…). */
  keylessOverlays: DesignKeylessOverlay[];
  /** Authored drip / lighting paths — DesignCanvas.irrigation_zones. */
  irrigationZones: IrrigationZone[];
  /** Construction trenches / conduit — DesignCanvas.construction_trenches. */
  constructionTrenches: ConstructionTrench[];
  /** Hand-lettered presentation notes — DesignCanvas.annotations. */
  annotations: CanvasAnnotation[];
  /** Fit-sheet compose pack — DesignCanvas.presentation_pack. */
  presentationPack?: PresentationPack;
};

export type { BydaAssetKind };

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
   * Layers / Measures / Services / Demo Lots / Checklist share this slot.
   */
  rightDataPanel: RightDataPanel | null;
  leftAssetPanel: LeftAssetPanel;
  leftAssetRestore: LeftAssetRestore | null;
  /** Pin expanded library so place / canvas interact do not auto-collapse. */
  leftAssetPinned: boolean;
  /** Session place recents for command-palette ranking. */
  recentAssetTypes: StudioItemType[];
  layerOpacity: LayerOpacity;
  /** View-only layer isolation; never persisted to DesignCanvas. */
  isolatedLayer: LayerKey | null;
  /**
   * Per-feature Services ledger hide map (id → true = hidden).
   * Session-only; survives Survey → CAD; ticks freeze when servicesLocked.
   */
  serviceFeatureHidden: Record<string, boolean>;
  /**
   * Focused service / design feature ids — others on the services surface fall away.
   * Esc clears. Shift/Cmd+click adds. Never persisted.
   */
  focusedServiceIds: string[] | null;
  /**
   * Legacy CAD services-edit toggle — superseded by survey-only authoring.
   * Kept for session compat; always false once quote locks site services.
   */
  servicesEdit: boolean;
  /**
   * Survey services (corridors, RL levels, easements) frozen as site context.
   * Set when entering Quote / Share; blocks Servc tools and opacity sliders.
   */
  servicesLocked: boolean;
  setbackOn: boolean;
  growth: GrowthStage;
  /** Minutes past midnight Melb-ish; handoff uses sunMin */
  sunMin: number;
  /** Practical seasonal date presets for the indicative sun study. */
  sunDatePreset: SunDatePreset;
  /**
   * Cardinal elevation look (Looking N/S/E/W). Replaces legacy elevAxis x/y.
   */
  elevLook: "N" | "S" | "E" | "W";
  /** @deprecated Prefer elevLook — kept for short migration reads. */
  elevAxis?: "x" | "y";
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
  /**
   * When set, next Servc commit lands as a typed BYDA asset (not a generic
   * corridor / title easement). Cleared after commit or Esc.
   */
  bydaDraftKind: BydaAssetKind | null;
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
  utilityPanel: "compliance" | "bom" | "sustainability" | null;
  councilTip: string | null;
  sheetScaleDenom: 50 | 100 | 150 | 200 | 250 | 300 | 400 | 500;
  parchmentPeel: number;
  saveStatus: "idle" | "saving" | "retrying" | "saved" | "error";
  /** Set when saveStatus is error — drives honest toast copy. */
  saveErrorKind: "unreachable" | "stale_client" | "rejected" | null;
  /**
   * Prepare site pack chase list (CoT / BYDA / council drain / arbor).
   * Persisted on DesignCanvas.site_frame.site_pack.
   */
  sitePackChase: Array<{
    id: string;
    label: string;
    done: boolean;
    href?: string;
  }>;
  /** Explicit dig override when BYDA assets not yet digitised — audit stamp. */
  digOverrideAt: string | null;
  digOverrideNote: string | null;
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
  // Services (drainage / utilities / RL levels) — survey context on CAD;
  // read-only overlay once Quote locks site services.
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
