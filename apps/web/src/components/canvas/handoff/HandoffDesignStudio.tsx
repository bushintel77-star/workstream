"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  BY_TYPE,
  MODE_TABS,
  PAINT_SWATCHES,
  type StudioItemType,
  type StudioMode,
} from "./studioCatalog";
import { useStudioState } from "./state/useStudioState";
import {
  resolveHandoffChrome,
  resolveTopHint,
} from "./state/handoffChrome";
import { armBuildingTracePatch } from "./state/armBuildingTrace";
import { surveyServicesAuthoringAllowed } from "./state/servicesLock";
import {
  allowAerialUnderlay,
  isDraftingPlate,
  resolveLiveAerial,
} from "./state/studioPlane";
import { CadPlanBoard } from "./features/cadPlan/CadPlanBoard";
import { DraftGridStudio } from "./features/gridStudio/DraftGridStudio";
import {
  loadGridStudioPrefs,
  saveGridStudioPrefs,
  type GridFormation,
  type GridInk,
} from "./geometry/gridStudio";
import { FitSheetOverlay } from "./features/fitSheet/FitSheetOverlay";
import { SheetComposeDock } from "./features/fitSheet/SheetComposeDock";
import { buildSheetWidgetContext } from "./features/fitSheet/sheetWidgetContext";
import {
  loadFitSheetPrefs,
  saveFitSheetPrefs,
} from "./features/fitSheet/fitSheetPrefs";
import { AiGhostReview } from "./features/aiGhosts/AiGhostReview";
import { LayersPanel } from "./features/layers/LayersPanel";
import { ServicesLedger } from "./features/services/ServicesLedger";
import { SitePackPanel } from "./features/sitePack/SitePackPanel";
import {
  listProjectFilesClient,
  uploadProjectFileClient,
} from "./features/sitePack/projectFilesClient";
import { buildServiceLedgerRows } from "./features/services/serviceLedger";
import {
  StickyMetaStack,
  summonStickyMeta,
} from "./features/stickyMeta/StickyMetaStack";
import { EnvironmentPanel } from "./features/stickyMeta/EnvironmentPanel";
import { SiteMetaPanel } from "./features/stickyMeta/SiteMetaPanel";
import { TreesMetaPanel } from "./features/stickyMeta/TreesMetaPanel";
import {
  buildEnvLiveMeta,
  type EnvWeatherDay,
} from "./features/stickyMeta/envLiveMeta";
import { buildSiteLiveMeta } from "./features/stickyMeta/siteLiveMeta";
import { buildTreesLiveMeta } from "./features/stickyMeta/treesLiveMeta";
import { RightDataLane } from "./features/surfaces/DataLaneSlot";
import { RIGHT_DATA_LANE_WIDTH_PX } from "./features/surfaces/rightDataLane";
import { StudioCommandPalette } from "./features/commandPalette/StudioCommandPalette";
import { SunGrowthDock } from "./features/sunGrowth/SunGrowthDock";
import { resolveBoardSunCast } from "./features/sunGrowth/resolveBoardSunCast";
import { LightingDock } from "./features/lighting/LightingDock";
import { LightingBeams } from "./features/lighting/LightingBeams";
import { PathCorridorsLayer } from "./features/hardscape/PathCorridorsLayer";
import { AssetPanel } from "./features/assetPanel/AssetPanel";
import { AssetCommandSheet } from "./features/assetPanel/AssetCommandSheet";
import { CompactModeNav } from "./features/header/CompactModeNav";
import { StudioSheetHost } from "./features/sheets/StudioSheetHost";
import {
  sheetSafeBottomPx,
  type StudioSheetPage,
  type StudioSheetSnap,
} from "./features/sheets/studioSheet";
import sheetCss from "./features/sheets/studioSheet.module.css";
import {
  categoryForSwatch,
  needsPathGrammar,
  openLeftAssetExclusive,
  resolveLeftSafeInsetPx,
  toggleRightDataPanelExclusive,
  withRightDataPanel,
} from "./features/assetPanel/leftAssetPanel";
import { VariationFilmstrip } from "./features/schemes/VariationFilmstrip";
import { DrainageRunsLayer } from "./features/survey/DrainageRunsLayer";
import { FrameDrawer } from "./features/frameDrawer/FrameDrawer";
import type { HardscapeEdgeType } from "./studioCatalog";
import {
  buildIndicativeShadeGrid,
  councilDrainageChase,
  defaultSitePackChase,
  sunHoursAtPct,
  type AspectTag,
  type PathFilletLockM,
  type PathWidthLockM,
  type SoilTag,
} from "@workstream/domain";
import { sunDateFromPreset } from "./features/sunGrowth/sunDatePreset";
import { UtilityDrawer } from "./features/utilityDrawer/UtilityDrawer";
import { PermitTodosPanel } from "./features/permitTodos/PermitTodosPanel";
import { LiveCostRail } from "./features/quote/LiveCostRail";
import { ElevationBoard } from "./features/elevation/ElevationBoard";
import {
  TraceOverlay,
  currentTraceCompletion,
} from "./features/trace/TraceOverlay";
import { MeasureOverlay } from "./features/measure/MeasureOverlay";
import { isStickyDraftTool } from "./features/measure/measureCancel";
import { AerialSlot } from "./features/aerial/AerialSlot";
import { GroundRulerOverlay } from "./features/ground/GroundRulerOverlay";
import { TactileGround } from "./features/ground/TactileGround";
import { ShadeGridOverlay } from "./features/shade/ShadeGridOverlay";
import { SunCastOverlay } from "./features/shade/SunCastOverlay";
import { SunMarkerPip } from "./features/shade/SunMarkerPip";
import { ClimateBedWash } from "./features/shade/ClimateBedWash";
import { KeylessOverlayWash } from "./features/keyless/KeylessOverlayWash";
import { BuildableAreaOverlay } from "./features/buildableArea/BuildableAreaOverlay";
import { shouldAutoShowBuildableArea } from "./features/buildableArea/buildableAreaPolicy";
import {
  readBuildableAreaPin,
  writeBuildableAreaPin,
} from "./features/buildableArea/buildableAreaPrefs";
import { SketchBoard } from "./features/sketch/SketchBoard";
import { FreehandLayer } from "./features/sketch/FreehandLayer";
import { ImageLayerSlot } from "./features/sketch/ImageLayerSlot";
import { ImageLayerPanel } from "./features/sketch/ImageLayerPanel";
import { rasterizeStrokesToPng } from "./features/sketch/rasterizeStrokes";
import { SurveyAnnotationLayer } from "./features/survey/SurveyAnnotationLayer";
import { SurveyChecklist } from "./features/survey/SurveyChecklist";
import { surveyChecklistProgress } from "./features/survey/surveyChecklistRows";
import { SiteSwitcher } from "./features/sites/SiteSwitcher";
import { ToolDock } from "./features/toolDock/ToolDock";
import { ContextualToolStrip } from "./features/toolDock/ContextualToolStrip";
import { CanvasToolCard } from "./features/toolDock/CanvasToolCard";
import { CanvasContextCard } from "./features/toolDock/CanvasContextCard";
import { LiveBomDock } from "./features/bom/LiveBomDock";
import { InstantPlannerChrome } from "./features/instantPlanner/InstantPlannerChrome";
import { NicheToolCarousel } from "./features/kitInventory/NicheToolCarousel";
import {
  nicheToolsForZone,
  zoneNicheActiveId,
  type NicheTool,
} from "./features/kitInventory/nicheTools";
import { LiveMeasuresRail } from "./features/liveMeasures/LiveMeasuresRail";
import {
  cancelToSelect,
  recordTool,
  toggleTool,
  type ToolStack,
} from "./features/toolStack/toolStack";
import { StudioContextBreadcrumb } from "./features/contextStrip/StudioContextBreadcrumb";
import {
  loadPointerMarkId,
  type PointerMarkId,
} from "./features/pointer/pointerMarks";
import { resolveStudioCursor } from "./features/pointer/resolveStudioCursor";
import {
  HeaderViewMenu,
  type HeaderViewMenuItem,
} from "./features/header/HeaderViewMenu";
import { AiCapabilityCue } from "./features/aiCue/AiCapabilityCue";
import { HeaderAiPill } from "./features/header/HeaderAiPill";
import { clampToCanvasMargin } from "./features/reach/marginSummon";
import { SelectionRing } from "./features/selectionRing/SelectionRing";
import { SelectionDial } from "./features/selectionDial/SelectionDial";
import { SelectionFocusVeil } from "./features/selectionFocus/SelectionFocusVeil";
import { DialHintPill } from "./features/selectionDial/DialHintPill";
import { ExistTreeInspector } from "./features/selectionRing/ExistTreeInspector";
import { BoardInkLegend } from "./features/inkLegend/BoardInkLegend";
import { DesignBranchDock } from "./features/designBranch/DesignBranchDock";
import {
  readDesignBranchId,
  writeDesignBranchId,
} from "./features/designBranch/designBranchPrefs";
import { OpsSchedulesDock } from "./features/opsSchedules/OpsSchedulesDock";
import { ZoneOverlay } from "./features/zones/ZoneOverlay";
import { IrrigationUniformityWash } from "./features/zones/IrrigationUniformityWash";
import { IrrigationUniformityDock } from "./features/zones/IrrigationUniformityDock";
import { LiveTelemetryWash } from "./features/telemetry/LiveTelemetryWash";
import { LiveTelemetryDock } from "./features/telemetry/LiveTelemetryDock";
import { ArBirdseyeOverlay } from "./features/ar/ArBirdseyeOverlay";
import { HeaderPhaseSelect } from "./features/phase/HeaderPhaseSelect";
import {
  loadLifecyclePhasePrefs,
  saveLifecyclePhasePrefs,
} from "./features/phase/phasePrefs";
import { TrenchOverlay } from "./features/trenches/TrenchOverlay";
import { PreemptiveHorizon } from "./features/horizon/PreemptiveHorizon";
import { BoardFindings } from "./features/horizon/BoardFindings";
import { HorizonMarkers } from "./features/horizon/HorizonMarkers";
import { ShareSurface } from "./features/share/ShareSurface";
import { PresentSurface } from "./features/present/PresentSurface";
import { Tier1TopBar } from "./features/tier1TopBar/Tier1TopBar";
import { UnifiedSaveStatus } from "./features/tier1TopBar/UnifiedSaveStatus";
import { ShareRevisionPopup } from "./features/share/ShareRevisionPopup";
import { FloraRing } from "./features/flora/FloraRing";
import { ITEM_LAYER } from "./state/studioTypes";
import { mapSymbolToStudioType } from "./state/studioAiEngine";
import {
  BOARD_WIDTH_M_AT_100,
} from "./features/ground/groundMetrics";
import {
  assessIrrigationUniformity,
  assessLvRuns,
  artboardElevLook,
  cycleElevationLook,
  DESIGN_LIFECYCLE_PHASES,
  isLightingSymbolId,
  isTier1WrightsTerrace,
  nextTransformerVa,
  resolveActiveArtboard,
  solveLiveTradeEstimate,
  sunPositionAt,
  type ArchitecturalTitleBlock,
  type ArtboardId,
} from "@workstream/domain";
import type {
  CanvasAnnotation,
  CatalogPlacement,
  CatalogSymbol,
  CanvasStroke,
  ConstructionTrench,
  DesignLifecyclePhase,
  DesignSiteFrame,
  LandscapeFeature,
  IrrigationZone,
  PresentationPack,
  ProjectFile,
} from "@workstream/contracts";
import {
  plotBoxFor,
  resolveSiteAreaDisplay,
  sheetBoxFor,
  sheetContentView,
  SHEET_SCALE_STEPS,
  SHEET_TITLE_STRIP_H,
  titlePanelWidth,
  clientToBoardPct,
} from "./geometry";
import { CameraChrome, boardCameraFromPlan } from "./CameraChrome";
import {
  clampZoom,
  zoomByKeyStep,
  zoomFromWheel,
} from "./geometry/canvasZoom";
import { nextBoardSize } from "./geometry/boardSizeCommit";
import {
  isViewRotatedFromNorth,
  normalizeViewRotationDeg,
  resolvePlanRotateDeg,
  stepViewRotationDeg,
  type ViewRotationStepDeg,
} from "./geometry/canvasViewRotation";
import { ViewNorthControl } from "./features/viewRotate/ViewNorthControl";
import { isPanGesture, nextPanOffset } from "./geometry/canvasPan";
import {
  isTwoFingerCameraGesture,
  panFromTouchMidpoint,
  touchDistance,
  touchMidpoint,
  zoomFromPinch,
} from "./geometry/canvasTouchCamera";
import { useStudioLayout } from "../../../hooks/useStudioLayout";
import { TiltHintPill } from "./features/tilt/TiltHintPill";
import {
  TILT_ANIM_MS_FAST,
  TILT_ANIM_MS_SLOW,
  TILT_DEG,
  activeGardenViewpoint,
  gardenViewpointCamera,
  gardenViewpointLabel,
  isTiltActive,
  settleTiltDeg,
  tiltFromDragDelta,
  tiltSkinScale,
  type GardenViewpointLook,
} from "./features/tilt/tiltMath";
import { GardenViewpointStrip } from "./features/viewpoint/GardenViewpointStrip";
import { ArtboardStrip } from "./features/artboards/ArtboardStrip";
import { usePresentationLens } from "./features/render/usePresentationLens";
import {
  clampNotePos,
  defaultNotePos,
} from "./features/render/annotationLayout";
import {
  formalizeSketchToCadAction,
  lookupCadastralTitleAction,
} from "../../../app/actions";
import { useToast } from "../../ToastHost";
import { useChromeIdle } from "./hooks/useChromeIdle";
import { suggestedMode, unlockedModes } from "../../../lib/canvas-mode";
import { lockReasonForMode as resolveModeLockReason } from "../../../lib/modeLockCopy";
import { useBoardFindings } from "../../../lib/use-board-findings";
import { useBoardReport } from "../../../lib/use-board-report";
import { useBoardTelemetry } from "../../../lib/use-board-telemetry";
import { telemetryBoardPoints } from "@workstream/domain";
import css from "./handoffStudio.module.css";

const audChip = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  maximumFractionDigits: 0,
}).format;

type Props = {
  projectId: string;
  projectAddress: string;
  projectLat?: number | null;
  projectLng?: number | null;
  aerialUri?: string | null;
  areaM2?: number | null;
  initialMode?: StudioMode;
  initialPlacements?: CatalogPlacement[];
  initialStrokes?: CanvasStroke[];
  initialSiteFrame?: DesignSiteFrame | null;
  initialIrrigationZones?: IrrigationZone[];
  initialConstructionTrenches?: ConstructionTrench[];
  initialAnnotations?: CanvasAnnotation[];
  initialImageLayers?: import("@workstream/contracts").ImageLayer[];
  initialFeatures?: LandscapeFeature[];
  initialPresentationPack?: PresentationPack | null;
  initialLifecyclePhase?: DesignLifecyclePhase;
  hasQuote?: boolean;
  quotePortalUri?: string | null;
  initialTitleBlock?: ArchitecturalTitleBlock | null;
};

/**
 * Design Studio v4/v5 shell — composes feature modules on `useStudioState`.
 * %‑coord aerial drafting board (not MapLibre / Vicmap title chrome).
 */
export function HandoffDesignStudio({
  projectId,
  projectAddress,
  projectLat = null,
  projectLng = null,
  aerialUri = null,
  areaM2 = null,
  initialMode = "cad",
  initialPlacements = [],
  initialStrokes = [],
  initialSiteFrame = null,
  initialIrrigationZones = [],
  initialConstructionTrenches = [],
  initialAnnotations = [],
  initialImageLayers = [],
  initialFeatures = [],
  initialPresentationPack = null,
  initialLifecyclePhase = "concept",
  hasQuote = false,
  quotePortalUri = null,
  initialTitleBlock = null,
}: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const studio = useStudioState({
    projectId,
    address: projectAddress,
    aerialUri,
    outdoorM2: areaM2 != null && areaM2 > 0 ? areaM2 : undefined,
    initialMode: MODE_TABS.includes(initialMode as StudioMode)
      ? initialMode
      : "cad",
    initialPlacements,
    initialStrokes,
    initialSiteFrame,
    initialIrrigationZones,
    initialConstructionTrenches,
    initialAnnotations,
    initialImageLayers,
    initialFeatures,
    initialPresentationPack,
    initialLifecyclePhase,
  });
  const toast = useToast();
  const [gridPreviewFormation, setGridPreviewFormation] =
    useState<GridFormation | null>(null);
  const [gridPreviewInk, setGridPreviewInk] = useState<GridInk | null>(null);
  const [annotatePhase, setAnnotatePhase] = useState<"off" | "place" | "type">(
    "off",
  );
  const [pendingAnnotation, setPendingAnnotation] = useState<{
    anchor: CanvasAnnotation["anchor"];
    notePos: { x: number; y: number };
  } | null>(null);
  const [annotateDraft, setAnnotateDraft] = useState("");
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<
    string | null
  >(null);

  const {
    ui,
    ai,
    compliance,
    estimate,
    estimateSettling,
    workableOutdoorM2,
    siteSchedule,
    acceptHorizonCard,
    setUi,
    setSelection,
  } = studio;
  /*
   * Cross-artefact findings over the *saved* board — refetched on each durable
   * save (saveRevision). Dismissals share the horizon `mitigated` map; finding
   * ids are `bf-`-namespaced so they never collide with `hz-` horizon cards.
   */
  const [telemetryRevision, setTelemetryRevision] = useState(0);
  const { findings: boardFindings, gaps: boardGaps } = useBoardFindings(
    projectId,
    ui.saveRevision,
    true,
    telemetryRevision,
  );
  const openBoardFindings = boardFindings.filter((f) => !ui.mitigated[f.id]);
  const showBoardFinding = (f: (typeof openBoardFindings)[number]) => {
    if (typeof f.x !== "number" || typeof f.y !== "number") return;
    studio.setUi({
      focusX: Number(f.x.toFixed(2)),
      focusY: Number(f.y.toFixed(2)),
      zoom: Math.max(ui.zoom, 1.35),
      panX: 0,
      panY: 0,
    });
  };
  /*
   * Same saved board, same refetch key: the sustainability read-out (calm
   * sidecar metric in the utility hub) and the export disclaimers prompted on
   * the share popup. Both need survey area, irrigation geometry in metres and
   * the planning flags, none of which the studio holds client-side.
   */
  const { sustainability: boardSustainability, disclaimers: boardDisclaimers } =
    useBoardReport(projectId, ui.saveRevision);
  const boardTelemetry = useBoardTelemetry(
    projectId,
    ui.saveRevision,
    ui.liveTelemetryOn,
  );
  const telemetryPoints = telemetryBoardPoints(boardTelemetry.readings);
  const { fidelity, markInteracting } = usePresentationLens({
    forcePresentation: ui.clientView || ui.frameOn,
  });
  const boardRef = useRef<HTMLDivElement>(null);
  const [boardSize, setBoardSize] = useState({ w: 960, h: 640 });
  /** Phone vs desktop chrome — adaptive shell; board engines unchanged. */
  const studioLayout = useStudioLayout();
  const isPhoneLayout = studioLayout === "phone";
  /** Compact fork — same viewport authority as data-layout (useStudioLayout). */
  const compactAssetUi = isPhoneLayout;
  /**
   * Drag-to-pan — Space held (grab, armed) vs actively dragging (grabbing).
   * spaceHeldRef/panDragBaseRef back the gesture listeners so pan drags
   * survive re-renders without tearing down mid-drag.
   */
  const spaceHeldRef = useRef(false);
  const [spacePanArmed, setSpacePanArmed] = useState(false);
  const [isPanningActive, setIsPanningActive] = useState(false);
  const panBaseRef = useRef({ x: 0, y: 0 });
  /** Live zoom for multi-touch pinch (avoids stale closures mid-gesture). */
  const zoomRef = useRef(1);
  /**
   * True while a two-finger pan/pinch is active — single-finger pan/sketch
   * capture listeners must stand down.
   */
  const touchCameraActiveRef = useRef(false);
  /**
   * Sketch pad has no marquee — while the Pan tool is armed there, a plain
   * left-drag grabs the canvas (the pad steps aside; see SketchBoard.active).
   */
  const panToolGrabRef = useRef(false);
  /** Temporary CSS class on .zoomWorld only during tilt enter/exit (not wheel). */
  const [tiltAnimKind, setTiltAnimKind] = useState<"fast" | "slow" | null>(
    null,
  );
  const tiltAnimClearTimerRef = useRef<number | null>(null);
  const tiltDragRef = useRef<{ startY: number; startDeg: number } | null>(
    null,
  );
  const [tiltDiscoverHint, setTiltDiscoverHint] = useState(false);
  const [tiltPauseHint, setTiltPauseHint] = useState(false);
  /** CadPlanBoard node/edge edit affordance — arbitrates top-centre hints. */
  const [vectorEditHint, setVectorEditHint] = useState(false);
  const tiltHintSeenRef = useRef(false);
  const [quotePersisted, setQuotePersisted] = useState(hasQuote);
  const [portalUri, setPortalUri] = useState<string | null>(quotePortalUri);
  const [sharePopupOpen, setSharePopupOpen] = useState(false);
  /*
   * Deck save status lifted from PresentSurface — the UnifiedSaveStatus in the
   * Tier-1 Top Bar reads this when mode === "present" so only one save
   * indicator shows at a time (audit 2.3 / spec §4).
   */
  const [deckSaveStatus, setDeckSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [deckSavedTick, setDeckSavedTick] = useState(0);
  const [deckRevision, setDeckRevision] = useState(0);
  /** Frozen QuoteDoc → ShareRevision payload (set from QuoteBuilder Share). */
  const [shareQuoteFreeze, setShareQuoteFreeze] = useState<{
    quoteLines: Array<{
      id: string;
      label: string;
      unit: string;
      qty: number;
      total: number;
    }>;
    totalInclGst: number;
  } | null>(null);
  const [headerViewMenuOpen, setHeaderViewMenuOpen] = useState(false);
  /** Fit-sheet compose peel — header-summoned only (never a parked rail). */
  const [sheetComposeOpen, setSheetComposeOpen] = useState(false);
  const [latestShare, setLatestShare] = useState<
    import("@workstream/contracts").ShareRevision | null
  >(null);
  const [titleBlock, setTitleBlock] = useState<ArchitecturalTitleBlock | null>(
    initialTitleBlock,
  );
  // Sync council label into studio state for multi-council compliance profile.
  // `setUi` is destructured so the effect depends on the stable callback rather
  // than the whole `studio` object — depending on `studio` would re-run this on
  // every studio state change and setUi back into it.
  const { setUi: studioSetUi } = studio;
  useEffect(() => {
    studioSetUi({ councilLabel: titleBlock?.councilLabel ?? null });
  }, [titleBlock?.councilLabel, studioSetUi]);
  /**
   * Canonical lot / dwelling / outdoor for every surface (CAD, Fit Sheet,
   * Measures, Site meta). Sanitizes absurd dwelling rings before print.
   */
  const siteAreaDisplay = useMemo(() => {
    if (!siteSchedule) return null;
    return resolveSiteAreaDisplay({
      schedule: siteSchedule,
      cadastralLotM2: titleBlock?.lotAreaM2,
      cadastralHouseM2: titleBlock?.houseAreaM2,
    });
  }, [
    siteSchedule,
    titleBlock?.lotAreaM2,
    titleBlock?.houseAreaM2,
  ]);

  /** Prefer resolved outdoor; never invent a seed figure when absent. */
  const outdoor =
    siteAreaDisplay != null && siteAreaDisplay.outdoorAreaM2 > 0
      ? siteAreaDisplay.outdoorAreaM2
      : workableOutdoorM2 > 0
        ? workableOutdoorM2
        : areaM2 != null && areaM2 > 0
          ? areaM2
          : 0;
  const [bydaFiles, setBydaFiles] = useState<ProjectFile[]>([]);
  /**
   * Sticky instrument home — empty canvas margin only (off the lot drawing).
   * Does not follow selection; default parks in the left gutter.
   */
  const [anchorPct, setAnchorPct] = useState<{ x: number; y: number }>({
    x: 12,
    y: 42,
  });
  /** Instruments open only when summoned (margin click / hub), not on select. */
  const [instrumentsSummoned, setInstrumentsSummoned] = useState(false);
  /** Board ink legend — summoned frost dock (View / Cmd+K). */
  const [inkLegendOpen, setInkLegendOpen] = useState(false);
  /** Async design VCS branch switcher. */
  const [designBranchOpen, setDesignBranchOpen] = useState(false);
  /** Instant Planner HUD — Cmd+K summon only (no sticky Assist / tools on idle). */
  const [plannerAssistOpen, setPlannerAssistOpen] = useState(false);
  const [structuredToolsOpen, setStructuredToolsOpen] = useState(false);
  const [activeDesignBranchId, setActiveDesignBranchId] = useState<
    string | null
  >(null);
  /** Landscape-ops schedules + documentation pack. */
  const [opsSchedulesOpen, setOpsSchedulesOpen] = useState(false);
  /** Shared-rev frost toast — dismissible; not a sticky slab. */
  const [shareBannerDismissed, setShareBannerDismissed] = useState(false);
  /** Drafting grid controls — toggled from the tool dock (not a separate cluster). */
  const [gridStudioOpen, setGridStudioOpen] = useState(false);
  const [dialHint, setDialHint] = useState(false);
  const dialHintSeenRef = useRef(false);
  /** One-time "drop the tool to select" hint — objects are inert in tools. */
  const [selectHint, setSelectHint] = useState(false);
  const selectHintSeenRef = useRef(false);
  const onInertToolClick = useCallback(() => {
    if (selectHintSeenRef.current) return;
    selectHintSeenRef.current = true;
    try {
      if (window.localStorage.getItem("ws-select-hint-seen") === "1") return;
      window.localStorage.setItem("ws-select-hint-seen", "1");
    } catch {
      /* ignore */
    }
    setSelectHint(true);
  }, []);
  /** Hold R + arrows → rotate selection in 15° detents. */
  const rotateChordRef = useRef(false);

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (
        (e.key === "r" || e.key === "R") &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey
      ) {
        rotateChordRef.current = true;
      }
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.key === "r" || e.key === "R") rotateChordRef.current = false;
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, []);

  /** Restore checked-out design branch tip after reload. */
  useEffect(() => {
    const branchId = readDesignBranchId(projectId);
    if (!branchId) return;
    setActiveDesignBranchId(branchId);
    let cancelled = false;
    void fetch(`/api/projects/${projectId}/design-branches/${branchId}/checkout`, {
      method: "POST",
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { canvas?: import("@workstream/contracts").DesignCanvas } | null) => {
        if (cancelled || !json?.canvas) return;
        studio.loadBranchCanvas(json.canvas);
      })
      .catch(() => {
        /* keep SSR main tip */
      });
    return () => {
      cancelled = true;
    };
    // Intentionally once on mount for this project.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- checkout restore
  }, [projectId]);

  const [pointerMarkId, setPointerMarkId] = useState<PointerMarkId>("spade");
  /**
   * Settings hover preview — persists only on click.
   *
   * `_setPointerMarkPreview` is unused because `PointerMarkSettings` (which owns
   * the `onPreview` / `onMarkId` callbacks) is never mounted anywhere. The
   * component, its stylesheet and its unit tests all exist; only the mount is
   * missing, so the cursor mark can never be changed. Kept, not deleted — see
   * OUTSTANDING.md.
   */
  const [pointerMarkPreview, _setPointerMarkPreview] =
    useState<PointerMarkId | null>(null);
  /** Handle hover from CadPlanBoard — move / add / paint affordances. */
  const [boardCursor, setBoardCursor] = useState<
    "default" | "move" | "add" | "paint" | null
  >(null);
  /** Board pointer % from CadPlanBoard — buildable live chip. */
  const [boardCursorPct, setBoardCursorPct] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [sketchChrome, setSketchChrome] = useState<{
    tool: "pen" | "eraser";
    tip: import("./features/sketch/sketchCursors").SketchTipGrade;
  }>({ tool: "pen", tip: "medium" });
  const onSketchChromeChange = useCallback(
    (chrome: {
      tool: "pen" | "eraser";
      tip: import("./features/sketch/sketchCursors").SketchTipGrade;
    }) => {
      setSketchChrome(chrome);
    },
    [],
  );
  /** Target settle-flash after a Paint apply — presentational confirmation only. */
  const [paintFlashId, setPaintFlashId] = useState<string | null>(null);
  const paintFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashPaintTarget = (id: string) => {
    setPaintFlashId(id);
    if (paintFlashTimer.current) clearTimeout(paintFlashTimer.current);
    paintFlashTimer.current = setTimeout(() => setPaintFlashId(null), 460);
  };
  /** Two-slot tool memory — Q flips back to the tool you left (AutoCAD-style). */
  const toolStackRef = useRef<ToolStack>({ current: ui.tool, previous: ui.tool });
  useEffect(() => {
    toolStackRef.current = recordTool(toolStackRef.current, ui.tool);
  }, [ui.tool]);
  /** Eyedropper — next canvas click loads that element's style into the swatch. */
  const [eyedropArmed, setEyedropArmed] = useState(false);
  /** Swatch/stamp hover preview — shows target result before commit. */
  const [previewSwatch, setPreviewSwatch] = useState<StudioItemType | null>(null);
  /** Prefetch accordion category when expanding from a Fill rail icon. */
  const [assetExpandSection, setAssetExpandSection] = useState<string | null>(
    null,
  );
  const [assetFocusSearch, setAssetFocusSearch] = useState(false);
  const [studioSheetOpen, setStudioSheetOpen] = useState(false);
  const [studioSheetPage, setStudioSheetPage] =
    useState<StudioSheetPage>("assets");
  const [studioSheetSnap, setStudioSheetSnap] =
    useState<StudioSheetSnap>("peek");
  const pickStyle = (t: StudioItemType) => {
    setEyedropArmed(false);
    studio.setUi({ paintSwatch: t, tool: "paint" });
  };

  useEffect(() => {
    setPointerMarkId(loadPointerMarkId());
  }, []);

  /** Surface autosave failure once — chip stays the daily status; toast is the alert. */
  const lastSaveErrorToast = useRef(false);
  useEffect(() => {
    if (ui.saveStatus === "error") {
      if (lastSaveErrorToast.current) return;
      lastSaveErrorToast.current = true;
      const detail =
        ui.saveErrorKind === "unreachable"
          ? "Couldn't reach the server. Tap Retry save in the header before leaving."
          : ui.saveErrorKind === "stale_client"
            ? "App updated in the background. Refresh the page to keep saving."
            : "Server rejected the save. Tap Retry save in the header before leaving.";
      toast.show(detail, "error", 6000);
      return;
    }
    if (ui.saveStatus === "saved" || ui.saveStatus === "saving") {
      lastSaveErrorToast.current = false;
    }
  }, [toast, ui.saveStatus, ui.saveErrorKind]);

  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const commitSize = (w: number, h: number) => {
      // CSS px only (DPR-invariant). See geometry/boardSizeCommit.ts.
      setBoardSize((prev) => nextBoardSize(prev, w, h) ?? prev);
      // Compact is viewport-gated only (see effect above) — do not key off
      // board inset width or coarse pointer, or desktop grows a mobile FAB.
    };
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (!cr) return;
      commitSize(cr.width, cr.height);
    });
    ro.observe(el);
    commitSize(el.clientWidth, el.clientHeight);
    return () => ro.disconnect();
  }, []);

  /**
   * Print geometry — scale the A3/A4 sheet box to fill the physical paper.
   * The sheet box and the paper share an aspect ratio (see sheetBoxFor), so
   * the fit factor is uniform. Exposed as CSS vars so the print stylesheet
   * works for window.print(), print-media emulation, and headless PDF alike
   * (no dependency on the beforeprint event, which never fires for PDF).
   */
  const printSheet = useMemo(() => {
    if (!ui.frameOn || boardSize.w < 1 || boardSize.h < 1) return null;
    const MM_PX = 96 / 25.4;
    const paperMm =
      ui.paper === "a4"
        ? { w: 210, h: 297 } // portrait
        : { w: 420, h: 297 }; // A3 landscape
    const paperW = paperMm.w * MM_PX;
    const paperH = paperMm.h * MM_PX;
    const sheet = sheetBoxFor(boardSize.w, boardSize.h, ui.paper);
    const fit = Math.min(paperW / sheet.boxW, paperH / sheet.boxH);
    return {
      left: sheet.boxLeft,
      top: sheet.boxTop,
      boardW: boardSize.w,
      boardH: boardSize.h,
      paperW,
      paperH,
      fit,
      paper: ui.paper,
    };
  }, [ui.frameOn, ui.paper, boardSize.w, boardSize.h]);

  /**
   * Infinite canvas zoom — wheel / trackpad / pinch over the board.
   * Active on Survey / Sketch / CAD including A3/A4 Fit sheet.
   * (Print 1:N is Alt+wheel on the Fit sheet HUD — not plain wheel.)
   */
  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const planMode =
      ui.mode !== "elevation" && ui.mode !== "quote" && ui.mode !== "share";
    if (!planMode) return;
    const onWheel = (e: WheelEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest?.("input, textarea, select, [data-no-canvas-zoom]")) {
        return;
      }
      // Fit sheet: Alt+wheel reserved for print 1:N (FitSheetOverlay).
      if (ui.frameOn && e.altKey) return;
      /*
       * Trackpad diagonal scrolls send deltaX+deltaY. Zooming on a
       * sideways-dominant gesture makes the focus origin hunt L/R.
       */
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) * 1.25) {
        return;
      }
      e.preventDefault();
      markInteracting();
      const nextZoom = zoomFromWheel(ui.zoom, e.deltaY);
      if (ui.frameOn) {
        // Keep lot-centred sheet origin; zoom multiplies the paper fit.
        studio.setUi({ zoom: nextZoom });
        return;
      }
      /*
       * Tilt applies rotateX that clientToBoardPct does not invert. Updating
       * focus from the pointer under tilt makes transform-origin jump each
       * tick → left/right zig-zag. Freeze focus; scale straight in/out.
       */
      if (isTiltActive(tiltDegRef.current)) {
        studio.setUi({ zoom: nextZoom });
        return;
      }
      const r = el.getBoundingClientRect();
      const rotateDeg =
        ui.mode === "cad" && !ui.clientView
          ? normalizeViewRotationDeg(ui.viewRotationDeg)
          : 0;
      const focus = clientToBoardPct(e.clientX, e.clientY, r, {
        boardW: el.clientWidth || 1,
        boardH: el.clientHeight || 1,
        zoom: clampZoom(ui.zoom),
        rotateDeg,
        panX: ui.panX,
        panY: ui.panY,
        focusX: ui.focusX,
        focusY: ui.focusY,
      });
      studio.setUi({
        focusX: Number(focus.x.toFixed(2)),
        focusY: Number(focus.y.toFixed(2)),
        zoom: nextZoom,
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [
    studio,
    markInteracting,
    ui.frameOn,
    ui.mode,
    ui.zoom,
    ui.panX,
    ui.panY,
    ui.focusX,
    ui.focusY,
    ui.viewRotationDeg,
    ui.clientView,
  ]);

  /** Keeps the drag-start base fresh without re-subscribing gesture listeners. */
  useEffect(() => {
    panBaseRef.current = { x: ui.panX, y: ui.panY };
  }, [ui.panX, ui.panY]);

  useEffect(() => {
    zoomRef.current = clampZoom(ui.zoom);
  }, [ui.zoom]);

  useEffect(() => {
    /*
     * Sketch pad has nothing to marquee — Select-drag pans the camera there
     * (the pen only inks while armed). Plan modes marquee; pan is Space/middle.
     */
    panToolGrabRef.current = ui.mode === "sketch" && ui.tool === "select";
  }, [ui.mode, ui.tool]);

  /**
   * Space held → pan armed (CAD/Figma convention). Tracked outside React
   * state via a ref so the gesture listener below always reads it live;
   * mirrored into state only to drive the grab cursor.
   * Works on free plan and Fit sheet (pan inside the paper plot).
   */
  useEffect(() => {
    const planMode =
      ui.mode !== "elevation" && ui.mode !== "quote" && ui.mode !== "share";
    if (!planMode) return;
    const release = () => {
      spaceHeldRef.current = false;
      setSpacePanArmed(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return;
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (typing) return;
      e.preventDefault();
      spaceHeldRef.current = true;
      setSpacePanArmed(true);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      release();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    // Alt-tabbing away while Space is held would otherwise strand it "armed".
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", release);
      release();
    };
  }, [ui.mode]);

  /**
   * Start a viewport pan drag from a pointer origin. Shared by the
   * capture-phase gesture listener (Space / middle-drag / pan-tool / tilt)
   * and by CadPlanBoard's Select-on-empty path (drag the empty board to pan;
   * Alt/Option+drag still marquee-selects). Reads `panBaseRef` live so the
   * drag survives re-renders without tearing down mid-gesture.
   */
  const startBoardPan = useCallback(
    (origin: { clientX: number; clientY: number; pointerId: number }) => {
      const el = boardRef.current;
      if (!el) return;
      const startX = origin.clientX;
      const startY = origin.clientY;
      const base = panBaseRef.current;
      setIsPanningActive(true);
      el.setPointerCapture?.(origin.pointerId);
      const onMove = (ev: PointerEvent) => {
        markInteracting();
        const next = nextPanOffset(
          base,
          ev.clientX - startX,
          ev.clientY - startY,
        );
        studio.setUi({ panX: next.x, panY: next.y });
      };
      const onUp = () => {
        setIsPanningActive(false);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        el.releasePointerCapture?.(origin.pointerId);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp, { once: true });
    },
    [studio, markInteracting],
  );

  /**
   * Drag-to-pan — middle-mouse or Space+drag translates the viewport
   * without touching selection. Intercepted at capture phase, ahead of
   * CadPlanBoard's marquee-select pointerdown, so the two never collide.
   * Enabled on Fit sheet too (pans inside the A3/A4 plot).
   */
  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const planMode =
      ui.mode !== "elevation" && ui.mode !== "quote" && ui.mode !== "share";
    if (!planMode) return;
    const onPointerDownCapture = (e: PointerEvent) => {
      /* Two-finger camera owns the board — do not start a one-finger pan. */
      if (touchCameraActiveRef.current) return;
      /* Pan-tool grab never swallows chrome (dock chips, tray buttons). */
      const overChrome = Boolean(
        (e.target as HTMLElement | null)?.closest(
          "button, input, select, textarea, [data-camera-chrome]",
        ),
      );
      if (
        !isPanGesture({
          button: e.button,
          spaceHeld: spaceHeldRef.current,
          panToolArmed: panToolGrabRef.current && !overChrome,
          tiltViewActive: isTiltActive(tiltDegRef.current) && !overChrome,
        })
      ) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      startBoardPan(e);
    };
    el.addEventListener("pointerdown", onPointerDownCapture, { capture: true });
    return () =>
      el.removeEventListener("pointerdown", onPointerDownCapture, {
        capture: true,
      });
  }, [studio, markInteracting, ui.mode, startBoardPan]);

  /**
   * Two-finger pan + pinch zoom (phone / tablet). Desktop Space/wheel paths
   * stay above; this only arms on `pointerType === "touch"`.
   */
  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const planMode =
      ui.mode !== "elevation" && ui.mode !== "quote" && ui.mode !== "share";
    if (!planMode) return;

    const pointers = new Map<number, { x: number; y: number }>();
    let gesture: {
      startMid: { x: number; y: number };
      startDist: number;
      basePan: { x: number; y: number };
      baseZoom: number;
    } | null = null;

    const overChrome = (target: EventTarget | null) =>
      Boolean(
        (target as HTMLElement | null)?.closest?.(
          "button, input, select, textarea, [data-camera-chrome]",
        ),
      );

    const endGesture = (opts?: { updateCursor?: boolean }) => {
      const wasActive = gesture != null || touchCameraActiveRef.current;
      gesture = null;
      touchCameraActiveRef.current = false;
      /* Never setState from effect cleanup — that re-subscribes forever. */
      if (wasActive && opts?.updateCursor) setIsPanningActive(false);
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      if (overChrome(e.target)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (!isTwoFingerCameraGesture(pointers.size)) return;
      const pts = [...pointers.values()];
      const a = pts[0]!;
      const b = pts[1]!;
      gesture = {
        startMid: touchMidpoint(a, b),
        startDist: touchDistance(a, b),
        basePan: { ...panBaseRef.current },
        baseZoom: zoomRef.current,
      };
      touchCameraActiveRef.current = true;
      setIsPanningActive(true);
      e.preventDefault();
      e.stopPropagation();
    };

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (!gesture || !isTwoFingerCameraGesture(pointers.size)) return;
      e.preventDefault();
      e.stopPropagation();
      markInteracting();
      const pts = [...pointers.values()];
      const a = pts[0]!;
      const b = pts[1]!;
      const mid = touchMidpoint(a, b);
      const dist = touchDistance(a, b);
      const nextPan = panFromTouchMidpoint(gesture.basePan, gesture.startMid, mid);
      const nextZoom = zoomFromPinch(gesture.baseZoom, gesture.startDist, dist);
      /* Pan + scale only — avoid focus re-anchor fights mid-pinch (tilt path). */
      studio.setUi({ panX: nextPan.x, panY: nextPan.y, zoom: nextZoom });
    };

    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      pointers.delete(e.pointerId);
      if (pointers.size < 2) endGesture({ updateCursor: true });
    };

    el.addEventListener("pointerdown", onPointerDown, { capture: true });
    el.addEventListener("pointermove", onPointerMove, { capture: true });
    el.addEventListener("pointerup", onPointerUp, { capture: true });
    el.addEventListener("pointercancel", onPointerUp, { capture: true });
    return () => {
      el.removeEventListener("pointerdown", onPointerDown, { capture: true });
      el.removeEventListener("pointermove", onPointerMove, { capture: true });
      el.removeEventListener("pointerup", onPointerUp, { capture: true });
      el.removeEventListener("pointercancel", onPointerUp, { capture: true });
      endGesture();
    };
    // markInteracting / studio.setUi are stable enough for the listener closure;
    // only re-bind when plan mode changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [ui.mode]);

  const prefersReducedMotion = () =>
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /** Keep tiltDeg readable inside long-lived gesture / tool listeners. */
  const tiltDegRef = useRef(ui.tiltDeg);
  useEffect(() => {
    tiltDegRef.current = ui.tiltDeg;
  }, [ui.tiltDeg]);

  /**
   * Drop the temp transition class. transitionend never fires when a
   * transition is cancelled (wheel mid-flatten, display:none) — without this
   * the class sticks and every wheel tick animates.
   */
  const clearTiltAnimKind = useCallback(() => {
    if (tiltAnimClearTimerRef.current != null) {
      window.clearTimeout(tiltAnimClearTimerRef.current);
      tiltAnimClearTimerRef.current = null;
    }
    setTiltAnimKind(null);
  }, []);

  useEffect(
    () => () => {
      if (tiltAnimClearTimerRef.current != null) {
        window.clearTimeout(tiltAnimClearTimerRef.current);
      }
    },
    [],
  );

  const animateTiltTo = useCallback(
    (nextDeg: number, slow = false) => {
      const clamped = Math.max(0, Math.min(60, nextDeg));
      if (Math.abs(tiltDegRef.current - clamped) < 0.05) {
        clearTiltAnimKind();
        return;
      }
      if (prefersReducedMotion()) {
        studio.setUi({ tiltDeg: clamped });
        clearTiltAnimKind();
        return;
      }
      if (tiltAnimClearTimerRef.current != null) {
        window.clearTimeout(tiltAnimClearTimerRef.current);
        tiltAnimClearTimerRef.current = null;
      }
      setTiltAnimKind(slow ? "slow" : "fast");
      studio.setUi({ tiltDeg: clamped });
      tiltAnimClearTimerRef.current = window.setTimeout(
        () => {
          tiltAnimClearTimerRef.current = null;
          setTiltAnimKind(null);
        },
        slow ? TILT_ANIM_MS_SLOW : TILT_ANIM_MS_FAST,
      );
    },
    [studio, clearTiltAnimKind],
  );

  /**
   * Operator entry for 3D massing. Fit sheet silently blocked tilt before —
   * exit Fit first. Walls only render when a dwelling ring exists.
   */
  const runTiltView = useCallback(() => {
    const planMode =
      ui.mode === "survey" || ui.mode === "sketch" || ui.mode === "cad";
    if (!planMode) {
      studio.setUi({
        councilTip: "Tilt needs Survey / Sketch / CAD — not Quote or Share",
        coachOpen: true,
      });
      return;
    }
    if (ui.frameOn) {
      /* Don't call setFitSheetOn here (defined later) — clear Fit camera only. */
      studio.setUi({ frameOn: false, panX: 0, panY: 0, zoom: 1 });
    }
    const turningOn = !isTiltActive(ui.tiltDeg);
    animateTiltTo(turningOn ? TILT_DEG : 0);
    if (turningOn) {
      const hasDwelling = studio.building.length >= 3;
      studio.setUi({
        cmdOpen: false,
        cmdQuery: "",
        /* Centre zoom origin — stable straight in/out under rotateX. */
        focusX: 50,
        focusY: 50,
        councilTip: hasDwelling
          ? "Looking north — Esc to flatten"
          : "Tilt on — drag to move. No dwelling yet (no walls) — trace the building or hydrate the title.",
        coachOpen: !hasDwelling,
      });
      setTiltPauseHint(true);
    }
  }, [animateTiltTo, studio, ui.frameOn, ui.mode, ui.tiltDeg]);

  /**
   * Named cardinal axon — yaw + tilt settle. View-only; same lock as tilt.
   * Looking north = yaw 0 (default tilt-from-south).
   */
  const runGardenViewpoint = useCallback(
    (look: GardenViewpointLook) => {
      const planMode =
        ui.mode === "survey" || ui.mode === "sketch" || ui.mode === "cad";
      if (!planMode) {
        studio.setUi({
          councilTip: "Garden viewpoints need Survey / Sketch / CAD",
          coachOpen: true,
        });
        return;
      }
      if (ui.frameOn) {
        studio.setUi({ frameOn: false, panX: 0, panY: 0, zoom: 1 });
      }
      const cam = gardenViewpointCamera(look);
      /*
       * Patch yaw + tilt together so the "park yaw when flat" effect never
       * sees Looking E/S/W without an active lens (Survey/Sketch).
       */
      studio.setUi({
        viewRotationDeg: cam.viewRotationDeg,
        tiltDeg: cam.tiltDeg,
        cmdOpen: false,
        cmdQuery: "",
        focusX: 50,
        focusY: 50,
        councilTip: `${gardenViewpointLabel(look)} — Esc to flatten`,
        coachOpen: false,
      });
      animateTiltTo(cam.tiltDeg);
      setTiltPauseHint(true);
    },
    [animateTiltTo, studio, ui.frameOn, ui.mode],
  );

  const onGardenViewpointSelect = useCallback(
    (look: GardenViewpointLook) => {
      if (ui.mode === "elevation") {
        studio.setUi({ elevLook: look });
        return;
      }
      runGardenViewpoint(look);
    },
    [runGardenViewpoint, studio, ui.mode],
  );

  /** Force flat when leaving plan / entering Fit / elevation / quote / share. */
  useEffect(() => {
    const planMode =
      ui.mode === "survey" || ui.mode === "sketch" || ui.mode === "cad";
    if (!planMode || ui.frameOn) {
      if (ui.tiltDeg !== 0) setUi({ tiltDeg: 0 });
      clearTiltAnimKind();
      setTiltPauseHint((v) => (v ? false : v));
    }
  }, [ui.mode, ui.frameOn, ui.tiltDeg, clearTiltAnimKind, setUi]);

  /** Pause hint tracks the lens. */
  useEffect(() => {
    const active = isTiltActive(ui.tiltDeg);
    setTiltPauseHint((v) => (v === active ? v : active));
  }, [ui.tiltDeg]);

  useEffect(() => {
    if (!isTiltActive(ui.tiltDeg)) return;
    if (!ui.selectedId && ui.groupIds.length === 0) return;
    setSelection(null, []);
  }, [ui.tiltDeg, ui.selectedId, ui.groupIds.length, setSelection]);

  /** Client view — slow 2s tilt-in flourish; flatten only when leaving client view. */
  const clientTiltOnceRef = useRef(false);
  const prevClientViewRef = useRef(ui.clientView);
  useEffect(() => {
    const wasClient = prevClientViewRef.current;
    prevClientViewRef.current = ui.clientView;
    if (!ui.clientView) {
      clientTiltOnceRef.current = false;
      if (wasClient && isTiltActive(tiltDegRef.current)) animateTiltTo(0);
      return;
    }
    if (clientTiltOnceRef.current) return;
    clientTiltOnceRef.current = true;
    animateTiltTo(TILT_DEG, true);
  }, [ui.clientView, animateTiltTo]);

  /** Arming any edit tool animates the lens flat (no jump cut). */
  const prevToolRef = useRef(ui.tool);
  useEffect(() => {
    const prev = prevToolRef.current;
    prevToolRef.current = ui.tool;
    if (prev === ui.tool) return;
    const editing =
      ui.tool === "add" ||
      ui.tool === "paint" ||
      ui.tool === "trace" ||
      ui.tool === "measure" ||
      ui.tool === "zone" ||
      ui.tool === "service" ||
      ui.tool === "calib" ||
      ui.tool === "level";
    if (editing && isTiltActive(tiltDegRef.current)) animateTiltTo(0);
  }, [ui.tool, animateTiltTo]);

  /** One-time discoverability after first CAD view-rotation. */
  useEffect(() => {
    if (tiltHintSeenRef.current) return;
    if (ui.mode !== "cad" || ui.frameOn || ui.clientView) return;
    if (ui.viewRotationDeg === 0) return;
    tiltHintSeenRef.current = true;
    setTiltDiscoverHint(true);
  }, [ui.viewRotationDeg, ui.mode, ui.frameOn, ui.clientView]);

  /**
   * Ctrl/Cmd + vertical drag tilts continuously. Capture-phase so it wins
   * over marquee; release below snap threshold returns flat.
   */
  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const planMode =
      ui.mode === "survey" || ui.mode === "sketch" || ui.mode === "cad";
    if (!planMode || ui.frameOn) return;

    const onPointerDownCapture = (e: PointerEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const startY = e.clientY;
      const startDeg = tiltDegRef.current;
      let lastY = startY;
      tiltDragRef.current = { startY, startDeg };
      clearTiltAnimKind();
      el.setPointerCapture?.(e.pointerId);
      const onMove = (ev: PointerEvent) => {
        lastY = ev.clientY;
        markInteracting();
        studio.setUi({
          tiltDeg: tiltFromDragDelta(startDeg, lastY - startY),
        });
      };
      const onUp = () => {
        tiltDragRef.current = null;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        el.releasePointerCapture?.(e.pointerId);
        const raw = tiltFromDragDelta(startDeg, lastY - startY);
        const settled = settleTiltDeg(raw);
        if (settled !== raw) animateTiltTo(settled);
        else studio.setUi({ tiltDeg: settled });
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp, { once: true });
    };

    el.addEventListener("pointerdown", onPointerDownCapture, { capture: true });
    return () =>
      el.removeEventListener("pointerdown", onPointerDownCapture, {
        capture: true,
      });
  }, [
    studio,
    markInteracting,
    ui.mode,
    ui.frameOn,
    animateTiltTo,
    clearTiltAnimKind,
  ]);

  /** Restore micro grid studio prefs for this project session. */
  useEffect(() => {
    const prefs = loadGridStudioPrefs(projectId);
    if (!prefs) return;
    studio.setUi({
      ...(prefs.formation ? { gridFormation: prefs.formation } : {}),
      ...(prefs.ink ? { gridInk: prefs.ink } : {}),
      ...(prefs.grain ? { gridGrain: prefs.grain } : {}),
      ...(prefs.snap != null ? { gridSnap: prefs.snap } : {}),
    });
    // once per project mount
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per project mount (grid prefs)
  }, [projectId]);

  /** Restore fit-sheet / elevation prefs for this project session. */
  useEffect(() => {
    const prefs = loadFitSheetPrefs(projectId);
    if (!prefs) return;
    studio.setUi({
      ...(prefs.frameOn != null ? { frameOn: prefs.frameOn } : {}),
      ...(prefs.sheetElevOn != null ? { sheetElevOn: prefs.sheetElevOn } : {}),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per project mount (fit-sheet prefs)
  }, [projectId]);

  useEffect(() => {
    saveFitSheetPrefs(projectId, {
      frameOn: ui.frameOn,
      sheetElevOn: ui.sheetElevOn,
    });
  }, [projectId, ui.frameOn, ui.sheetElevOn]);

  /** Restore buildable-area pin for this project session. */
  useEffect(() => {
    if (readBuildableAreaPin(projectId)) {
      studio.setUi({ buildableAreaOn: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per project mount (buildable pin)
  }, [projectId]);

  useEffect(() => {
    writeBuildableAreaPin(projectId, ui.buildableAreaOn);
  }, [projectId, ui.buildableAreaOn]);

  /** Session phase override wins over the canvas/status boot value. */
  useEffect(() => {
    const prefs = loadLifecyclePhasePrefs(projectId);
    if (!prefs) return;
    studio.setUi({ lifecyclePhase: prefs });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per project mount (lifecycle phase)
  }, [projectId]);

  useEffect(() => {
    saveLifecyclePhasePrefs(projectId, ui.lifecyclePhase);
  }, [projectId, ui.lifecyclePhase]);

  /** Warn before leaving when canvas autosave failed or is in flight. */
  useEffect(() => {
    const dirty =
      ui.saveStatus === "error" ||
      ui.saveStatus === "saving" ||
      ui.saveStatus === "retrying";
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [ui.saveStatus]);

  /**
   * Fit to screen by default — outdoor garden remnant on Survey / Sketch / CAD.
   * Fit sheet uses sheetContentView (plan scales inside a fixed paper frame).
   */
  const outdoorFitKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (ui.focusOn || ui.clientView || ui.frameOn) return;
    if (
      ui.mode !== "survey" &&
      ui.mode !== "sketch" &&
      ui.mode !== "cad"
    ) {
      outdoorFitKeyRef.current = null;
      return;
    }
    const key = `${ui.mode}:${ui.siteIdx}`;
    if (outdoorFitKeyRef.current === key) return;
    outdoorFitKeyRef.current = key;
    studio.fitOutdoorView();
  }, [ui.mode, ui.siteIdx, ui.frameOn, ui.focusOn, ui.clientView, studio]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        studio.setUi({ cmdOpen: !ui.cmdOpen });
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) studio.redo();
        else studio.undo();
        return;
      }
      if (
        !typing &&
        !ui.cmdOpen &&
        e.key === "/" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey
      ) {
        e.preventDefault();
        studio.setUi({ cmdOpen: true });
        return;
      }
      if (typing || ui.cmdOpen) return;

      /* Mode-switch shortcuts — 1 through 6 map to MODE_TABS order. */
      if (!e.metaKey && !e.ctrlKey && !e.altKey && /^[1-6]$/.test(e.key)) {
        const idx = Number(e.key) - 1;
        const mode = MODE_TABS[idx];
        if (mode && mode !== ui.mode) {
          e.preventDefault();
          studio.setMode(mode);
          return;
        }
      }

      if (ui.tool === "path" && ui.drawPoly) {
        if (e.key === "Enter" && ui.drawPoly.length >= 2) {
          e.preventDefault();
          studio.finishPathCorridor(ui.drawPoly);
          return;
        }
        if (e.key === "Backspace" || e.key === "Delete") {
          e.preventDefault();
          studio.popTracePoint();
          return;
        }
      }

      if (ui.tool === "trace" && ui.drawPoly) {
        if (e.key === "Tab") {
          const done = currentTraceCompletion(
            ui.drawPoly,
            ui.drawCursor,
            ui.locked,
          );
          if (done) {
            e.preventDefault();
            studio.finishTrace(done);
            return;
          }
        }
        if (e.key === "Enter" && ui.drawPoly.length >= 3) {
          e.preventDefault();
          studio.finishTrace(ui.drawPoly);
          return;
        }
        if (e.key === "Backspace" || e.key === "Delete") {
          e.preventDefault();
          studio.popTracePoint();
          return;
        }
      }

      if (e.key === "Escape") {
        if (annotatePhase !== "off") {
          e.preventDefault();
          setAnnotatePhase("off");
          setPendingAnnotation(null);
          setAnnotateDraft("");
          return;
        }
        if (isTiltActive(ui.tiltDeg)) {
          e.preventDefault();
          animateTiltTo(0);
          return;
        }
        if (ui.focusedServiceIds?.length || ui.isolatedLayer) {
          e.preventDefault();
          studio.clearServiceFocus();
          return;
        }
        if (ui.floraSession) {
          studio.dismissFlora();
          return;
        }
        if (ui.drawPoly) {
          studio.cancelTrace();
          return;
        }
        // CAD practice: Esc cancels sticky draft tools → Select (KiCad / Fusion).
        // Keep the dock summoned so Select stays visible — Esc drops the craft tool, not the UI.
        if (isStickyDraftTool(ui.tool)) {
          e.preventDefault();
          toolStackRef.current = cancelToSelect(toolStackRef.current);
          studio.setTool("select");
          setInstrumentsSummoned(true);
          studio.setUi({
            factorsOpen: false,
            ghostReviewOpen: false,
            rightDataPanel: null,
            leftAssetPanel: null,
            leftAssetRestore: null,
            leftAssetPinned: false,
            cmdOpen: false,
            addOpen: false,
            coachOpen: false,
          });
          return;
        }
        if (ui.leftAssetPanel != null) {
          e.preventDefault();
          studio.setUi({
            leftAssetPanel: null,
            leftAssetRestore: null,
            leftAssetPinned: false,
          });
          return;
        }
        if (ui.selectedId) {
          e.preventDefault();
          studio.setSelection(null, []);
          return;
        }
        studio.setUi({
          factorsOpen: false,
          ghostReviewOpen: false,
          rightDataPanel: null,
          leftAssetPanel: null,
          leftAssetRestore: null,
          leftAssetPinned: false,
          cmdOpen: false,
          addOpen: false,
          coachOpen: false,
          utilityPanel: null,
        });
        setInstrumentsSummoned(false);
        return;
      }
      if (
        e.key.toLowerCase() === "i" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        planOn &&
        !ui.frameOn
      ) {
        e.preventDefault();
        if (ui.isolatedLayer) {
          studio.setUi({ isolatedLayer: null });
          return;
        }
        const selected = studio.items.find(
          (item) => item.id === ui.selectedId && !item.ghost,
        );
        if (selected) {
          studio.setUi({ isolatedLayer: ITEM_LAYER[selected.t] });
        }
        return;
      }
      if (e.key.toLowerCase() === "f" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        // F = Fit sheet (product). Shift+F = zoom camera to selection.
        if (e.shiftKey) {
          if (!ui.frameOn) studio.fitSelectionView();
          return;
        }
        setFitSheetOn(!ui.frameOn);
        return;
      }
      /* Q flips back to the previous tool — no toolbar round trip. */
      if (
        e.key.toLowerCase() === "q" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        planOn &&
        !ui.frameOn
      ) {
        const next = toggleTool(toolStackRef.current);
        if (next !== ui.tool) {
          e.preventDefault();
          studio.setTool(next);
          setInstrumentsSummoned(true);
        }
        return;
      }
      /* +/- = scale selection when selected; else infinite zoom. Alt+/- = print 1:N. */
      if (
        (e.key === "+" || e.key === "=" || e.key === "-" || e.key === "_") &&
        ui.mode !== "elevation" &&
        ui.mode !== "quote" &&
        ui.mode !== "share"
      ) {
        e.preventDefault();
        if (ui.frameOn && e.altKey) {
          studio.snapSheetScale(
            e.key === "-" || e.key === "_" ? 1 : -1,
          );
        } else if (
          ui.selectedId &&
          !ui.drawPoly &&
          !e.metaKey &&
          !e.ctrlKey &&
          !e.altKey
        ) {
          const item = studio.items.find((i) => i.id === ui.selectedId);
          if (item) {
            const delta = e.key === "-" || e.key === "_" ? -0.1 : 0.1;
            studio.transformItem(ui.selectedId, {
              scale: Math.max(0.35, Math.min(2.5, item.scale + delta)),
            });
          }
        } else {
          studio.setUi({
            zoom: zoomByKeyStep(
              ui.zoom,
              e.key === "-" || e.key === "_" ? -1 : 1,
            ),
          });
        }
        return;
      }
      if (
        (e.key.toLowerCase() === "a" || e.key === "Enter") &&
        ai.current &&
        !ui.drawPoly &&
        ui.tool !== "service" &&
        ui.tool !== "calib" &&
        ui.tool !== "level" &&
        ui.tool !== "trace" &&
        ui.tool !== "zone"
      ) {
        e.preventDefault();
        ai.accept(ai.current.id);
        return;
      }
      if (e.key.toLowerCase() === "r" && ai.current && !ui.drawPoly) {
        e.preventDefault();
        ai.reject(ai.current.id);
        return;
      }
      if (e.key === "[" || e.key === "]") {
        e.preventDefault();
        if (ui.selectedId && !ui.drawPoly) {
          // Per-asset clock rotate — never touches ui.viewRotationDeg.
          studio.rotateSelectedClock(e.key === "]" ? 1 : -1);
          return;
        }
        // No selection: CAD camera rotate by the active step (15/45/90).
        if (ui.mode === "cad" && !ui.frameOn && !ui.drawPoly) {
          const dir = e.key === "]" ? 1 : -1;
          studio.setUi({
            viewRotationDeg: stepViewRotationDeg(
              ui.viewRotationDeg,
              dir,
              ui.viewRotationStepDeg,
            ),
          });
        }
        return;
      }
      if (
        e.key === "0" &&
        e.shiftKey &&
        !e.metaKey &&
        !e.ctrlKey &&
        ui.mode === "cad" &&
        !ui.frameOn
      ) {
        e.preventDefault();
        studio.setUi({ viewRotationDeg: 0 });
        return;
      }
      if (
        !ui.selectedId &&
        !ui.drawPoly &&
        ai.pendingCount > 0 &&
        (e.key === "ArrowLeft" || e.key === "ArrowRight")
      ) {
        e.preventDefault();
        ai.cycle(e.key === "ArrowRight" ? 1 : -1);
        return;
      }
      if (
        ui.selectedId &&
        !ui.drawPoly &&
        rotateChordRef.current &&
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)
      ) {
        e.preventDefault();
        const dir =
          e.key === "ArrowRight" || e.key === "ArrowUp" ? 1 : -1;
        const item = studio.items.find((i) => i.id === ui.selectedId);
        if (item) {
          studio.transformItem(ui.selectedId, {
            rot: ((Math.round(item.rot / 15) * 15 + dir * 15) % 360 + 360) % 360,
          });
        }
        return;
      }
      if (
        ui.selectedId &&
        !ui.drawPoly &&
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)
      ) {
        e.preventDefault();
        const step = e.shiftKey ? 1 : 0.2;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        studio.nudgeSelected(dx, dy);
        return;
      }
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedAnnotationId &&
        !ui.drawPoly &&
        annotatePhase === "off"
      ) {
        e.preventDefault();
        const removed = studio.removeAnnotation(selectedAnnotationId);
        setSelectedAnnotationId(null);
        if (removed) {
          toast.show("Note removed", "info", 5000, {
            action: {
              label: "Undo",
              onClick: () => studio.restoreAnnotation(removed),
            },
          });
        }
        return;
      }
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        ui.selectedId &&
        !ui.drawPoly
      ) {
        e.preventDefault();
        studio.deleteSelected();
      }

      /* Digit accelerators for Soft/Hard swatches (CAD hotkeys, not a hotbar). */
      if (/^[1-9]$/.test(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const idx = Number(e.key) - 1;
        const selected = studio.items.find(
          (i) => i.id === ui.selectedId && !i.ghost,
        );
        const sw = PAINT_SWATCHES[idx];
        if (sw && ui.tool !== "zone") {
          e.preventDefault();
          if (selected) {
            studio.changeSelectedType(sw.t);
            return;
          }
          if (ui.tool === "paint" && !ui.frameOn) {
            studio.setUi({ paintSwatch: sw.t, tool: "paint" });
            return;
          }
          studio.setUi({
            armed: sw.t,
            tool: "add",
            addOpen: true,
            cmdOpen: false,
          });
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // Depends on `studio` and `ui` wholesale, so it already re-binds on most
    // state changes; the rest are listed so the shortcut closure cannot go stale.
    //
    // `planOn` and `setFitSheetOn` are deliberately absent: both are declared
    // below this effect, so naming them in the dependency array is a temporal
    // dead zone reference (TS2448). The effect body reads them when a key fires,
    // which is after render, so the closure is correct — only the dep array
    // cannot see them. Fixing this properly means reordering declarations in a
    // 5,700-line component; tracked in OUTSTANDING.md.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    studio,
    ui,
    ai,
    animateTiltTo,
    annotatePhase,
    selectedAnnotationId,
    toast,
  ]);

  useEffect(() => {
    setQuotePersisted(hasQuote);
    setPortalUri(quotePortalUri);
  }, [hasQuote, quotePortalUri]);

  const planOn =
    ui.mode !== "elevation" &&
    ui.mode !== "quote" &&
    ui.mode !== "share" &&
    ui.mode !== "present";
  const armedGardenLook = activeGardenViewpoint(
    ui.tiltDeg,
    ui.viewRotationDeg,
  );
  const horizonCardCount = estimate.horizon.filter(
    (h) =>
      !ui.mitigated[h.id] &&
      (h.kind === "drainage" || h.kind === "tpz" || h.kind === "engineer"),
  ).length;
  const chrome = resolveHandoffChrome({
    mode: ui.mode,
    tool: ui.tool,
    focusOn: ui.focusOn,
    frameOn: ui.frameOn,
    clientView: ui.clientView,
    foundationCleanse: ui.foundationCleanse,
    pendingGhosts: ai.pendingCount,
    shadeOn: ui.shadeOn,
    dataSummoned: ui.rightDataPanel === "measures",
    floraSessionActive: Boolean(ui.floraSession),
    horizonCardCount,
    compact: compactAssetUi,
    lightingWorkspaceOn: ui.lightingWorkspaceOn,
  });
  // Drop Instant Planner summons when leaving modes that host them.
  useEffect(() => {
    if (!chrome.liveBom) {
      setPlannerAssistOpen(false);
      setStructuredToolsOpen(false);
      return;
    }
    if (ui.mode !== "sketch" && ui.mode !== "cad") {
      setStructuredToolsOpen(false);
    }
  }, [chrome.liveBom, ui.mode]);
  const measuresOpen = ui.rightDataPanel === "measures";
  const layersOpen = ui.rightDataPanel === "layers";
  const imageLayersOpen = ui.rightDataPanel === "image_layers";
  const servicesOpen = ui.rightDataPanel === "services";
  const environmentOpen = ui.rightDataPanel === "environment";
  const siteMetaOpen = ui.rightDataPanel === "site";
  const treesMetaOpen = ui.rightDataPanel === "trees";
  const sitesOpen = ui.rightDataPanel === "sites";
  const checklistOpen = ui.rightDataPanel === "checklist";
  const quoteRailOpen = ui.rightDataPanel === "quote";
  const hasCostedLines = estimate.lines.some((l) => l.total > 0);
  const draftSurface = chrome.draftSurface;
  const ghostsLaneOpen = draftSurface && ui.ghostReviewOpen;
  const rightLaneBusy = ui.rightDataPanel != null || ghostsLaneOpen;
  const surveyProgress = useMemo(
    () =>
      surveyChecklistProgress({
        boundary: studio.boundary,
        building: studio.building,
        items: studio.items,
        levels: studio.levels,
        services: studio.services,
        easements: studio.easements,
      }),
    [
      studio.boundary,
      studio.building,
      studio.items,
      studio.levels,
      studio.services,
      studio.easements,
    ],
  );
  const streetContextChips = useMemo(() => {
    const chips = studio.keylessOverlays
      .filter(
        (o) =>
          o.kind === "water_corp" ||
          o.kind === "road_casement" ||
          o.kind === "planning" ||
          o.kind === "flood" ||
          o.kind === "bushfire",
      )
      .map((o) => {
        if (o.kind === "water_corp") {
          return o.label ? `Water corp · ${o.label}` : "Water corp overlay";
        }
        if (o.kind === "road_casement") {
          return o.label
            ? `Road casement · ${o.label}`
            : "Road / frontage casement";
        }
        if (o.kind === "planning") {
          return o.label ? `Planning · ${o.label}` : "Planning zone";
        }
        if (o.kind === "flood") return "Flood / LSIO wash";
        if (o.kind === "bushfire") return "Bushfire / BMO wash";
        return o.kind;
      });
    return [...new Set(chips)];
  }, [studio.keylessOverlays]);
  const councilDrainTpl = useMemo(
    () =>
      councilDrainageChase(null, titleBlock?.councilLabel ?? null)
        .requestTemplate,
    [titleBlock?.councilLabel],
  );
  /* Bump-to-refresh nonce — nothing reads the value, only the re-render. */
  const [, setStickyRestoreNonce] = useState(0);
  const [weatherDay, setWeatherDay] = useState<EnvWeatherDay | null>(null);
  useEffect(() => {
    if (!projectId || !servicesOpen) return;
    let cancelled = false;
    void listProjectFilesClient(projectId)
      .then((files) => {
        if (cancelled) return;
        setBydaFiles(files.filter((f) => f.kind === "byda"));
      })
      .catch(() => {
        if (!cancelled) setBydaFiles([]);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, servicesOpen]);
  useEffect(() => {
    if (!servicesOpen) return;
    if (ui.sitePackChase.length > 0) return;
    studio.setUi({
      sitePackChase: defaultSitePackChase({
        councilLabel: titleBlock?.councilLabel ?? null,
      }),
    });
    // studio.setUi is stable; omit studio object to avoid re-fire each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once when Services opens empty
  }, [servicesOpen, titleBlock?.councilLabel, ui.sitePackChase.length]);
  useEffect(() => {
    if (!projectId) {
      setWeatherDay(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const { getWeatherAction } = await import("../../../app/actions");
        const forecast = await getWeatherAction(projectId);
        if (cancelled) return;
        const day = forecast?.days?.[0];
        setWeatherDay(
          day
            ? {
              precipitation_mm: day.precipitation_mm,
              wind_max_kph: day.wind_max_kph ?? day.wind_speed_kmh,
              temp_max_c: day.temp_max_c,
              temp_min_c: day.temp_min_c,
              humidity_pct: day.humidity_pct ?? null,
            }
            : null,
        );
      } catch {
        if (!cancelled) setWeatherDay(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);
  const envLiveMeta = useMemo(
    () =>
      buildEnvLiveMeta({
        sunMin: ui.sunMin,
        sunDatePreset: ui.sunDatePreset,
        growth: ui.growth,
        lat: projectLat,
        lng: projectLng,
        shadeOn: ui.shadeOn,
        weatherDay,
      }),
    [
      ui.sunMin,
      ui.sunDatePreset,
      ui.growth,
      ui.shadeOn,
      projectLat,
      projectLng,
      weatherDay,
    ],
  );
  const treesLiveMeta = useMemo(
    () => buildTreesLiveMeta({ items: studio.items }),
    [studio.items],
  );
  const surveyServicesAuthoring = surveyServicesAuthoringAllowed({
    mode: ui.mode,
    servicesLocked: ui.servicesLocked,
  });
  const titleLocked =
    ui.foundationCleanse || ui.boundarySource === "vicmap";
  const drawingHot = chrome.collapseUtility;
  const showDocks = chrome.utilityDrawer;
  /**
   * Dual-mode zoom — past the precision threshold, swap to the crisp skin so
   * fine CAD work never fights the soft shell. Instant (no animated morph).
   */
  const precisionOn =
    planOn &&
    !ui.frameOn &&
    !ui.focusOn &&
    !ui.clientView &&
    ui.zoom >= 2.2;
  /**
   * Fill / asset panel — always on in plan CAD/sketch (command-first collapsed
   * rail by default). Compact widths use AssetCommandSheet instead of the dock.
   */
  const assetChromeOn =
    (ui.mode === "cad" || ui.mode === "sketch") &&
    !ui.frameOn &&
    !ui.focusOn &&
    !ui.clientView &&
    !ui.foundationCleanse;
  /** Desktop dock — hidden on compact widths (mobile sheet owns placement). */
  const assetPanelOn =
    assetChromeOn &&
    !compactAssetUi &&
    (ui.leftAssetPanel === "expanded" || ui.leftAssetPanel === "placing");
  /** Summoned Add card from the border icon — no persistent panel for type pick. */
  const canvasToolCardOn =
    assetChromeOn &&
    !compactAssetUi &&
    ui.tool === "add" &&
    ui.addOpen &&
    ui.leftAssetPanel == null;
  /** One assets path: compact uses StudioSheetHost Assets only (no second floater). */
  const studioSheetVisible =
    chrome.studioSheet &&
    (studioSheetOpen ||
      Boolean(ui.armed) ||
      (chrome.inboxSheet && studioSheetPage === "inbox"));
  const inboxCardCount = horizonCardCount + openBoardFindings.length;
  const contextualStripVisible =
    chrome.contextualStrip &&
    !(studioSheetVisible && studioSheetSnap === "full");
  /**
   * Canvas-first mandate: idle parchment is tool-free.
   * Summon via header Instruments / margin / Q; stay up while a craft tool is armed.
   */
  const instrumentsVisible =
    instrumentsSummoned ||
    (ui.tool !== "select" && ui.tool !== "pan" && ui.tool !== "lock");
  const compactSafeBottom = sheetSafeBottomPx({
    sheetOpen: studioSheetVisible,
    fabOn: chrome.primaryFab,
    sunOn: chrome.sunGrowth,
    toolStripOn: contextualStripVisible && instrumentsVisible,
  });

  /* Canvas-first auto-fade: rails dim after inactivity so the drawing is the product. */
  const idleDisabled =
    ui.cmdOpen ||
    sharePopupOpen ||
    sheetComposeOpen ||
    ui.addOpen ||
    ui.coachOpen ||
    ui.factorsOpen ||
    ui.ghostReviewOpen ||
    ui.rightDataPanel != null ||
    headerViewMenuOpen ||
    studioSheetVisible ||
    /* Client meeting keeps View (exit / print) — idle must not bury it. */
    ui.clientView ||
    /* Present owns the viewport — suspend studio idle recession while composing. */
    ui.mode === "present";
  const idle = useChromeIdle({
    timeout: 6000,
    disabled: idleDisabled,
  });

  /* Canvas-first linger — idle summoned tools fade so parchment returns. */
  useEffect(() => {
    if (!instrumentsSummoned) return;
    if (ui.tool !== "select" && ui.tool !== "pan" && ui.tool !== "lock") return;
    const id = window.setTimeout(() => setInstrumentsSummoned(false), 4_200);
    return () => window.clearTimeout(id);
  }, [instrumentsSummoned, ui.tool]);
  /** Undo filmstrip — desktop CAD/survey only; compact uses ⌘K / strip. */
  const undoFilmOn =
    !compactAssetUi &&
    (ui.mode === "cad" || ui.mode === "survey") &&
    !ui.frameOn &&
    !ui.focusOn &&
    !ui.clientView &&
    !ui.foundationCleanse;
  /** Prefer live project address; demo site switcher still re-queries Vicmap. */
  const displayAddress = studio.siteAddress || projectAddress;
  /**
   * Free-plan metres stay at the calibrated / default board width.
   * Print 1:N (`sheetScaleDenom`) must not stretch live CAD maths.
   */
  const scaleM = ui.boardWidthM ?? BOARD_WIDTH_M_AT_100;

  const trenchDrafting = useMemo(
    () => (studio.constructionTrenches ?? []).some((t) => t.ghost),
    [studio.constructionTrenches],
  );
  const highStakesBuildable = shouldAutoShowBuildableArea({
    tool: ui.tool,
    armed: ui.tool === "paint" ? ui.paintSwatch : ui.armed,
    armedSymbolId: ui.armedSymbolId,
    trenchDrafting,
  });
  const buildableAreaVisible =
    (ui.buildableAreaOn || highStakesBuildable) &&
    !ui.frameOn &&
    !ui.focusOn;

  const lvRuns = useMemo(() => {
    const boardW = scaleM > 0 ? scaleM : 110;
    const zones = studio.irrigationZones
      .filter((z) => z.kind === "lighting" || z.kind === "lighting_conduit")
      .map((z) => ({
        id: z.id,
        kind: z.kind as "lighting" | "lighting_conduit",
        points: z.points.map((p) => ({ x: p.x_pct, y: p.y_pct })),
        wire_gauge: z.wire_gauge,
        transformer_va: z.transformer_va,
      }));
    const fixtures = studio.items
      .filter(
        (i) =>
          !i.ghost && i.symbolId != null && isLightingSymbolId(i.symbolId),
      )
      .map((i) => ({
        id: i.id,
        symbolId: i.symbolId!,
        x: i.x,
        y: i.y,
        rot: i.rot,
      }));
    return assessLvRuns({
      zones,
      fixtures,
      boardWidthM: boardW,
      defaultTransformerVa: ui.lightingTransformerVa,
      defaultWireGauge: ui.lightingWireGauge,
    });
  }, [
    scaleM,
    studio.irrigationZones,
    studio.items,
    ui.lightingTransformerVa,
    ui.lightingWireGauge,
  ]);
  const lvCircuit = lvRuns.aggregate;

  const irrigUniformity = useMemo(
    () => assessIrrigationUniformity(studio.irrigationZones, scaleM),
    [studio.irrigationZones, scaleM],
  );

  /** Same azimuth vector as SunCastOverlay — drives decorative glyph shadows. */
  const sunAzimuthDeg = useMemo(() => {
    const when = sunDateFromPreset(ui.sunDatePreset, ui.sunMin);
    const lat = projectLat ?? -37.849;
    const lng = projectLng ?? 144.993;
    return sunPositionAt(lat, lng, when).azimuth_deg;
  }, [ui.sunDatePreset, ui.sunMin, projectLat, projectLng]);

  const siteLiveMeta = useMemo(
    () =>
      buildSiteLiveMeta({
        boundary: studio.boundary,
        building: studio.building,
        easements: studio.easements,
        scaleM,
        lotAreaM2:
          siteAreaDisplay?.lotAreaM2 ?? titleBlock?.lotAreaM2 ?? null,
        titleSource: titleBlock?.sourceLabel ?? null,
        lotDisagreement: siteAreaDisplay?.lotDisagreement ?? null,
      }),
    [
      studio.boundary,
      studio.building,
      studio.easements,
      scaleM,
      siteAreaDisplay?.lotAreaM2,
      siteAreaDisplay?.lotDisagreement,
      titleBlock?.lotAreaM2,
      titleBlock?.sourceLabel,
    ],
  );

  /**
   * Dark is a *screen* lens — it must never leak into the Fit sheet, which
   * is a print artifact and stays parchment regardless. `ui.darkOn` keeps
   * the toggle state; every render path reads `darkLens`.
   */
  const darkLens = ui.darkOn && !ui.frameOn;

  /**
   * Fit sheet layout — fixed plot clip + content scale from 1:N.
   * Clip must never share a node with transform (that locked frame to drawing).
   */
  const sheetPlotLayout = useMemo(() => {
    if (!ui.frameOn || boardSize.w < 1 || boardSize.h < 1) return null;
    const sheet = sheetBoxFor(boardSize.w, boardSize.h, ui.paper);
    /* A4 portrait reflows: title block becomes a bottom strip so the plot
       keeps full paper width (landscape lots were thumbnails otherwise). */
    const a4 = ui.paper === "a4";
    const titleW = a4 ? 0 : titlePanelWidth(sheet.boxW);
    const elevH =
      (ui.sheetElevOn ? 56 * 2 + 34 : 0) + (a4 ? SHEET_TITLE_STRIP_H : 0);
    const plot = plotBoxFor(sheet, { titleW, elevH });
    const view = sheetContentView({
      boundary: studio.boundary,
      building: studio.building,
      scaleM,
      boardW: boardSize.w,
      boardH: boardSize.h,
      plot,
      paper: ui.paper,
      sheetW: sheet.boxW,
      scaleDenom: ui.sheetScaleDenom,
    });
    return {
      plot,
      view,
      clipPath: `inset(${plot.boxTop}px ${Math.max(0, boardSize.w - plot.boxLeft - plot.boxW)}px ${Math.max(0, boardSize.h - plot.boxTop - plot.boxH)}px ${plot.boxLeft}px)`,
    };
  }, [
    ui.frameOn,
    ui.paper,
    ui.sheetElevOn,
    ui.sheetScaleDenom,
    boardSize.w,
    boardSize.h,
    studio.boundary,
    studio.building,
    scaleM,
  ]);

  /**
   * Absolute camera zoom on free plan and Fit sheet (0.05–64).
   * Fit sheet seeds ui.zoom to the paper-fit value on enter; pan centres the lot.
   */
  const planZoom = clampZoom(ui.zoom);
  const planFocusX = sheetPlotLayout?.view.focusX ?? ui.focusX;
  const planFocusY = sheetPlotLayout?.view.focusY ?? ui.focusY;
  /** Sheet centres the lot; ui.pan is extra drag on free plan and Fit sheet. */
  const planPanX = (sheetPlotLayout?.view.panX ?? 0) + ui.panX;
  const planPanY = (sheetPlotLayout?.view.panY ?? 0) + ui.panY;
  /**
   * Camera yaw — viewport only (geometry % coords unchanged).
   * CAD free plan + Looking N/E/S/W while tilted; flat Sketch/Fit stay north-up.
   */
  const planRotateDeg = resolvePlanRotateDeg({
    mode: ui.mode,
    frameOn: ui.frameOn,
    clientView: ui.clientView,
    tiltDeg: ui.tiltDeg,
    viewRotationDeg: ui.viewRotationDeg,
    tiltAnimating: tiltAnimKind != null,
  });
  /**
   * Live camera matching `.zoomWorld` — passed to any overlay that portals
   * frosted chrome via `CameraChrome` so those elements stay clear of the
   * camera transform (constant screen size, no pan/rotate leak) while the
   * underlying geometry rides the world scale.
   */
  const planCam = boardCameraFromPlan({
    boardW: boardSize.w,
    boardH: boardSize.h,
    planZoom,
    planRotateDeg,
    planPanX,
    planPanY,
    planFocusX,
    planFocusY,
  });
  /**
   * Free-plan paper stays OUTSIDE the camera transform (flat). Scaling
   * parchment inside `.zoomWorld` made the cream board grow/shrink with the
   * lot on every wheel tick. Under tilt, paper must ride the camera (see
   * `.tiltSkin`) so foreshortening keeps the shade — bleed hides then.
   */
  const tiltLensOn = isTiltActive(ui.tiltDeg) || tiltAnimKind != null;
  /*
   * The in-world (zoom-world) parchment scales with the camera, so on the Fit
   * sheet it shrank away from the paper. Hide it in sheet mode too and let the
   * viewport-fixed ground (clipped to the plot rect) fill the sheet instead —
   * the canvas stays full, only the plan vectors scale.
   */
  const worldHidePaper = planOn && (!ui.frameOn || Boolean(sheetPlotLayout));
  const skinScale = tiltLensOn
    ? tiltSkinScale(ui.tiltDeg || TILT_DEG, planZoom)
    : 1;
  const boardSunCast = useMemo(
    () =>
      resolveBoardSunCast({
        shadeOn: ui.shadeOn && !ui.frameOn,
        sunMin: ui.sunMin,
        datePreset: ui.sunDatePreset,
        growth: ui.growth,
        lat: projectLat,
        lng: projectLng,
        boardWidthM: scaleM,
      }),
    [
      ui.shadeOn,
      ui.frameOn,
      ui.sunMin,
      ui.sunDatePreset,
      ui.growth,
      projectLat,
      projectLng,
      scaleM,
    ],
  );

  const floraGuardItems = useMemo(
    () =>
      studio.items.map((it) => ({
        id: it.id,
        t: it.t,
        x: it.x,
        y: it.y,
        scale: it.scale,
        ghost: it.ghost,
        dbhM: it.dbhM,
        canopyM: BY_TYPE[it.t]?.canopyM,
      })),
    [studio.items],
  );

  /**
   * Seed the honest print scale when opening Fit sheet / changing paper.
   * Auto = rawDenom snapped up the standard ladder, so the operator clicks
   * A3/A4 and gets a true, filled sheet with zero fiddling. Alt+wheel then
   * overrides along the ladder until the next paper/entry reseed.
   */
  const autoDenomKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!ui.frameOn || !sheetPlotLayout) {
      autoDenomKeyRef.current = null;
      return;
    }
    const key = `${ui.paper}:${boardSize.w}x${boardSize.h}`;
    if (autoDenomKeyRef.current === key) return;
    autoDenomKeyRef.current = key;
    const auto = sheetPlotLayout.view.autoDenom;
    if (auto !== ui.sheetScaleDenom) {
      studio.setUi({ sheetScaleDenom: auto });
    }
  }, [
    ui.frameOn,
    ui.paper,
    ui.sheetScaleDenom,
    boardSize.w,
    boardSize.h,
    sheetPlotLayout,
    studio,
  ]);

  /** Seed absolute zoom to the current 1:N whenever format or denom changes. */
  const fitSeedKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!ui.frameOn || !sheetPlotLayout) {
      fitSeedKeyRef.current = null;
      return;
    }
    const key = `${ui.paper}:${ui.sheetScaleDenom}:${boardSize.w}x${boardSize.h}`;
    if (fitSeedKeyRef.current === key) return;
    fitSeedKeyRef.current = key;
    studio.setUi({
      zoom: clampZoom(sheetPlotLayout.view.zoom),
      panX: 0,
      panY: 0,
    });
  }, [
    ui.frameOn,
    ui.paper,
    ui.sheetScaleDenom,
    boardSize.w,
    boardSize.h,
    sheetPlotLayout,
    studio,
  ]);

  const setFitSheetOn = useCallback(
    (on: boolean) => {
      if (on) {
        fitSeedKeyRef.current = null;
        autoDenomKeyRef.current = null;
        /* Denom is auto-seeded from the true fit (autoDenom effect) —
           no hardcoded 1:100. */
        /* Paper-first: clear orbit chrome, lanes, and armed tools. */
        studio.setSelection(null, []);
        studio.setUi({
          frameOn: true,
          panX: 0,
          panY: 0,
          tool: "select",
          rightDataPanel: null,
          cmdOpen: false,
          arBirdseyeOn: false,
          lightingWorkspaceOn: false,
          ghostReviewOpen: false,
        });
        // First open with an empty, never-templated pack → seed the client
        // brochure onto the paper. Compose peel stays closed.
        const pack = studio.presentationPack;
        if (
          (pack.widgets?.length ?? 0) === 0 &&
          pack.template_id == null
        ) {
          studio.applyPresentationTemplate("curtis-client-brochure");
        }
        return;
      }
      // Leaving Fit sheet — restore a coherent free-plan camera on every tab.
      setSheetComposeOpen(false);
      outdoorFitKeyRef.current = null;
      fitSeedKeyRef.current = null;
      studio.setUi({ frameOn: false, panX: 0, panY: 0, zoom: 1 });
      studio.fitOutdoorView();
    },
    [studio],
  );

  /**
   * Leaving CAD (or Fit/client) — park camera at north so Sketch stays clean.
   * Keep yaw while a garden axon is tilted (Looking E/S/W in Survey/Sketch).
   */
  useEffect(() => {
    if (ui.mode === "cad" && !ui.frameOn && !ui.clientView) return;
    if (isTiltActive(ui.tiltDeg)) return;
    if (ui.viewRotationDeg === 0) return;
    studio.setUi({ viewRotationDeg: 0 });
  }, [
    ui.mode,
    ui.frameOn,
    ui.clientView,
    ui.tiltDeg,
    ui.viewRotationDeg,
    studio,
  ]);

  const [formalizing, setFormalizing] = useState(false);

  /** Single authority for mode + `?mode=` URL — never setMode alone. */
  const syncModeUrl = useCallback(
    (mode: StudioMode) => {
      studio.setMode(mode);
      const next = new URLSearchParams(searchParams.toString());
      next.set("mode", mode);
      window.history.replaceState(
        window.history.state,
        "",
        `${pathname}?${next.toString()}`,
      );
    },
    [studio, searchParams, pathname],
  );

  /**
   * Sketch → CAD: rasterize the raw freehand ink and run the Claude vision
   * pipeline server-side, then apply the returned CAD elements as reviewable
   * ghosts. Falls back to the local heuristic when the network / model fails.
   */
  const runFormalizeToCad = useCallback(async () => {
    if (formalizing) return;
    if (studio.strokes.length === 0) {
      syncModeUrl("cad");
      studio.setUi({
        assistReply: "Sketch on the plan first — then formalize to CAD when ready.",
        councilTip: "Draw a path, bed, or canopy mark before translating to CAD.",
      });
      return;
    }
    setFormalizing(true);
    studio.setUi({
      assistReply: "Translating sketch to CAD with AI…",
      councilTip: null,
    });
    try {
      const raster = rasterizeStrokesToPng(
        studio.strokes,
        boardSize.w,
        boardSize.h,
      );
      if (!raster) {
        studio.interpretSketches();
        studio.setUi({
          councilTip:
            "Could not capture the sketch image — used quick geometry translation instead.",
        });
        return;
      }
      const res = await formalizeSketchToCadAction(projectId, {
        image_base64: raster.image_base64,
        mime_type: raster.mime_type,
        boundary: studio.boundary.map((p) => ({ x: p.x, y: p.y })),
        building: studio.building.map((p) => ({ x: p.x, y: p.y })),
        strokes: studio.strokes.map((s) => ({
          id: s.id,
          points: s.points.map((p) => ({ x: p.x, y: p.y })),
        })),
        scale_m: scaleM,
      });
      studio.applyCadSuggestions(res.suggestions, { source: res.source });
      if (res.source === "heuristic") {
        studio.setUi({
          councilTip:
            "AI vision unavailable — used quick geometry translation. Review ghosts before accepting.",
        });
      }
    } catch {
      // Network / model failure — keep the operator moving with the heuristic.
      studio.interpretSketches();
      studio.setUi({
        councilTip:
          "AI translation failed — used quick geometry translation. Review ghosts before accepting.",
      });
    } finally {
      setFormalizing(false);
    }
  }, [formalizing, studio, boardSize.w, boardSize.h, projectId, scaleM, syncModeUrl]);

  const requestMode = useCallback(
    (mode: (typeof MODE_TABS)[number]) => {
      /*
       * Changing mode EXITS the Fit sheet first — switching tabs while
       * frameOn left the studio in a half-state (sheet clip + seeded zoom
       * with no sheet chrome). Same clean path as toggling Fit off.
       */
      if (ui.frameOn) setFitSheetOn(false);
      if (ui.mode === "sketch" && mode === "cad" && studio.strokes.length > 0) {
        const alreadyHasSketchGhosts = studio.items.some(
          (i) => i.ghost && i.id.startsWith("ai-sketch-"),
        );
        if (!alreadyHasSketchGhosts) {
          void runFormalizeToCad();
          return;
        }
      }
      syncModeUrl(mode);
    },
    [ui.mode, ui.frameOn, setFitSheetOn, studio, runFormalizeToCad, syncModeUrl],
  );

  const activeArtboard = resolveActiveArtboard({
    mode: ui.mode,
    frameOn: ui.frameOn,
    elevLook: ui.elevLook,
  });

  const selectArtboard = useCallback(
    (id: ArtboardId) => {
      const look = artboardElevLook(id);
      if (look) {
        if (ui.frameOn) setFitSheetOn(false);
        syncModeUrl("elevation");
        studio.setUi({ elevLook: look });
        return;
      }
      if (id === "fit") {
        if (ui.mode === "elevation") syncModeUrl("cad");
        setFitSheetOn(true);
        return;
      }
      if (ui.mode === "elevation") syncModeUrl("cad");
      else if (ui.frameOn) setFitSheetOn(false);
    },
    [ui.frameOn, ui.mode, setFitSheetOn, syncModeUrl, studio],
  );

  useEffect(() => {
    let cancelled = false;
    void lookupCadastralTitleAction(projectId, displayAddress)
      .then((block) => {
        if (!cancelled && block) setTitleBlock(block);
      })
      .catch(() => {
        /* keep last good title block */
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, displayAddress]);
  const draftingPlate = isDraftingPlate(ui.mode);
  const aerialOk = allowAerialUnderlay({
    mode: ui.mode,
    foundationCleanse: ui.foundationCleanse,
  });
  /** Single aerial paint path — Survey upload only; never CAD/Sketch/Stage 1. */
  const liveAerial = resolveLiveAerial({
    mode: ui.mode,
    foundationCleanse: ui.foundationCleanse,
    aerialSuppressed: ui.aerialSuppressed,
    aerialUri: ui.aerialUri,
    allowPlanUnderlay: draftingPlate && !ui.foundationCleanse,
  });
  const titleCueOnCad =
    (ui.foundationCleanse || titleLocked) && !ui.frameOn;
  const flaggedIds = new Set<string>(
    compliance.alerts.flatMap((a: { sourceIds: string[] }) => a.sourceIds),
  );

  const openHorizon = estimate.horizon.filter((h) => !ui.mitigated[h.id]);
  const actionHorizon = openHorizon.filter(
    (h) => h.kind === "drainage" || h.kind === "tpz" || h.kind === "engineer",
  );

  /*
   * `_trade` is unused: the live trade estimate is solved on every estimate
   * change and never surfaced anywhere in the studio. Kept, not deleted — the
   * calculation is real and owned by @workstream/domain; what is missing is the
   * display. See OUTSTANDING.md.
   */
  const _trade = useMemo(
    () => solveLiveTradeEstimate({ report: estimate }),
    [estimate],
  );

  const tpzReadouts = compliance.alerts
    .filter((a) => a.code === "tpz")
    .map((a) => {
      const hardId = a.sourceIds.find((id) => {
        const it = studio.items.find((x) => x.id === id);
        return it && (it.t === "paving" || it.t === "deck");
      });
      const item = studio.items.find((x) => x.id === hardId);
      const pctMatch = a.title.match(/(\d+)%/);
      return {
        id: a.id,
        x: item?.x ?? 50,
        y: item?.y ?? 50,
        pct: pctMatch ? Number(pctMatch[1]) : 0,
        active: ui.hoverId === hardId || ui.selectedId === hardId,
      };
    });

  const selectedLive =
    studio.items.find((i) => i.id === ui.selectedId && !i.ghost) ?? null;

  /** Single-selection orbit (dial) — also drives the focus veil. */
  const selectionOrbitOn = Boolean(
    !ui.clientView &&
    !ui.frameOn &&
    !isTiltActive(ui.tiltDeg) &&
    selectedLive &&
    ui.groupIds.length <= 1 &&
    ui.tool !== "zone" &&
    (ui.mode === "cad" || ui.mode === "survey"),
  );

  /** One-time dial discoverability (session). */
  useEffect(() => {
    if (dialHintSeenRef.current) return;
    if (!selectedLive || ui.frameOn || isTiltActive(ui.tiltDeg)) return;
    if (ui.mode !== "cad" && ui.mode !== "survey") return;
    if (ui.groupIds.length > 1) return;
    dialHintSeenRef.current = true;
    try {
      if (window.localStorage.getItem("ws-dial-hint-seen") === "1") return;
      window.localStorage.setItem("ws-dial-hint-seen", "1");
    } catch {
      /* ignore */
    }
    setDialHint(true);
  }, [selectedLive, ui.frameOn, ui.tiltDeg, ui.mode, ui.groupIds.length]);

  /** Any vectors / underlay / assets — kills barren-lot onboarding cue. */
  const hasGeometry =
    studio.items.some((i) => !i.ghost) ||
    studio.boundary.length >= 2 ||
    studio.building.length >= 2 ||
    Boolean(liveAerial) ||
    Boolean(ui.aerialUri) ||
    studio.easements.length > 0 ||
    studio.services.length > 0 ||
    titleLocked ||
    ui.boundarySource === "vicmap" ||
    ui.boundarySource === "seed";
  /** Tool armed or drawing in progress — not barren idle. */
  const canvasEngaged =
    ui.tool !== "select" ||
    Boolean(ui.drawPoly && ui.drawPoly.length > 0) ||
    Boolean(ui.selectedId) ||
    ui.groupIds.length > 0 ||
    ui.addOpen ||
    ui.locked;
  const presentMaterials = useMemo(
    () => buildSheetWidgetContext({ items: studio.items }).materialChips,
    [studio.items],
  );
  const estimateShareLines = useMemo(
    () =>
      estimate.lines
        .filter((l) => l.total > 0)
        .slice(0, 18)
        .map((l) => ({
          id: l.id,
          label: l.label,
          unit: l.unit,
          qty: l.qty,
          total: l.total,
        })),
    [estimate.lines],
  );
  const quoteShareLines = shareQuoteFreeze?.quoteLines ?? estimateShareLines;
  const quoteShareTotalInclGst =
    shareQuoteFreeze?.totalInclGst ?? estimate.totalInclGst;
  const hasCostedBom =
    quoteShareLines.length > 0 && quoteShareTotalInclGst > 0;

  const modeProgress = useMemo(
    () => ({
      hasAerial:
        Boolean(liveAerial) ||
        Boolean(ui.aerialUri) ||
        Boolean(titleBlock) ||
        studio.boundary.length >= 3,
      hasSketch: studio.items.some((i) => !i.ghost) || studio.strokes.length > 0,
      hasCad:
        studio.items.some((i) => !i.ghost) ||
        studio.strokes.length > 0 ||
        studio.irrigationZones.length > 0,
      /** Share unlocks on live costed BOM (not only persisted quote output). */
      hasQuote: hasCostedBom || quotePersisted,
    }),
    [
      hasCostedBom,
      liveAerial,
      quotePersisted,
      studio.boundary.length,
      studio.irrigationZones.length,
      studio.items,
      studio.strokes.length,
      titleBlock,
      ui.aerialUri,
    ],
  );
  const openModes = useMemo(() => unlockedModes(modeProgress), [modeProgress]);
  const fallbackMode = useMemo(() => suggestedMode(modeProgress), [modeProgress]);

  useEffect(() => {
    if (!openModes.has(ui.mode)) {
      requestMode(fallbackMode);
    }
  }, [fallbackMode, openModes, requestMode, ui.mode]);

  /*
   * Quote is a lane panel, not a mode takeover. ?mode=quote (and the Quote
   * tab) redirect to CAD and always summon the live-cost rail — including
   * the empty “place priced assets” state. Never auto-dismiss on empty:
   * that made Quote look broken after unlock.
   */
  useEffect(() => {
    if (ui.mode === "quote") {
      requestMode("cad");
      studio.setUi({ rightDataPanel: "quote", utilityPanel: null });
    }
  }, [ui.mode, requestMode, studio]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { listShareRevisionsAction } = await import(
          "../../../app/actions"
        );
        const data = await listShareRevisionsAction(projectId);
        if (!cancelled) setLatestShare(data.revisions[0] ?? null);
      } catch {
        /* non-blocking — share stamp is progressive */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const openSharedRev =
    latestShare?.status === "shared" ? latestShare : null;

  useEffect(() => {
    setShareBannerDismissed(false);
  }, [openSharedRev?.revision]);

  const lockReasonForMode = (mode: StudioMode): string | null =>
    resolveModeLockReason(mode, openModes);
  /**
   * Instrument + inventory home — margin pin only (never lot core).
   */
  const instrumentAnchor = useMemo(() => {
    if (ui.drawPoly && ui.drawPoly.length > 0) {
      const last = ui.drawPoly[ui.drawPoly.length - 1]!;
      return clampToCanvasMargin(last.x, last.y);
    }
    return clampToCanvasMargin(anchorPct.x, anchorPct.y);
  }, [ui.drawPoly, anchorPct.x, anchorPct.y]);

  /** Shade-cell sample at kit summon for planting palette filter. */
  const kitSunHours = useMemo(() => {
    const cells = buildIndicativeShadeGrid(
      projectLat ?? -37.849,
      projectLng ?? 144.993,
      sunDateFromPreset(ui.sunDatePreset, ui.sunMin),
    );
    return sunHoursAtPct(instrumentAnchor.x, instrumentAnchor.y, cells);
  }, [
    projectLat,
    projectLng,
    ui.sunDatePreset,
    ui.sunMin,
    instrumentAnchor.x,
    instrumentAnchor.y,
  ]);

  useEffect(() => {
    if (!drawingHot) return;
    if (ui.utilityPanel != null || ui.coachOpen) {
      studio.setUi({ utilityPanel: null, coachOpen: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot: clear panels when drawing becomes hot, not every time a panel opens while drawing
  }, [drawingHot]);

  const armType = (t: StudioItemType) => {
    if (needsPathGrammar(t)) {
      studio.setUi({
        armed: t,
        armedSymbolId: null,
        paintSwatch: t,
        tool: "add",
        addOpen: true,
        cmdOpen: false,
        leftAssetPanel: "placing",
        leftAssetRestore: null,
        rightDataPanel: null,
      });
      return;
    }
    // Command-first: arm without forcing the library open.
    studio.setUi({
      armed: t,
      armedSymbolId: null,
      tool: "add",
      addOpen: true,
      cmdOpen: false,
      rightDataPanel: null,
    });
  };

  const armSymbol = (sym: CatalogSymbol) => {
    const t = mapSymbolToStudioType(sym.id);
    const lighting = isLightingSymbolId(sym.id);
    studio.setUi({
      armed: t,
      armedSymbolId: sym.id,
      tool: "add",
      addOpen: true,
      cmdOpen: false,
      rightDataPanel: null,
      ...(lighting ? { lightingWorkspaceOn: true } : {}),
    });
  };

  const collapseLibraryUnlessPinned = () => {
    if (ui.leftAssetPanel !== "expanded" || ui.leftAssetPinned) return;
    studio.setUi({ leftAssetPanel: null, leftAssetRestore: null });
  };

  /** Vicmap miss / empty dwelling — one tap starts Trace → Existing dwelling. */
  const armBuildingTrace = useCallback(() => {
    setTiltPauseHint(false);
    setTiltDiscoverHint(false);
    studio.setUi(armBuildingTracePatch());
  }, [studio]);

  const topHint = resolveTopHint({
    tool: ui.tool,
    vectorEditHint,
    tiltPauseHint,
  });

  const pinInstrumentAnchor = (x: number, y: number) => {
    setAnchorPct(clampToCanvasMargin(x, y));
  };

  const studioCursor = pointerMarkPreview
    ? resolveStudioCursor({
      markId: pointerMarkPreview,
      tool: "select",
      mode: ui.mode,
      locked: false,
    })
    : resolveStudioCursor({
      markId: pointerMarkId,
      tool: ui.tool,
      mode: ui.mode,
      locked: ui.locked,
      frameOn: ui.frameOn,
      tiltViewActive: isTiltActive(ui.tiltDeg),
      boardCursor:
        boardCursor && boardCursor !== "default" ? boardCursor : null,
      sketchTool: ui.mode === "sketch" ? sketchChrome.tool : undefined,
      sketchTip: ui.mode === "sketch" ? sketchChrome.tip : undefined,
    });

  /** Drag-to-pan takes cursor priority over whatever tool is active. */
  const effectiveCursor = isPanningActive
    ? "grabbing"
    : spacePanArmed || isTiltActive(ui.tiltDeg)
      ? "grab"
      : studioCursor;

  const draftLabel =
    ai.status === "scanning"
      ? "Scanning"
      : ai.status === "assisting"
        ? "Assisting"
        : ai.pendingCount > 0
          ? `Review ${ai.pendingCount}`
          : "Ask AI";

  const leftSafeInset = resolveLeftSafeInsetPx(
    ui.leftAssetPanel,
    assetPanelOn,
  );

  const openAssetSheet = () => {
    if (chrome.studioSheet) {
      setStudioSheetPage("assets");
      setStudioSheetSnap("half");
      setStudioSheetOpen(true);
      studio.setUi({ cmdOpen: false, cmdQuery: "" });
      return;
    }
    if (!compactAssetUi) {
      studio.setUi({
        ...openLeftAssetExclusive("expanded"),
        cmdOpen: false,
        cmdQuery: "",
      });
      return;
    }
    studio.setUi({ cmdOpen: false, cmdQuery: "" });
  };

  /* useCallback because a useMemo below depends on this; a fresh function every
   * render invalidated that memo on every render. */
  const openStudioSheetPage = useCallback(
    (page: StudioSheetPage, snap: StudioSheetSnap = "half") => {
      setStudioSheetPage(page);
      setStudioSheetSnap(snap);
      setStudioSheetOpen(true);
      studioSetUi({ cmdOpen: false, cmdQuery: "" });
    },
    [studioSetUi],
  );

  const headerViewMenuHot =
    ui.darkOn ||
    isTiltActive(ui.tiltDeg) ||
    servicesOpen ||
    layersOpen ||
    sitesOpen ||
    ui.titleBoundaryLocked ||
    ui.frameOn ||
    ui.clientView ||
    instrumentsVisible ||
    sheetComposeOpen ||
    sharePopupOpen;

  const handleHeaderAi = useCallback(() => {
    if (ai.status === "scanning" || ai.status === "assisting") {
      studio.setUi({ cmdOpen: true, cmdQuery: "" });
      return;
    }
    if (ai.pendingCount === 0) {
      void ai.scan();
      return;
    }
    studio.setUi({ ghostReviewOpen: true, rightDataPanel: null });
  }, [ai, studio]);

  const headerViewMenuItems = useMemo((): HeaderViewMenuItem[] => {
    const items: HeaderViewMenuItem[] = [];

    // Craft tools
    items.push({
      id: "instruments",
      label: instrumentsVisible ? "Hide instruments" : "Show instruments",
      testId: "pointer-settings-top",
      active: instrumentsVisible,
      onSelect: () => {
        if (instrumentsVisible) {
          setInstrumentsSummoned(false);
          if (ui.tool !== "select" && ui.tool !== "pan") {
            studio.setTool("select");
          }
        } else {
          setInstrumentsSummoned(true);
        }
      },
    });

    items.push({
      id: "tilt",
      label: isTiltActive(ui.tiltDeg) ? "Flatten to 2D" : "Tilt to 3D",
      testId: "tilt-view-top",
      active: isTiltActive(ui.tiltDeg),
      onSelect: runTiltView,
    });

    if (ui.foundationCleanse || titleLocked) {
      items.push({
        id: "title-boundary",
        label: ui.foundationCleanse ? "Close title boundary" : "Title boundary",
        testId: "title-boundary-top",
        active: ui.foundationCleanse,
        onSelect: () => {
          if (ui.foundationCleanse) studio.exitStage1Foundation();
          else void studio.runStage1FoundationCleanse();
        },
      });
    }

    items.push({
      id: "fit-sheet",
      label: ui.frameOn ? "Close fit sheet" : "Fit sheet",
      testId: "fit-sheet-top",
      active: ui.frameOn,
      onSelect: () => setFitSheetOn(!ui.frameOn),
    });

    items.push({
      id: "ink-legend",
      label: inkLegendOpen ? "Hide ink legend" : "Ink legend",
      testId: "board-ink-legend-top",
      active: inkLegendOpen,
      onSelect: () => setInkLegendOpen((v) => !v),
    });

    if (ui.frameOn && !ui.clientView) {
      items.push({
        id: "sheet-compose",
        label: sheetComposeOpen ? "Close sheet compose" : "Compose sheet",
        testId: "sheet-compose-top",
        active: sheetComposeOpen,
        onSelect: () => setSheetComposeOpen((v) => !v),
      });
    }

    // Output / presentation
    items.push({
      id: "client-view",
      label: ui.clientView ? "Exit client view" : "Client presentation",
      testId: "client-view-top",
      active: ui.clientView,
      onSelect: () =>
        studio.setUi({
          clientView: !ui.clientView,
          focusOn: false,
          ghostReviewOpen: false,
        }),
    });

    if (ui.clientView) {
      items.push({
        id: "meeting-pack-print",
        label: "Print meeting pack",
        testId: "meeting-pack-print",
        onSelect: () => window.print(),
      });
    }

    if (!ui.clientView) {
      items.push({
        id: "share",
        label: hasCostedBom ? "Share" : "Cost something before sharing",
        testId: "share-top",
        disabled: !hasCostedBom,
        active: sharePopupOpen || ui.mode === "share",
        onSelect: () => {
          if (!hasCostedBom) return;
          setSharePopupOpen((v) => !v);
        },
      });
    }

    items.push({
      id: "command-palette",
      label: "Command palette",
      testId: "canvas-command-top",
      onSelect: () => studio.setUi({ cmdOpen: true }),
    });

    // Cost / quote — always summonable once CAD unlocks Quote mode
    items.push({
      id: "live-cost",
      label: quoteRailOpen ? "Close live cost" : "Live cost",
      testId: "live-cost-top",
      active: quoteRailOpen,
      onSelect: () =>
        studio.setUi({
          ...withRightDataPanel("quote"),
          utilityPanel: null,
        }),
    });

    // View / data
    if (chrome.structureRail || chrome.compact) {
      items.push({
        id: "layers",
        label: "Layers",
        testId: "canvas-layers-top",
        active: layersOpen,
        onSelect: () => {
          if (chrome.compact) openStudioSheetPage("data");
          studio.setUi({
            ...withRightDataPanel("layers"),
            utilityPanel: null,
          });
        },
      });
    }

    if (!projectId) {
      items.push({
        id: "sites",
        label: "Sites",
        testId: "canvas-sites-top",
        active: sitesOpen,
        onSelect: () =>
          studio.setUi({
            ...withRightDataPanel("sites"),
            utilityPanel: null,
          }),
      });
    }

    items.push({
      id: "dark",
      label: "Dark canvas",
      testId: "dark-canvas-top",
      active: ui.darkOn,
      onSelect: () => studio.setUi({ darkOn: !ui.darkOn }),
    });

    if (ui.foundationCleanse || titleLocked) {
      items.push({
        id: "title-lock",
        label: ui.titleBoundaryLocked ? "Unlock title" : "Lock title",
        testId: "title-boundary-lock-top",
        active: ui.titleBoundaryLocked,
        onSelect: () =>
          studio.setTitleBoundaryLocked(!ui.titleBoundaryLocked),
      });
    }

    if (ui.frameOn) {
      items.push({
        id: "print",
        label: "Print fit sheet",
        testId: "fit-sheet-print",
        onSelect: () => window.print(),
      });
    }

    return items;
  }, [
    chrome.compact,
    chrome.structureRail,
    hasCostedBom,
    inkLegendOpen,
    instrumentsVisible,
    layersOpen,
    openStudioSheetPage,
    projectId,
    quoteRailOpen,
    runTiltView,
    setFitSheetOn,
    setInstrumentsSummoned,
    setSheetComposeOpen,
    setSharePopupOpen,
    sharePopupOpen,
    sheetComposeOpen,
    sitesOpen,
    studio,
    titleLocked,
    ui.clientView,
    ui.darkOn,
    ui.foundationCleanse,
    ui.frameOn,
    ui.mode,
    ui.titleBoundaryLocked,
    ui.tiltDeg,
    ui.tool,
  ]);

  const councilTipVisible =
    planOn &&
    !ui.focusOn &&
    !ui.clientView &&
    !ui.frameOn &&
    Boolean(ui.councilTip);
  const headerContextActive =
    planOn &&
    !ui.clientView &&
    !ui.frameOn &&
    (councilTipVisible ||
      ui.setbackOn ||
      ui.shadeOn ||
      ui.growth !== "mature" ||
      ui.isolatedLayer != null ||
      ui.layerOpacity.survey < 0.95 ||
      ui.layerOpacity.boundary < 0.95 ||
      ui.layerOpacity.council < 0.95 ||
      ui.layerOpacity.vegetation < 0.95 ||
      ui.layerOpacity.services < 0.95 ||
      ui.layerOpacity.notes < 0.95);
  const showHeaderAiPill =
    !ui.focusOn &&
    !ui.clientView &&
    !ui.foundationCleanse &&
    !ui.frameOn;

  const vicGovChipRow =
    planOn && !ui.focusOn && !ui.clientView && !ui.frameOn ? (
      <StickyMetaStack
        placement="header"
        projectId={projectId}
        laneBusy={rightLaneBusy}
        activePanel={
          servicesOpen
            ? "services"
            : environmentOpen
              ? "environment"
              : siteMetaOpen
                ? "site"
                : treesMetaOpen
                  ? "trees"
                  : null
        }
        scaleM={scaleM}
        boundary={studio.boundary}
        building={studio.building}
        services={studio.services}
        easements={studio.easements}
        bydaAssets={studio.bydaAssets}
        keylessOverlays={studio.keylessOverlays}
        levels={studio.levels}
        irrigationZones={studio.irrigationZones}
        constructionTrenches={studio.constructionTrenches}
        items={studio.items}
        servicesLocked={ui.servicesLocked}
        sunMin={ui.sunMin}
        sunDatePreset={ui.sunDatePreset}
        growth={ui.growth}
        shadeOn={ui.shadeOn}
        lat={projectLat}
        lng={projectLng}
        outdoorM2={outdoor}
        titleSource={titleBlock?.sourceLabel ?? null}
        boundarySource={ui.boundarySource}
        councilLabel={titleBlock?.councilLabel ?? null}
        councilHref={
          councilDrainageChase(null, titleBlock?.councilLabel ?? null).href
        }
        sitePackChase={ui.sitePackChase}
        weatherDay={weatherDay}
        onOpenPanel={(panel) => {
          summonStickyMeta(
            projectId,
            panel === "environment"
              ? "environment"
              : panel === "trees"
                ? "trees"
                : panel === "site"
                  ? "site"
                  : "services",
          );
          setStickyRestoreNonce((n) => n + 1);
          studio.setUi({
            ...withRightDataPanel(panel),
            ...(panel === "environment" ? { shadeOn: true } : {}),
            utilityPanel: null,
          });
        }}
        onCouncilLink={(href) => {
          if (typeof window !== "undefined") {
            window.open(href, "_blank", "noopener,noreferrer");
          }
        }}
      />
    ) : null;

  return (
    <div
      className={`${css.root}${darkLens || ui.lightingWorkspaceOn ? ` ${css.rootDark}` : ""}${ui.lightingWorkspaceOn ? ` ${css.rootLighting}` : ""}${ui.focusOn ? ` ${css.rootFocus}` : ""}${ui.clientView ? ` ${css.rootClient}` : ""}${precisionOn ? ` ${css.rootPrecision}` : ""}`}
      data-testid="handoff-design-studio"
      data-layout={studioLayout}
      data-theme={darkLens && !ui.frameOn ? "dark" : "light"}
      data-canvas-mode={ui.mode}
      data-studio-surface="handoff-v4"
      data-idle={idle ? "true" : "false"}
      data-compact={chrome.compact ? "1" : "0"}
      data-compliance={compliance.canvasSignal}
      data-fit-sheet={ui.frameOn ? "1" : "0"}
      data-lighting-workspace={ui.lightingWorkspaceOn ? "1" : "0"}
      data-paper={ui.paper}
      data-right-lane={rightLaneBusy ? "1" : "0"}
      style={
        {
          /* Must match .zoomWorld scale (planZoom), not raw ui.zoom —
             Fit sheet diverges via sheetContentView. Inverse handles depend on it. */
          ["--studio-zoom" as string]: String(planZoom),
          ...(isPhoneLayout
            ? {
              ["--ws-safe-bottom" as string]: `${compactSafeBottom}px`,
            }
            : null),
          ...(rightLaneBusy
            ? {
              ["--ws-safe-right" as string]: `${RIGHT_DATA_LANE_WIDTH_PX}px`,
            }
            : null),
          ...(leftSafeInset != null
            ? {
              ["--ws-safe-left" as string]: `${leftSafeInset}px`,
            }
            : null),
          ...(printSheet
            ? {
              ["--ws-print-left" as string]: `${printSheet.left}px`,
              ["--ws-print-top" as string]: `${printSheet.top}px`,
              ["--ws-print-fit" as string]: String(printSheet.fit),
              ["--ws-paper-w" as string]: `${printSheet.paperW}px`,
              ["--ws-paper-h" as string]: `${printSheet.paperH}px`,
              ["--ws-board-w" as string]: `${printSheet.boardW}px`,
              ["--ws-board-h" as string]: `${printSheet.boardH}px`,
            }
            : null),
        } as CSSProperties
      }
    >
      {printSheet ? (
        <style>
          {`@page { size: ${printSheet.paper === "a4" ? "A4 portrait" : "A3 landscape"
            }; margin: 0; }`}
        </style>
      ) : null}
      {/* Gallery-frame portal mount — sibling of the board, spans the whole
        shell so frame-band chrome sits in the dark border, never on the plan. */}
      <div
        data-testid="studio-frame-root"
        data-studio-frame-root="1"
        className={css.studioFrameRoot}
      />
      <Tier1TopBar
        compact={chrome.compact}
        clientView={ui.clientView}
        aria-label="Canvas header"
        left={
          <>
            <div className={css.brandBlock}>
              <p className={css.brandName}>Workstream</p>
              <p className={css.address}>{displayAddress}</p>
            </div>

            {/*
              * Survey progress pill — compact "2/5" indicator in the frame band.
              * Replaces the right-data-lane-checklist that was forced open on
              * every survey load (7.57% of the drawing). The pill lives in the
              * frame band, not on the canvas, so it does not paint over the plan.
              * Click opens the full checklist in the right data lane on demand.
              *
              * §6 item 9 justification (ribbon budget): this is a new persistent
              * element in the frame band, but it replaces 7.57% of idle chrome
              * coverage — a net reduction of the drawing surface covered. The
              * pill is the entry point for the checklist, which is no longer
              * forced open by default (§6 item 7).
              */}
            {ui.mode === "survey" && !ui.focusOn && !ui.clientView ? (
              <button
                type="button"
                className={`${css.surveyProgress}${surveyProgress.complete ? ` ${css.surveyProgressDone}` : ""}${checklistOpen ? ` ${css.surveyProgressActive}` : ""}`}
                data-testid="survey-progress-pill"
                onClick={() =>
                  studio.setUi({
                    rightDataPanel: checklistOpen ? null : "checklist",
                  })
                }
                aria-label={`Survey checklist: ${surveyProgress.done} of ${surveyProgress.total} complete`}
                title="Survey checklist"
              >
                {surveyProgress.done}/{surveyProgress.total}
              </button>
            ) : null}

            {!ui.focusOn && !ui.clientView ? (
              <div className={css.meta} data-testid="header-cadastral-meta">
                {titleBlock?.metaLine ??
                  `${studio.siteMeta} · ${Number(outdoor).toFixed(0)} m²`}
              </div>
            ) : null}

            {/*
              * Lifecycle phase dropdown — project-level setting, lives with
              * brand/address/meta in the header left zone, not floating over
              * the canvas. Hidden in compact/phone/focus/client views.
              */}
            {!ui.focusOn &&
              !ui.clientView &&
              !chrome.compact ? (
              <HeaderPhaseSelect
                phase={ui.lifecyclePhase}
                onPhase={(lifecyclePhase) => studio.setUi({ lifecyclePhase })}
              />
            ) : null}

            {ui.frameOn && !ui.clientView ? (
              <div className={css.segment} data-testid="paper-size-control">
                {(["a3", "a4"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={`${css.segmentBtn}${ui.paper === p ? ` ${css.segmentBtnActive}` : ""}`}
                    onClick={() => studio.setPaper(p)}
                  >
                    {p.toUpperCase()}
                  </button>
                ))}
                <button
                  type="button"
                  className={`${css.segmentBtn}${ui.sheetElevOn ? ` ${css.segmentBtnActive}` : ""}`}
                  data-testid="sheet-elevations-toggle"
                  onClick={() => studio.setUi({ sheetElevOn: !ui.sheetElevOn })}
                  title="Elevations"
                  aria-label="Elevations"
                >
                  Elev
                </button>
              </div>
            ) : null}
          </>
        }
        center={
          <nav
            className={css.modes}
            aria-label="Design workflow"
            data-testid={chrome.compact ? undefined : "canvas-mode-strip"}
          >
            {chrome.compact ? (
              <CompactModeNav
                modes={MODE_TABS}
                current={ui.mode}
                lockReasonForMode={lockReasonForMode}
                onRequestMode={requestMode}
              />
            ) : (
              MODE_TABS.map((m) => {
                const lockReason = lockReasonForMode(m);
                const locked = Boolean(lockReason);
                return (
                  <button
                    key={m}
                    type="button"
                    className={`${css.modeBtn}${ui.mode === m ? ` ${css.modeBtnActive}` : ""}${locked ? ` ${css.modeBtnLocked}` : ""}`}
                    data-testid={`canvas-mode-${m}`}
                    disabled={locked}
                    aria-disabled={locked}
                    aria-current={ui.mode === m ? "page" : undefined}
                    title={lockReason ?? `${m[0]!.toUpperCase() + m.slice(1)} mode`}
                    onClick={() => {
                      if (!locked) requestMode(m);
                    }}
                  >
                    {locked ? <span className={css.modeLockIcon} aria-hidden /> : null}
                    {m[0]!.toUpperCase() + m.slice(1)}
                  </button>
                );
              })
            )}
          </nav>
        }
        right={
          <div className={css.headerTools} role="toolbar" aria-label="Canvas tools">
            {showHeaderAiPill ? (
              <HeaderAiPill
                label={draftLabel}
                hot={
                  ai.pendingCount > 0 ||
                  ai.status === "scanning" ||
                  ai.status === "assisting"
                }
                ok={ai.status === "verified" && ai.pendingCount === 0}
                onClick={handleHeaderAi}
              />
            ) : null}
            {!ui.focusOn ? (
              <div className={css.viewMenuWrap}>
                <HeaderViewMenu
                  open={headerViewMenuOpen}
                  onOpenChange={setHeaderViewMenuOpen}
                  items={headerViewMenuItems}
                  hot={headerViewMenuHot}
                />
              </div>
            ) : null}
            {/*
              * Live cost chip — compact total in the header right zone.
              * Opens the cost rail. Shown once Quote is unlocked (has CAD),
              * including $0 so empty boards still have a clear entry.
              */}
            {!ui.focusOn &&
              !quoteRailOpen &&
              !ui.clientView &&
              openModes.has("quote") ? (
              <button
                type="button"
                className={css.costChip}
                data-testid="header-cost-chip"
                onClick={() =>
                  studio.setUi({ rightDataPanel: "quote", utilityPanel: null })
                }
                title="Open live cost rail"
              >
                {hasCostedLines
                  ? audChip(estimate.totalInclGst)
                  : "Quote"}
              </button>
            ) : null}
            {!ui.clientView ? (
              <UnifiedSaveStatus
                status={ui.mode === "present" ? deckSaveStatus : ui.saveStatus}
                savedTick={ui.mode === "present" ? deckSavedTick : ui.savedTick}
                revision={ui.mode === "present" ? deckRevision : ui.saveRevision}
                errorKind={ui.mode === "present" ? null : ui.saveErrorKind}
                onSave={() => {
                  void studio.saveNow().catch(() => {
                    toast.show(
                      "Canvas save failed. Try again before leaving.",
                      "error",
                    );
                  });
                }}
                onRetry={() => {
                  if (ui.saveErrorKind === "stale_client") {
                    window.location.reload();
                    return;
                  }
                  void studio.saveNow().catch(() => {
                    toast.show(
                      "Canvas save failed. Try again before leaving.",
                      "error",
                    );
                  });
                }}
              />
            ) : null}
            {!ui.clientView ? (
              <div className={css.shareWrap}>
                <button
                  type="button"
                  className={`${css.iconBtn}${sharePopupOpen || ui.mode === "share" ? ` ${css.iconBtnActive}` : ""}`}
                  data-testid="share-top"
                  aria-label="Share"
                  aria-expanded={sharePopupOpen}
                  title={
                    lockReasonForMode("share") ??
                    (hasCostedBom
                      ? "Share with client"
                      : "Cost something before sharing")
                  }
                  disabled={!hasCostedBom}
                  onClick={() => {
                    if (!hasCostedBom) return;
                    setSharePopupOpen((v) => !v);
                  }}
                >
                  <svg className={css.iconBtnSvg} viewBox="0 0 16 16" fill="none" aria-hidden>
                    <circle cx="12" cy="4" r="1.6" stroke="currentColor" strokeWidth="1.2" />
                    <circle cx="4" cy="8" r="1.6" stroke="currentColor" strokeWidth="1.2" />
                    <circle cx="12" cy="12" r="1.6" stroke="currentColor" strokeWidth="1.2" />
                    <path
                      d="M5.4 7.3 10.5 4.8M5.4 8.7l5.1 2.5"
                      stroke="currentColor"
                      strokeWidth="1.2"
                    />
                  </svg>
                </button>
                <ShareRevisionPopup
                  open={sharePopupOpen}
                  onClose={() => setSharePopupOpen(false)}
                  projectId={projectId}
                  address={displayAddress}
                  quoteLines={quoteShareLines}
                  totalInclGst={quoteShareTotalInclGst}
                  disclaimers={boardDisclaimers}
                  onRevisionChange={setLatestShare}
                />
              </div>
            ) : null}
          </div>
        }
      />
      <CanvasContextCard active={headerContextActive}>
        <StudioContextBreadcrumb
          mode={ui.mode}
          isolatedLayer={ui.isolatedLayer}
          layerOpacity={ui.layerOpacity}
          setbackOn={ui.setbackOn}
          shadeOn={ui.shadeOn}
          growth={ui.growth}
          onClearIsolation={() => studio.clearServiceFocus()}
          onClearSetback={() => studio.setUi({ setbackOn: false })}
          onClearShade={() => studio.setUi({ shadeOn: false, sunPlay: false })}
          onResetGrowth={() => studio.setUi({ growth: "mature" })}
          onResetLayer={(layer) => {
            if (layer === "services" && ui.servicesLocked) return;
            studio.setLayerOpacity(layer, 1);
          }}
        />
        {councilTipVisible ? (
          <p className={css.headerCouncilTip} data-testid="council-setback-tip">
            {ui.councilTip}
          </p>
        ) : null}
      </CanvasContextCard>

      <div
        className={`${css.board}${compliance.canvasSignal === "critical" ? ` ${css.boardCritical}` : ""}${compliance.canvasSignal === "watch" ? ` ${css.boardWatch}` : ""}${isTiltActive(ui.tiltDeg) || tiltAnimKind ? ` ${css.boardTiltPerspective}` : ""}`}
        data-testid="studio-board"
        data-panning={isPanningActive ? "1" : "0"}
        data-tilt={isTiltActive(ui.tiltDeg) ? "1" : "0"}
        data-client={ui.clientView ? "1" : "0"}
        data-focus-veil={selectionOrbitOn ? "1" : "0"}
        ref={boardRef}
        style={{ cursor: effectiveCursor }}
      >
        {vicGovChipRow ? (
          <FrameDrawer
            edge="right"
            testId="frame-drawer-site-meta"
            label="Site metadata and environment"
            size={320}
            zIndex={30}
          >
            {vicGovChipRow}
          </FrameDrawer>
        ) : null}
        {/*
         * Teaching cue for the AI capabilities that have no other surface.
         * Renders nothing unless one is both applicable and unacknowledged —
         * policy and reasoning live in features/aiCue/aiCuePolicy.ts.
         * Placed at chrome level, outside the camera transform, so it does not
         * pan with the drawing.
         */}
        <AiCapabilityCue
          projectId={projectId}
          laneBusy={rightLaneBusy}
          context={{
            mode: ui.mode,
            hasAerial: Boolean(liveAerial),
            boundaryPoints: studio.boundary.length,
            // Committed placements only — a pending ghost is not yet the
            // operator's work, and counting it would silence the cue for the
            // exact state the cue exists to serve.
            itemCount: studio.items.filter((i) => !i.ghost).length,
            treeCount: studio.items.filter(
              (i) => !i.ghost && (i.t === "canopy" || i.t === "exist"),
            ).length,
            ghostCount: ai.pendingCount,
            // Passed as the union, not coerced — see aiCuePolicy.ts.
            aiStatus: ai.busy,
            clientView: ui.clientView,
            focusOn: ui.focusOn,
            frameOn: ui.frameOn,
          }}
          onRun={() => void ai.scan()}
        />
        {openSharedRev &&
          !ui.clientView &&
          !ui.frameOn &&
          !shareBannerDismissed ? (
          <CameraChrome
            place={{ kind: "dock" }}
            zIndex={42}
            testId="share-open-banner-chrome"
          >
            <div className={css.shareToast} data-testid="share-open-banner">
              <p>
                Shared rev {openSharedRev.revision} is out with the client —
                changes create a new revision.
              </p>
              <button
                type="button"
                className={css.shareToastDismiss}
                aria-label="Dismiss share notice"
                onClick={() => setShareBannerDismissed(true)}
              >
                ×
              </button>
            </div>
          </CameraChrome>
        ) : null}
        {ui.mode === "elevation" ? (
          <ElevationBoard
            look={ui.elevLook}
            boundary={studio.boundary}
            building={studio.building}
            items={studio.items}
            selectedId={ui.selectedId}
            scaleM={scaleM}
            dark={darkLens}
            onSelect={(id) => studio.setUi({ selectedId: id })}
            onCycleLook={() =>
              studio.setUi({ elevLook: cycleElevationLook(ui.elevLook) })
            }
            onTraceInPlan={(id) => {
              studio.setUi({ selectedId: id });
              requestMode("cad");
            }}
          />
        ) : null}

        {/*
          * Quote mode is now a lane panel (LiveCostRail), not a screen takeover.
          * The old backdrop + QuoteSurface overlay is removed — the drawing
          * stays visible alongside the cost rail. If someone navigates to
          * ?mode=quote, redirect to CAD and open the rail.
          */}

        {ui.mode === "share" ? (
          <ShareSurface
            projectId={projectId}
            draftUnverified={ai.status === "unverified"}
            pendingGhosts={ai.pendingCount}
            quotePersisted={quotePersisted}
            portalUri={portalUri}
            onQuotePersisted={(uri) => {
              setQuotePersisted(true);
              setPortalUri(uri);
            }}
            onReviewGhosts={() => {
              requestMode("cad");
              ai.openReview();
            }}
            onBack={() => requestMode("cad")}
            onOpenSharePopup={() => {
              setSharePopupOpen(true);
              requestMode("cad");
            }}
          />
        ) : null}

        {ui.mode === "present" ? (
          <PresentSurface
            projectId={projectId}
            imageLayers={studio.imageLayers}
            planSnapshot={{
              boundary: studio.boundary.map((p) => ({ x: p.x, y: p.y })),
              building: studio.building.map((p) => ({ x: p.x, y: p.y })),
              items: studio.items.map((i) => ({
                id: i.id,
                t: i.t,
                x: i.x,
                y: i.y,
                outlinePct: i.outlinePct?.map((p) => ({ x: p.x, y: p.y })),
              })),
              strokes: studio.strokes.map((s) => ({
                id: s.id,
                points: s.points.map((p) => ({ x: p.x, y: p.y })),
                widthPx: s.widthPx,
                color: s.color,
              })),
              revision: ui.savedTick ?? 0,
            }}
            estimate={{
              totalInclGst: estimate.totalInclGst,
              materialsExGst: estimate.materialsExGst,
              gst: estimate.gst,
              lines: estimate.lines.map((l) => ({
                id: l.id,
                label: l.label,
                unit: l.unit,
                qty: l.qty,
                total: l.total,
              })),
              hardscapeM2: estimate.hardscapeM2,
              excavateM3: estimate.excavateM3,
            }}
            materials={presentMaterials}
            onBack={() => requestMode("cad")}
            onSaveStatusChange={(status, savedTick, revision) => {
              setDeckSaveStatus(status);
              if (savedTick !== undefined) setDeckSavedTick(savedTick);
              if (revision !== undefined) setDeckRevision(revision);
            }}
          />
        ) : null}

        {planOn ? (
          <>
            {!tiltLensOn && (!ui.frameOn || sheetPlotLayout) ? (
              <div
                className={css.parchmentBleed}
                data-testid="parchment-bleed"
                aria-hidden
                /* Fit sheet: pin the ground to the plot rect so it fills the
                   sheet permanently — only the plan vectors (in .zoomWorld)
                   scale on top. */
                style={
                  ui.frameOn && sheetPlotLayout
                    ? { clipPath: sheetPlotLayout.clipPath }
                    : undefined
                }
              >
                <TactileGround
                  zoom={planZoom}
                  sheetScaleDenom={100}
                  parchmentPeel={
                    ui.frameOn || draftingPlate || ui.foundationCleanse
                      ? 1
                      : ui.parchmentPeel
                  }
                  hasAerial={Boolean(liveAerial)}
                  darkOn={darkLens}
                  foundationCleanse={ui.foundationCleanse}
                  titleLocked={titleLocked}
                  boundarySource={ui.boundarySource}
                  siteLabel={displayAddress}
                  address={displayAddress}
                  suppressSiteCue
                  quietChrome
                />
              </div>
            ) : null}
            <div
              className={
                sheetPlotLayout
                  ? `${css.sheetPlotClip}`
                  : undefined
              }
              style={
                sheetPlotLayout
                  ? { clipPath: sheetPlotLayout.clipPath }
                  : undefined
              }
            >
              <div
                className={`${css.zoomWorld}${isTiltActive(ui.tiltDeg) || tiltAnimKind ? ` ${css.zoomWorldTilted}` : ""}${tiltAnimKind === "fast" ? ` ${css.zoomWorldTiltAnim}` : ""}${tiltAnimKind === "slow" ? ` ${css.zoomWorldTiltAnimSlow}` : ""}`}
                data-testid="zoom-world"
                data-print-keep="plan"
                data-tilt-deg={ui.tiltDeg.toFixed(1)}
                data-view-yaw={String(planRotateDeg)}
                onTransitionEnd={(e) => {
                  if (e.propertyName !== "transform") return;
                  clearTiltAnimKind();
                }}
                onTransitionCancel={(e) => {
                  if (e.propertyName !== "transform") return;
                  clearTiltAnimKind();
                }}
                style={{
                  transformOrigin: `${planFocusX}% ${planFocusY}%`,
                  /*
                   * Camera: optional view-only tilt → pan → rotate → scale.
                   * Keep rotateX(0) in the string while the temp transition class
                   * is on so flatten animates (then strip for pixel-identical off).
                   * Tilt is never inverted in clientToBoardPct — editing locks out.
                   */
                  transform: `${isTiltActive(ui.tiltDeg) || tiltAnimKind
                    ? `rotateX(${ui.tiltDeg}deg) `
                    : ""
                    }translate(${planPanX}px, ${planPanY}px) rotate(${planRotateDeg}deg) scale(${planZoom})`,
                  cursor: effectiveCursor,
                }}
              >
                {tiltLensOn ? (
                  <div
                    className={css.tiltSkin}
                    data-testid="tilt-skin"
                    aria-hidden
                    style={
                      {
                        ["--tilt-skin-scale"]: String(skinScale),
                      } as CSSProperties
                    }
                  >
                    <TactileGround
                      zoom={planZoom}
                      sheetScaleDenom={100}
                      parchmentPeel={
                        draftingPlate || ui.foundationCleanse ? 1 : ui.parchmentPeel
                      }
                      hasAerial={Boolean(liveAerial)}
                      darkOn={darkLens}
                      foundationCleanse={ui.foundationCleanse}
                      titleLocked={titleLocked}
                      boundarySource={ui.boundarySource}
                      siteLabel={displayAddress}
                      address={displayAddress}
                      suppressSiteCue
                      quietChrome
                    />
                  </div>
                ) : null}
                <AerialSlot
                  uri={liveAerial}
                  dimmed={darkLens}
                  frameOn={ui.frameOn}
                  scanning={
                    aerialOk &&
                    (ui.canopyScanning || ai.busy === "scanning")
                  }
                  zoom={planZoom}
                  sheetScaleDenom={100}
                  darkOn={darkLens}
                  foundationCleanse={ui.foundationCleanse}
                  allowAerial={aerialOk}
                  allowPlanUnderlay={draftingPlate && !ui.foundationCleanse}
                  autoCanopyScan={false}
                  canopyScanRequest={ui.canopyScanRequest}
                  titleLocked={titleLocked}
                  boundarySource={ui.boundarySource}
                  siteLabel={displayAddress}
                  address={displayAddress}
                  suppressSiteCue={titleCueOnCad}
                  parchmentPeel={
                    draftingPlate || ui.foundationCleanse ? 1 : ui.parchmentPeel
                  }
                  hidePaper={worldHidePaper}
                  hasGeometry={hasGeometry}
                  canvasEngaged={canvasEngaged}
                  onUri={(uri) => {
                    // Survey aerial OR CAD/Sketch plan underlay (SVG/PNG)
                    if (!aerialOk && !draftingPlate) return;
                    studio.setUi({
                      aerialUri: uri,
                      aerialSuppressed: uri == null,
                    });
                  }}
                  onScanning={(canopyScanning) => studio.setUi({ canopyScanning })}
                  onCanopyImage={ai.ingestCanopyImage}
                />
                <ImageLayerSlot layers={studio.imageLayers} />
                <ShadeGridOverlay
                  active={ui.shadeOn && !ui.frameOn && !ui.focusOn}
                  sunMin={ui.sunMin}
                  datePreset={ui.sunDatePreset}
                  lat={projectLat ?? undefined}
                  lng={projectLng ?? undefined}
                />
                <ClimateBedWash
                  active={
                    (environmentOpen || ui.shadeOn) &&
                    !ui.frameOn &&
                    !ui.focusOn
                  }
                  boundary={studio.boundary}
                  meta={envLiveMeta}
                />
                <KeylessOverlayWash
                  active={!ui.frameOn && !ui.focusOn}
                  overlays={studio.keylessOverlays}
                  boundary={studio.boundary}
                />
                <BuildableAreaOverlay
                  active={buildableAreaVisible}
                  pinned={ui.buildableAreaOn}
                  boundary={studio.boundary}
                  building={studio.building}
                  easements={studio.easements ?? []}
                  bydaAssets={studio.bydaAssets ?? []}
                  keylessOverlays={studio.keylessOverlays ?? []}
                  items={studio.items}
                  setbackM={compliance.setbackM}
                  boardWidthM={scaleM}
                  cursorPct={boardCursorPct ?? ui.drawCursor}
                  showValidation={
                    highStakesBuildable || ui.buildableAreaOn
                  }
                  onPinChange={(pinned) =>
                    studio.setUi({ buildableAreaOn: pinned })
                  }
                />
                <SunCastOverlay
                  active={
                    (ui.shadeOn || environmentOpen) &&
                    !ui.frameOn &&
                    !ui.focusOn
                  }
                  sunMin={ui.sunMin}
                  datePreset={ui.sunDatePreset}
                  growth={ui.growth}
                  boundary={studio.boundary}
                  building={studio.building}
                  items={studio.items}
                  scaleM={scaleM}
                  lat={projectLat}
                  lng={projectLng}
                />
                <SunMarkerPip
                  active={environmentOpen && !ui.frameOn}
                  boundary={studio.boundary}
                  sunMin={ui.sunMin}
                  datePreset={ui.sunDatePreset}
                  lat={projectLat}
                  lng={projectLng}
                />
                <CadPlanBoard
                  frameOn={ui.frameOn}
                  darkOn={darkLens}
                  foundationCleanse={ui.foundationCleanse}
                  titleLocked={titleLocked}
                  titleBoundaryLocked={ui.titleBoundaryLocked}
                  buildingSource={ui.buildingSource}
                  scaleM={scaleM}
                  timedSunCast={ui.shadeOn || environmentOpen}
                  sunAzimuthDeg={sunAzimuthDeg}
                  bydaAssets={studio.bydaAssets}
                  machineAccessOverrideMm={studio.machineAccessOverrideMm}
                  machineAccessSource={studio.machineAccessSource}
                  planZoom={planZoom}
                  sunCast={boardSunCast}
                  tiltDeg={ui.tiltDeg}
                  planPanX={planPanX}
                  planPanY={planPanY}
                  planFocusX={planFocusX}
                  planFocusY={planFocusY}
                  planRotateDeg={planRotateDeg}
                  lotAreaM2={titleBlock?.lotAreaM2 ?? null}
                  siteAreas={
                    siteAreaDisplay
                      ? {
                        buildingAreaM2: siteAreaDisplay.buildingAreaM2,
                        outdoorAreaM2: siteAreaDisplay.outdoorAreaM2,
                        lotAreaM2: siteAreaDisplay.lotAreaM2,
                      }
                      : null
                  }
                  siteLabel={displayAddress}
                  titleMeta={
                    titleBlock
                      ? {
                        parcelRef: titleBlock.parcelRef,
                        sourceLabel: titleBlock.sourceLabel,
                        councilLabel: titleBlock.councilLabel,
                        sourceKind: titleBlock.sourceKind,
                      }
                      : null
                  }
                  boundary={studio.boundary}
                  building={studio.building}
                  easements={studio.easements}
                  services={studio.services}
                  items={studio.items}
                  mode={ui.mode}
                  tool={ui.foundationCleanse && !ui.titleBoundaryLocked ? "select" : ui.tool}
                  locked={ui.foundationCleanse ? false : ui.locked}
                  layerOpacity={ui.layerOpacity}
                  isolatedLayer={ui.isolatedLayer}
                  serviceFeatureHidden={ui.serviceFeatureHidden}
                  focusedServiceIds={ui.focusedServiceIds}
                  setbackOn={ui.setbackOn}
                  councilSetbackM={compliance.setbackM}
                  growth={ui.growth}
                  selectedId={ui.selectedId}
                  groupIds={ui.groupIds}
                  hoverId={ui.hoverId}
                  curGhostId={ai.current?.id ?? null}
                  reviewOpen={ui.ghostReviewOpen}
                  flaggedIds={flaggedIds}
                  tpzReadouts={tpzReadouts}
                  onSelect={(id, opts) => {
                    // Selecting geometry / symbols is not a toolbox summon.
                    setInstrumentsSummoned(false);
                    collapseLibraryUnlessPinned();
                    if (!id) {
                      studio.setSelection(null, []);
                      return;
                    }
                    if (ai.pending.some((g) => g.id === id)) {
                      const idx = ai.pending.findIndex((g) => g.id === id);
                      studio.setUi({
                        selectedId: id,
                        groupIds: [],
                        ghostIdx: idx >= 0 ? idx : ui.ghostIdx,
                        ghostReviewOpen: true,
                        rightDataPanel: null,
                      });
                      return;
                    }
                    if (opts?.additive) {
                      const next = ui.groupIds.includes(id)
                        ? ui.groupIds.filter((g) => g !== id)
                        : [...ui.groupIds, id];
                      studio.setSelection(id, next.length ? next : [id]);
                      return;
                    }
                    studio.setSelection(id, [id]);
                  }}
                  onMarqueeSelect={(ids, opts) => {
                    setInstrumentsSummoned(false);
                    if (opts?.additive && ids.length > 0) {
                      const merged = new Set([...ui.groupIds, ...ids]);
                      if (ui.selectedId) merged.add(ui.selectedId);
                      const list = [...merged];
                      studio.setSelection(ids[0] ?? ui.selectedId, list);
                      return;
                    }
                    studio.setSelection(ids[0] ?? null, ids);
                  }}
                  onEmptyClick={({ x, y, insideLot }) => {
                    collapseLibraryUnlessPinned();
                    if (insideLot) {
                      // On the drawing — clear selection only; keep toolbox closed.
                      setInstrumentsSummoned(false);
                      return;
                    }
                    // Off the lot, on the canvas margin — pin + summon instruments.
                    pinInstrumentAnchor(x, y);
                    setInstrumentsSummoned(true);
                  }}
                  onCadHandleInteract={() => {
                    setInstrumentsSummoned(false);
                    collapseLibraryUnlessPinned();
                  }}
                  onHover={(id) => studio.setUi({ hoverId: id })}
                  onAcceptGhost={ai.accept}
                  onRejectGhost={ai.reject}
                  onTraceInElevation={(id) => {
                    studio.setSelection(id, [id]);
                    requestMode("elevation");
                  }}
                  onBoundaryChange={studio.updateBoundary}
                  onBuildingChange={studio.updateBuilding}
                  onPlace={(x, y) => {
                    if (ui.tool === "path") {
                      studio.pushTracePoint({ x, y });
                      return;
                    }
                    studio.placeArmed(x, y);
                  }}
                  onMoveItem={studio.moveItem}
                  onMoveGroup={studio.moveGroup}
                  onTransformItem={studio.transformItem}
                  gridGrain={ui.gridGrain}
                  gridSnap={ui.gridSnap}
                  gridFormation={gridPreviewFormation ?? ui.gridFormation}
                  gridInk={gridPreviewInk ?? ui.gridInk}
                  onPaintItem={(id) => {
                    studio.paintItem(id);
                    flashPaintTarget(id);
                  }}
                  paintFlashId={paintFlashId}
                  previewSwatch={previewSwatch}
                  eyedropArmed={eyedropArmed}
                  onEyedrop={pickStyle}
                  onBoardCursor={setBoardCursor}
                  onBoardCursorPct={setBoardCursorPct}
                  onPanDrag={startBoardPan}
                  onInertToolClick={onInertToolClick}
                  fidelity={fidelity}
                  onInteract={() => {
                    markInteracting();
                    collapseLibraryUnlessPinned();
                  }}
                  onLongPressCanvas={
                    compactAssetUi && assetChromeOn
                      ? () => openAssetSheet()
                      : undefined
                  }
                  onVectorEditHint={setVectorEditHint}
                  onTraceBuilding={armBuildingTrace}
                  annotations={studio.annotations}
                  selectedAnnotationId={selectedAnnotationId}
                  onSelectAnnotation={(id) => {
                    setSelectedAnnotationId(id);
                    if (id) studio.setSelection(null, []);
                  }}
                  onMoveAnnotation={(id, notePos) => {
                    studio.updateAnnotationNotePos(
                      id,
                      clampNotePos(notePos, studio.boundary),
                    );
                  }}
                  annotatePlace={annotatePhase === "place"}
                  onAnnotatePlace={({ x, y, itemId }) => {
                    const anchor: CanvasAnnotation["anchor"] = itemId
                      ? { kind: "item", itemId }
                      : { kind: "point", x, y };
                    const notePos = defaultNotePos(x, y, studio.boundary);
                    setPendingAnnotation({ anchor, notePos });
                    setAnnotateDraft("");
                    setAnnotatePhase("type");
                  }}
                  sheetPen={studio.presentationPack.pen ?? "technical"}
                  sheetTheme={studio.presentationPack.theme ?? "parchment"}
                  atmosphere={studio.presentationPack.atmosphere ?? "graphite"}
                  handDrawnSeed={projectId}
                />
                {annotatePhase === "type" && pendingAnnotation ? (
                  <div
                    className={css.annotateInputWrap}
                    data-testid="annotate-input"
                    style={{
                      left: `${pendingAnnotation.notePos.x}%`,
                      top: `${pendingAnnotation.notePos.y}%`,
                    }}
                  >
                    <input
                      autoFocus
                      type="text"
                      maxLength={140}
                      value={annotateDraft}
                      placeholder="NOTE…"
                      aria-label="Annotation text"
                      style={{ fontSize: 16 }}
                      onChange={(e) => setAnnotateDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          e.preventDefault();
                          e.stopPropagation();
                          setAnnotatePhase("off");
                          setPendingAnnotation(null);
                          setAnnotateDraft("");
                          return;
                        }
                        if (e.key === "Enter") {
                          e.preventDefault();
                          e.stopPropagation();
                          const text = annotateDraft.trim();
                          if (!text) return;
                          const ann: CanvasAnnotation = {
                            id: crypto.randomUUID(),
                            text,
                            anchor: pendingAnnotation.anchor,
                            notePos: pendingAnnotation.notePos,
                            createdAt: new Date().toISOString(),
                          };
                          studio.addAnnotation(ann);
                          setSelectedAnnotationId(ann.id);
                          setAnnotatePhase("off");
                          setPendingAnnotation(null);
                          setAnnotateDraft("");
                          void studio.saveNow().catch(() => {
                            /* autosave chip surfaces failure */
                          });
                        }
                      }}
                    />
                  </div>
                ) : null}
                {chrome.floraRing && ui.floraSession ? (
                  <FloraRing
                    xPct={ui.floraSession.x}
                    yPct={ui.floraSession.y}
                    candidates={ui.floraSession.candidates}
                    activeIdx={ui.floraSession.activeIdx}
                    previewSpreadPct={Math.min(
                      28,
                      Math.max(
                        6,
                        (ui.floraSession.candidates[ui.floraSession.activeIdx]
                          ?.canopySpreadM ?? 2) * 2.4,
                      ),
                    )}
                    guardItems={floraGuardItems}
                    scaleM={scaleM}
                    cam={planCam}
                    onActiveIdx={studio.setFloraActiveIdx}
                    onAccept={studio.acceptFlora}
                    onDismiss={studio.dismissFlora}
                  />
                ) : null}
                {chrome.horizon ? (
                  <HorizonMarkers
                    cards={actionHorizon}
                    onFocus={(card) => {
                      if (card.suggestType) {
                        acceptHorizonCard(card);
                        return;
                      }
                      studio.setUi({
                        utilityPanel: "bom",
                      });
                    }}
                  />
                ) : null}
                {ui.mode === "sketch" ? (
                  <SketchBoard
                    strokes={studio.strokes}
                    darkOn={darkLens}
                    hideChrome={ui.frameOn}
                    formalizing={formalizing}
                    active={ui.tool === "sketch"}
                    onActivate={() => studio.setTool("sketch")}
                    onChromeChange={onSketchChromeChange}
                    onCommit={(stroke) => {
                      studio.setStrokes([...studio.strokes, stroke]);
                    }}
                    onErase={(strokeId) =>
                      studio.setStrokes(
                        studio.strokes.filter((stroke) => stroke.id !== strokeId),
                      )
                    }
                    onUndoLast={() => studio.undo()}
                    onRedo={() => studio.redo()}
                    canUndo={studio.canUndo}
                    canRedo={studio.canRedo}
                    onTidy={() => studio.tidySketches()}
                    onFormalizeToCad={() => {
                      void runFormalizeToCad();
                    }}
                    onOpenImageLayers={() =>
                      studio.setUi({
                        rightDataPanel: "image_layers",
                        ghostReviewOpen: false,
                      })
                    }
                  />
                ) : null}
                {ui.mode === "cad" && studio.strokes.length > 0 ? (
                  <FreehandLayer strokes={studio.strokes} />
                ) : null}
                {planOn && !ui.frameOn ? (
                  <>
                    {studio.pathCorridors.length > 0 || ui.tool === "path" ? (
                      <PathCorridorsLayer
                        corridors={studio.pathCorridors}
                        scaleM={scaleM}
                        draftPts={ui.tool === "path" ? ui.drawPoly : null}
                        draftWidthM={ui.pathWidthM}
                        draftEdge={ui.edgeType}
                        draftFilletM={ui.pathFilletM}
                      />
                    ) : null}
                    {(studio.drainageRuns.length > 0 ||
                      ui.drainageLevelIdx.length > 0 ||
                      ui.tool === "level" ||
                      ui.servicesEdit) &&
                      !ui.clientView ? (
                      <DrainageRunsLayer
                        runs={studio.drainageRuns}
                        levels={studio.levels}
                        selectedIdx={ui.drainageLevelIdx}
                        scaleM={scaleM}
                        onToggleLevel={studio.toggleDrainageLevelIdx}
                        onCommitRun={studio.commitDrainageRun}
                      />
                    ) : studio.drainageRuns.length > 0 ? (
                      <DrainageRunsLayer
                        runs={studio.drainageRuns}
                        levels={[]}
                        selectedIdx={[]}
                        scaleM={scaleM}
                        onToggleLevel={() => { }}
                        onCommitRun={() => { }}
                      />
                    ) : null}
                    <SurveyAnnotationLayer
                      active={surveyServicesAuthoring}
                      tool={ui.tool}
                      levels={studio.levels}
                      services={studio.services}
                      easements={studio.easements}
                      showCorridors={ui.mode === "survey"}
                      scaleM={scaleM}
                      planZoom={planZoom}
                      darkOn={darkLens}
                      layerOpacity={ui.layerOpacity}
                      isolatedLayer={ui.isolatedLayer}
                      serviceFeatureHidden={ui.serviceFeatureHidden}
                      focusedServiceIds={ui.focusedServiceIds}
                      onAddLevel={studio.addSpotLevel}
                      onCommitService={studio.commitService}
                      onCalibrate={(nextScaleM) => {
                        // Prototype: board width metres from two known points.
                        // Also snap sheet denom so the ground mesh stays coherent.
                        const denoms = SHEET_SCALE_STEPS;
                        const target = (nextScaleM / 110) * 100;
                        let best: (typeof denoms)[number] = 100;
                        let bestD = Infinity;
                        for (const d of denoms) {
                          const err = Math.abs(d - target);
                          if (err < bestD) {
                            bestD = err;
                            best = d;
                          }
                        }
                        studio.setUi({
                          boardWidthM: nextScaleM,
                          sheetScaleDenom: best,
                          tool: "select",
                        });
                      }}
                    />
                  </>
                ) : null}
                <TraceOverlay
                  active={ui.tool === "trace" && !ui.frameOn && ui.mode !== "sketch"}
                  locked={ui.locked}
                  target={ui.traceTarget}
                  drawPoly={ui.drawPoly}
                  drawCursor={ui.drawCursor}
                  cam={planCam}
                  onTarget={studio.setTraceTarget}
                  onCursor={(drawCursor) => studio.setUi({ drawCursor })}
                  onPush={studio.pushTracePoint}
                  onFinish={studio.finishTrace}
                  onCancel={studio.cancelTrace}
                  onPop={studio.popTracePoint}
                />
                <MeasureOverlay
                  active={ui.tool === "measure" && !ui.frameOn}
                  scaleM={scaleM}
                  cam={planCam}
                  onCancel={() => {
                    studio.setTool("select");
                    setInstrumentsSummoned(false);
                  }}
                />
                {(ui.mode === "cad" || ui.mode === "sketch") && !ui.frameOn ? (
                  <ZoneOverlay
                    active={ui.tool === "zone"}
                    kind={ui.zoneKind}
                    zones={studio.irrigationZones}
                    cam={planCam}
                    serviceFeatureHidden={ui.serviceFeatureHidden}
                    focusedServiceIds={ui.focusedServiceIds}
                    lightingOverload={
                      ui.lightingWorkspaceOn && lvCircuit.overloaded
                    }
                    overloadedZoneIds={
                      ui.lightingWorkspaceOn ? lvRuns.overloadedZoneIds : []
                    }
                    onCommit={studio.commitZone}
                  />
                ) : null}
                {(ui.mode === "cad" || ui.mode === "sketch") &&
                  !ui.frameOn &&
                  ui.irrigationUniformityOn ? (
                  <IrrigationUniformityWash
                    active
                    report={irrigUniformity}
                  />
                ) : null}
                {(ui.mode === "cad" || ui.mode === "sketch") &&
                  !ui.frameOn &&
                  ui.liveTelemetryOn ? (
                  <LiveTelemetryWash active points={telemetryPoints} />
                ) : null}
                {(ui.mode === "cad" || ui.mode === "sketch") &&
                  !ui.frameOn &&
                  ui.lightingWorkspaceOn ? (
                  <LightingBeams
                    items={studio.items}
                    kelvin={ui.lightingKelvin}
                    active
                  />
                ) : null}
                {(ui.mode === "cad" ||
                  ui.mode === "sketch") &&
                  !ui.frameOn ? (
                  <TrenchOverlay
                    trenches={studio.constructionTrenches.filter((t) => {
                      if (t.ghost) return true;
                      return !ui.serviceFeatureHidden[`trench:${t.id}`];
                    })}
                    cam={planCam}
                    scaleM={scaleM}
                    onAcceptAll={studio.acceptAllTrenchGhosts}
                    onRejectAll={studio.rejectAllTrenchGhosts}
                  />
                ) : null}
                {ui.tool === "zone" &&
                  !ui.focusOn &&
                  !ui.clientView &&
                  !ui.frameOn ? (
                  <NicheToolCarousel
                    testId="zone-kind-bar"
                    label="Zone type"
                    xPct={instrumentAnchor.x}
                    yPct={instrumentAnchor.y}
                    tools={nicheToolsForZone()}
                    activeId={zoneNicheActiveId(ui.zoneKind)}
                    cam={planCam}
                    onSelect={(tool: NicheTool) => {
                      if (tool.id === "zone-drip") {
                        studio.setUi({ zoneKind: "drip" });
                      } else if (tool.id === "zone-lighting") {
                        studio.setUi({
                          zoneKind: "lighting",
                          lightingWorkspaceOn: true,
                        });
                      } else if (tool.id === "zone-conduit") {
                        studio.setUi({
                          zoneKind: "lighting_conduit",
                          lightingWorkspaceOn: true,
                        });
                      } else if (tool.id === "zone-spray") {
                        studio.setUi({ zoneKind: "spray" });
                      } else if (tool.id === "zone-agg") {
                        studio.setUi({ zoneKind: "agg_drain" });
                      }
                    }}
                  />
                ) : null}
                {gridStudioOpen &&
                  !ui.focusOn &&
                  !ui.clientView &&
                  !ui.frameOn &&
                  !ui.foundationCleanse ? (
                  <DraftGridStudio
                    anchorXPct={instrumentAnchor.x}
                    anchorYPct={instrumentAnchor.y}
                    formation={ui.gridFormation}
                    ink={ui.gridInk}
                    grain={ui.gridGrain}
                    snap={ui.gridSnap}
                    cam={planCam}
                    onPreviewFormation={setGridPreviewFormation}
                    onPreviewInk={setGridPreviewInk}
                    onCommit={(patch) => {
                      const next = {
                        gridFormation: patch.formation ?? ui.gridFormation,
                        gridInk: patch.ink ?? ui.gridInk,
                        gridGrain: patch.grain ?? ui.gridGrain,
                        gridSnap: patch.snap ?? ui.gridSnap,
                      };
                      studio.setUi(next);
                      saveGridStudioPrefs(projectId, {
                        formation: next.gridFormation,
                        ink: next.gridInk,
                        grain: next.gridGrain,
                        snap: next.gridSnap,
                      });
                    }}
                  />
                ) : null}
                {/* Selection focus veil — one scrim; persists across item hops. */}
                {selectionOrbitOn && selectedLive ? (
                  <SelectionFocusVeil
                    focusPct={{ x: selectedLive.x, y: selectedLive.y }}
                    cam={planCam}
                    night={darkLens}
                    onDismiss={() => studio.setSelection(null, [])}
                  />
                ) : null}
                {/* Selection dial — steering-wheel arc (single item, plan modes). */}
                {selectionOrbitOn && selectedLive ? (
                  <SelectionDial
                    item={selectedLive}
                    items={studio.items}
                    cam={planCam}
                    night={darkLens}
                    onTransform={studio.transformItem}
                    onChangeType={studio.changeSelectedType}
                    onDuplicate={studio.duplicateSelected}
                    onAnnotate={() => {
                      setAnnotatePhase("place");
                      setPendingAnnotation(null);
                      setAnnotateDraft("");
                    }}
                    onDelete={() => {
                      const id = selectedLive.id;
                      studio.deleteSelected();
                      toast.show("Deleted", "info", 5000, {
                        action: {
                          label: "Undo",
                          onClick: () => studio.undo(),
                        },
                      });
                      void id;
                    }}
                    onDismiss={() => studio.setSelection(null, [])}
                  />
                ) : null}
                {/* Multi-select / sketch keep the orbit ring; single CAD uses dial.
                Fit is paper-only — chrome.selectionRing is false; do not bypass. */}
                {!ui.clientView &&
                  !ui.frameOn &&
                  selectedLive &&
                  ui.tool !== "zone" &&
                  !selectionOrbitOn &&
                  (chrome.selectionRing ||
                    ui.mode === "cad" ||
                    ui.mode === "sketch" ||
                    ui.mode === "survey") ? (
                  <SelectionRing
                    item={selectedLive}
                    xPct={selectedLive.x}
                    yPct={selectedLive.y}
                    locked={ui.locked}
                    cam={planCam}
                    onDelete={studio.deleteSelected}
                    onClose={() => studio.setSelection(null, [])}
                    onLock={() => studio.setTool(ui.locked ? "select" : "lock")}
                    onAskAi={() =>
                      studio.setUi({
                        cmdOpen: true,
                        cmdQuery: `about ${BY_TYPE[selectedLive.t]?.tag ?? selectedLive.t}`,
                      })
                    }
                  />
                ) : null}
              </div>
            </div>
            {/* Dedicated portal mount — sibling of the camera, never an ancestor
              of chrome call-sites. Portaling into an ancestor collapses wrappers.
              NOT aria-hidden: CameraChrome portals interactive chrome (tool
              dock, checklist, measures, hint pills) into this node — hiding it
              removed every docked control from the accessibility tree. */}
            <div
              data-testid="camera-chrome-root"
              data-camera-chrome-root="1"
              className={css.cameraChromeRoot}
            />
          </>
        ) : null}

        {planOn && !ui.frameOn ? (
          <GroundRulerOverlay
            zoom={planZoom}
            focusX={planFocusX}
            focusY={planFocusY}
            panXPct={boardSize.w > 0 ? (ui.panX / boardSize.w) * 100 : 0}
            panYPct={boardSize.h > 0 ? (ui.panY / boardSize.h) * 100 : 0}
            scaleM={scaleM}
            darkOn={darkLens}
          />
        ) : null}

        {/*
          * Collapsed-state marker for the right data lane. When no panel is
          * open, this hidden span gives the STUDIO-STYLING-AND-UX §6 item-7
          * probe a stable testid to assert against. The open panels carry
          * their own testids (right-data-lane-checklist, -measures, -layers,
          * …), so the probe distinguishes "collapsed" from "open"
          * structurally — by which testid exists — rather than inferring it
          * from geometry, which is the trap that kept item 7 unprobed.
          *
          * `hidden` = not rendered visually, which is exactly what collapsed
          * means. Zero paint, zero pointer-events, zero coverage impact.
          */}
        {planOn && !ui.frameOn && ui.rightDataPanel == null ? (
          <span data-testid="right-data-lane-collapsed" hidden aria-hidden />
        ) : null}

        {planOn &&
          !ui.frameOn &&
          ui.mode === "survey" &&
          !ui.focusOn &&
          !ui.clientView &&
          checklistOpen ? (
          <RightDataLane
            testId="right-data-lane-checklist"
            onClose={() => studio.setUi({ rightDataPanel: null })}
          >
            <SurveyChecklist
              boundary={studio.boundary}
              building={studio.building}
              items={studio.items}
              levels={studio.levels}
              services={studio.services}
              easements={studio.easements}
              onClose={() => studio.setUi({ rightDataPanel: null })}
              onTraceBuilding={armBuildingTrace}
            />
          </RightDataLane>
        ) : null}

        {ui.frameOn && planOn ? (
          <FitSheetOverlay
            boardW={boardSize.w}
            boardH={boardSize.h}
            paper={ui.paper}
            address={displayAddress}
            boundary={studio.boundary}
            building={studio.building}
            items={studio.items}
            easements={studio.easements}
            services={studio.services}
            scaleM={scaleM}
            showElevations={ui.sheetElevOn}
            elevLook={ui.elevLook}
            scaleDenom={ui.sheetScaleDenom}
            onScaleDenom={(sheetScaleDenom) => studio.setUi({ sheetScaleDenom })}
            titleBlock={titleBlock}
            weatherDay={weatherDay}
            presentationPack={studio.presentationPack}
            quoteTotalInclGst={estimate.totalInclGst}
            tier1={isTier1WrightsTerrace(projectAddress)}
            irrigationZones={studio.irrigationZones}
            constructionTrenches={studio.constructionTrenches}
            bydaAssets={studio.bydaAssets}
            shareStamp={
              latestShare
                ? latestShare.status === "accepted"
                  ? `Rev ${latestShare.revision} · Accepted`
                  : latestShare.status === "declined"
                    ? `Rev ${latestShare.revision} · Declined`
                    : latestShare.status === "shared"
                      ? `Rev ${latestShare.revision} · Shared ${new Date(
                        latestShare.created_at,
                      ).toLocaleDateString("en-AU", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}`
                      : `Rev ${latestShare.revision} · Superseded`
                : null
            }
          />
        ) : null}

        {ui.frameOn && planOn && !ui.clientView && sheetComposeOpen ? (
          <CameraChrome
            place={{ kind: "dock" }}
            zIndex={54}
            testId="sheet-compose-chrome"
          >
            <SheetComposeDock
              open={sheetComposeOpen}
              onClose={() => setSheetComposeOpen(false)}
              pack={studio.presentationPack}
              onApplyTemplate={studio.applyPresentationTemplate}
              onTheme={studio.setPresentationTheme}
              onPen={studio.setPresentationPen}
              onAtmosphere={studio.setPresentationAtmosphere}
              onAddWidget={studio.addPresentationWidget}
              onRemoveWidget={studio.removePresentationWidget}
              onReflow={studio.reflowPresentationPack}
              onClear={studio.clearPresentationWidgets}
            />
          </CameraChrome>
        ) : null}

        {ui.mode === "cad" &&
          !ui.frameOn &&
          !ui.clientView &&
          !ui.focusOn &&
          isViewRotatedFromNorth(ui.viewRotationDeg) ? (
          <CameraChrome
            place={{ kind: "dock" }}
            zIndex={42}
            testId="view-north-chrome"
          >
            <ViewNorthControl
              rotationDeg={ui.viewRotationDeg}
              stepDeg={ui.viewRotationStepDeg}
              onRotation={(viewRotationDeg) =>
                studio.setUi({ viewRotationDeg })
              }
              onStep={(viewRotationStepDeg: ViewRotationStepDeg) =>
                studio.setUi({ viewRotationStepDeg })
              }
            />
          </CameraChrome>
        ) : null}

        {(planOn || ui.mode === "elevation") &&
          !ui.focusOn &&
          !ui.clientView &&
          !ui.frameOn &&
          !ui.lightingWorkspaceOn &&
          !chrome.compact ? (
          <FrameDrawer
            edge="top"
            testId="frame-drawer-artboards"
            label="Artboards and viewpoints"
            size={52}
            zIndex={30}
          >
            <ArtboardStrip active={activeArtboard} onSelect={selectArtboard} />
            {((planOn && isTiltActive(ui.tiltDeg)) ||
              ui.mode === "elevation") ? (
              <GardenViewpointStrip
                mode={ui.mode === "elevation" ? "elevation" : "plan"}
                activeLook={armedGardenLook}
                elevLook={ui.elevLook}
                onSelect={onGardenViewpointSelect}
              />
            ) : null}
          </FrameDrawer>
        ) : null}

        {/* One contextual hint: discover (bottom) never stacks with pause (top). */}
        {tiltDiscoverHint &&
          planOn &&
          !ui.frameOn &&
          topHint !== "tilt" &&
          topHint !== "edit" &&
          topHint !== "trace" ? (
          <TiltHintPill
            kind="discover"
            onDismiss={() => setTiltDiscoverHint(false)}
          />
        ) : null}
        {topHint === "tilt" && planOn && !ui.frameOn ? (
          <TiltHintPill
            kind="paused"
            hasDwelling={studio.building.length >= 3}
            lookLabel={
              armedGardenLook
                ? gardenViewpointLabel(armedGardenLook)
                : null
            }
            onDismiss={() => setTiltPauseHint(false)}
            onTraceDwelling={
              studio.building.length < 3 ? armBuildingTrace : undefined
            }
          />
        ) : null}

        {/* Compact: single Tools peek — header Instruments is often under mode nav. */}
        {chrome.compact &&
          planOn &&
          !ui.frameOn &&
          !ui.focusOn &&
          !ui.clientView &&
          !instrumentsVisible ? (
          <CameraChrome place={{ kind: "dock" }} zIndex={36} testId="instruments-peek-chrome">
            <button
              type="button"
              className={css.instrumentsPeek}
              data-testid="instruments-peek"
              aria-label="Summon instruments"
              onClick={() => setInstrumentsSummoned(true)}
            >
              Tools
            </button>
          </CameraChrome>
        ) : null}

        {/* Persistent left tool rail — the primary instrument column stays down
            the left frame band at all times on desktop (activity-bar model),
            never summon-gated. Idle only dims it; it never leaves. */}
        {chrome.ambientRibbon ? (
          <ToolDock
            tool={ui.tool}
            mode={ui.mode}
            surveyServicesAuthoring={surveyServicesAuthoring}
            locked={ui.locked}
            night={darkLens}
            gridOn={gridStudioOpen}
            onTool={(t) => {
              setInstrumentsSummoned(true);
              studio.setTool(t);
            }}
            onMeasure={() => {
              setInstrumentsSummoned(true);
              studio.setTool(ui.tool === "measure" ? "select" : "measure");
            }}
            onToggleGrid={() => {
              setGridStudioOpen((v) => !v);
            }}
          />
        ) : null}

        {contextualStripVisible && instrumentsVisible ? (
          <ContextualToolStrip
            tool={ui.tool}
            mode={ui.mode}
            surveyServicesAuthoring={surveyServicesAuthoring}
            locked={ui.locked}
            night={darkLens}
            gridOn={gridStudioOpen}
            onTool={(t) => {
              setInstrumentsSummoned(true);
              studio.setTool(t);
            }}
            onMeasure={() => {
              setInstrumentsSummoned(true);
              studio.setTool(ui.tool === "measure" ? "select" : "measure");
            }}
            onToggleGrid={() => {
              setGridStudioOpen((v) => !v);
            }}
          />
        ) : null}

        {canvasToolCardOn ? (
          <CanvasToolCard
            open
            mode={ui.mode}
            recentAssetTypes={ui.recentAssetTypes}
            armed={ui.armed}
            onArm={(t) => {
              armType(t);
              studio.setUi({ addOpen: false });
            }}
            onClose={() => studio.setUi({ addOpen: false })}
          />
        ) : null}

        {dialHint && planOn && !ui.frameOn ? (
          <DialHintPill onDismiss={() => setDialHint(false)} />
        ) : null}

        {selectHint && planOn && !ui.frameOn ? (
          <DialHintPill
            label="Drop the tool to select — Esc"
            testId="select-hint"
            onDismiss={() => setSelectHint(false)}
          />
        ) : null}

        {!ui.focusOn &&
          !ui.clientView &&
          !ui.frameOn &&
          planOn &&
          selectedLive?.t === "exist" ? (
          <ExistTreeInspector
            xPct={selectedLive.x}
            yPct={selectedLive.y}
            cam={planCam}
            dbhM={selectedLive.dbhM ?? ui.existDbhM}
            stemDbhM={selectedLive.stemDbhM}
            locked={ui.locked}
            onDbhM={studio.patchSelectedDbh}
            onStemDbhM={studio.patchSelectedStems}
          />
        ) : null}

        {inkLegendOpen &&
          planOn &&
          !ui.focusOn &&
          !ui.clientView &&
          !ui.frameOn ? (
          <BoardInkLegend onClose={() => setInkLegendOpen(false)} />
        ) : null}

        <DesignBranchDock
          projectId={projectId}
          open={designBranchOpen}
          activeBranchId={activeDesignBranchId}
          onClose={() => setDesignBranchOpen(false)}
          onCheckout={(branchId, canvas) => {
            setActiveDesignBranchId(branchId);
            writeDesignBranchId(projectId, branchId);
            studio.loadBranchCanvas(canvas);
            setDesignBranchOpen(false);
          }}
        />

        {chrome.liveBom && !ui.clientView && !ui.focusOn ? (
          <InstantPlannerChrome
            projectId={projectId}
            active
            paper={ui.frameOn || ui.mode === "cad" || ui.mode === "quote"}
            structuredTools={
              ui.mode === "sketch" || ui.mode === "cad"
            }
            assistOpen={plannerAssistOpen}
            structuredToolsOpen={structuredToolsOpen}
            onAssistOpenChange={setPlannerAssistOpen}
            onStructuredToolsOpenChange={setStructuredToolsOpen}
            onOpenBranches={() => setDesignBranchOpen(true)}
            items={studio.items}
            strokes={studio.strokes}
            irrigationZones={studio.irrigationZones}
            annotations={studio.annotations}
            imageLayers={studio.imageLayers}
            constructionTrenches={studio.constructionTrenches}
            landscapeFeatures={studio.landscapeFeatures}
            onCanvasApplied={(canvas) => {
              studio.loadBranchCanvas(canvas);
            }}
          />
        ) : null}

        <OpsSchedulesDock
          projectId={projectId}
          open={opsSchedulesOpen}
          onClose={() => setOpsSchedulesOpen(false)}
          onProposeCallouts={() => {
            void import("@workstream/domain").then(
              ({
                proposeScheduleCalloutGhosts,
                acceptScheduleCalloutGhosts,
              }) => {
                const ghosts = proposeScheduleCalloutGhosts({
                  placements: studio.items
                    .filter((i) => i.symbolId)
                    .map((i) => ({
                      id: i.id,
                      symbol_id: i.symbolId!,
                      x_pct: i.x,
                      y_pct: i.y,
                      rotation_deg: i.rot ?? 0,
                      scale: i.scale ?? 1,
                    })),
                  construction_trenches: studio.constructionTrenches,
                  annotations: studio.annotations,
                });
                if (ghosts.length === 0) {
                  studio.setUi({
                    assistReply: "No schedule callouts to propose on this tip.",
                  });
                  return;
                }
                /* Ghost-until-accept: operator Confirm via toast path → write now as Accept. */
                const notes = acceptScheduleCalloutGhosts(ghosts);
                for (const n of notes) {
                  studio.addAnnotation(n);
                }
                studio.setUi({
                  assistReply: `Accepted ${notes.length} schedule callouts on the plan.`,
                });
                setOpsSchedulesOpen(false);
              },
            );
          }}
        />

        {ui.addOpen &&
          ui.armed === "exist" &&
          !selectedLive &&
          planOn &&
          !ui.focusOn ? (
          <CameraChrome
            place={{
              kind: "project",
              pct: {
                x: instrumentAnchor.x,
                y: Math.min(88, instrumentAnchor.y + 10),
              },
              cam: planCam,
              transform: "translate(-50%, -50%)",
            }}
            testId="exist-dbh-field-chrome"
          >
            <label className={css.dbhField} data-testid="exist-dbh-field">
              <span>DBH m</span>
              <input
                type="number"
                min={0.05}
                max={2}
                step={0.01}
                inputMode="decimal"
                value={ui.existDbhM}
                aria-label="Existing tree DBH in metres"
                onChange={(e) => {
                  const n = Number.parseFloat(e.target.value);
                  if (!Number.isFinite(n) || n <= 0) return;
                  studio.setUi({
                    existDbhM: Math.min(2, Math.max(0.05, n)),
                  });
                }}
              />
            </label>
          </CameraChrome>
        ) : null}

        {/* Formalize payoff — a scan beam sweeps the board while the sketch
            is being translated to CAD. Chrome, never inside the zoom world. */}
        {formalizing ? (
          <CameraChrome
            place={{ kind: "dock" }}
            zIndex={53}
            testId="formalize-sweep-chrome"
            contentPointerEvents="none"
          >
            <div
              className={css.formalizeSweep}
              data-testid="formalize-sweep"
              aria-hidden
            >
              <div className={css.formalizeBeam} />
            </div>
          </CameraChrome>
        ) : null}

        {/* Live measures — Cmd+K / header Data only. No parked CAD MEASURES card. */}

        {measuresOpen &&
          planOn &&
          !ui.focusOn &&
          !ui.clientView &&
          !ui.frameOn &&
          !ui.foundationCleanse ? (
          <RightDataLane
            testId="right-data-lane-measures"
            onClose={() =>
              studio.setUi({ rightDataPanel: null, utilityPanel: null })
            }
          >
            <LiveMeasuresRail
              boundary={studio.boundary}
              building={studio.building}
              items={studio.items}
              scaleM={scaleM}
              schedule={siteSchedule}
              selected={selectedLive}
              cadastralLotM2={titleBlock?.lotAreaM2 ?? null}
              cadastralHouseM2={titleBlock?.houseAreaM2 ?? null}
              onClose={() =>
                studio.setUi({ rightDataPanel: null, utilityPanel: null })
              }
            />
            {showDocks ? (
              <UtilityDrawer
                openPanel={ui.utilityPanel}
                collapsed={drawingHot}
                outdoorM2={outdoor}
                boundary={studio.boundary}
                items={studio.items}
                estimate={estimate}
                mitigated={ui.mitigated}
                complianceSignal={compliance.canvasSignal}
                compliancePass={
                  [
                    compliance.outdoorOk,
                    compliance.permeableOk,
                    compliance.canopyOk,
                  ].filter(Boolean).length
                }
                councilSummary={{
                  permeablePct: compliance.permeablePct,
                  canopyPct: compliance.canopyPct,
                  setbackM: compliance.setbackM,
                }}
                projectId={projectId}
                projectAddress={projectAddress}
                complianceReport={compliance}
                sustainability={boardSustainability}
                onClose={() =>
                  studio.setUi({ rightDataPanel: null, utilityPanel: null })
                }
                onOpenPanel={(utilityPanel) =>
                  studio.setUi({
                    utilityPanel,
                    ...(utilityPanel === "compliance"
                      ? { setbackOn: true }
                      : {}),
                  })
                }
                onMitigate={(id) =>
                  studio.setUi({
                    mitigated: { ...ui.mitigated, [id]: !ui.mitigated[id] },
                  })
                }
                onOpenQuote={() => studio.setUi({ rightDataPanel: "quote" })}
                onQuotePromoted={() =>
                  studio.setUi({
                    assistReply: "Live cost promoted to main quote.",
                  })
                }
                settling={
                  estimateSettling ||
                  ui.saveStatus === "saving" ||
                  ui.saveStatus === "retrying"
                }
              />
            ) : null}
          </RightDataLane>
        ) : null}

        {/* Sun scrubber — shade mesh armed (operator or client theatre). */}
        {chrome.sunGrowth ? (
          <SunGrowthDock
            sunMin={ui.sunMin}
            datePreset={ui.sunDatePreset}
            growth={ui.growth}
            playing={ui.sunPlay}
            shadowLengthM={boardSunCast?.lengthM ?? null}
            year10CanopyConflicts={
              openBoardFindings.filter((f) => f.kind === "canopy_conflict")
                .length
            }
            onSunMin={(sunMin) => studio.setUi({ sunMin })}
            onDatePreset={(sunDatePreset) => studio.setUi({ sunDatePreset })}
            onGrowth={(growth) => studio.setUi({ growth })}
            onPlaying={(sunPlay) => studio.setUi({ sunPlay })}
          />
        ) : null}

        {chrome.lightingWorkspace ? (
          <LightingDock
            assessment={lvCircuit}
            kelvin={ui.lightingKelvin}
            onKelvin={(lightingKelvin) => studio.setUi({ lightingKelvin })}
            wireGauge={ui.lightingWireGauge}
            onWireGauge={(lightingWireGauge) =>
              studio.setUi({ lightingWireGauge })
            }
            transformerVa={ui.lightingTransformerVa}
            onTransformerVa={(lightingTransformerVa) =>
              studio.setUi({ lightingTransformerVa })
            }
            onUpgradeTransformer={() => {
              studio.setUi({
                lightingTransformerVa: nextTransformerVa(
                  ui.lightingTransformerVa,
                ),
              });
              toast.show(
                "Transformer upgraded — recheck the capacity ring.",
                "info",
                4000,
              );
            }}
            onSplitHint={() => {
              toast.show(
                "Split circuit — draw a second lighting run to a new transformer.",
                "info",
                5000,
              );
            }}
            onClose={() => studio.setUi({ lightingWorkspaceOn: false })}
          />
        ) : null}


        {planOn &&
          !ui.focusOn &&
          !ui.clientView &&
          !ui.frameOn &&
          ui.irrigationUniformityOn &&
          irrigUniformity.heads.length > 0 ? (
          <IrrigationUniformityDock
            report={irrigUniformity}
            onClose={() => studio.setUi({ irrigationUniformityOn: false })}
          />
        ) : null}

        {planOn &&
          !ui.focusOn &&
          !ui.clientView &&
          !ui.frameOn &&
          ui.liveTelemetryOn ? (
          <LiveTelemetryDock
            latest={boardTelemetry.latest}
            readings={boardTelemetry.readings}
            points={telemetryPoints}
            loading={boardTelemetry.loading}
            onSeedDemo={() => {
              void boardTelemetry.seedDemo().then(() => {
                setTelemetryRevision((n) => n + 1);
              });
            }}
            onClose={() => studio.setUi({ liveTelemetryOn: false })}
          />
        ) : null}

        {ui.arBirdseyeOn && !ui.frameOn ? (
          <ArBirdseyeOverlay
            address={displayAddress}
            boundary={studio.boundary.map((p) => ({
              x_pct: p.x,
              y_pct: p.y,
            }))}
            building={studio.building.map((p) => ({
              x_pct: p.x,
              y_pct: p.y,
            }))}
            placements={studio.items
              .filter((it) => !it.ghost)
              .map((it) => ({
                id: it.id,
                x_pct: it.x,
                y_pct: it.y,
                symbol_id: it.symbolId ?? it.t,
              }))}
            onClose={() => studio.setUi({ arBirdseyeOn: false })}
          />
        ) : null}

        {planOn &&
          !ui.frameOn &&
          !ui.focusOn &&
          (ui.clientView || ui.schemes.length > 0) ? (
          <FrameDrawer
            edge="bottom"
            testId="frame-drawer-variations"
            label="Design variations"
            size={64}
            zIndex={30}
          >
            <VariationFilmstrip
              schemes={ui.schemes}
              activeSchemeId={ui.activeSchemeId}
              boundary={studio.boundary}
              building={studio.building}
              onSave={studio.saveDesignScheme}
              onActivate={studio.activateDesignScheme}
            />
          </FrameDrawer>
        ) : null}

        {ui.clientView && planOn && !ui.frameOn ? (
          <CameraChrome
            place={{ kind: "dock" }}
            testId="client-presentation-caption"
          >
            <p className={css.clientCaption} data-testid="client-meeting-caption">
              Client meeting · concept sketch
              {ui.schemes.length > 0
                ? ` · schemes ${ui.schemes.map((s) => s.letter).join("/")}`
                : ""}
            </p>
          </CameraChrome>
        ) : null}

        {/* Design to-dos: background sync only — no canvas corner card */}
        {planOn && !ui.focusOn && !ui.clientView && !ui.frameOn ? (
          <PermitTodosPanel
            projectId={projectId}
            address={projectAddress}
            outdoorM2={outdoor}
            items={studio.items}
            compliance={compliance}
            syncOnly
          />
        ) : null}

        {chrome.horizonBoard ? (
          <PreemptiveHorizon
            cards={actionHorizon}
            onAccept={acceptHorizonCard}
            onDismiss={(id) =>
              studio.setUi({
                mitigated: { ...ui.mitigated, [id]: true },
              })
            }
          />
        ) : null}

        {chrome.horizonBoard ? (
          <BoardFindings
            findings={openBoardFindings}
            gaps={boardGaps}
            onShow={showBoardFinding}
            onDismiss={(id) =>
              studio.setUi({
                mitigated: { ...ui.mitigated, [id]: true },
              })
            }
          />
        ) : null}

        {/* Ghost review — AI sidecar lane (lane law). */}
        {draftSurface && ui.ghostReviewOpen ? (
          <RightDataLane
            testId="right-data-lane-ghosts"
            onClose={() => studio.setUi({ ghostReviewOpen: false })}
          >
            <AiGhostReview
              ghosts={ai.pending}
              items={studio.items}
              boundary={studio.boundary}
              building={studio.building}
              services={studio.services}
              easements={studio.easements}
              scaleM={scaleM}
              sunMin={ui.sunMin}
              growth={ui.growth}
              selectedId={ai.current?.id ?? null}
              factorsOpen={ui.factorsOpen}
              onFactorsOpen={(factorsOpen) => studio.setUi({ factorsOpen })}
              onSelect={(id) => {
                const idx = ai.pending.findIndex((g) => g.id === id);
                studio.setUi({ ghostIdx: idx >= 0 ? idx : ui.ghostIdx });
              }}
              onAccept={ai.accept}
              onReject={ai.reject}
              rejectReasonId={ai.rejectReasonId}
              onRejectWithReason={ai.rejectWithReason}
              onCycle={ai.cycle}
              onAskAi={(id) => {
                const g = ai.pending.find((x) => x.id === id);
                void ai.assist(g?.why ?? "refine this suggestion");
              }}
            />
          </RightDataLane>
        ) : null}

        {/* Right data lane — one panel (lane law). Flush to the right boundary.
            Fit dismisses lanes on enter; keep mounts gated while paper is up. */}
        {planOn && servicesOpen && !ui.frameOn ? (
          <RightDataLane
            testId="right-data-lane-services"
            onClose={() => studio.setUi({ rightDataPanel: null })}
          >
            <SitePackPanel
              chase={ui.sitePackChase}
              bydaAssetCount={studio.bydaAssets.filter((a) => a.ring.length >= 2).length}
              digOverrideAt={ui.digOverrideAt}
              streetChips={streetContextChips}
              bydaFiles={bydaFiles.map((f) => ({
                id: f.id,
                title: f.title,
                uri: f.uri,
              }))}
              councilRequestTemplate={councilDrainTpl}
              onToggleChase={studio.toggleSitePackChase}
              onStampDigOverride={() => studio.stampDigOverride()}
              onUploadBydaFile={(file) => {
                void uploadProjectFileClient(projectId, file, { kind: "byda" })
                  .then((row) => {
                    setBydaFiles((prev) => [row, ...prev]);
                    const chase = ui.sitePackChase.map((c) =>
                      c.id === "byda" ? { ...c, done: true } : c,
                    );
                    studio.setUi({
                      sitePackChase: chase.length
                        ? chase
                        : [
                          {
                            id: "byda",
                            label: "Lodge BYDA + upload plans to project (dig gate)",
                            done: true,
                            href: "https://www.byda.com.au/",
                          },
                        ],
                      councilTip:
                        "BYDA plan filed — digitise assets with Servc + BYDA kind to unlock dig",
                    });
                  })
                  .catch(() => {
                    studio.setUi({
                      councilTip: "BYDA upload failed — try PDF or JPEG/PNG",
                    });
                  });
              }}
              onIngestStormwaterFile={(file) => {
                void file.text().then((text) => {
                  try {
                    const geojson = JSON.parse(text) as unknown;
                    void studio.ingestStormwaterGeoJson(geojson).then(() => {
                      const chase = ui.sitePackChase.map((c) =>
                        c.id === "council_drain" ? { ...c, done: true } : c,
                      );
                      if (chase.length) {
                        studio.setUi({ sitePackChase: chase });
                      }
                    });
                  } catch {
                    studio.setUi({
                      councilTip: "Could not parse GeoJSON — check council export",
                    });
                  }
                });
              }}
            />
            <ServicesLedger
              open
              locked={ui.servicesLocked}
              scaleM={scaleM}
              services={studio.services}
              easements={studio.easements}
              bydaAssets={studio.bydaAssets}
              levels={studio.levels}
              irrigationZones={studio.irrigationZones}
              constructionTrenches={studio.constructionTrenches}
              items={studio.items}
              hiddenIds={ui.serviceFeatureHidden}
              focusedIds={ui.focusedServiceIds}
              onClose={() => studio.setUi({ rightDataPanel: null })}
              onToggleVisible={studio.toggleServiceFeatureVisible}
              onFocus={studio.focusServiceFeature}
              onClearFocus={studio.clearServiceFocus}
              onShowAll={studio.showAllServiceFeatures}
              onOpenSchedule={() => {
                setOpsSchedulesOpen(true);
                studio.setUi({ rightDataPanel: null });
              }}
              onFocusChecked={() => {
                const rows = buildServiceLedgerRows({
                  services: studio.services,
                  easements: studio.easements,
                  bydaAssets: studio.bydaAssets,
                  levels: studio.levels,
                  irrigationZones: studio.irrigationZones,
                  constructionTrenches: studio.constructionTrenches,
                  items: studio.items,
                  scaleM,
                });
                const visible = rows
                  .filter((r) => !ui.serviceFeatureHidden[r.id])
                  .map((r) => r.id);
                studio.focusVisibleServiceFeatures(visible);
              }}
            />
          </RightDataLane>
        ) : null}

        {planOn && environmentOpen && !ui.frameOn ? (
          <RightDataLane
            testId="right-data-lane-environment"
            onClose={() => studio.setUi({ rightDataPanel: null })}
          >
            <EnvironmentPanel
              open
              meta={envLiveMeta}
              sunMin={ui.sunMin}
              datePreset={ui.sunDatePreset}
              growth={ui.growth}
              playing={ui.sunPlay}
              shadeOn={ui.shadeOn}
              streetChips={streetContextChips}
              onClose={() => studio.setUi({ rightDataPanel: null })}
              onSunMin={(sunMin) => studio.setUi({ sunMin })}
              onDatePreset={(sunDatePreset) => studio.setUi({ sunDatePreset })}
              onGrowth={(growth) => studio.setUi({ growth })}
              onPlaying={(sunPlay) => studio.setUi({ sunPlay })}
              onShadeOn={(shadeOn) =>
                studio.setUi({ shadeOn, sunPlay: shadeOn ? ui.sunPlay : false })
              }
            />
          </RightDataLane>
        ) : null}

        {planOn && siteMetaOpen && !ui.frameOn ? (
          <RightDataLane
            testId="right-data-lane-site"
            onClose={() => studio.setUi({ rightDataPanel: null })}
          >
            <SiteMetaPanel
              open
              meta={siteLiveMeta}
              outdoorM2={outdoor}
              onClose={() => studio.setUi({ rightDataPanel: null })}
            />
          </RightDataLane>
        ) : null}

        {planOn && treesMetaOpen && !ui.frameOn ? (
          <RightDataLane
            testId="right-data-lane-trees"
            onClose={() => studio.setUi({ rightDataPanel: null })}
          >
            <TreesMetaPanel
              open
              meta={treesLiveMeta}
              onClose={() => studio.setUi({ rightDataPanel: null })}
            />
          </RightDataLane>
        ) : null}

        {(chrome.structureRail || chrome.compact) &&
          planOn &&
          layersOpen &&
          !ui.frameOn ? (
          <RightDataLane
            testId="right-data-lane-layers"
            onClose={() => studio.setUi({ rightDataPanel: null })}
          >
            <LayersPanel
              open
              opacity={ui.layerOpacity}
              setbackOn={ui.setbackOn}
              shadeOn={ui.shadeOn}
              buildableAreaOn={ui.buildableAreaOn}
              items={studio.items}
              noteCount={studio.annotations.length}
              lockedLayers={ui.servicesLocked ? ["services"] : []}
              onClose={() => studio.setUi({ rightDataPanel: null })}
              onOpacity={studio.setLayerOpacity}
              onSetback={(setbackOn) => studio.setUi({ setbackOn })}
              onShade={(shadeOn) => studio.setUi({ shadeOn })}
              onBuildableArea={(buildableAreaOn) => studio.setUi({ buildableAreaOn })}
              onOpenServices={() => {
                summonStickyMeta(projectId, "services");
                setStickyRestoreNonce((n) => n + 1);
                studio.setUi({
                  ...withRightDataPanel("services"),
                  utilityPanel: null,
                });
              }}
            />
          </RightDataLane>
        ) : null}

        {planOn && imageLayersOpen && !ui.frameOn ? (
          <RightDataLane
            testId="right-data-lane-image-layers"
            onClose={() => studio.setUi({ rightDataPanel: null })}
          >
            <ImageLayerPanel
              projectId={projectId}
              layers={studio.imageLayers}
              onClose={() => studio.setUi({ rightDataPanel: null })}
              onAdd={studio.addImageLayer}
              onUpdate={studio.updateImageLayer}
              onRemove={studio.removeImageLayer}
              onSetLayers={studio.setImageLayers}
            />
          </RightDataLane>
        ) : null}

        {chrome.primaryFab ? (
          <CameraChrome place={{ kind: "dock" }} testId="studio-primary-fab-chrome">
            <button
              type="button"
              className={css.assetFab}
              data-testid="studio-primary-fab"
              data-legacy-testid="asset-command-fab"
              aria-label="Open studio sheet"
              onClick={() => {
                if (studioSheetVisible && studioSheetPage === "assets") {
                  setStudioSheetOpen(false);
                  return;
                }
                // Assets card at half — larger sheet with tabs (DNA). No Inbox diversion.
                openStudioSheetPage("assets", "half");
              }}
            >
              +
            </button>
          </CameraChrome>
        ) : null}

        {studioSheetVisible ? (
          <StudioSheetHost
            open
            page={studioSheetPage}
            snap={studioSheetSnap}
            inboxCount={inboxCardCount}
            onPage={(page) => {
              setStudioSheetPage(page);
            }}
            onSnap={setStudioSheetSnap}
            onClose={() => {
              setStudioSheetOpen(false);
            }}
          >
            {studioSheetPage === "assets" ? (
              <AssetCommandSheet
                open
                mode={ui.mode}
                recentAssetTypes={ui.recentAssetTypes}
                armed={ui.armed}
                onArm={armType}
                onClose={() => setStudioSheetOpen(false)}
              />
            ) : null}
            {studioSheetPage === "data" ? (
              <div data-testid="studio-sheet-data">
                {chrome.liveBom ? (
                  <div className={sheetCss.bomEmbed} data-testid="studio-sheet-live-bom">
                    <p className={sheetCss.pageKicker}>Instant Planner</p>
                    <LiveBomDock
                      embedded
                      projectId={projectId}
                      estimate={estimate}
                      mitigated={ui.mitigated}
                      settling={
                        estimateSettling ||
                        ui.saveStatus === "saving" ||
                        ui.saveStatus === "retrying"
                      }
                      onMitigate={(id) =>
                        studio.setUi({
                          mitigated: {
                            ...ui.mitigated,
                            [id]: !ui.mitigated[id],
                          },
                        })
                      }
                      onOpenQuote={() => studio.setUi({ rightDataPanel: "quote" })}
                      onQuotePromoted={() =>
                        studio.setUi({
                          assistReply: "Live cost promoted to main quote.",
                        })
                      }
                    />
                  </div>
                ) : null}
                <p className={sheetCss.pageKicker}>Site and design data</p>
                <ul className={sheetCss.actionList}>
                  {(
                    [
                      ["layers", "Layers"],
                      ["measures", "Measures"],
                      ["services", "Services"],
                      ["environment", "Environment"],
                      ["site", "Site"],
                      ["trees", "Trees"],
                    ] as const
                  ).map(([id, label]) => (
                    <li key={id}>
                      <button
                        type="button"
                        className={sheetCss.actionRow}
                        data-testid={`studio-sheet-data-${id}`}
                        onClick={() => {
                          if (id === "environment" || id === "services" || id === "site" || id === "trees") {
                            summonStickyMeta(
                              projectId,
                              id === "environment"
                                ? "environment"
                                : id === "trees"
                                  ? "trees"
                                  : id === "site"
                                    ? "site"
                                    : "services",
                            );
                            setStickyRestoreNonce((n) => n + 1);
                          }
                          studio.setUi({
                            ...withRightDataPanel(id),
                            utilityPanel: null,
                            ...(id === "environment" ? { shadeOn: true } : {}),
                          });
                          setStudioSheetSnap("full");
                        }}
                      >
                        {label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {studioSheetPage === "inbox" ? (
              <div className={sheetCss.inboxStack} data-testid="studio-sheet-inbox">
                {actionHorizon.length === 0 &&
                  openBoardFindings.length === 0 &&
                  boardGaps.length === 0 ? (
                  <p className={sheetCss.empty}>No open advisories on this board.</p>
                ) : null}
                <PreemptiveHorizon
                  embedded
                  cards={actionHorizon}
                  onAccept={acceptHorizonCard}
                  onDismiss={(id) =>
                    studio.setUi({
                      mitigated: { ...ui.mitigated, [id]: true },
                    })
                  }
                />
                <BoardFindings
                  embedded
                  findings={openBoardFindings}
                  gaps={boardGaps}
                  onShow={showBoardFinding}
                  onDismiss={(id) =>
                    studio.setUi({
                      mitigated: { ...ui.mitigated, [id]: true },
                    })
                  }
                />
              </div>
            ) : null}
          </StudioSheetHost>
        ) : null}

        {assetPanelOn ? (
          <AssetPanel
            panel={ui.leftAssetPanel}
            restore={ui.leftAssetRestore}
            activeSwatch={ui.paintSwatch}
            paintArmed={ui.tool === "paint" && !eyedropArmed}
            eyedropOn={eyedropArmed}
            night={darkLens}
            mode={ui.mode}
            armed={ui.armed}
            tool={ui.tool}
            sunHours={kitSunHours}
            plantingSoil={ui.plantingSoil}
            plantingAspect={ui.plantingAspect}
            pathWidthM={ui.pathWidthM}
            edgeType={ui.edgeType}
            pathFilletM={ui.pathFilletM}
            pathDrafting={ui.tool === "path"}
            expandSection={assetExpandSection}
            focusSearchOnExpand={assetFocusSearch}
            libraryPinned={ui.leftAssetPinned}
            onToggleLibraryPin={() =>
              studio.setUi({ leftAssetPinned: !ui.leftAssetPinned })
            }
            onExpand={(opts) => {
              setAssetExpandSection(opts?.section ?? null);
              setAssetFocusSearch(Boolean(opts?.focusSearch));
              studio.setUi({
                ...openLeftAssetExclusive("expanded"),
              });
            }}
            onEnterPlacing={(restore, t) => {
              studio.setUi({
                leftAssetPanel: "placing",
                leftAssetRestore: restore,
                rightDataPanel: null,
                armed: t,
                paintSwatch: t,
                tool: "add",
                addOpen: true,
                cmdOpen: false,
              });
            }}
            onBackFromPlacing={() => {
              studio.setUi({
                leftAssetPanel: "expanded",
                tool: "add",
                addOpen: true,
              });
            }}
            onRailPick={(t) => {
              setEyedropArmed(false);
              setAssetExpandSection(categoryForSwatch(t));
              studio.setUi({
                paintSwatch: t,
                ...openLeftAssetExclusive("expanded"),
              });
            }}
            onEyedrop={() => setEyedropArmed((v) => !v)}
            onPreview={setPreviewSwatch}
            onPlantingSoil={(plantingSoil: SoilTag) =>
              studio.setUi({ plantingSoil })
            }
            onPlantingAspect={(plantingAspect: AspectTag) =>
              studio.setUi({ plantingAspect })
            }
            onPickMaterial={armType}
            onPickSymbol={armSymbol}
            onPathWidth={(pathWidthM: PathWidthLockM) =>
              studio.setUi({ pathWidthM })
            }
            onEdgeType={(edgeType: HardscapeEdgeType) =>
              studio.setUi({ edgeType })
            }
            onPathFillet={(pathFilletM: PathFilletLockM) =>
              studio.setUi({ pathFilletM })
            }
            onBeginPath={studio.beginPathDraft}
          />
        ) : null}

        {undoFilmOn && (studio.canUndo || studio.canRedo) ? (
          <div className={css.undoFilmstrip} data-testid="undo-filmstrip">
            <button
              type="button"
              className={css.undoFilmBtn}
              disabled={!studio.canUndo}
              onClick={studio.undo}
              title="Undo"
            >
              Undo
            </button>
            <div className={css.undoCells} aria-label="Recent canvas states">
              {Array.from({ length: Math.min(studio.undoDepth, 8) }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  className={css.undoCell}
                  data-provenance={
                    studio.undoProvenance[
                    studio.undoProvenance.length - 1 - i
                    ] ?? "manual"
                  }
                  title={`Step back ${i + 1}`}
                  aria-label={`Step back ${i + 1}`}
                  onClick={() => {
                    for (let n = 0; n <= i; n += 1) studio.undo();
                  }}
                />
              ))}
              {studio.undoDepth === 0 ? (
                <span className={css.undoEmpty}>Live</span>
              ) : null}
            </div>
            <button
              type="button"
              className={css.undoFilmBtn}
              disabled={!studio.canRedo}
              onClick={studio.redo}
              title="Redo"
            >
              Redo
            </button>
          </div>
        ) : null}

        {undoFilmOn &&
          studio.boundary.length < 3 &&
          studio.items.length === 0 &&
          studio.strokes.length === 0 ? (
          <div className={css.onboardHint} data-testid="studio-onboard-hint">
            <p className={css.onboardHintTitle}>Trace the boundary to begin</p>
            <p className={css.onboardHintMeta}>
              ⌘K to ask AI · summon instruments from the margin
            </p>
          </div>
        ) : null}

        {sitesOpen && planOn && !projectId && !ui.frameOn ? (
          <RightDataLane
            testId="right-data-lane-sites"
            onClose={() => studio.setUi({ rightDataPanel: null })}
          >
            <SiteSwitcher
              open
              siteIdx={ui.siteIdx}
              onClose={() => studio.setUi({ rightDataPanel: null })}
              onPick={studio.switchSite}
            />
          </RightDataLane>
        ) : null}

        {/*
          * Progressive cost rail — right data lane alongside the drawing.
          * Opens empty or costed; empty state prompts placing priced assets.
          */}
        {quoteRailOpen && planOn && !ui.frameOn ? (
          <RightDataLane
            testId="right-data-lane-quote"
            onClose={() => studio.setUi({ rightDataPanel: null })}
          >
            <LiveCostRail
              projectId={projectId}
              address={projectAddress}
              estimate={estimate}
              estimateSettling={estimateSettling}
              onShare={(payload) => {
                setShareQuoteFreeze(payload);
                setSharePopupOpen(true);
              }}
              onOpenLibrary={() => {
                studio.setUi({
                  leftAssetPanel: "expanded",
                  addOpen: true,
                  cmdOpen: true,
                });
              }}
              onFit={() => setFitSheetOn(!ui.frameOn)}
              onClose={() => studio.setUi({ rightDataPanel: null })}
            />
          </RightDataLane>
        ) : null}

        <StudioCommandPalette
          open={ui.cmdOpen}
          query={ui.cmdQuery}
          onQuery={(cmdQuery) => studio.setUi({ cmdQuery })}
          onClose={() => studio.setUi({ cmdOpen: false, cmdQuery: "" })}
          onAskAi={(q) => void ai.assist(q)}
          onArm={armType}
          recentAssetTypes={ui.recentAssetTypes}
          mode={ui.mode}
          onScanGhosts={() => void ai.scan()}
          onPrepareSitePack={() =>
            void studio.ai.prepareSitePack({
              councilLabel: titleBlock?.councilLabel ?? null,
            })
          }
          onDevelopSite={() => void studio.ai.develop()}
          onProposeServices={studio.ai.proposeServices}
          onAutoTrench={studio.runAutoTrench}
          onOpenServices={() => {
            summonStickyMeta(projectId, "services");
            setStickyRestoreNonce((n) => n + 1);
            studio.setUi({
              ...withRightDataPanel("services"),
              cmdOpen: false,
              cmdQuery: "",
              utilityPanel: null,
            });
          }}
          onOpenEnvironment={() => {
            summonStickyMeta(projectId, "environment");
            setStickyRestoreNonce((n) => n + 1);
            studio.setUi({
              ...withRightDataPanel("environment"),
              shadeOn: true,
              cmdOpen: false,
              cmdQuery: "",
              utilityPanel: null,
            });
          }}
          onOpenSite={() => {
            summonStickyMeta(projectId, "site");
            setStickyRestoreNonce((n) => n + 1);
            studio.setUi({
              ...withRightDataPanel("site"),
              cmdOpen: false,
              cmdQuery: "",
              utilityPanel: null,
            });
          }}
          onOpenTrees={() => {
            summonStickyMeta(projectId, "trees");
            setStickyRestoreNonce((n) => n + 1);
            studio.setUi({
              ...withRightDataPanel("trees"),
              cmdOpen: false,
              cmdQuery: "",
              utilityPanel: null,
            });
          }}
          onArmByda={(kind) => {
            studio.setUi({
              tool: "service",
              bydaDraftKind: kind,
              mode: "survey",
              cmdOpen: false,
              cmdQuery: "",
              ...withRightDataPanel("services"),
            });
          }}
          onConvertSketch={
            formalizing ? undefined : () => void runFormalizeToCad()
          }
          onToggleFitSheet={() => setFitSheetOn(!ui.frameOn)}
          onToggleInkLegend={() => {
            setInkLegendOpen((v) => !v);
            studio.setUi({ cmdOpen: false, cmdQuery: "" });
          }}
          onOpenDesignBranches={() => {
            setDesignBranchOpen(true);
            studio.setUi({ cmdOpen: false, cmdQuery: "" });
          }}
          onOpenPlannerAssist={
            chrome.liveBom
              ? () => {
                  setPlannerAssistOpen(true);
                  studio.setUi({ cmdOpen: false, cmdQuery: "" });
                }
              : undefined
          }
          onOpenStructuredTools={
            chrome.liveBom &&
            (ui.mode === "sketch" || ui.mode === "cad")
              ? () => {
                  setStructuredToolsOpen(true);
                  studio.setUi({ cmdOpen: false, cmdQuery: "" });
                }
              : undefined
          }
          onOpenOpsSchedules={() => {
            setOpsSchedulesOpen(true);
            studio.setUi({ cmdOpen: false, cmdQuery: "" });
          }}
          onCycleLifecyclePhase={() => {
            const idx = DESIGN_LIFECYCLE_PHASES.indexOf(ui.lifecyclePhase);
            const next =
              DESIGN_LIFECYCLE_PHASES[
              (idx < 0 ? 0 : idx + 1) % DESIGN_LIFECYCLE_PHASES.length
              ]!;
            studio.setUi({ lifecyclePhase: next });
          }}
          onToggleIrrigationUniformity={() =>
            studio.setUi({
              irrigationUniformityOn: !ui.irrigationUniformityOn,
            })
          }
          onToggleLiveTelemetry={() =>
            studio.setUi({ liveTelemetryOn: !ui.liveTelemetryOn })
          }
          onToggleArBirdseye={() =>
            studio.setUi({ arBirdseyeOn: !ui.arBirdseyeOn })
          }
          onToggleBuildableArea={() =>
            studio.setUi({ buildableAreaOn: !ui.buildableAreaOn })
          }
          onScanCanopy={() =>
            studio.setUi({ canopyScanRequest: ui.canopyScanRequest + 1 })
          }
          onArtboardPlan={() => selectArtboard("plan")}
          onGoQuote={() => studio.setUi({ rightDataPanel: "quote" })}
          onToggleFocus={() => studio.setUi({ focusOn: !ui.focusOn })}
          onTiltView={() => runTiltView()}
          onGardenViewpoint={runGardenViewpoint}
          onSaveScheme={studio.saveDesignScheme}
          dataOpen={measuresOpen}
          onToggleData={() =>
            studio.setUi({
              ...toggleRightDataPanelExclusive(ui.rightDataPanel, "measures"),
              utilityPanel:
                ui.rightDataPanel === "measures"
                  ? null
                  : (ui.utilityPanel ?? "bom"),
            })
          }
          onUndo={studio.undo}
          onRedo={studio.redo}
          onAnnotate={() => {
            setSelectedAnnotationId(null);
            setPendingAnnotation(null);
            setAnnotateDraft("");
            setAnnotatePhase("place");
            studio.setUi({ cmdOpen: false, cmdQuery: "", tool: "select" });
          }}
          onZoomToFit={() => {
            studio.setUi({ cmdOpen: false, cmdQuery: "" });
            if (ui.selectedId) studio.fitSelectionView();
            else studio.fitOutdoorView();
          }}
        />

      </div>
    </div >
  );
}
