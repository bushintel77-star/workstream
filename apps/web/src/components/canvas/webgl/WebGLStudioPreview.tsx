"use client";

/**
 * Gold Standard 2026 — Unified WebGL Studio (Fused Rendering Context).
 *
 * The primary operator surface. Mounts the WebGLStudio with ALL canvas data
 * wired: boundary, building, easements, items, strokes, subsurface utilities
 * (from BYDA assets), strike alerts (from trench×utility intersection),
 * and the terrain heightmap (from spot levels). The canvas foundation is
 * the authoritative Vicmap boundary + building envelope on Studio Paper —
 * the aerial photo underlay was retired (2026-08-18 directive).
 *
 * This is no longer a "dev-only preview" — it is the default mount. The
 * legacy SVG studio (HandoffDesignStudio) was retired 2026-08-19; this
 * surface is the only canvas mount.
 *
 * Key fused-rendering features:
 *   - View toggle: Plan ↔ 3D drives viewBlendTarget in the store. The
 *     FusedCamera interpolates the projection matrix — no hard cut.
 *   - Shared ink: strokes hydrate from the canvas and render in BOTH views
 *     via the FusedSketchLayer.
 *   - Autosave: the useStudioAutosave hook persists strokes back to the API.
 *   - Live data: sample utilities replaced by real BYDA/trench/level data.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import type {
  BuildingFootprint,
  CanvasStroke,
  CatalogPlacement,
  ConstructionTrench,
  DesignBydaAsset,
  DesignKeylessOverlay,
  DesignNeighbourBuilding,
  DesignSiteFrameLevel,
  IrrigationZone,
  LandscapeFeature,
  PhotoElevation,
  SetbackLine,
  SketchCanvas,
} from "@workstream/contracts";
import { getCatalogSymbol } from "@workstream/domain";
import { VignetteOverlay } from "./VignetteOverlay";
import type { PctPoint } from "./coordTransform";
import { FloatingChrome } from "./FloatingChrome";
import { buildCanopyCompliance } from "./canopyCompliance";
import {
  DEFAULT_CAMERA_RIG,
  GARDEN_PITCH_DEG,
  modeArmsDims,
  modeEntryPitchDeg,
  type StudioCameraRig,
} from "./cameraRig";
import { PRESENTATION_LENS, TECHNICAL_LENS } from "./PresentationLens";
import {
  useStudioStore,
} from "./studioStore";
import { useStudioAutosave, useBeforeUnloadGuard } from "./useStudioAutosave";
import { computeLiveStudioData } from "./canvasBridges";
import { FloatingPlacementToolbar } from "./FloatingPlacementToolbar";
import { Button } from "./Button";
import { canvasLayerPolicy } from "./layerPolicy";
import { importSiteTruth } from "./siteTruthImport";
import { StudioCommandPalette } from "./StudioCommandPalette";
import { AiScanOverlay } from "./AiScanOverlay";
import { PhotoTraceHud } from "./PhotoTraceHud";
import { PhotoElevationSheet } from "./PhotoElevationSheet";
import { SplitViewLens } from "./SplitViewLens";
import { StudioSurfaceErrorBoundary } from "./StudioSurfaceErrorBoundary";
import { StudioCanvasLoading } from "./StudioCanvasLoading";
import { ScheduleSheet } from "./ScheduleSheet";
import { isToolLocked } from "./chromeContract";
// Lazy: SheetComposer statically imports pdfExport.ts, which statically
// imports the full jsPDF library. SheetComposer only ever renders behind
// `sheetComposerOpen &&` below, but a static import still ships jsPDF in
// this route's first-load JS regardless of whether the panel is ever
// opened — it put /projects/[id] ~459 kB over its budget. Same pattern as
// LazyWebGLStudioPreview.tsx for the studio itself.
const SheetComposer = dynamic(
  () => import("./SheetComposer").then((m) => m.SheetComposer),
  { ssr: false },
);
import { OfficeTemplatePanel } from "./OfficeTemplatePanel";
import { guideFirstSketch } from "./firstSketchGuide";
import type { WebGLStudioProps } from "./WebGLStudio";
import { placementsToItems, featuresOntoItems } from "../handoff/state/canvasBridge";
import { buildScanChoreography } from "./scanChoreography";
import { toRenderItems } from "./stateBridge";
import { GhostOverlay } from "./GhostOverlay";
import {
  nearestFeatureId,
  nearestPlacementId,
  boundaryHitTest,
  buildingHitTest,
} from "./selectionPick";
import { unlockedModes, type CanvasMode, type CanvasProgress } from "../../../lib/canvas-mode";
import { StudioShortcutsHelp } from "./StudioShortcutsHelp";
import { isTypingTarget, resolveStudioShortcut } from "./studioShortcuts";
import { viewpointYawDeg, type GardenViewpointLook } from "../handoff/features/tilt/tiltMath";
import { useMediaQuery } from "../../../hooks/useMediaQuery";
import { ShareSurface } from "../handoff/features/share/ShareSurface";
import { PresentSurface } from "../handoff/features/present/PresentSurface";

/** Day arc bounds — same as the 2D SunGrowthDock (~06:20 → ~19:40). */

/**
 * Validate a GET /design-canvas payload against the contract schema before
 * the site-truth bridge consumes it — an unvalidated cast feeds corrupt JSON
 * straight into the import (and, after the reload, back into the API).
 * Returns null when there is no canvas document; a schema failure also
 * returns null (the import then reports zero traced vectors rather than
 * acting on garbage). The schema import is dynamic so zod stays out of the
 * studio's critical chunk.
 */
async function parseDesignCanvasPayload(
  payload: unknown,
): Promise<import("@workstream/contracts").DesignCanvas | null> {
  if (typeof payload !== "object" || payload === null) return null;
  const canvas = (payload as { canvas?: unknown }).canvas;
  if (canvas == null) return null;
  const { DesignCanvasSchema } = await import("@workstream/contracts");
  const parsed = DesignCanvasSchema.safeParse(canvas);
  return parsed.success ? parsed.data : null;
}

// R3F Canvas requires the browser — dynamic import with ssr:false
const WebGLStudio = dynamic(() => import("./WebGLStudio").then((m) => m.WebGLStudio), {
  ssr: false,
  loading: () => <StudioCanvasLoading label="Opening canvas" />,
});

/** Signals once the WebGL surface has mounted. The site-truth loading
 *  overlay waits for this so "Opening canvas" and "Importing site truth"
 *  never announce as two live regions at the same moment. */
function WebGLStudioReady({
  onReady,
  ...sceneProps
}: WebGLStudioProps & { onReady: () => void }) {
  useEffect(() => {
    onReady();
  }, [onReady]);
  return <WebGLStudio {...sceneProps} />;
}
import { CanvasFirstLayout } from "./CanvasFirstLayout";
import type { CanvasBridge, SpatialGraphNode } from "./CanvasFirstLayout";
import type { SelectionRef } from "./selectionPick";

export interface WebGLStudioPreviewProps {
  projectId: string;
  scaleM: number;
  /** True when the project has no confirmed scale (no site_frame.board_width_m).
   *  Drives the UNSCALED badge in the chip bar (turn 15a/15c). */
  unscaled?: boolean;
  boardAspect: number;
  boundaryPct: PctPoint[];
  buildingPct?: PctPoint[];
  easementsPct?: PctPoint[][];
  /** Project latitude (decimal degrees) when verified for this project. */
  lat?: number;
  lng?: number;
  /** Project address — feeds the flora ring's municipality ranking. */
  projectAddress?: string;
  /** Persisted canvas strokes (hydrated into the store on mount). */
  initialStrokes?: CanvasStroke[];
  /** Persisted Spatial Sketching planes (hydrated into the store on mount). */
  initialCanvases?: SketchCanvas[];
  /** Persisted legal setback lines (hydrated into the store on mount). */
  initialSetbackLines?: SetbackLine[];
  /** Persisted building footprints (hydrated into the store on mount). */
  initialBuildingFootprints?: BuildingFootprint[];
  /** Persisted placements — hydrated into the store on mount; the store is
   *  the live source thereafter (items + autosave derive from it). */
  placements?: CatalogPlacement[];
  /** Persisted LandscapeFeatures (converted CAD entities + placement-outline
   *  mirrors) — hydrated into the store; re-attached to placements on render. */
  initialFeatures?: LandscapeFeature[];
  /** Pinned site photos as calibrated elevation-trace frames (canvas records). */
  photoElevations?: PhotoElevation[];
  /** BYDA assets from site_frame → converted to subsurface utilities. */
  bydaAssets?: DesignBydaAsset[];
  /** Construction trenches → converted to excavations for strike detection. */
  constructionTrenches?: ConstructionTrench[];
  /** Irrigation zones → feed hydraulic calculations. */
  irrigationZones?: IrrigationZone[];
  /** Spot levels from site_frame → feed terrain heightmap. */
  levels?: DesignSiteFrameLevel[];
  /** Government/state overlays already co-registered to the title frame. */
  keylessOverlays?: DesignKeylessOverlay[];
  /** Vicmap neighbouring footprints for real overshadowing context. */
  neighbourBuildings?: DesignNeighbourBuilding[];
  /** Outdoor area m² (page-computed from survey/title/site_frame) → fit-sheet. */
  /** @deprecated — kept for API compat, unused after chrome purge. */
  outdoorM2?: number;
  /** Activate sketch mode on mount (from ?tool=sketch deep link). */
  initialSketchMode?: boolean;
  /** Resolved canvas mode for the mode tabs (page clamps to a WebGL-native
   *  mode — legacy modes render the SVG studio instead). */
  initialMode?: CanvasMode;
  /** Progressive-unlock progress flags driving mode tab lock states. */
  progress?: CanvasProgress;
  /** Initial durable quote/share state hydrated by the server component. */
  hasQuote?: boolean;
  quotePortalUri?: string | null;
  /** Null means CAD verification could not be loaded and sharing must fail closed. */
  initialCadGhostCount?: number | null;
  /** Cadastral/environmental records for the ambient meta chip-set. */
  siteMeta?: {
    titleRef?: string | null;
    lga?: string | null;
    lotAreaM2?: number | null;
    sunHours?: number | null;
  };
  /** True north bearing for board-up. Null/undefined means uncalibrated. */
  northBearingDeg?: number | null;
}

export function WebGLStudioPreview({
  projectId,
  scaleM,
  unscaled = false,
  boardAspect,
  boundaryPct,
  buildingPct,
  easementsPct,
  lat,
  lng,
  projectAddress = "",
  initialStrokes,
  initialCanvases = [],
  initialSetbackLines = [],
  initialBuildingFootprints = [],
  placements: initialPlacements = [],
  initialFeatures: initialFeaturesProp = [],
  photoElevations: initialPhotoElevations = [],
  bydaAssets = [],
  constructionTrenches = [],
  irrigationZones = [],
  levels = [],
  keylessOverlays = [],
  neighbourBuildings = [],
  outdoorM2: _outdoorM2 = 0,
  initialSketchMode = false,
  initialMode = "sketch",
  progress = {
    hasAerial: false,
    hasSketch: false,
    hasCad: false,
    hasQuote: false,
  },
  hasQuote = false,
  quotePortalUri = null,
  initialCadGhostCount = null,
  siteMeta,
  northBearingDeg = null,
}: WebGLStudioPreviewProps) {
  /**
   * Discrete camera write (garden look / zoom buttons / palette) — straight
   * to the transient store, the single source of truth for the camera. There
   * is NO React rig mirror: per-frame pan/zoom (StudioControls) and these
   * discrete writes all land in liveRig, read by FusedCamera via getState().
   */
  const writeLiveRig = useCallback((next: StudioCameraRig) => {
    useStudioStore.getState().setLiveRig(next);
  }, []);

  /** Discrete zoom step (buttons / command palette). */
  const zoomBy = useCallback(
    (dir: 1 | -1) => {
      const live = useStudioStore.getState().liveRig;
      const factor = dir === 1 ? 1.25 : 1 / 1.25;
      writeLiveRig({ ...live, zoom: Math.min(Math.max(live.zoom * factor, 0.1), 50) });
    },
    [writeLiveRig],
  );

  const [presentationMode, setPresentationMode] = useState(false);
  const [activeMode, setActiveMode] = useState<CanvasMode>(initialMode);
  /** Open meta surface panel (null = none). Mode surfaces open by mode. */
  /** The open photo elevation sheet (print artifact) — null = closed. */
  const [photoSheetId, setPhotoSheetId] = useState<string | null>(null);
  /** Fit companion visibility — the Fit meta tab's pressed state (rides the
   *  store, not the metaTab state; restored with the meta tabs). */
  const router = useRouter();
  const setupRanFor = useRef<string | null>(null);

  // Escape closes the open surface panel (browser-tab behaviour).  }, [metaTab]);
  const [cadGhostCount] = useState<number | null>(
    initialCadGhostCount,
  );
  const [quotePersisted, setQuotePersisted] = useState(hasQuote);
  const [portalUri, setPortalUri] = useState<string | null>(quotePortalUri);
  const [visibleLayers] = useState({
    sketch: true,
    siteTruth: true,
    design: true,
  });
  const [webglAvailable, setWebglAvailable] = useState<boolean | null>(null);
  const [webglLost, setWebglLost] = useState(false);
  // True once the WebGL surface mounts — the site-truth loading overlay waits
  // for it so the two loading live regions never announce at once.
  const [studioReady, setStudioReady] = useState(false);
  const handleStudioReady = useCallback(() => setStudioReady(true), []);
  // True while the quiet site-truth bootstrap parses the Vicmap cadastral data
  // on first load — drives the StudioCanvasLoading overlay so a cold geocoded
  // project shows "Importing site truth" instead of a blank canvas page.
  const [importingSiteTruth, setImportingSiteTruth] = useState(false);

  // Tool-state canvas cursor — crosshair while a draw vector is armed
  // (sketch / measure / trench / zone / asset), grab while panning, and
  // grabbing during an active pan drag. Survey/select keep the default.
  const sketchMode = useStudioStore((s) => s.sketchMode);
  const measureActive = useStudioStore((s) => s.measureActive);
  const trenchTool = useStudioStore((s) => s.trenchTool);
  const zoneTool = useStudioStore((s) => s.zoneTool);
  const armedSymbolId = useStudioStore((s) => s.armedSymbolId);
  const drawCursor =
    sketchMode || measureActive || trenchTool !== null || zoneTool !== null || armedSymbolId !== null
      ? "crosshair"
      : "grab";
  useEffect(() => {
    const probe = document.createElement("canvas");
    setWebglAvailable(
      Boolean(
        probe.getContext("webgl2") ||
        probe.getContext("webgl") ||
        probe.getContext("experimental-webgl"),
      ),
    );
  }, []);

  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  /* Tablet tier (design-spec debt D4): below 1100px floating companions
   * narrow so the drawing keeps its room. The retired right dock's
   * collapse pill went with the dock — the UnifiedPanel is flush chrome,
   * not a floating column. */
  const narrowViewport = useMediaQuery("(max-width: 1100px)");

  // Garden viewpoint — eye-level rig presets per cardinal look. The yaw
  // reuses the classic tiltMath mapping so N/E/S/W mean the same thing in
  // both studios.
  const [gardenLook, setGardenLook] = useState<GardenViewpointLook>("S");
  const applyGardenLook = useCallback((look: GardenViewpointLook) => {
    setGardenLook(look);
    // Pitch is the single camera axis — raise to the garden eye level and let
    // the rig write commit the derived 3D blend target in the same set.
    writeLiveRig({
      ...DEFAULT_CAMERA_RIG,
      tiltDeg: GARDEN_PITCH_DEG,
      zoom: 1.45,
      rotateDeg: viewpointYawDeg(look),
    });
  }, [writeLiveRig]);

  // Estimator stage — the panel titles "Estimator" while the estimate is
  // provisional and "Quote" once the operator commits it (signoff exists).
  /**
   * Camera + instrument state for entering a mode. Shared by the tab/shortcut
   * path (`onNativeMode`) and the deep-link mount effect below, so `?mode=cad`
   * and clicking the CAD tab cannot resolve to different cameras — which is
   * exactly what happened while `onNativeMode` was the only path.
   */
  const applyModeCamera = useCallback(
    (mode: CanvasMode) => {
      const store = useStudioStore.getState();
      if (mode === "garden") {
        applyGardenLook(gardenLook);
      } else {
        store.setPitchDeg(modeEntryPitchDeg(mode));
      }
      if (modeArmsDims(mode) && boundaryPct.length >= 3) {
        store.setDimsView(true);
      }
    },
    [applyGardenLook, gardenLook, boundaryPct.length],
  );

  /**
   * Keep `?mode=` in step with the active mode (replaceState — no history
   * churn). A reload, a shared link, or the browser back button must land in
   * the mode the operator is actually looking at, not the deep-link mode the
   * page booted with.
   */
  const syncModeUrl = useCallback((mode: CanvasMode) => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("mode", mode);
      window.history.replaceState(null, "", url.toString());
    } catch {
      // Non-browser context — the mode state itself is unaffected.
    }
  }, []);

  const onNativeMode = useCallback((mode: CanvasMode) => {
    setActiveMode(mode);
    if (mode !== "present") setPresentationMode(false);
    const store = useStudioStore.getState();
    applyModeCamera(mode);
    if (mode === "sketch") {
      store.setArmedSymbolId(null);
      store.setMeasureActive(false);
      store.setSketchMode(true);
    } else if (mode === "quote") {
      store.setFitSheetOpen(true);
    } else if (mode === "present") {
      setPresentationMode(true);
    }
    syncModeUrl(mode);
    // survey / share / elevation mount their glass cards on activeMode.
  }, [applyModeCamera, syncModeUrl]);

  /**
   * Deep-link entry. `activeMode` initialises from `initialMode` and
   * `onNativeMode` only fires on a click, shortcut or palette command, so every
   * `?mode=` mount used to inherit the rig default — a 55° oblique — and the
   * only mount effect handled quote and present. Sketch deliberately stays
   * un-armed here (the rail / `?tool=sketch` owns the draw cursor); this effect
   * resolves the camera and the instruments, not the active tool.
   */
  const modeEntryRef = useState({ done: false })[0];
  useEffect(() => {
    if (modeEntryRef.done) return;
    modeEntryRef.done = true;
    applyModeCamera(initialMode);
    if (initialMode === "quote") {
      useStudioStore.getState().setFitSheetOpen(true);
    } else if (initialMode === "present") {
      setPresentationMode(true);
    }
  }, [initialMode, applyModeCamera, modeEntryRef]);

  // --- Store subscriptions (DOM HUD re-renders; 3D reads via getState) ---
  const year = useStudioStore((s) => s.growthYear);
  const growthFactor = year / 10;
  const sunMin = useStudioStore((s) => s.sunMin);
  const viewBlendTarget = useStudioStore((s) => s.viewBlendTarget);
  const strokes = useStudioStore((s) => s.sketchStrokes);
  const storeCanvases = useStudioStore((s) => s.sketchCanvases);
  // Sketch → CAD — the tidy proposal set + review state (Part A).
  // Save status is rendered by <SaveStatusChip /> which subscribes independently
  // (so only the chip re-renders on status change, not the whole HUD).

  // --- Hydrate the store on mount (strokes + placements + project context) ---
  // This runs once when the component mounts with the server-fetched data.
  const hydratedRef = useState({ done: false });
  useEffect(() => {
    if (hydratedRef[0].done) return;
    hydratedRef[0].done = true;
    const store = useStudioStore.getState();
    store.setSketchStrokes(initialStrokes ?? []);
    store.setSketchCanvases(initialCanvases);
    store.setSetbackLines(initialSetbackLines);
    store.setBuildingFootprints(initialBuildingFootprints);
    store.setPlacements(initialPlacements);
    store.setConstructionTrenches(constructionTrenches);
    store.setIrrigationZones(irrigationZones);
    store.setPhotoElevations(initialPhotoElevations);
    store.setFeatures(initialFeaturesProp);
    // Site context feeds the sketch→CAD classifier + placement constraints.
    store.setSiteContext(boundaryPct, buildingPct ?? []);
    store.setSelection([]);
    store.setProjectContext(projectId, null, projectAddress);
    if (initialSketchMode) store.setSketchMode(true);
  }, [initialStrokes, initialCanvases, initialSetbackLines, initialBuildingFootprints, initialPlacements, initialFeaturesProp, constructionTrenches, irrigationZones, initialPhotoElevations, projectId, projectAddress, initialSketchMode, boundaryPct, buildingPct, hydratedRef]);

  // Phase 9: auto-site setup from the spatial command palette. When a new
  // project is created via JUMP, the URL carries ?setup=1; run the mock
  // WFS/AI pipeline once after the store has the new project context.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("setup") !== "1") return;
    if (!projectId || setupRanFor.current === projectId) return;
    setupRanFor.current = projectId;

    params.delete("setup");
    const queryString = params.toString();
    const newUrl = `${window.location.pathname}${queryString ? `?${queryString}` : ""}`;
    window.history.replaceState(null, "", newUrl);

    const store = useStudioStore.getState();
    store.setAiProcessingState("IDLE");
    void store.processSiteDocuments();
  }, [projectId]);

  // Quiet site-truth bootstrap — the canvas foundation is the authoritative
  // Vicmap boundary + building envelope, not an aerial photo. When a
  // geocoded project opens with no boundary yet, trace it once per session
  // (same flow as the explicit Import button) and reload into the vectors.
  const runSiteTruthImport = useCallback(async () => {
    setImportingSiteTruth(true);
    // Client watchdog — the loading surface is bounded even if a request
    // hangs, so "Importing site truth" can never spin forever. Cleared on
    // normal completion below.
    const watchdog = window.setTimeout(() => setImportingSiteTruth(false), 12000);
    try {
      const canvasRes = await fetch(`/api/projects/${projectId}/design-canvas`);
      if (!canvasRes.ok) {
        throw new Error(`design-canvas responded ${canvasRes.status}`);
      }
      const canvas = await parseDesignCanvasPayload(await canvasRes.json());
      const r = await importSiteTruth(projectId, canvas);
      useStudioStore.getState().setOverlayFetchError(null);
      if ((r.boundaryPts ?? 0) > 0) router.refresh();
    } catch (err) {
      // Phase O — this is the ONLY site-truth import path (the "explicit
      // Import button" the old comment deferred to does not exist), so
      // swallowing here left the operator on an empty board with no
      // boundary and no reason given.
      const msg = err instanceof Error ? err.message : String(err);
      useStudioStore.getState().setOverlayFetchError({
        source: "Vicmap site truth",
        message: `The boundary and building envelope could not be imported (${msg}). The board carries no site truth — draw on it, or retry the import.`,
      });
    } finally {
      window.clearTimeout(watchdog);
      setImportingSiteTruth(false);
    }
  }, [projectId, router, setImportingSiteTruth]);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_E2E === "1") return; // e2e seeds its own state
    if (boundaryPct.length >= 3 || lat == null || lng == null) return;
    const key = `gs-truth-autotrace-${projectId}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    void runSiteTruthImport();
  }, [projectId, boundaryPct, lat, lng, runSiteTruthImport]);

  // Guided first-sketch handoff is a PASSIVE hint only — the pen is NOT
  // auto-armed (auto-arming flipped sketchMode and turned plain drags into
  // ink, breaking pan on every empty board; seen 2026-09-02 live pass). The
  // operator starts with P / the PEN rail tile; the pan law stays intact.

  // Placements live in the store after hydration — the live source for both
  // the 3D items and the autosave doc. Pure client-side bridge (proven in
  // the SVG studio's client hook); unknown symbol ids degrade gracefully.
  // Persisted feature outlines re-attach by mirrored id (featuresOntoItems —
  // the SVG coupling), so a reloaded deck/lawn/bed keeps its drawn region.
  const storePlacements = useStudioStore((s) => s.placements);
  const storeFeatures = useStudioStore((s) => s.features);
  const scheduleOpen = useStudioStore((s) => s.scheduleOpen);
  const sheetComposerOpen = useStudioStore((s) => s.sheetComposerOpen);
  const templatePanelOpen = useStudioStore((s) => s.templatePanelOpen);
  const splitView = useStudioStore((s) => s.splitView);
  const surveyedPlanLayers = useStudioStore((s) => s.surveyedPlanLayers);
  const setSurveyedPlanLayers = useStudioStore((s) => s.setSurveyedPlanLayers);
  const surveyAnnotationDialect = useStudioStore((s) => s.surveyAnnotationDialect);
  const setSurveyAnnotationDialect = useStudioStore((s) => s.setSurveyAnnotationDialect);
  const cadAnnotationLayers = useStudioStore((s) => s.cadAnnotationLayers);
  const setCadAnnotationLayers = useStudioStore((s) => s.setCadAnnotationLayers);
  const cadAnnotationDialect = useStudioStore((s) => s.cadAnnotationDialect);
  const setCadAnnotationDialect = useStudioStore((s) => s.setCadAnnotationDialect);
  const sketchAnnotationLayers = useStudioStore((s) => s.sketchAnnotationLayers);
  const setSketchAnnotationLayers = useStudioStore((s) => s.setSketchAnnotationLayers);
  const sketchAnnotationDialect = useStudioStore((s) => s.sketchAnnotationDialect);
  const setSketchAnnotationDialect = useStudioStore((s) => s.setSketchAnnotationDialect);
  const surveyTradePacks = useStudioStore((s) => s.surveyTradePacks);
  const setSurveyTradePacks = useStudioStore((s) => s.setSurveyTradePacks);
  const cadTradePacks = useStudioStore((s) => s.cadTradePacks);
  const setCadTradePacks = useStudioStore((s) => s.setCadTradePacks);
  const sketchTradePacks = useStudioStore((s) => s.sketchTradePacks);
  const setSketchTradePacks = useStudioStore((s) => s.setSketchTradePacks);
  const storeTrenches = useStudioStore((s) => s.constructionTrenches);
  const storeZones = useStudioStore((s) => s.irrigationZones);
  const items = useMemo(() => {
    const hydrated = featuresOntoItems(
      placementsToItems(storePlacements),
      storeFeatures,
    );
    return toRenderItems(hydrated);
  }, [storePlacements, storeFeatures]);
  // Undo / redo — Cmd/Ctrl+Z (+Shift). Skipped while typing in chrome
  // inputs so the palette/assist fields keep native text undo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (typing || !(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") return;
      e.preventDefault();
      const store = useStudioStore.getState();
      if (e.shiftKey) store.redo();
      else store.undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // --- Selection: one state, three entity families (Part B) ---
  // Click picks the nearest feature linework, then the nearest placement
  // glyph; shift-click adds (multi-select); empty-ground click clears.
  // Esc clears too. The refs live in the zustand store, so selection
  // persists across every WebGL mode switch (plan/sketch/cad/elevation/
  // tilt) — nothing remounts on mode change. No cross-studio sync exists
  // (AGENTS.md: the two studios share only the persisted canvas).
  const selection = useStudioStore((s) => s.selection);
  const handleGroundClick = useCallback(
    (pct: PctPoint, opts: { additive: boolean }) => {
      const store = useStudioStore.getState();
      // Phase I — stroke-matching eraser: when active, clicking erases the
      // stroke under the cursor (scales to the stroke's own width) instead
      // of selecting an entity.
      if (store.eraserActive) {
        store.eraseStrokeAt(pct, scaleM);
        return;
      }
      const featureId = nearestFeatureId(store.features, pct, scaleM);
      if (featureId) {
        store.selectRef({ kind: "feature", id: featureId }, opts);
        return;
      }
      const placementId = nearestPlacementId(store.placements, pct, scaleM);
      if (placementId) {
        store.selectRef({ kind: "placement", id: placementId }, opts);
        return;
      }
      // Site elements: the title boundary and the building footprint are
      // selectable — the unified panel shows their inspector on click.
      if (boundaryHitTest(store.siteBoundary, pct, scaleM)) {
        store.selectRef({ kind: "boundary", id: "site-boundary" }, opts);
        return;
      }
      if (buildingHitTest(store.siteBuilding ?? [], pct, scaleM)) {
        store.selectRef({ kind: "building", id: "site-building" }, opts);
        return;
      }
      if (!opts.additive) store.clearSelection();
    },
    [scaleM],
  );

  // Studio keyboard map — viewport 1–4, Shift+digit modes, letter tools, ?.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (typing || e.key !== "Escape") return;
      useStudioStore.getState().clearSelection();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Delete/Backspace — remove selected placements and features (undoable,
  // one history commit per kind). Photo strokes stay elevation-space (no
  // plan-view edit surface). Skipped while typing in chrome inputs.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (typing || (e.key !== "Delete" && e.key !== "Backspace")) return;
      const store = useStudioStore.getState();
      // While a drafting run is open, Backspace belongs to the run (it steps
      // back one vertex) — deleting the standing selection under the same key
      // would be two destructive meanings for one press.
      if (store.draftSession && e.key === "Backspace") return;
      const placementIds = store.selection
        .filter((r) => r.kind === "placement")
        .map((r) => r.id);
      const featureIds = store.selection
        .filter((r) => r.kind === "feature")
        .map((r) => r.id);
      if (placementIds.length === 0 && featureIds.length === 0) return;
      e.preventDefault();
      if (placementIds.length > 0) store.removePlacements(placementIds);
      if (featureIds.length > 0) store.removeFeatures(featureIds);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Sketch photo underlay — retired (2026-08-18). The site-photo gallery +
  // photo-trace elevation replaced the single aerial-slot upload; the canvas
  // foundation is Vicmap vectors, not photo underlays.

  // Site-truth import — the Vicmap bridge (survey mode owns it).
  const [truthBusy] = useState(false);
  const [,] = useState<string | null>(null);

  // AI parsing-stage transition — the canvas-level scan overlay driven by
  // the drafter panel's busy state (AI draft / assist). The research-backed
  // parsing UX lives in AiScanOverlay; this is just its power switch.
  const [aiScanKey] = useState<string | null>(null);

  // Command palette — Cmd/Ctrl+K summons; Esc closes (handled inside).
  const [paletteOpen, setPaletteOpen] = useState(projectId === "");
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Workspace hotkeys (pack S6.2): Opt+H = handedness, Opt+F = anchor
  // visibility cycle, Opt+R = drafting/sketching toggle.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      const store = useStudioStore.getState();
      switch (e.key.toLowerCase()) {
        case "h":
          e.preventDefault();
          store.setHandedness(store.handedness === "LEFT" ? "RIGHT" : "LEFT");
          break;
        case "f":
          e.preventDefault();
          store.setAnchorVisibility(
            store.anchorVisibility === "ALL" ? "DIMMED" :
              store.anchorVisibility === "DIMMED" ? "FOCUS" : "ALL",
          );
          break;
        case "r":
          e.preventDefault();
          store.setDraftingMode(!store.draftingMode);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  // store flag on camera-motion state change; this effect mirrors the flag
  // (OR the hold-H peek) onto <body> imperatively, so receding chrome never
  // re-renders the React tree. Opacity only — the CSS lives in globals.css.
  useEffect(() => {
    let receded = useStudioStore.getState().chromeReceded;
    let peek = useStudioStore.getState().chromePeek;
    const apply = () => {
      document.body.classList.toggle("gs-chrome-receding", receded || peek);
    };
    const unsub = useStudioStore.subscribe((s) => {
      if (s.chromeReceded === receded && s.chromePeek === peek) return;
      receded = s.chromeReceded;
      peek = s.chromePeek;
      apply();
    });
    return () => {
      unsub();
      document.body.classList.remove("gs-chrome-receding");
    };
  }, []);

  // Hold-H peek — fades the chrome while held so the operator can read the
  // drawing underneath (site data, boundaries, canopies). Listed in the ?
  // shortcut sheet; plain h only (no modifiers, not while typing).
  useEffect(() => {
    const isPeekKey = (e: KeyboardEvent) =>
      !e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === "h";
    const down = (e: KeyboardEvent) => {
      if (isPeekKey(e) && !isTypingTarget(e.target)) {
        useStudioStore.getState().setChromePeek(true);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (isPeekKey(e)) useStudioStore.getState().setChromePeek(false);
    };
    document.addEventListener("keydown", down);
    document.addEventListener("keyup", up);
    return () => {
      document.removeEventListener("keydown", down);
      document.removeEventListener("keyup", up);
    };
  }, []);

  // Placements as classic StudioItems — the elevation board consumes the
  // same shape the SVG studio feeds it (ARCHITECTURE §5 state contract).
  const studioItems = useMemo(
    () => placementsToItems(storePlacements),
    [storePlacements],
  );

  // ResCode A2-6 canopy compliance for the chrome — same pure builder the
  // scene's meta chips consume, computed here so the DOM top bar can light
  // its obligation pill without waiting on a keyless vegetation overlay.
  const canopyCompliance = useMemo(
    () =>
      buildCanopyCompliance({
        placements: storePlacements,
        boundary: boundaryPct,
        scaleM,
        boardAspect,
        lotAreaM2: siteMeta?.lotAreaM2,
      }),
    [storePlacements, boundaryPct, scaleM, boardAspect, siteMeta?.lotAreaM2],
  );

  // Plan snapshot for the present deck's plan-crop panels — the same bridge
  // the SVG studio feeds PresentSurface, drawn from the WebGL store's live
  // placements/strokes and the server-rendered site frame.
  const presentPlanSnapshot = useMemo(
    () => ({
      boundary: boundaryPct.map((p) => ({ x: p.x, y: p.y })),
      building: (buildingPct ?? []).map((p) => ({ x: p.x, y: p.y })),
      items: studioItems.map((i) => ({
        id: i.id,
        t: i.t,
        x: i.x,
        y: i.y,
        outlinePct: i.outlinePct?.map((p) => ({ x: p.x, y: p.y })),
      })),
      strokes: strokes.map((s) => ({
        id: s.id,
        points: s.points.map((p) => ({ x: p.x_pct, y: p.y_pct })),
        widthPx: s.width_px,
        color: s.color,
        ...(s.kind ? { kind: s.kind } : {}),
        ...(s.shape_tool ? { shapeTool: s.shape_tool } : {}),
        ...(s.shape_start
          ? { shapeStart: { x: s.shape_start.x_pct, y: s.shape_start.y_pct } }
          : {}),
        ...(s.shape_end
          ? { shapeEnd: { x: s.shape_end.x_pct, y: s.shape_end.y_pct } }
          : {}),
      })),
      // Canvas revision — moves whenever the placements/strokes deps do.
      revision: Date.now(),
    }),
    [boundaryPct, buildingPct, studioItems, strokes],
  );

  // Progress re-derives live from the store — placing the first asset or
  // drawing the first stroke unlocks CAD/quote/present without a reload
  // (the server-rendered snapshot only seeds the initial state).
  // The aerial gate falls back to boundary presence: the Vicmap import
  // lands vectors, not an aerial photo, and a traced title boundary is the
  // real "site truth captured" signal (survey.aerial_uri is the legacy
  // name for the same stage).
  const liveProgress = useMemo<CanvasProgress>(
    () => ({
      hasAerial: progress.hasAerial || boundaryPct.length >= 3,
      hasSketch: progress.hasSketch || strokes.length > 0,
      hasCad:
        progress.hasCad ||
        storePlacements.length > 0 ||
        storeFeatures.length > 0 ||
        boundaryPct.length > 0,
      hasQuote: progress.hasQuote,
    }),
    [progress, strokes, storePlacements, storeFeatures, boundaryPct],
  );
  const unlocked = useMemo(() => unlockedModes(liveProgress), [liveProgress]);

  /*
   * The full projection capsule needs ~1021px of viewport to sit between the
   * nib palette's right edge (403px) and the right dock (380px from the right
   * edge). Below that it slid left across the palette — 89x47px of overlap at
   * 960px wide. Under the threshold it renders as the icon-only preset group,
   * which fits the remaining gap at every viewport the collision spec walks.
   */
  const _hudCompact = narrowViewport;
  /*
   * Survey drops the projection capsule entirely. It already argued its own
   * case ("Survey mode has nothing to project yet, so the full capsule is dead
   * weight there" — ViewportTransitionHUD) and then rendered the compact preset
   * group anyway, floating in the upper-right of the drawing at top:152
   * right:400. If it is dead weight, it is dead weight: the presets stay
   * reachable from the keyboard (1/2/3), the command palette, and the Plan/3D
   * segmented control in the identity strip.
   */
  const _showProjectionHud = activeMode !== "survey";

  // Survey capture progress — ONE derivation feeding both the setup panel and
  // the chrome pill, so the two can never disagree on "X of 5". Completion is
  // read off real project data (see surveySetup.ts), never a manual tick.  );  // Studio keyboard map — viewport 1–4, Shift+digit modes, letter tools, ?.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const hit = resolveStudioShortcut(e);
      if (!hit) return;
      if (hit.kind === "viewport") {
        if (useStudioStore.getState().splitView) return;
        e.preventDefault();
        // Landscape Canvas v2 — camera dock presets (handoff §6.1).
        // The store's setCameraPreset writes the rig tilt + blend target.
        useStudioStore.getState().setCameraPreset(hit.preset);
        return;
      }
      if (hit.kind === "mode") {
        if (!unlocked.has(hit.mode)) return;
        e.preventDefault();
        onNativeMode(hit.mode);
        return;
      }
      // Landscape Canvas v2 — letter hotkeys drive the ribbon's unified tool
      // via setActiveTool (the legacy tool-flag bridge). Re-pressing the
      // active tool toggles it off, mirroring the ribbon's click behaviour.
      if (hit.kind === "ribbon-tool") {
        e.preventDefault();
        const store = useStudioStore.getState();
        // Phase L.5 — the chrome contract governs the keyboard too. The
        // ribbon greys GRADE/MEASURE in 3D; without this guard the letter
        // hotkey still activated them and the operator could measure under
        // perspective, which is the false reading the lock exists to stop.
        // Deactivating an already-active tool stays allowed, so entering 3D
        // with a locked tool armed is not a trap.
        // The refusal is not silent: the ribbon draws the lock glyph and the
        // stated reason for the locked group the whole time the camera is in
        // that state, at every ribbon width.
        if (store.activeTool !== hit.tool && isToolLocked(hit.tool, store.cameraPreset)) {
          return;
        }
        store.setActiveTool(store.activeTool === hit.tool ? "none" : hit.tool);
        return;
      }
      const store = useStudioStore.getState();
      e.preventDefault();
      switch (hit.tool) {
        case "help":
          setShortcutsOpen((open) => !open);
          break;
        case "assets":
          store.setAssetsOpen(!store.assetsOpen);
          break;
        case "measure":
          store.setMeasureActive(!store.measureActive);
          break;
        case "underground":
          store.setSubsurfaceView(!store.subsurfaceView);
          break;
        case "dims":
          store.setDimsView(!store.dimsView);
          break;
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [unlocked, onNativeMode, writeLiveRig]);

  // Mode-driven layer law — flows into the scene as props (no remounts).
  const policy = useMemo(() => canvasLayerPolicy(activeMode), [activeMode]);
  // Survey owns the subsurface works: entering survey arms the blueprint
  // ground (the Underground rail toggle remains the operator override).
  useEffect(() => {
    if (policy.subsurface) {
      useStudioStore.getState().setSubsurfaceView(true);
    }
  }, [policy.subsurface]);

  // --- Compute live studio data (replaces hardcoded sample utilities) ---
  const liveData = useMemo(
    () =>
      computeLiveStudioData({
        bydaAssets,
        trenches: constructionTrenches,
        irrigationZones,
        levels,
        easements: easementsPct ?? [],
        // The frame's APWA service lines are not yet plumbed to the WebGL
        // mount; BYDA utilities already cover gas via the utility path.
        services: [],
        scaleM,
        boardAspect,
      }),
    [bydaAssets, constructionTrenches, irrigationZones, levels, easementsPct, scaleM, boardAspect],
  );

  // --- Autosave (debounced + retry + backoff) ---
  const storePhotoElevations = useStudioStore((s) => s.photoElevations);
  const storeSetbackLines = useStudioStore((s) => s.setbackLines);
  const storeBuildingFootprints = useStudioStore((s) => s.buildingFootprints);
  const autosaveDoc = useMemo(
    () => ({
      placements: storePlacements,
      strokes,
      constructionTrenches: storeTrenches,
      irrigationZones: storeZones,
      photoElevations: storePhotoElevations,
      features: storeFeatures,
      canvases: storeCanvases,
      setbackLines: storeSetbackLines,
      buildingFootprints: storeBuildingFootprints,
    }),
    [storePlacements, strokes, storeCanvases, storeTrenches, storeZones, storePhotoElevations, storeFeatures, storeSetbackLines, storeBuildingFootprints],
  );
  useStudioAutosave(projectId, autosaveDoc);
  useBeforeUnloadGuard();

  const is3D = viewBlendTarget > 0.5;
  /* Quantised to 5-degree steps — the same trick ViewportTransitionHUD uses to
     keep an orbit gesture at ~18 re-renders instead of one per frame. */
  const pitchQuant = useStudioStore((s) =>
    Math.round(s.liveRig.tiltDeg / 5) * 5,
  );

  // Pads exist ⇔ any committed stroke OR any drafted region carries an
  // extrusion height — gates the Earth toggle + EarthworksCard. Both sources
  // are pads by cutFill's single definition (spec §8.1), so the gate must see
  // both or an elevated Area would analyse with no way to view it.
  const annotationControl = useMemo(
    () =>
      activeMode === "survey"
        ? {
          dialect: surveyAnnotationDialect,
          setDialect: setSurveyAnnotationDialect,
          layers: surveyedPlanLayers,
          setLayers: setSurveyedPlanLayers,
          tradePacks: surveyTradePacks,
          setTradePacks: setSurveyTradePacks,
        }
        : activeMode === "cad"
          ? {
            dialect: cadAnnotationDialect,
            setDialect: setCadAnnotationDialect,
            layers: cadAnnotationLayers,
            setLayers: setCadAnnotationLayers,
            tradePacks: cadTradePacks,
            setTradePacks: setCadTradePacks,
          }
          : activeMode === "sketch"
            ? {
              dialect: sketchAnnotationDialect,
              setDialect: setSketchAnnotationDialect,
              layers: sketchAnnotationLayers,
              setLayers: setSketchAnnotationLayers,
              tradePacks: sketchTradePacks,
              setTradePacks: setSketchTradePacks,
            }
            : null,
    [
      activeMode,
      surveyAnnotationDialect,
      setSurveyAnnotationDialect,
      surveyedPlanLayers,
      setSurveyedPlanLayers,
      cadAnnotationDialect,
      setCadAnnotationDialect,
      cadAnnotationLayers,
      setCadAnnotationLayers,
      sketchAnnotationDialect,
      setSketchAnnotationDialect,
      sketchAnnotationLayers,
      setSketchAnnotationLayers,
      surveyTradePacks,
      setSurveyTradePacks,
      cadTradePacks,
      setCadTradePacks,
      sketchTradePacks,
      setSketchTradePacks,
    ],
  );

  // Scan choreography (mirror of StudioScene's build — same props, pure) —
  // drives the post-import reveal clock and the overlay's REAL stage labels.
  const scanChoreography = useMemo(
    () =>
      buildScanChoreography({
        boundaryPts: boundaryPct.length,
        buildingCount: buildingPct && buildingPct.length >= 3 ? 1 : 0,
        neighbourCount: neighbourBuildings.length,
        easementCount: easementsPct?.length ?? 0,
        serviceLineCount: bydaAssets.length,
        hasTerrain: liveData.heightmapPoints.length >= 3,
        contourRingCount: keylessOverlays.filter((o) => o.kind === "contour").length,
        treeCount: studioItems.filter(
          (i) => i.t === "canopy" || i.t === "feature" || i.t === "exist",
        ).length,
      }),
    [boundaryPct, buildingPct, neighbourBuildings, easementsPct, bydaAssets, liveData.heightmapPoints, keylessOverlays, studioItems],
  );
  // The reveal clock: the import armed `gs-scan-reveal` before its reload;
  // on this mount, walk the choreography through the store so the scene
  // director animates each category and the overlay shows true stages.
  // Mount-once by design: the choreography memo's inputs churn identity
  // during hydration, and a dep-driven effect would cancel its own timers
  // before the first stage fires. The ref carries the latest plan; for the
  // reveal path the data is already in the server props at mount.
  const choreoRef = useRef(scanChoreography);
  useEffect(() => {
    choreoRef.current = scanChoreography;
  }, [scanChoreography]);
  useEffect(() => {
    let armed: boolean;
    try {
      armed = sessionStorage.getItem("gs-scan-reveal") === "1";
    } catch {
      armed = false;
    }
    if (!armed) return;
    const scanPlan = choreoRef.current;
    if (!scanPlan) return;
    // NOTE: the flag is consumed only when the reveal COMPLETES — a
    // StrictMode double-mount cancels the first timer chain via cleanup,
    // and the second mount must still find the flag armed.
    const timers: number[] = [];
    let at = 300;
    for (const e of scanPlan.events) {
      timers.push(
        window.setTimeout(
          () => useStudioStore.getState().setScanStage(e.stage),
          at,
        ),
      );
      at += e.durationMs;
    }
    timers.push(
      window.setTimeout(() => {
        useStudioStore.getState().setScanStage("done");
        try {
          sessionStorage.removeItem("gs-scan-reveal");
        } catch {
          // best effort only
        }
      }, at + 200),
    );
    return () => {
      for (const t of timers) window.clearTimeout(t);
    };
  }, []);
  // Live scan state (post-reload reveal) keeps the overlay up with real stages.
  const scanRevealActive = useStudioStore(
    (s) => s.scanStage !== "idle" && s.scanStage !== "done",
  );

  // Scene props shared by the single studio and both split halves.
  const sceneProps = {
    scaleM,
    boardAspect,
    boundaryPct: visibleLayers.siteTruth ? boundaryPct : [],
    buildingPct: visibleLayers.siteTruth ? buildingPct : undefined,
    easementsPct: visibleLayers.siteTruth ? easementsPct : [],
    servicesPct: visibleLayers.siteTruth
      ? bydaAssets.map((asset) =>
        asset.ring.map((point) => ({ x: point.x_pct, y: point.y_pct })),
      )
      : [],
    items: visibleLayers.design ? items : [],
    subsurfaceUtilities: liveData.subsurfaceUtilities,
    strikeAlerts: liveData.strikeAlerts,
    lens: presentationMode ? PRESENTATION_LENS : TECHNICAL_LENS,
    growthFactor,
    lat,
    lng,
    sunMin,
    heightmapPoints: liveData.heightmapPoints,
    keylessOverlays: visibleLayers.siteTruth ? keylessOverlays : [],
    neighbourBuildings: visibleLayers.siteTruth ? neighbourBuildings : [],
    showSketch: visibleLayers.sketch,
    layerPolicy: policy,
    mode: activeMode,
    siteMeta,
    northBearingDeg,
    levels,
    placements: storePlacements,
    features: storeFeatures,
    annotationDialect: annotationControl?.dialect,
    tradePacks:
      annotationControl?.tradePacks ?? {
        irrigationDrainage: false,
        hardscapeConstruction: false,
        lightingElectrical: false,
      },
    constructionTrenches: storeTrenches,
    irrigationZones: storeZones,
    annotationLayers:
      annotationControl == null
        ? {
          enabled: false,
          bearings: false,
          elevations: false,
          plants: false,
          materials: false,
          callouts: false,
          scope: false,
        }
        : {
          ...annotationControl.layers,
          enabled:
            annotationControl.layers.enabled &&
            (activeMode === "survey" || activeMode === "cad" || activeMode === "sketch"),
        },
    onGroundClick: handleGroundClick,
    onContextLost: () => {
      setWebglLost(true);
      // Studio error path — a lost WebGL context is a real device/GPU failure.
      void import("../../../lib/sentry").then(({ captureWebError }) =>
        captureWebError(new Error("WebGL context lost"), {
          boundary: "webgl",
          projectId,
        }),
      );
    },
  } as const;

  useEffect(() => {
    const loadDialect = (
      key: string,
      setDialect: (value: "technical" | "architectural" | "creative" | "hybrid") => void,
    ) => {
      const saved = sessionStorage.getItem(key);
      if (
        saved === "technical" ||
        saved === "architectural" ||
        saved === "creative" ||
        saved === "hybrid"
      ) {
        setDialect(saved);
      }
    };
    loadDialect(`survey-communication-dialect-${projectId}`, setSurveyAnnotationDialect);
    loadDialect(`cad-communication-dialect-${projectId}`, setCadAnnotationDialect);
    loadDialect(`sketch-communication-dialect-${projectId}`, setSketchAnnotationDialect);
  }, [
    projectId,
    setSurveyAnnotationDialect,
    setCadAnnotationDialect,
    setSketchAnnotationDialect,
  ]);

  useEffect(() => {
    sessionStorage.setItem(
      `survey-communication-dialect-${projectId}`,
      surveyAnnotationDialect,
    );
    sessionStorage.setItem(`cad-communication-dialect-${projectId}`, cadAnnotationDialect);
    sessionStorage.setItem(
      `sketch-communication-dialect-${projectId}`,
      sketchAnnotationDialect,
    );
  }, [
    projectId,
    surveyAnnotationDialect,
    cadAnnotationDialect,
    sketchAnnotationDialect,
  ]);

  /* ---------------------------------------------------------------- *
   * Canvas-First Layout (Module 1 / 2 / 3) — wires the four-slot z-stack
   * over the WebGL canvas and exposes an off-screen mirror tree for
   * screen-reader users. Bridge callbacks only carry shallow primitives
   * (vectors / flat config) — the math layer pulls them on its RAF tick.
   *
   * Hook order contract: every hook below MUST run before any conditional
   * return — including the `webgl unavailable` early exit.
   * ---------------------------------------------------------------- */

  const liveFeatures = useStudioStore((s) => s.features);
  const livePlacements = useStudioStore((s) => s.placements);

  const spatialGraph: SpatialGraphNode[] = useMemo(() => {
    const out: SpatialGraphNode[] = [];
    // Site frame first — the keyboard engine's Home key lands on the title
    // boundary, the drawing's anchor (click-selection parity: boundary and
    // building are pickable, so they must be arrow-key reachable too).
    if (boundaryPct.length >= 3) {
      out.push({
        id: "boundary:site-boundary",
        label: "Title boundary",
        level: 1,
        graphicKind: "object",
      });
    }
    if ((buildingPct ?? []).length >= 3) {
      out.push({
        id: "building:site-building",
        label: "Building footprint",
        level: 1,
        graphicKind: "object",
      });
    }
    for (const f of liveFeatures) {
      const layer = f.metadata?.layer ?? "feature";
      out.push({
        id: `feature:${f.id}`,
        label: f.metadata?.friendly_name?.trim() || `${layer} ${f.id.slice(-4)}`,
        level: 1,
        graphicKind: "object",
      });
    }
    for (const p of livePlacements) {
      const sym = p.symbol_id ?? "asset";
      out.push({
        id: `placement:${p.id}`,
        label: getCatalogSymbol(sym)?.label ?? sym,
        level: 2,
        graphicKind: "symbol",
      });
    }
    return out;
  }, [liveFeatures, livePlacements, boundaryPct, buildingPct]);

  const activeSelectionId =
    selection[0] != null
      ? `${selection[0].kind}:${selection[0].id}`
      : null;

  const onSpatialSelect = useCallback((compositeId: string) => {
    const sep = compositeId.indexOf(":");
    const [kind, id] =
      sep < 0
        ? [compositeId, ""]
        : [compositeId.slice(0, sep), compositeId.slice(sep + 1)];
    if (kind !== "feature" && kind !== "placement" && kind !== "boundary" && kind !== "building") {
      return;
    }
    useStudioStore.getState().selectRef(
      kind === "boundary"
        ? { kind: "boundary", id: "site-boundary" }
        : kind === "building"
          ? { kind: "building", id: "site-building" }
          : ({ kind, id } as SelectionRef),
      { additive: false },
    );
  }, []);

  const bridge: CanvasBridge = useMemo(
    () => ({
      onCameraReset: () => {
        writeLiveRig({ ...DEFAULT_CAMERA_RIG });
      },
      onScalar: (patch) => {
        const next = useStudioStore.getState().liveRig;
        if ("zoom" in patch) {
          writeLiveRig({ ...next, zoom: patch.zoom });
        }
      },
    }),
    [writeLiveRig],
  );

  /* Canvas slot — owns the draw cursor + grab/grabbing toggle while the
   * drawing owns the middle. Lives at z-0 per the SDS z-stack; chrome
   * sits on top in a sibling slot. */
  const canvasSlot = (
    <div
      style={{ position: "absolute", inset: 0 }}
      onPointerDown={(e) => {
        if (
          e.target instanceof HTMLElement &&
          (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable)
        ) return;
        if (drawCursor === "grab") e.currentTarget.style.cursor = "grabbing";
      }}
      onPointerUp={(e) => { e.currentTarget.style.cursor = drawCursor; }}
      onPointerLeave={(e) => { e.currentTarget.style.cursor = drawCursor; }}
      onDragOver={(e) => {
        if (
          e.dataTransfer.types.includes("text/plain") ||
          e.dataTransfer.types.includes("application/x-workstream-symbol")
        ) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        const symbolId =
          e.dataTransfer.getData("application/x-workstream-symbol") ||
          e.dataTransfer.getData("text/plain");
        if (!symbolId) return;
        useStudioStore.getState().setPendingAssetDrop({
          symbolId,
          clientX: e.clientX,
          clientY: e.clientY,
        });
      }}
    >
      {/* The render surface: ONE studio, or the split lens (locked plan |
          live 3D, linked cameras). The DOM chrome overlays whichever is
          mounted — one chrome, two viewports. */}
      <StudioSurfaceErrorBoundary
        tone="canvas"
        areaLabel="Canvas surface"
        title="Unable to render canvas view"
        detail="The WebGL drawing surface hit a render exception. Chrome tools and saved data are still available while you retry."
        testId="webgl-canvas-boundary-fallback"
      >
        {splitView ? (
          <SplitViewLens sceneProps={sceneProps} />
        ) : (
          <WebGLStudioReady onReady={handleStudioReady} {...sceneProps} />
        )}
      </StudioSurfaceErrorBoundary>

      {/* Site-truth parsing overlay — covers the blank canvas while the
          quiet Vicmap bootstrap reads the cadastre on first load. Waits for
          the WebGL surface so "Opening canvas" and this announce in sequence,
          never as two live regions at once. */}
      {importingSiteTruth && (studioReady || splitView) && (
        <StudioCanvasLoading
          label="Importing site truth"
          testId="studio-canvas-loading-import"
          detail={projectAddress.trim() ? projectAddress : undefined}
          stages={[
            "Reading cadastre",
            "Tracing title boundary",
            "Placing easements and levels",
          ]}
        />
      )}

      {/* Mode cross-fade — a 150 ms paper veil keyed by mode. */}
      <div
        key={`mode-fade-${activeMode}`}
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: "var(--cf-z-spatial)",
          background: "var(--ws-canvas)",
          animation: "gsModeFadeOut 150ms ease-out forwards",
        }}
      />

      {/* AI parsing-stage transitions — site-truth import (Survey) and the
          drafter's ghost generation / assist (CAD). Null when idle; the
          overlay is ambient (wash tier) so chrome stays interactive above. */}
      <AiScanOverlay
        active={truthBusy || scanRevealActive}
        label="Importing site truth"
        stages={
          scanChoreography
            ? scanChoreography.events.map((e) => e.label)
            : ["Reading cadastre", "Tracing title boundary", "Placing easements and levels"]
        }
        stageTestIds={
          scanChoreography
            ? scanChoreography.events.map((e) => `scan-stage-${e.stage}`)
            : undefined
        }
        testId="ai-scan-overlay-import"
      />
      <AiScanOverlay
        active={aiScanKey === "generate" || aiScanKey === "assist"}
        label={aiScanKey === "assist" ? "Thinking about this site" : "AI drafting ghosts"}
        stages={
          aiScanKey === "assist"
            ? ["Parsing the question", "Checking site geometry"]
            : ["Reading lot geometry", "Segmenting canopy", "Drafting proposals"]
        }
        testId="ai-scan-overlay-draft"
      />
    </div>
  );

  /* App slot — global application elements (Cmd-K command palette, share
   * takeover, present deck) that must always sit ABOVE the chrome tier
   * (z=20) so they can dim/scrim-over peripheral UI without competing
   * with on-canvas pointer events. Inline `zIndex` overrides stripped:
   * the wrapper owns the stack. */
  const appSlot = (
    <>
      {/* Command palette — the power-operator surface (Cmd/Ctrl+K). */}
      <StudioCommandPalette
        open={paletteOpen}
        onClose={() => {
          /* No project loaded — nothing else to see behind the picker, so
           * keep it up until the operator chooses or creates a site. */
          if (projectId === "") return;
          setPaletteOpen(false);
        }}
        projectId={projectId}
        unlocked={unlocked}
        onMode={(m) => onNativeMode(m as Parameters<typeof onNativeMode>[0])}
        onZoom={(dir) => zoomBy(dir === 1 ? 1 : -1)}
        onOpenSitePhotos={() => { }}
      />
      <StudioShortcutsHelp
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />

      {/* Native share — client portal promotion, centered glass. */}
      {activeMode === "share" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "auto",
            background: "color-mix(in srgb, var(--ws-canvas) 55%, transparent)",
          }}
        >
          <div style={{ width: "min(460px, 92vw)" }}>
            <ShareSurface
              projectId={projectId}
              verificationUnavailable={cadGhostCount === null}
              draftUnverified={(cadGhostCount ?? 0) > 0}
              pendingGhosts={cadGhostCount ?? 0}
              quotePersisted={quotePersisted}
              portalUri={portalUri}
              onQuotePersisted={(uri) => {
                setQuotePersisted(true);
                setPortalUri(uri);
              }}
              onReviewGhosts={() => setActiveMode("cad")}
              onBack={() => onNativeMode("cad")}
            />
          </div>
        </div>
      )}

      {/* Native present — the classic PresentSurface deck as full-bleed
          chrome over the presentation lens (ARCHITECTURE §5: the feature
          module consumes the new shell). Owns the surface while
          presenting; Back exits to CAD. */}
      {presentationMode && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "auto",
          }}
        >
          <PresentSurface
            projectId={projectId}
            imageLayers={[]}
            planSnapshot={presentPlanSnapshot}
            estimate={null}
            materials={[]}
            onBack={() => onNativeMode("cad")}
          />
        </div>
      )}
    </>
  );

  /* ------------------------------------------------------------------ *
   * UnifiedPanel bodies — the retired hidden dock's surfaces, composed
   * here (the studio scope owns the state they read) and rendered by
   * the UnifiedPanel's context router: an open meta surface owns the
   * dialog slot, mode bodies stack below any live selection.
   * ------------------------------------------------------------------ */  if (webglAvailable === false || webglLost) {
    return (
      <div
        role="alert"
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          padding: 24,
          background: "var(--ws-canvas)",
          color: "var(--ws-ink)",
          fontFamily: "var(--font-ui)",
        }}
      >
        <div
          style={{
            width: "min(420px, 100%)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--ws-space-5)",
            padding: 20,
            borderRadius: "var(--ws-radius-3)",
            background: "var(--ws-panel)",
            border: "1px solid var(--ws-line)",
          }}
        >
          <h1 style={{ margin: 0, fontSize: "var(--ws-text-xl)" }}>3D canvas unavailable</h1>
          <p style={{ margin: 0, color: "var(--ws-ink-secondary)" }}>
            The graphics context is unavailable or was interrupted. Your saved
            drawing is unchanged.
          </p>
          <div style={{ display: "flex", gap: "var(--ws-space-4)", flexWrap: "wrap" }}>
            <Button
              variant="cta"
              onClick={() => window.location.reload()}
              style={{
                minHeight: 40,
                padding: "0 12px",
                // The alert card inherits the body font (--text-base /
                // weight 400); null the CTA base so the button inherits
                // exactly as the prior inline button did.
                fontSize: undefined,
                fontWeight: undefined,
              }}
            >
              Reload canvas
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Design-content gate — true once any ink, placement, or feature exists.
  // Used by the guided first-sketch hint, which retires when content lands.
  const hasDesignContent =
    strokes.length > 0 ||
    storePlacements.length > 0 ||
    storeFeatures.length > 0;
  // Guided first-sketch handoff: once the title boundary is set and the board
  // is still empty in Sketch, the studio arms the pen and shows a one-line
  // prompt (<first-move-hint>) instead of asking the operator to pick a move.
  // The hint waits for the WebGL surface so it never overlaps the "Opening
  // canvas" loader card.
  const guideSketchActive =
    guideFirstSketch({
      boundaryPointCount: boundaryPct.length,
      hasDesignContent,
      mode: activeMode,
      isE2e: process.env.NEXT_PUBLIC_E2E === "1",
    }) && studioReady;

  return (
    <CanvasFirstLayout
      style={{ position: "absolute", cursor: drawCursor }}
      onPointerDown={(e) => {
        if (
          e.target instanceof HTMLElement &&
          (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable)
        ) return;
        if (drawCursor === "grab") (e.currentTarget as HTMLElement).style.cursor = "grabbing";
      }}
      onPointerUp={(e) => { (e.currentTarget as HTMLElement).style.cursor = drawCursor; }}
      onPointerLeave={(e) => { (e.currentTarget as HTMLElement).style.cursor = drawCursor; }}
      ariaLabel="Design canvas — operator studio"
      bridge={bridge}
      spatialGraph={spatialGraph}
      activeId={activeSelectionId}
      onSelect={onSpatialSelect}
      canvas={canvasSlot}
      app={appSlot}
    >
      {/* ---- The chrome overlay (pointer-transparent; children opt in) ---- */}
      {/* The committed camera state is stamped here so it is observable at all.
          It was previously readable only from the Plan/3D control inside the
          Studio meta panel and the projection HUD's presets — both summoned,
          both absent in some modes — which is why "the camera opens oblique in
          every mode" survived unnoticed. `data-view-blend` is the committed
          plan/3D target and `data-pitch-deg` the quantised live rig pitch: if
          those two ever disagree at rest, the divergence is visible in the DOM
          rather than only in what the operator sees. */}
      <div
        data-webgl-chrome
        data-mode={activeMode}
        data-view-blend={is3D ? "3d" : "plan"}
        data-pitch-deg={pitchQuant}
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      >
        {/* Atmospheric vignette — matches the 3D post-processing, fades with blend */}
        <VignetteOverlay />

        {/* Spatial Sketching -- floating liquid-glass chrome (depth rail,
            handedness/mode toggles, readout). Mirrors with handedness. */}
        <FloatingChrome
          scaleM={scaleM}
          unscaled={unscaled}
          boardAspect={boardAspect}
          northBearingDeg={northBearingDeg}
          heightmapPoints={liveData.heightmapPoints}
          mode={activeMode}
          projectId={projectId}
          keylessOverlays={visibleLayers.siteTruth ? keylessOverlays : []}
          easementRingCount={visibleLayers.siteTruth ? easementsPct?.length ?? 0 : 0}
          canopy={canopyCompliance}
          strikeAlerts={liveData.strikeAlerts}
          onRetrySiteTruth={() => void runSiteTruthImport()}
        />

        {/* Floating cursor toolbar — shows when an asset is armed */}
        <FloatingPlacementToolbar />

        {/* Ghost overlay — AI-generated placements as translucent markers. */}
        <GhostOverlay scaleM={scaleM} boardAspect={boardAspect} />

        {/* Photo-trace HUD — the only chrome while a photo is pinned. */}
        <PhotoTraceHud />
        {/* Photo elevation sheet — the trace's print artifact. */}
        {photoSheetId ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "auto",
              zIndex: "var(--cf-z-chrome)",
            }}
          >
            <PhotoElevationSheet
              elevationId={photoSheetId}
              onClose={() => setPhotoSheetId(null)}
            />
          </div>
        ) : null}

        {/* Survey locate state — the canvas is genuinely empty until the title
          boundary lands, so name the property instead of showing a flat fill. */}
        {activeMode === "survey" && boundaryPct.length < 3 ? (
          <SurveyLocateState address={projectAddress} />
        ) : null}

        {/* Guided first-sketch hint — boundary set, board empty: the pen is
            armed and this one line states the next move. Non-blocking so it
            never intercepts a draw; retires as soon as content lands. */}
        {guideSketchActive ? (
          <div
            role="note"
            aria-label="Start sketching"
            data-testid="first-move-hint"
            style={{
              position: "absolute",
              left: 72,
              right: 336,
              top: 152,
              bottom: 80,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
              zIndex: "var(--cf-z-chrome)",
              textAlign: "center",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "var(--ws-space-3)",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-ui)",
                  fontSize: "var(--ws-text-md)",
                  fontWeight: 600,
                  color: "var(--ws-ink)",
                }}
              >
                Draw
              </span>
              <span
                style={{
                  fontFamily: "var(--font-ui)",
                  // Was 10.5px `--ws-ink-muted` (#8A8A8A), which measures
                  // 5.73:1 on the studio ground — already past AA, so the
                  // contrast was not the problem; 10.5px for the only
                  // instruction on an empty canvas was. One step up the
                  // ladder, and `--ws-ink-secondary` takes it to ~7.8:1 (AAA)
                  // for the same cost.
                  fontSize: "var(--ws-text-xs)",
                  color: "var(--ws-ink-secondary)",
                  maxWidth: 320,
                }}
              >
                Your strokes land on the ground plane
              </span>
            </div>
          </div>
        ) : null}

        {/* Schedule sheet — the one light surface (spec 6b / 9.1). Every
            number derives from board geometry through the domain builders;
            nothing is stored. Opens via Cmd+K -> Schedule sheet. */}
        {scheduleOpen && (
          <ScheduleSheet
            scaleM={scaleM}
            canopy={
              canopyCompliance &&
                canopyCompliance.assessment.status !== "insufficient-data"
                ? {
                  provided: canopyCompliance.assessment.matureProvided,
                  required: canopyCompliance.assessment.required,
                }
                : null
            }
            onClose={() => useStudioStore.getState().setScheduleOpen(false)}
          />
        )}

        {/* Phase Q — sheet composition modal (spec 18a). Live viewports,
            auto legend, title block, issue PDF. */}
        {sheetComposerOpen && (
          <SheetComposer
            onClose={() => useStudioStore.getState().setSheetComposerOpen(false)}
          />
        )}

        {/* Phase R — office template panel (spec 17a/17b). Conventions,
            binding, overrides and the version offer. */}
        {templatePanelOpen && (
          <OfficeTemplatePanel
            onClose={() => useStudioStore.getState().setTemplatePanelOpen(false)}
          />
        )}
      </div>
    </CanvasFirstLayout>
  );
}


/**
 * Survey locate state — shown while the title boundary is still missing.
 *
 * The canvas has nothing to draw before the import lands, and a bare fill
 * reads as a broken screen. This names the property being set up. It is
 * bounded by the left gutter and the right dock rather than centred on the
 * whole viewport, so it cannot land under either.
 */
function SurveyLocateState({ address }: { address?: string | null }) {
  return (
    <div
      data-testid="survey-locate-state"
      aria-hidden
      style={{
        position: "absolute",
        left: 72,
        /* Clear of the flush UnifiedPanel (320px + 16px gutter). */
        right: 336,
        top: 152,
        bottom: 80,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--ws-space-3)",
        pointerEvents: "none",
        zIndex: "var(--cf-z-chrome)",
        textAlign: "center",
      }}
    >
      <svg
        width="34"
        height="34"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--ws-ink-muted)"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z" />
        <circle cx="12" cy="10" r="2.4" />
      </svg>
      <span
        style={{
          fontFamily: "var(--font-tech)",
          fontSize: "var(--ws-text-md)",
          letterSpacing: "0.02em",
          color: "var(--ws-ink-secondary)",
          maxWidth: 320,
        }}
      >
        {address?.trim() ? address : "Locating the property"}
      </span>
      <span
        style={{
          fontFamily: "var(--font-ui)",
          fontSize: "var(--ws-text-xs)",
          color: "var(--ws-ink-muted)",
        }}
      >
        Import site truth to draw the title boundary
      </span>
    </div>
  );
}


