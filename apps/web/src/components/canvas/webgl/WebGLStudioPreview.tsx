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
  type ReactNode,
} from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import type {
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
} from "@workstream/contracts";
import { getCatalogSymbol } from "@workstream/domain";
import { VignetteOverlay } from "./VignetteOverlay";
import { SaveStatusChip } from "./SaveStatusChip";
import {
  DEFAULT_CAMERA_RIG,
  GARDEN_PITCH_DEG,
  OBLIQUE_PITCH_DEG,
  modeArmsDims,
  modeEntryPitchDeg,
  type StudioCameraRig,
} from "./cameraRig";
import { pctToWorld, type PctPoint } from "./coordTransform";
import { PRESENTATION_LENS, TECHNICAL_LENS } from "./PresentationLens";
import {
  useStudioStore,
  leafStatus,
  melbourneSeasonFromSun,
} from "./studioStore";
import {
  SUN_DATE_PRESETS,
  sunDatePresetLabel,
} from "../handoff/features/sunGrowth/sunDatePreset";
import { draftAreaM2, draftRunLengthM } from "./draftShape";
import { useStudioAutosave, useBeforeUnloadGuard } from "./useStudioAutosave";
import { computeLiveStudioData } from "./canvasBridges";
import { SliceProfileCard } from "./SliceProfileCard";
import { DrainageFlowCard } from "./DrainageFlowCard";
import { EarthworksCard } from "./EarthworksCard";
import { EstimatorPanel } from "./EstimatorPanel";
import { AssetLibraryPanel } from "./AssetLibraryPanel";
import { FloatingPlacementToolbar } from "./FloatingPlacementToolbar";
import { StudioToolRail } from "./StudioToolRail";
import { Button } from "./Button";
// import { NibPalette } from "./NibPalette"; // stripped (austerity)
import { PerimeterTabStrip, type MetaTabId } from "./PerimeterTabStrip";
import { canvasLayerPolicy } from "./layerPolicy";
import { importSiteTruth } from "./siteTruthImport";
import { StudioCommandPalette } from "./StudioCommandPalette";
// import { StudioElevationCard } from "./StudioElevationCard"; // stripped (austerity)
import { StudioCadCard } from "./StudioCadCard";
import { AiScanOverlay } from "./AiScanOverlay";
import { InspectorCard } from "./InspectorCard";
import { SitePhotoGallery } from "./SitePhotoGallery";
import { PhotoTraceHud } from "./PhotoTraceHud";
import { PhotoElevationSheet } from "./PhotoElevationSheet";
import { SplitViewLens } from "./SplitViewLens";
// import { ViewportTransitionHUD } from "./ViewportTransitionHUD"; // stripped (austerity)
import { StudioSurfaceErrorBoundary } from "./StudioSurfaceErrorBoundary";
import { placementsToItems, featuresOntoItems } from "../handoff/state/canvasBridge";
import { buildCanopyCompliance } from "./canopyCompliance";
import { buildScanChoreography } from "./scanChoreography";
import { toRenderItems } from "./stateBridge";
import { SketchCadReviewCard } from "./SketchCadReviewCard";
import { UnifiedPanel } from "./UnifiedPanel";
import {
  nearestFeatureId,
  nearestPlacementId,
  boundaryHitTest,
  buildingHitTest,
} from "./selectionPick";
import { suggestedMode, unlockedModes, type CanvasMode, type CanvasProgress } from "../../../lib/canvas-mode";
import { interactionGuidance } from "./interactionGuidance";
import { StudioShortcutsHelp } from "./StudioShortcutsHelp";
import { isTypingTarget, resolveStudioShortcut } from "./studioShortcuts";
import { SiteContextBadges } from "../../SiteContextBadges";
import { GardenViewpointStrip } from "../handoff/features/viewpoint/GardenViewpointStrip";
import { viewpointYawDeg, type GardenViewpointLook } from "../handoff/features/tilt/tiltMath";
import { SurveySetupPanel } from "./SurveySetupPanel";
import { buildSurveySetup } from "./surveySetup";
import { useMediaQuery } from "../../../hooks/useMediaQuery";
import { ShareSurface } from "../handoff/features/share/ShareSurface";
import { PresentSurface } from "../handoff/features/present/PresentSurface";
import { deriveSurveyedPlanModel } from "./annotations/derive";
import { deriveTradePackModel } from "./annotations/tradeDerive";
import { SurveyCommunicationCard } from "./annotations/SurveyCommunicationCard";
import { communicationProfileForMode } from "./annotations/modeProfile";

/** Day arc bounds — same as the 2D SunGrowthDock (~06:20 → ~19:40). */
const DAY_START = 6 * 60 + 20;
const DAY_END = 19 * 60 + 40;

// R3F Canvas requires the browser — dynamic import with ssr:false
const WebGLStudio = dynamic(() => import("./WebGLStudio").then((m) => m.WebGLStudio), {
  ssr: false,
  loading: () => (
    <div style={{ position: "absolute", inset: 0, background: "var(--gs-canvas)" }} />
  ),
});
import { CanvasFirstLayout } from "./CanvasFirstLayout";
import type { CanvasBridge, SpatialGraphNode } from "./CanvasFirstLayout";
import { CfzTierInspector } from "./CfzTierInspector";
import type { SelectionRef } from "./selectionPick";

export interface WebGLStudioPreviewProps {
  projectId: string;
  scaleM: number;
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
  boardAspect,
  boundaryPct,
  buildingPct,
  easementsPct,
  lat,
  lng,
  projectAddress = "",
  initialStrokes,
  placements: initialPlacements = [],
  initialFeatures: initialFeaturesProp = [],
  photoElevations: initialPhotoElevations = [],
  bydaAssets = [],
  constructionTrenches = [],
  irrigationZones = [],
  levels = [],
  keylessOverlays = [],
  neighbourBuildings = [],
  outdoorM2 = 0,
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
  const [metaTab, setMetaTab] = useState<MetaTabId | null>(null);
  /** The open photo elevation sheet (print artifact) — null = closed. */
  const [photoSheetId, setPhotoSheetId] = useState<string | null>(null);
  const _fitSheetOpen = useStudioStore((s) => s.fitSheetOpen);
  const router = useRouter();

  // Escape closes the open surface panel (browser-tab behaviour).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && metaTab) setMetaTab(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [metaTab]);
  const [cadGhostCount, setCadGhostCount] = useState<number | null>(
    initialCadGhostCount,
  );
  const [quotePersisted, setQuotePersisted] = useState(hasQuote);
  const [portalUri, setPortalUri] = useState<string | null>(quotePortalUri);
  const [visibleLayers, setVisibleLayers] = useState({
    sketch: true,
    siteTruth: true,
    design: true,
  });
  const [webglAvailable, setWebglAvailable] = useState<boolean | null>(null);
  const [webglLost, setWebglLost] = useState(false);

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

  /* Tablet tier (design-spec debt D4): below 1100px the right dock narrows
   * and can be collapsed entirely — a fixed 360px column swallows ~half a
   * 768px drawing. Collapsed state reclaims the full canvas behind a small
   * reopen pill; the dock defaults open so the chrome-collision spec's
   * visible-panels states are unchanged. */
  const [dockCollapsed, setDockCollapsed] = useState(false);

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
  const [signedOff, setSignedOff] = useState(false);
  const [signoffLoading, setSignoffLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    import("../../../app/actions")
      .then(({ getSignoffAction }) => getSignoffAction(projectId))
      .then((res) => {
        if (cancelled) return;
        setSignedOff(res?.signoff != null);
      })
      .catch(() => {
        if (!cancelled) setSignedOff(false);
      })
      .finally(() => {
        if (!cancelled) setSignoffLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

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

  const onNativeMode = useCallback((mode: CanvasMode) => {
    setActiveMode(mode);
    setMetaTab(null);
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
    // survey / share / elevation mount their glass cards on activeMode.
  }, [applyModeCamera]);

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
  const setYear = useStudioStore((s) => s.setGrowthYear);
  const growthFactor = year / 10;
  const sunMin = useStudioStore((s) => s.sunMin);
  const setSunMin = useStudioStore((s) => s.setSunMin);
  const seasonProgress = useStudioStore((s) => s.seasonProgress);
  const sunDatePreset = useStudioStore((s) => s.sunDatePreset);
  const setSunDatePreset = useStudioStore((s) => s.setSunDatePreset);
  const suncastView = useStudioStore((s) => s.suncastView);
  const setSuncastView = useStudioStore((s) => s.setSuncastView);
  const seasonMeta = useMemo(
    () => melbourneSeasonFromSun(sunDatePreset, sunMin),
    [sunDatePreset, sunMin],
  );
  const viewBlendTarget = useStudioStore((s) => s.viewBlendTarget);
  const setPitchDeg = useStudioStore((s) => s.setPitchDeg);
  const canUndo = useStudioStore((s) => s.historyPast.length > 0);
  const canRedo = useStudioStore((s) => s.historyFuture.length > 0);
  const subsurfaceView = useStudioStore((s) => s.subsurfaceView);
  const strokes = useStudioStore((s) => s.sketchStrokes);
  const sketchModeActive = useStudioStore((s) => s.sketchMode);
  // Sketch → CAD — the tidy proposal set + review state (Part A).
  const cadProposals = useStudioStore((s) => s.cadProposals);
  const cadReviewOpen = useStudioStore((s) => s.cadReviewOpen);
  const sketchCadNotice = useStudioStore((s) => s.sketchCadNotice);
  const stitchNotice = useStudioStore((s) => s.stitchNotice);
  const dismissStitchNotice = useStudioStore((s) => s.dismissStitchNotice);
  const setCadReviewOpen = useStudioStore((s) => s.setCadReviewOpen);
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
  }, [initialStrokes, initialPlacements, initialFeaturesProp, constructionTrenches, irrigationZones, initialPhotoElevations, projectId, projectAddress, initialSketchMode, boundaryPct, buildingPct, hydratedRef]);

  // Quiet site-truth bootstrap — the canvas foundation is the authoritative
  // Vicmap boundary + building envelope, not an aerial photo. When a
  // geocoded project opens with no boundary yet, trace it once per session
  // (same flow as the explicit Import button) and reload into the vectors.
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_E2E === "1") return; // e2e seeds its own state
    if (boundaryPct.length >= 3 || lat == null || lng == null) return;
    const key = `gs-truth-autotrace-${projectId}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    void (async () => {
      try {
        const canvasRes = await fetch(`/api/projects/${projectId}/design-canvas`);
        if (!canvasRes.ok) return;
        const canvasJson = (await canvasRes.json()) as {
          canvas: import("@workstream/contracts").DesignCanvas | null;
        };
        const r = await importSiteTruth(projectId, canvasJson.canvas ?? null);
        if ((r.boundaryPts ?? 0) > 0) router.refresh();
      } catch {
        // Quiet by design — the explicit Import button reports errors.
      }
    })();
  }, [projectId, boundaryPct, lat, lng, router]);

  // Placements live in the store after hydration — the live source for both
  // the 3D items and the autosave doc. Pure client-side bridge (proven in
  // the SVG studio's client hook); unknown symbol ids degrade gracefully.
  // Persisted feature outlines re-attach by mirrored id (featuresOntoItems —
  // the SVG coupling), so a reloaded deck/lawn/bed keeps its drawn region.
  const storePlacements = useStudioStore((s) => s.placements);
  const storeFeatures = useStudioStore((s) => s.features);
  const splitView = useStudioStore((s) => s.splitView);
  const marqueeActive = useStudioStore((s) => s.marqueeActive);
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
  const [truthBusy, setTruthBusy] = useState(false);
  const [truthMsg, setTruthMsg] = useState<string | null>(null);

  // AI parsing-stage transition — the canvas-level scan overlay driven by
  // the drafter panel's busy state (AI draft / assist). The research-backed
  // parsing UX lives in AiScanOverlay; this is just its power switch.
  const [aiScanKey, setAiScanKey] = useState<string | null>(null);
  const runSiteTruthImport = useCallback(async () => {
    setTruthBusy(true);
    setTruthMsg(null);
    try {
      const canvasRes = await fetch(`/api/projects/${projectId}/design-canvas`);
      if (!canvasRes.ok) {
        const payload = (await canvasRes.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(
          payload?.error ?? `Could not load the current drawing (${canvasRes.status})`,
        );
      }
      const canvasJson = (await canvasRes.json()) as {
        canvas: import("@workstream/contracts").DesignCanvas | null;
      };
      const r = await importSiteTruth(projectId, canvasJson.canvas ?? null);
      setTruthMsg(
        `Traced: boundary ${r.boundaryPts} pts` +
          (r.buildingPts ? ` · dwelling ${r.buildingPts} pts` : "") +
          (r.trees ? ` · ${r.trees} trees` : "") +
          (r.easements ? ` · ${r.easements} easements` : "") +
          (r.overlays ? ` · ${r.overlays} overlays` : "") +
          (r.levels ? ` · ${r.levels} indicative levels` : ""),
      );
      // Arm the scan-choreographed reveal: the reload rehydrates the studio
      // from the server and the mount effect runs the category cascade.
      try {
        sessionStorage.setItem("gs-scan-reveal", "1");
      } catch {
        // sessionStorage unavailable (privacy mode) — the reveal simply
        // doesn't run; entities appear settled, which is correct too.
      }
      window.location.reload();
    } catch (e) {
      setTruthMsg(e instanceof Error ? e.message : "Site truth import failed");
      setTruthBusy(false);
    }
  }, [projectId]);

  // Command palette — Cmd/Ctrl+K summons; Esc closes (handled inside).
  const [paletteOpen, setPaletteOpen] = useState(false);
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

  // Motion-aware chrome recede (AEC-2026 §3.2) — the R3F watcher flips the
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
  const liveProgress = useMemo<CanvasProgress>(
    () => ({
      hasAerial: progress.hasAerial,
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
  const _nextMode = useMemo(() => suggestedMode(liveProgress), [liveProgress]);

  /*
   * The full projection capsule needs ~1021px of viewport to sit between the
   * nib palette's right edge (403px) and the right dock (380px from the right
   * edge). Below that it slid left across the palette — 89x47px of overlap at
   * 960px wide. Under the threshold it renders as the icon-only preset group,
   * which fits the remaining gap at every viewport the collision spec walks.
   */
  const narrowViewport = useMediaQuery("(max-width: 1100px)");
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
  // read off real project data (see surveySetup.ts), never a manual tick.
  const surveySetup = useMemo(
    () =>
      buildSurveySetup({
        boundary: boundaryPct.map((p) => ({ x: p.x, y: p.y })),
        building: (buildingPct ?? []).map((p) => ({ x: p.x, y: p.y })),
        items: studioItems,
        levels: levels.map((l) => ({
          x: l.x_pct,
          y: l.y_pct,
          z: l.z_m,
          provenance:
            l.source === "vicmap_contour" ? "vicmap_contour" : "authored",
        })),
        services: bydaAssets.map((a) =>
          a.ring.map((p) => ({ x: p.x_pct, y: p.y_pct })),
        ),
        easements: (easementsPct ?? []).map((ring) =>
          ring.map((p) => ({ x: p.x, y: p.y })),
        ),
      }),
    [boundaryPct, buildingPct, studioItems, levels, bydaAssets, easementsPct],
  );
  const _guidance = interactionGuidance({
    activeMode,
    sketchMode,
    measureActive,
    armedSymbolId,
    marqueeActive,
    trenchTool,
    zoneTool,
    splitView,
  });

  // Studio keyboard map — viewport 1–4, Shift+digit modes, letter tools, ?.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const hit = resolveStudioShortcut(e);
      if (!hit) return;
      if (hit.kind === "viewport") {
        if (useStudioStore.getState().splitView) return;
        const live = useStudioStore.getState().liveRig;
        e.preventDefault();
        if (hit.preset === "plan") writeLiveRig({ ...live, tiltDeg: 0 });
        else if (hit.preset === "orbit")
          writeLiveRig({ ...live, tiltDeg: OBLIQUE_PITCH_DEG });
        else if (hit.preset === "garden")
          writeLiveRig({ ...live, tiltDeg: GARDEN_PITCH_DEG, zoom: 1.45 });
        else useStudioStore.getState().setPitchDeg(90);
        return;
      }
      if (hit.kind === "mode") {
        if (!unlocked.has(hit.mode)) return;
        e.preventDefault();
        onNativeMode(hit.mode);
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
        case "sketch-ink": {
          const next = !store.sketchMode;
          if (next) {
            store.setArmedSymbolId(null);
            store.setMeasureActive(false);
          }
          store.setSketchMode(next);
          break;
        }
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
  const autosaveDoc = useMemo(
    () => ({
      placements: storePlacements,
      strokes,
      constructionTrenches: storeTrenches,
      irrigationZones: storeZones,
      photoElevations: storePhotoElevations,
      features: storeFeatures,
    }),
    [storePlacements, strokes, storeTrenches, storeZones, storePhotoElevations, storeFeatures],
  );
  const { retrySave } = useStudioAutosave(projectId, autosaveDoc);
  useBeforeUnloadGuard();

  const stats = useMemo(
    () => ({
      boundaryPoints: boundaryPct.length,
      buildingPoints: buildingPct?.length ?? 0,
      easements: easementsPct?.length ?? 0,
      items: items?.length ?? 0,
      strokes: strokes.length,
      utilities: liveData.subsurfaceUtilities.length,
      strikes: liveData.strikeAlerts.length,
      scaleM,
    }),
    [boundaryPct, buildingPct, easementsPct, items, strokes, liveData, scaleM],
  );

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
  const hasPads = useMemo(
    () =>
      strokes.some((s) => (s.extrude_height_m ?? 0) > 0) ||
      storeFeatures.some((f) => (f.extrude_height_m ?? 0) > 0),
    [strokes, storeFeatures],
  );

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
  const communicationProfile = communicationProfileForMode(activeMode);

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

  const surveyLegendModel = useMemo(
    () =>
      deriveSurveyedPlanModel({
        dialect: annotationControl?.dialect ?? "technical",
        boundaryPct,
        scaleM,
        boardAspect,
        northBearingDeg,
        levels,
        placements: storePlacements,
        features: storeFeatures,
        density: "full",
      }),
    [
      annotationControl,
      boundaryPct,
      scaleM,
      boardAspect,
      northBearingDeg,
      levels,
      storePlacements,
      storeFeatures,
    ],
  );

  const tradeLegendModel = useMemo(
    () =>
      deriveTradePackModel({
        dialect: annotationControl?.dialect ?? "technical",
        packs:
          annotationControl?.tradePacks ?? {
            irrigationDrainage: false,
            hardscapeConstruction: false,
            lightingElectrical: false,
          },
        trenches: storeTrenches,
        zones: storeZones,
        features: storeFeatures,
        placements: storePlacements,
        density: "full",
      }),
    [annotationControl, storeTrenches, storeZones, storeFeatures, storePlacements],
  );

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
  }, [liveFeatures, livePlacements]);

  const activeSelectionId =
    selection[0] != null
      ? `${selection[0].kind}:${selection[0].id}`
      : null;

  const onSpatialSelect = useCallback((compositeId: string) => {
    const [kind, id] = compositeId.split(":");
    if (kind !== "feature" && kind !== "placement") return;
    useStudioStore.getState().selectRef({ kind, id } as SelectionRef, {
      additive: false,
    });
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
          <WebGLStudio {...sceneProps} />
        )}
      </StudioSurfaceErrorBoundary>

      {/* Mode cross-fade — a 150 ms paper veil keyed by mode. */}
      <div
        key={`mode-fade-${activeMode}`}
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: "var(--cf-z-spatial)",
          background: "var(--gs-canvas)",
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
        onClose={() => setPaletteOpen(false)}
        projectId={projectId}
        unlocked={unlocked}
        onMode={(m) => onNativeMode(m as Parameters<typeof onNativeMode>[0])}
        onZoom={(dir) => zoomBy(dir === 1 ? 1 : -1)}
        onOpenSitePhotos={() => setMetaTab("studio")}
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
            background: "color-mix(in srgb, var(--gs-canvas) 55%, transparent)",
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
              onBack={() => setActiveMode("sketch")}
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

  if (webglAvailable === false || webglLost) {
    return (
      <div
        role="alert"
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          padding: 24,
          background: "var(--gs-canvas)",
          color: "var(--gs-ink)",
          fontFamily: "var(--font-ui)",
        }}
      >
        <div
          style={{
            width: "min(420px, 100%)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--gs-space-6)",
            padding: 20,
            borderRadius: "var(--gs-radius-panel)",
            background: "var(--gs-glass-veil-strong)",
            border: "1px solid var(--gs-line)",
          }}
        >
          <h1 style={{ margin: 0, fontSize: "var(--gs-font-h1)" }}>3D canvas unavailable</h1>
          <p style={{ margin: 0, color: "var(--gs-ink-secondary)" }}>
            The graphics context is unavailable or was interrupted. Your saved
            drawing is unchanged.
          </p>
          <div style={{ display: "flex", gap: "var(--gs-space-4)", flexWrap: "wrap" }}>
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

      {/* ---- Perimeter tab strip — the single chrome anchor. One
          browser-tab chip strip hugs the top edge; modes on the left,
          meta surfaces on the right, live stats as the trailing status
          cell. Panels drop into the right dock, not beneath it. ---- */}
      <div
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          right: 16,
          display: "flex",
          alignItems: "flex-start",
          gap: "var(--gs-space-4)",
          pointerEvents: "none",
          zIndex: "var(--cf-z-chrome)",
        }}
      >
        {/* Project identity — tier-1 format: file identity left, actions
            centre, states right, one band. */}
        {projectAddress ? (
          <div
            data-testid="project-identity"
            data-gs-glass-card
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: "var(--gs-space-4)",
              padding: "5px 10px",
              borderRadius: "var(--gs-radius-pill)",
              /* Paper glass, not dark glass — the dark capsule is reserved
               * for the presentation lens (design-spec §5 / debt D8). */
              background: "var(--la-surface)",
              backdropFilter: "none",
              WebkitBackdropFilter: "none",
              border:
                "1px solid color-mix(in srgb, var(--gs-line) 55%, transparent)",
              boxShadow: "var(--gs-shadow-1)",
              flex: "0 0 auto",
              maxWidth: 260,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-tech)",
                fontSize: "var(--gs-font-md)",
                fontWeight: 600,
                color: "var(--gs-ink)",
                letterSpacing: "0.01em",
              }}
            >
              {projectAddress.split(",")[0]?.trim() ?? projectAddress}
            </span>
            <span
              style={{
                fontFamily: "var(--font-technical-mono)",
                fontSize: "var(--gs-font-xs)",
                letterSpacing: "0.05em",
                color: "var(--gs-ink-secondary)",
              }}
            >
              {projectAddress.split(",")[1]?.trim() ?? "VIC"}
            </span>
            <span
              aria-hidden
              style={{
                width: 1,
                height: 12,
                background:
                  "color-mix(in srgb, var(--gs-line) 70%, transparent)",
              }}
            />
            <span
              style={{
                fontFamily: "var(--font-technical-mono)",
                fontSize: "var(--gs-font-xs)",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                /* Charcoal on the paper veil — the old #ffffff belonged to
                 * the dark capsule (debt D8 flip; caught by webgl-contrast-aa
                 * at 1.01:1). */
                color: "var(--gs-ink-secondary)",
              }}
            >
              {activeMode}
            </span>
          </div>
        ) : null}
        {!splitView ? (
        <div
          style={{
            /* Floating top-center pill (DESIGN.md §5). */
            position: "absolute",
            top: 12,
            left: "50%",
            transform: "translateX(-50%)",
            pointerEvents: "none",
            zIndex: "var(--cf-z-chrome)",
          }}
        >
        <PerimeterTabStrip
          activeMode={activeMode}
          unlocked={unlocked}
          onNativeMode={onNativeMode}
          surveyProgress={
            surveySetup.complete
              ? null
              : { done: surveySetup.done, total: surveySetup.total }
          }
          metaTabs={[]}
          trailing={null}
        />
        </div>
      ) : null}
      </div>

      {/* Chrome austerity: viewport HUD + elevation card stripped — data
          lives in the UnifiedPanel. */}

      {/* ---- Right dock — the single right-edge panel host. Mode/meta
          surfaces and the CAD review card dock here instead of hanging
          centred over the drawing (UI survey §1.3). ---- */}
      {/* Tablet tier (debt D4): collapsed dock leaves only the reopen pill —
          the drawing reclaims the full width. */}
      {dockCollapsed ? (
        <button
          type="button"
          data-testid="dock-reopen"
          aria-label="Show panels"
          onClick={() => setDockCollapsed(false)}
          style={{
            position: "absolute",
            top: 152,
            right: 12,
            zIndex: "var(--cf-z-chrome)",
            pointerEvents: "auto",
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "5px 9px",
            borderRadius: "var(--gs-radius-pill)",
            background: "var(--la-surface)",
            backdropFilter: "none",
            WebkitBackdropFilter: "none",
            border:
              "1px solid color-mix(in srgb, var(--gs-line) 55%, transparent)",
            boxShadow: "var(--gs-shadow-1)",
            color: "var(--gs-ink-secondary)",
            fontFamily: "var(--font-tech)",
            fontSize: "var(--gs-font-xs)",
            letterSpacing: "0.06em",
            textTransform: "uppercase" as const,
            cursor: "pointer",
          }}
        >
          ◂ Panels
        </button>
      ) : null}
      <div
        style={{
          position: "absolute",
          top: 152,
          right: 20,
          bottom: 16,
          /* Tablet tier (debt D4): narrower column below 1100px —
           * min() keeps it inside the viewport on a 768px tablet. */
          width: narrowViewport
            ? "min(300px, calc(100vw - 140px))"
            : 360,
          display: "none", // Retired by the Unified Panel (AEC program wave 3)
          flexDirection: "column",
          gap: "var(--gs-space-3)",
          alignItems: "flex-end",
          pointerEvents: "none",
          zIndex: "var(--cf-z-chrome)",
          maxWidth: "calc(100% - 120px)",
          // The dock floats with air on every side — a glass capsule, not a
          // rigid dashboard column flush against the screen border. It
          // scrolls internally so the estimation companion never escapes.
          maxHeight: "calc(100dvh - 168px)",
          overflowY: "auto",
          scrollbarWidth: "none",
        }}
      >
        {/* Tablet tier (debt D4): collapse control — narrow viewports only. */}
        {narrowViewport && !dockCollapsed ? (
          <button
            type="button"
            data-testid="dock-collapse"
            aria-label="Hide panels"
            onClick={() => setDockCollapsed(true)}
            style={{
              pointerEvents: "auto",
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "3px 8px",
              borderRadius: "var(--gs-radius-pill)",
              background: "var(--la-surface)",
              border:
                "1px solid color-mix(in srgb, var(--gs-line) 55%, transparent)",
              color: "var(--gs-ink-secondary)",
              fontFamily: "var(--font-tech)",
              fontSize: "var(--gs-font-micro)",
              letterSpacing: "0.06em",
              textTransform: "uppercase" as const,
              cursor: "pointer",
            }}
          >
            Panels ▸
          </button>
        ) : null}
        {cadReviewOpen && cadProposals.length > 0 ? (
          <div
            data-gs-glass-card
            data-testid="cad-review-panel"
            style={{
              pointerEvents: "auto",
              width: "min(300px, calc(100vw - 32px))",
              maxHeight: "min(420px, calc(100dvh - 240px))",
              overflowY: "auto",
              scrollbarWidth: "thin",
              borderRadius: "var(--gs-radius-panel)",
              background: "var(--gs-panel-grad)",
              border: "1px solid color-mix(in srgb, var(--gs-line) 55%, transparent)",
              boxShadow: "var(--gs-shadow-2)",
              padding: "12px 14px",
              animation: "wsPanelIn 160ms ease-out",
            }}
          >
            <SketchCadReviewCard />
          </div>
        ) : null}

        <InspectorCard scaleM={scaleM} boardAspect={boardAspect} />

        {(() => {
          let body: ReactNode | null = null;
          let dismiss: (() => void) | null = null;

          if (activeMode === "survey") {
            body = (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--gs-space-4)" }}>
                <SurveySetupPanel
                  setup={surveySetup}
                  importBusy={truthBusy}
                  importMessage={truthMsg}
                  onImport={() => void runSiteTruthImport()}
                  onOpenAssets={() => {
                    useStudioStore.getState().setAssetsOpen(true);
                  }}
                  onContinue={() => onNativeMode("sketch")}
                  continueEnabled={unlocked.has("sketch")}
                />
                <SurveyCommunicationCard
                  dialect={surveyAnnotationDialect}
                  onDialect={setSurveyAnnotationDialect}
                  toggles={surveyedPlanLayers}
                  onToggle={(patch) =>
                    setSurveyedPlanLayers(
                      patch as Partial<typeof surveyedPlanLayers>,
                    )
                  }
                  model={surveyLegendModel}
                  tradePacks={surveyTradePacks}
                  onTradePacks={(patch) => setSurveyTradePacks(patch)}
                  tradeLegend={tradeLegendModel.legend.filter(
                    (entry) => surveyTradePacks[entry.pack],
                  )}
                  modes={communicationProfile?.modes}
                  labels={{
                    title: communicationProfile?.title ?? "Survey communication",
                    technical:
                      communicationProfile?.labels.technical ?? "Surveyed plan",
                    architectural:
                      communicationProfile?.labels.architectural ??
                      "Design sketch",
                    creative: communicationProfile?.labels.creative ?? "Creative",
                    hybrid: communicationProfile?.labels.hybrid ?? "Hybrid",
                  }}
                />
              </div>
            );
            dismiss = () => setActiveMode("sketch");
          } else if (activeMode === "garden") {
            body = (
              <GardenViewpointStrip
                activeLook={gardenLook}
                elevLook={null}
                mode="plan"
                onSelect={applyGardenLook}
              />
            );
          } else if (activeMode === "cad") {
            body = (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--gs-space-4)" }}>
                <StudioSurfaceErrorBoundary
                  areaLabel="Design assist panel"
                  title="Design assist unavailable"
                  detail="The AI drafter panel crashed and was isolated. Annotation and canvas tools are still active."
                  testId="design-assist-boundary-fallback"
                >
                  <StudioCadCard
                    projectId={projectId}
                    onCadResult={(result) => setCadGhostCount(result.ghost_count)}
                    onBusyChange={(key) => setAiScanKey(key)}
                  />
                </StudioSurfaceErrorBoundary>
                <SurveyCommunicationCard
                  dialect={cadAnnotationDialect}
                  onDialect={setCadAnnotationDialect}
                  toggles={cadAnnotationLayers}
                  onToggle={(patch) =>
                    setCadAnnotationLayers(
                      patch as Partial<typeof cadAnnotationLayers>,
                    )
                  }
                  model={surveyLegendModel}
                  tradePacks={cadTradePacks}
                  onTradePacks={(patch) => setCadTradePacks(patch)}
                  tradeLegend={tradeLegendModel.legend.filter(
                    (entry) => cadTradePacks[entry.pack],
                  )}
                  modes={communicationProfile?.modes}
                  labels={{
                    title: communicationProfile?.title ?? "CAD communication",
                    technical: communicationProfile?.labels.technical ?? "Technical",
                    architectural:
                      communicationProfile?.labels.architectural ??
                      "Architectural",
                    creative: communicationProfile?.labels.creative ?? "Creative",
                    hybrid:
                      communicationProfile?.labels.hybrid ??
                      "Presentation blend",
                  }}
                />
              </div>
            );
          } else if (activeMode === "sketch" && metaTab == null) {
            body = (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--gs-space-4)" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-tech)",
                      fontSize: "var(--gs-font-sm)",
                      fontWeight: 600,
                      letterSpacing: "0.06em",
                      color: "var(--gs-ink)",
                    }}
                  >
                    SKETCH
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-tech)",
                      fontSize: "var(--gs-font-xs)",
                      color: "var(--gs-ink-secondary)",
                    }}
                  >
                    {strokes.length} stroke{strokes.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div style={{ display: "flex", gap: "var(--gs-space-3)", flexWrap: "wrap" }}>
                  <Button
                    variant="cta"
                    data-testid="sketch-tidy"
                    disabled={strokes.length === 0}
                    onClick={() => useStudioStore.getState().tidySketchToCad()}
                    title={
                      strokes.length === 0
                        ? "Draw ink first — strokes become CAD proposals"
                        : "Classify strokes into confidence-scored CAD proposals"
                    }
                    style={{ flex: 1 }}
                  >
                    Tidy → CAD proposals
                  </Button>
                  <Button
                    variant="ghost-line"
                    data-testid="sketch-convert-cad"
                    disabled={strokes.length === 0}
                    onClick={() =>
                      useStudioStore.getState().convertStrokesToCadFeatures()
                    }
                    title="One-click convert — ditch/path/wall/bed CAD linework, ink kept as reference"
                    style={{ flex: 1 }}
                  >
                    Convert to CAD features
                  </Button>
                  <Button
                    variant="cta"
                    data-testid="sketch-stitch"
                    disabled={strokes.length === 0}
                    onClick={() =>
                      useStudioStore
                        .getState()
                        .stitchSketchStrokes(scaleM, boardAspect)
                    }
                    title="Weld touching strokes into continuous polylines and closed polygons (0.15 m snap), ink kept as reference"
                    style={{
                      flex: 1,
                      border: "1px solid color-mix(in srgb, var(--la-accent) 55%, transparent)",
                      background: "color-mix(in srgb, var(--la-accent) 10%, transparent)",
                      // --gs-primary on its own veil reads 4.08:1 at 11px —
                      // below AA; the cobalt ink token clears 6:1 on the veil.
                      // White reads 1.26:1 on this light veil — do not use it.
                      color: "var(--la-ink)",
                    }}
                  >
                    Stitch strokes
                  </Button>
                </div>
                {cadProposals.length > 0 && !cadReviewOpen ? (
                  <Button
                    variant="primary"
                    data-testid="cad-review-open"
                    onClick={() => setCadReviewOpen(true)}
                  >
                    Review {cadProposals.length} CAD proposal
                    {cadProposals.length === 1 ? "" : "s"}
                  </Button>
                ) : null}
                {sketchCadNotice ? (
                  <p
                    role="status"
                    data-testid="sketch-cad-notice"
                    style={{
                      margin: 0,
                      fontSize: "var(--gs-font-xs)",
                      lineHeight: 1.4,
                      color: /photo-traced/.test(sketchCadNotice)
                        ? "var(--la-error)"
                        : "var(--gs-ink-secondary)",
                    }}
                  >
                    {sketchCadNotice}
                  </p>
                ) : null}
                {stitchNotice ? (
                  <div
                    role="status"
                    data-testid="stitch-notice"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--gs-space-3)",
                      fontSize: "var(--gs-font-xs)",
                      lineHeight: 1.4,
                      color: "var(--gs-ink-secondary)",
                    }}
                  >
                    <span style={{ flex: 1 }}>{stitchNotice}</span>
                    <Button
                      variant="text"
                      aria-label="Dismiss stitch notice"
                      onClick={() => dismissStitchNotice()}
                      style={{
                        fontSize: "var(--gs-font-sub)",
                        lineHeight: 1,
                        padding: "0 2px",
                      }}
                    >
                      ×
                    </Button>
                  </div>
                ) : null}
                <SurveyCommunicationCard
                  dialect={sketchAnnotationDialect}
                  onDialect={setSketchAnnotationDialect}
                  toggles={sketchAnnotationLayers}
                  onToggle={(patch) =>
                    setSketchAnnotationLayers(
                      patch as Partial<typeof sketchAnnotationLayers>,
                    )
                  }
                  model={surveyLegendModel}
                  tradePacks={sketchTradePacks}
                  onTradePacks={(patch) => setSketchTradePacks(patch)}
                  tradeLegend={tradeLegendModel.legend.filter(
                    (entry) => sketchTradePacks[entry.pack],
                  )}
                  modes={communicationProfile?.modes}
                  labels={{
                    title: communicationProfile?.title ?? "Sketch communication",
                    technical: communicationProfile?.labels.technical ?? "Technical",
                    architectural:
                      communicationProfile?.labels.architectural ??
                      "Architectural",
                    creative: communicationProfile?.labels.creative ?? "Creative",
                    hybrid: communicationProfile?.labels.hybrid ?? "Hybrid",
                  }}
                />
              </div>
            );
          } else if (metaTab === "studio") {
            dismiss = () => setMetaTab(null);
            body = (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--gs-space-4)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-tech)",
                      fontSize: "var(--gs-font-sm)",
                      fontWeight: 600,
                      letterSpacing: "0.06em",
                      color: "var(--gs-ink)",
                    }}
                  >
                    STUDIO
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-tech)",
                      fontSize: "var(--gs-font-xs)",
                      color: "var(--gs-ink-secondary)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    B {stats.boundaryPoints} · I {stats.items} · S {stats.strokes}
                    {stats.strikes > 0 && (
                      <span style={{ color: "var(--la-error)" }}>
                        {" "}
                        · ⚠ {stats.strikes}
                      </span>
                    )}{" "}
                    | {stats.scaleM.toFixed(0)} m
                  </span>
                </div>
                <SaveStatusChip
                  onRetry={retrySave}
                  onRefresh={() => window.location.reload()}
                />
                <nav
                  aria-label="Project destinations"
                  style={{ display: "flex", gap: "var(--gs-space-5)" }}
                >
                  <a
                    href="/home"
                    style={{ color: "var(--gs-ink-secondary)", fontSize: "var(--gs-font-xs)" }}
                  >
                    Sites
                  </a>
                  <a
                    href={`/projects/${projectId}/outputs`}
                    style={{ color: "var(--la-accent)", fontSize: "var(--gs-font-xs)" }}
                  >
                    Outputs
                  </a>
                </nav>
                <div
                  style={{
                    display: "flex",
                    borderRadius: "var(--gs-radius-md)",
                    border: "1px solid var(--gs-line)",
                    overflow: "hidden",
                  }}
                >
                  <Button
                    variant="chip-preset"
                    aria-pressed={!is3D}
                    active={!is3D}
                    onClick={() => setPitchDeg(0)}
                    style={{
                      flex: 1,
                      padding: "2px 10px",
                      border: "none",
                      // Null the chip-preset pill radius so the segmented
                      // halves stay square (the clipped container owns the
                      // corners) — same undefined-null pattern as the
                      // alert card's font reset.
                      borderRadius: undefined,
                      fontSize: "var(--gs-font-sm)",
                      fontWeight: 600,
                    }}
                  >
                    Plan
                  </Button>
                  <Button
                    variant="chip-preset"
                    aria-pressed={is3D}
                    active={is3D}
                    onClick={() => setPitchDeg(OBLIQUE_PITCH_DEG)}
                    style={{
                      flex: 1,
                      padding: "2px 10px",
                      border: "none",
                      // Null the chip-preset pill radius so the segmented
                      // halves stay square (the clipped container owns the
                      // corners) — same undefined-null pattern as the
                      // alert card's font reset.
                      borderRadius: undefined,
                      fontSize: "var(--gs-font-sm)",
                      fontWeight: 600,
                    }}
                  >
                    3D
                  </Button>
                </div>
                <div
                  style={{ display: "flex", gap: "var(--gs-space-2)" }}
                  role="group"
                  aria-label="Camera and history"
                >
                  {(
                    [
                      ["−", "Zoom out", () => zoomBy(-1)],
                      ["+", "Zoom in", () => zoomBy(1)],
                      ["↶", "Undo (Ctrl+Z)", () => useStudioStore.getState().undo()],
                      ["↷", "Redo (Ctrl+Shift+Z)", () => useStudioStore.getState().redo()],
                    ] as Array<[string, string, () => void]>
                  ).map(([glyph, label, fn]) => {
                    const disabled = label.startsWith("Undo")
                      ? !canUndo
                      : label.startsWith("Redo")
                        ? !canRedo
                        : false;
                    return (
                      <Button
                        key={label}
                        variant="glyph"
                        aria-label={label}
                        data-testid={
                          label.startsWith("Zoom out")
                            ? "zoom-out"
                            : label.startsWith("Zoom in")
                              ? "zoom-in"
                              : label.startsWith("Undo")
                                ? "undo-btn"
                                : "redo-btn"
                        }
                        disabled={disabled}
                        onClick={fn}
                      >
                        {glyph}
                      </Button>
                    );
                  })}
                </div>
                <SitePhotoGallery
                  projectId={projectId}
                  boundaryPct={boundaryPct}
                  scaleM={scaleM}
                  boardAspect={boardAspect}
                  onViewSheet={(elevationId) => setPhotoSheetId(elevationId)}
                  onClose={() => setMetaTab(null)}
                />
              </div>
            );
          } else if (metaTab === "sun") {
            dismiss = () => setMetaTab(null);
            body = (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--gs-space-5)" }}>
                <div
                  style={{
                    display: "flex",
                    gap: "var(--gs-space-2)",
                    flexWrap: "wrap",
                  }}
                >
                  <MetaChip label="Season" value={seasonMeta.label} />
                  <MetaChip
                    label="Leaf"
                    value={leafStatus(seasonProgress, year)}
                    accent
                  />
                  <MetaChip label="Sun" value={`${sunMin}m`} />
                </div>
                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      marginBottom: 6,
                    }}
                  >
                    <span style={scrubberLabelStyle}>Sun</span>
                    <span style={{ ...scrubberValueStyle, fontSize: "var(--gs-font-h3)" }}>
                      {String(Math.floor(sunMin / 60)).padStart(2, "0")}:
                      {String(sunMin % 60).padStart(2, "0")}
                    </span>
                  </div>
                  <ScrubberTrack
                    value={(sunMin - DAY_START) / (DAY_END - DAY_START)}
                    min={DAY_START}
                    max={DAY_END}
                    step={5}
                    onChange={setSunMin}
                    ariaLabel="Time of day"
                    labels={["06:20", "13:00", "19:40"]}
                  />
                </div>
                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      marginBottom: 6,
                    }}
                  >
                    <span style={scrubberLabelStyle}>Season · {seasonMeta.label}</span>
                    <span style={{ ...scrubberValueStyle, fontSize: "var(--gs-font-h3)" }}>
                      {seasonMeta.month}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "var(--gs-space-2)", flexWrap: "wrap" }}>
                    {SUN_DATE_PRESETS.map((p) => (
                      <Button
                        key={p}
                        variant="chip-preset"
                        aria-pressed={sunDatePreset === p}
                        active={sunDatePreset === p}
                        onClick={() => setSunDatePreset(p)}
                        style={{ padding: "2px 6px" }}
                      >
                        {sunDatePresetLabel(p)}
                      </Button>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{ display: "flex", gap: "var(--gs-space-2)", alignItems: "center", flexWrap: "wrap" }}>
                    <Button
                      variant="chip-preset"
                      aria-pressed={suncastView}
                      active={suncastView}
                      onClick={() => setSuncastView(!suncastView)}
                      data-testid="suncast-toggle"
                      style={{ padding: "2px 6px" }}
                    >
                      Suncast overlay
                    </Button>
                    <span style={{ fontSize: "var(--gs-font-micro)", color: "var(--gs-ink-muted)" }}>
                      Analytical shade footprint — scrub the sun to sweep it
                    </span>
                  </div>
                </div>
              </div>
            );
          } else if (metaTab === "growth") {
            dismiss = () => setMetaTab(null);
            body = (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--gs-space-5)" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                  }}
                >
                  <span style={scrubberLabelStyle}>Growth Simulation</span>
                  <span style={scrubberValueStyle}>Year {year}</span>
                </div>
                <ScrubberTrack
                  value={growthFactor}
                  min={0}
                  max={10}
                  step={1}
                  onChange={setYear}
                  ariaLabel="Growth simulation year"
                  labels={["Year 0", "Year 5", "Year 10"]}
                  highlightValues={[0, 5, 10]}
                  currentHighlight={year}
                />
              </div>
            );
          } else if (metaTab === "layers") {
            dismiss = () => setMetaTab(null);
            body = (
              <div
                role="group"
                aria-label="Canvas layers"
                style={{ display: "flex", gap: "var(--gs-space-2)", flexWrap: "wrap" }}
              >
                {(
                  [
                    ["sketch", "Ink"],
                    ["siteTruth", "Site truth"],
                    ["design", "Design"],
                  ] as const
                ).map(([layer, label]) => (
                  <Button
                    key={layer}
                    variant="chip-preset"
                    aria-pressed={visibleLayers[layer]}
                    active={visibleLayers[layer]}
                    onClick={() =>
                      setVisibleLayers((current) => ({
                        ...current,
                        [layer]: !current[layer],
                      }))
                    }
                  >
                    {label}
                  </Button>
                ))}
              </div>
            );
          } else if (metaTab === "site") {
            dismiss = () => setMetaTab(null);
            body = (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--gs-space-4)" }}>
                <SiteContextBadges
                  projectId={projectId}
                  variant="glass"
                  showSeason={false}
                />
                {keylessOverlays.length > 0 ? (
                  <div
                    data-testid="government-overlay-legend"
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "var(--gs-space-2)",
                      padding: "5px 7px",
                      borderRadius: "var(--gs-radius-chip)",
                      background: "var(--gs-surface-fill)",
                      border: "1px solid color-mix(in srgb, var(--gs-line) 45%, transparent)",
                      color: "var(--gs-ink-secondary)",
                      fontFamily: "var(--font-ui)",
                      fontSize: "var(--gs-font-xs)",
                    }}
                  >
                    <strong style={{ color: "var(--gs-ink)" }}>
                      Government layers
                    </strong>
                    {[...new Set(keylessOverlays.map((overlay) => overlay.kind))].map(
                      (kind) => (
                        <span key={kind}>{kind.replaceAll("_", " ")}</span>
                      ),
                    )}
                    <a
                      href="https://mapshare.vic.gov.au/vicplan/"
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "var(--la-accent)" }}
                    >
                      Open VicPlan
                    </a>
                    <a
                      href="https://www.vic.gov.au/find-my-local-council"
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "var(--la-accent)" }}
                    >
                      Council tools
                    </a>
                  </div>
                ) : null}
                <div
                  role="note"
                  data-testid="site-truth-official-sources"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--gs-space-2)",
                    padding: "6px 9px",
                    borderRadius: "var(--gs-radius-chip)",
                    background: "var(--gs-surface-fill)",
                    border: "1px solid color-mix(in srgb, var(--gs-line) 45%, transparent)",
                    color: "var(--gs-ink-secondary)",
                    fontFamily: "var(--font-ui)",
                    fontSize: "var(--gs-font-xs)",
                    lineHeight: 1.45,
                  }}
                >
                  <span style={{ color: "var(--gs-ink)" }}>
                    Aboriginal cultural heritage (ACHRIS) is not part of the
                    public overlay washes — check the register before design.
                  </span>
                  <span style={{ display: "flex", flexWrap: "wrap", gap: "var(--gs-space-3)" }}>
                    <a
                      href="https://achris.vic.gov.au/"
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "var(--la-accent)" }}
                    >
                      ACHRIS register
                    </a>
                    <a
                      href="https://www.environment.vic.gov.au/biodiversity/naturekit"
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "var(--la-accent)" }}
                    >
                      NatureKit (EVC)
                    </a>
                    <a
                      href="https://elevation.fsdf.org.au/"
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "var(--la-accent)" }}
                    >
                      ELVIS elevation
                    </a>
                    <a
                      href="https://mapshare.vic.gov.au/vicplan/"
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "var(--la-accent)" }}
                    >
                      VicPlan report
                    </a>
                  </span>
                </div>
                {(easementsPct?.length ?? 0) > 0 || subsurfaceView ? (
                  <div
                    role="note"
                    data-testid="site-truth-honesty"
                    style={{
                      padding: "6px 9px",
                      borderRadius: "var(--gs-radius-chip)",
                      background: "var(--gs-surface-fill)",
                      border: "1px solid color-mix(in srgb, var(--gs-warning) 45%, transparent)",
                      color: "var(--gs-ink)",
                      fontFamily: "var(--font-ui)",
                      fontSize: "var(--gs-font-sm)",
                      lineHeight: 1.4,
                    }}
                  >
                    Easements are legal title constraints, not underground assets.
                    {subsurfaceView
                      ? " Utility depths and strike checks are indicative until surveyed."
                      : null}{" "}
                    <a
                      href="https://www.byda.com.au/"
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "var(--la-accent)" }}
                    >
                      Request BYDA
                    </a>
                  </div>
                ) : null}
                {lat == null || lng == null ? (
                  <div
                    role="status"
                    style={{
                      padding: "5px 8px",
                      borderRadius: "var(--gs-radius-chip)",
                      background: "var(--gs-surface-fill)",
                      color: "var(--gs-ink-secondary)",
                      fontFamily: "var(--font-ui)",
                      fontSize: "var(--gs-font-sm)",
                    }}
                  >
                    Solar analysis unavailable until the property pin is verified.
                  </div>
                ) : null}
                {subsurfaceView ? (
                  <a
                    href={`/subsurface-studio/${projectId}`}
                    data-testid="open-subsurface-studio"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "var(--gs-space-2)",
                      padding: "4px 8px",
                      borderRadius: "var(--gs-radius-pill)",
                      background: "color-mix(in srgb, var(--gs-truth-ink) 12%, transparent)",
                      border: "1px solid color-mix(in srgb, var(--gs-truth-ink) 40%, transparent)",
                      color: "var(--gs-ink-truth)",
                      fontFamily: "var(--font-ui)",
                      fontSize: "var(--gs-font-xs)",
                      textDecoration: "none",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Open full subsurface studio →
                  </a>
                ) : null}
              </div>
            );
          } else if (metaTab === "terrain") {
            dismiss = () => setMetaTab(null);
            body = (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--gs-space-4)" }}>
                <SliceProfileCard
                  scaleM={scaleM}
                  boardAspect={boardAspect}
                  heightmapPoints={liveData.heightmapPoints}
                />
                <DrainageFlowCard
                  scaleM={scaleM}
                  boardAspect={boardAspect}
                  heightmapPoints={liveData.heightmapPoints}
                  hydraulicResults={liveData.hydraulicResults}
                />
                <EarthworksCard
                  scaleM={scaleM}
                  boardAspect={boardAspect}
                  heightmapPoints={liveData.heightmapPoints}
                />
              </div>
            );
          } else if (activeMode === "quote" && (items?.length ?? 0) === 0) {
            dismiss = () => onNativeMode("cad");
            body = (
              <div
                data-testid="quote-empty-state"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--gs-space-4)",
                  color: "var(--gs-ink)",
                  fontFamily: "var(--font-ui)",
                  fontSize: "var(--gs-font-sm)",
                  lineHeight: 1.45,
                }}
              >
                <strong>Build the concept before pricing</strong>
                <span style={{ color: "var(--gs-ink-secondary)" }}>
                  Add accepted planting or hardscape items to create a live fit-sheet.
                </span>
                <Button
                  variant="primary"
                  onClick={() => onNativeMode("cad")}
                  style={{
                    minHeight: 32,
                    borderRadius: "var(--gs-radius-chip)",
                    // The quote-empty-state container sets font-size sm;
                    // the prior inline button had no padding, so it
                    // inherited UA padding (1px 6px). Null the primary
                    // base padding so the UA default is restored exactly.
                    padding: undefined,
                  }}
                >
                  Open CAD drafter
                </Button>
              </div>
            );
          }

          if (!body) return null;

          return (
            <div
              data-gs-glass-card
              data-testid="perimeter-panel"
              role="dialog"
              aria-label="Canvas surface panel"
              style={{
                position: "relative",
                pointerEvents: "auto",
                width: "min(340px, calc(100vw - 32px))",
                flex: "1 1 auto",
                minHeight: 0,
                maxHeight: "min(420px, calc(100dvh - 240px))",
                overflowY: "auto",
                scrollbarWidth: "thin",
                borderRadius: "var(--gs-radius-panel)",
                background: "var(--gs-panel-grad)",
                border: "1px solid color-mix(in srgb, var(--gs-line) 55%, transparent)",
                boxShadow: "var(--gs-shadow-2)",
                padding: "10px 12px",
                display: "flex",
                flexDirection: "column",
                gap: "var(--gs-space-2)",
                animation: "wsPanelIn 160ms ease-out",
              }}
            >
              {dismiss ? (
                <Button
                  variant="icon"
                  aria-label="Close panel"
                  onClick={dismiss}
                  style={{
                    position: "absolute",
                    top: 6,
                    right: 6,
                    width: 24,
                    height: 24,
                  }}
                >
                  ×
                </Button>
              ) : null}
              {body}
            </div>
          );
        })()}

        {/* Estimation companion — a flow child of this dock, stacked AFTER the
            mode panel so it can never paint over one (estimation-dock-spec §3
            placement, restored 2026-08-22). The dock's own scroller absorbs the
            overflow when panel + card exceed the column. Toggled via the Fit
            tab; the flag stays mode-independent, only the expanded default is
            mode-gated. */}
        {/* Estimator — ONE contextual tabbed glass panel (Estimate | Sourcing)
            replacing the stacked fit-sheet + trade-sourcing cards. Titles
            "Estimator" while provisional, "Quote" once signed off. Only the
            active tab mounts, so the dock never stacks two cards.
            Alongside a tall mode panel (survey/sketch/cad/garden) it defaults
            to the COMPACT running-estimate summary — the mode panel keeps the
            dock's height and the estimate is the ambient companion, so the two
            never compete for space (gold-standard 2026 coexistence). */}
        {/* EstimatorPanel moved to unified-panel companion mount below (wave 3) */}
      </div>



      {/* Left slim tool icons — bare (no container), border chrome per the
          Stitch reference; the drawing owns the middle. */}
      <StudioToolRail
        showTerrainTools={liveData.heightmapPoints.length > 0}
        showDims={boundaryPct.length >= 3}
        showEarth={liveData.heightmapPoints.length > 0 && hasPads}
        presentActive={presentationMode}
        onPresentToggle={() => setPresentationMode((p) => !p)}
        showTidy={sketchModeActive || strokes.length > 0}
        tidyDisabled={strokes.length === 0}
        onTidy={() => useStudioStore.getState().tidySketchToCad()}
      />

      {/* Nib palette stripped (austerity) — absorb into UnifiedPanel. */}

      {/* Selection chip stripped — UnifiedPanel shows selection state. */}

      {/* Asset library — rail-docked discovery palette (the single asset
          surface; replaces the bottom fan-out dock and the full-screen
          Asset Selection Studio, both removed 2026-08-25). Stays mounted
          while closed so it owns the arm/disarm Esc ladder. */}
      <AssetLibraryPanel />

      {/* Unified floating panel — boundary-anchored, selection-driven.
          Shows boundary/building inspectors (new) + mode bodies + estimator.
          Coexists with the dock during migration; the dock retires as each
          body moves in. */}
      <UnifiedPanel
        mode={activeMode}
        scaleM={scaleM}
        boardAspect={boardAspect}
        boundaryPct={boundaryPct}
        buildingPct={buildingPct ?? null}
        buildingSource={null}
        lotAreaM2={siteMeta?.lotAreaM2}
      />

      {/* Estimator companion — floats independently. FitSheetCard self-gates
          on its own items prop (renders null when empty, so the wrapper is
          safe to always mount — no store hydration race). */}
      {!splitView ? (
        <div
          data-testid="estimator-float"
          style={{
            position: "absolute",
            /* Sit LEFT of the flush right inspector (320px + 16px gap). */
            right: 336,
            bottom: 16,
            width: narrowViewport ? "min(300px, calc(100vw - 480px))" : 340,
            pointerEvents: "none",
            zIndex: "var(--cf-z-chrome)",
          }}
        >
          <EstimatorPanel
            projectId={projectId}
            items={items ?? []}
            boundaryPct={boundaryPct}
            constructionTrenches={constructionTrenches}
            irrigationZones={irrigationZones}
            scaleM={scaleM}
            outdoorM2={outdoorM2}
            signedOff={signedOff}
            signedOffLoading={signoffLoading}
            defaultCollapsed={
              activeMode === "survey" ||
              activeMode === "sketch" ||
              activeMode === "cad" ||
              activeMode === "garden"
            }
            canopy={buildCanopyCompliance({
              placements: storePlacements,
              boundary: boundaryPct,
              scaleM,
              boardAspect,
              lotAreaM2: siteMeta?.lotAreaM2,
            })}
          />
        </div>
      ) : null}

      {/* Floating cursor toolbar — shows when an asset is armed */}
      <FloatingPlacementToolbar />

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

      {/* Workflow guide + guidance chip stripped (austerity). */}

      {/* Dev-only z-tier hover HUD — renders NOTHING outside dev or
          without the `?cfz-inspect=1` URL flag. See CfzTierInspector.tsx
          and docs/CANVAS-FIRST-Z-STACK-CONTRACT.md §7. */}
      <CfzTierInspector />
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
        right: 380,
        top: 152,
        bottom: 80,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--gs-space-3)",
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
        stroke="var(--gs-ink-muted)"
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
          fontSize: "var(--gs-font-sub)",
          letterSpacing: "0.02em",
          color: "var(--gs-ink-secondary)",
          maxWidth: 320,
        }}
      >
        {address?.trim() ? address : "Locating the property"}
      </span>
      <span
        style={{
          fontFamily: "var(--font-ui)",
          fontSize: "var(--gs-font-xs)",
          color: "var(--gs-ink-muted)",
        }}
      >
        Import site truth to draw the title boundary
      </span>
    </div>
  );
}

const WORKFLOW_STAGES: CanvasMode[] = ["survey", "sketch", "cad", "quote"];

/**
 * The bottom slot — ONE chip.
 *
 * `FirstRunHint` used to render a second, separate chip horizontally co-located
 * with this one, with vertical offsets hand-tuned against each other ("stacked
 * below the guidance line, which claims 288"). The content was redundant: this
 * line already said "Survey mode · Review site truth and constraints before
 * designing" while the hint said "Wheel = zoom · Drag = pan · choose a tool to
 * draw or place · ? = shortcuts". The guidance line owns the slot now and
 * carries the control scheme as a first-run tail, dismissed for the session —
 * `StudioShortcutsHelp` behind `?` is the durable home for the full scheme.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- stripped (austerity)
function InteractionGuidanceChip({
  guidance,
}: {
  guidance: { label: string; detail: string };
}) {
  const [showControls, setShowControls] = useState(false);
  useEffect(() => {
    if (!sessionStorage.getItem("gs-controls-hint-seen")) setShowControls(true);
  }, []);
  // The asset library (release 87adeeb) is a tall dialog (top:152 to the
  // viewport floor) that owns the left column at small viewports — the old
  // bottom:288 clearance was computed for the retired 201px asset dock.
  // While it is open the canvas-gesture guidance is stale anyway, so the
  // chip stands down instead of overlapping the palette (chrome-collision
  // gate: asset-library × interaction-guidance at ≤1280×720).
  const assetsOpen = useStudioStore((s) => s.assetsOpen);
  if (assetsOpen) return null;
  return (
    <div
      data-testid="interaction-guidance"
      role="status"
      aria-live="polite"
      style={{
        position: "absolute",
        /*
         * Centred on the FREE canvas, not the viewport: the right dock takes
         * 380px off the right edge, so a 50% centre crosses it at narrow
         * widths. Same offset trick the asset dock already uses.
         */
        left: "calc(50% - 190px)",
        /*
         * Clear of the asset dock, which is 201px tall at 960x640 (top edge at
         * bottom:213) — not the ~150px a taller viewport suggests. 200 put
         * this line on the dock's shoulder.
         */
        bottom: 288,
        transform: "translateX(-50%)",
        display: "flex",
        alignItems: "baseline",
        gap: "var(--gs-space-3)",
        /*
         * The width budget is what keeps this off the tool rail. Centred at
         * `50% - 190px`, the left edge sits at `vw/2 - 190 - w/2`; clearing the
         * rail's 64px column plus its margin needs `w <= vw - 540`. At 960 the
         * old `calc(100vw - 32px)` let the chip reach 560px and its left edge
         * landed at x=10, straight on the rail — which the merged first-run tail
         * made reachable where the shorter guidance line alone was not.
         */
        maxWidth: "min(560px, calc(100vw - 560px))",
        padding: "6px 11px",
        borderRadius: "var(--gs-radius-pill)",
        /* Paper glass, not dark glass (design-spec §5 / debt D8) — the dark
         * capsule is reserved for the presentation lens. */
        background: "var(--la-surface)",
        backdropFilter: "none",
        WebkitBackdropFilter: "none",
        border: "1px solid color-mix(in srgb, var(--gs-line) 55%, transparent)",
        boxShadow: "var(--gs-shadow-1)",
        // The first-run tail carries a dismiss button, so the chip opts into
        // pointer events only while that button exists.
        pointerEvents: showControls ? "auto" : "none",
        zIndex: "var(--cf-z-chrome)",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--gs-font-xs)",
        color: "var(--gs-ink-secondary)",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}
    >
              <strong style={{ color: "var(--gs-ink-strong)" }}>{guidance.label}</strong>
      <span>{guidance.detail}</span>
      {showControls ? (
        <>
          <span aria-hidden style={{ opacity: 0.45 }}>|</span>
          <span>Wheel = zoom · Drag = pan · ? = shortcuts</span>
          <Button
            variant="text"
            aria-label="Dismiss controls hint"
            data-testid="controls-hint-dismiss"
            onClick={() => {
              sessionStorage.setItem("gs-controls-hint-seen", "1");
              setShowControls(false);
            }}
            style={{
              color: "var(--gs-ink)",
              fontFamily: "var(--font-tech)",
              padding: "0 4px",
            }}
          >
            ✕
          </Button>
        </>
      ) : null}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- stripped (austerity)
function WorkflowGuideChip({
  activeMode,
  nextMode,
  unlocked,
  onMode,
}: {
  activeMode: CanvasMode;
  nextMode: CanvasMode;
  unlocked: ReadonlySet<CanvasMode>;
  onMode: (mode: CanvasMode) => void;
}) {
  return (
    <nav
      data-testid="workflow-guide"
      aria-label="Studio workflow"
      style={{
        position: "absolute",
        top: 70,
        left: 16,
        display: "flex",
        alignItems: "center",
        gap: "var(--gs-space-2)",
        pointerEvents: "auto",
        zIndex: "var(--cf-z-chrome)",
        padding: "3px 8px",
        borderRadius: "var(--gs-radius-pill)",
        background: "color-mix(in srgb, var(--la-surface) 40%, transparent)",
        backdropFilter: "none",
        WebkitBackdropFilter: "none",
        border: "1px solid color-mix(in srgb, var(--gs-line) 35%, transparent)",
        fontFamily: "var(--font-tech)",
        fontSize: "var(--gs-font-xs)",
        letterSpacing: "0.04em",
        color: "var(--gs-ink-secondary)",
      }}
    >
      {WORKFLOW_STAGES.map((mode, i) => {
        const locked = !unlocked.has(mode);
        const here = mode === activeMode;
        return (
          <span key={mode} style={{ display: "inline-flex", alignItems: "center", gap: "var(--gs-space-2)" }}>
            {i > 0 ? <span aria-hidden>→</span> : null}
            <Button
              variant="text"
              disabled={locked}
              aria-current={here ? "step" : undefined}
              aria-label={locked ? `${mode} locked. Complete the previous stage first.` : mode}
              data-testid={`workflow-${mode}`}
              onClick={() => onMode(mode)}
              style={{
                padding: "0 2px",
                color: here
                  ? "var(--la-ink)"
                  : locked
                    ? "var(--gs-ink-muted)"
                    : "var(--gs-ink-secondary)",
                fontWeight: here ? 600 : 400,
                textTransform: "capitalize",
              }}
            >
              {mode}
            </Button>
          </span>
        );
      })}
      {nextMode !== activeMode ? (
        <span style={{ marginLeft: 6, color: "var(--gs-ink-muted)" }}>
          Next: {nextMode}
        </span>
      ) : null}
    </nav>
  );
}

/* -------------------------------------------------------------------------- */
/* Shared UI primitives                                                       */
/* -------------------------------------------------------------------------- */

const scrubberLabelStyle: React.CSSProperties = {
  fontFamily: "var(--font-ui)",
  fontSize: "var(--gs-font-xs)",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--gs-ink-secondary)",
};

const scrubberValueStyle: React.CSSProperties = {
  fontFamily: "var(--font-tech)",
  fontSize: "var(--gs-font-h3)",
  fontWeight: 500,
  color: "var(--la-accent)",
};

/** A tiny meta chip — label + value in one pill (canvas-first chrome unit). */
function MetaChip({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "baseline",
        gap: "var(--gs-space-2)",
        padding: "2px 7px",
        borderRadius: "var(--gs-radius-pill)",
        border: "1px solid color-mix(in srgb, var(--gs-line) 45%, transparent)",
        fontFamily: "var(--font-tech)",
        fontSize: "var(--gs-font-xs)",
        color: "var(--gs-ink-secondary)",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ letterSpacing: "0.06em", textTransform: "uppercase" }}>{label}</span>
      <span style={{ color: accent ? "var(--la-accent)" : "var(--gs-ink)", fontSize: "var(--gs-font-sm)" }}>
        {value}
      </span>
    </span>
  );
}

/**
 * Measure tape readout — the DOM twin of the in-canvas tape label. Renders
 * the live/last measurement in true metres while the tool is armed and a
 * tape exists. Subscribes to the store independently so pointer-move updates
 * re-render only this chip, not the whole HUD (SaveStatusChip pattern).
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- stripped (austerity)
function MeasureReadoutChip({
  scaleM,
  boardAspect,
}: {
  scaleM: number;
  boardAspect: number;
}) {
  const measureActive = useStudioStore((s) => s.measureActive);
  const tape = useStudioStore((s) => s.measureTape);

  if (!measureActive || !tape) return null;

  const [ax, az] = pctToWorld(tape.a, scaleM, boardAspect);
  const [bx, bz] = pctToWorld(tape.b, scaleM, boardAspect);
  const lengthM = Math.hypot(bx - ax, bz - az);

  return (
    <div
      data-testid="measure-readout"
      style={{
        marginTop: 4,
        fontFamily: "var(--font-tech)",
        fontSize: "var(--gs-font-sm)",
        color: "var(--la-accent)",
      }}
    >
      Measure · {lengthM.toFixed(2)} m · Esc clears
    </div>
  );
}

/**
 * Precision drafting readout — the DOM twin of the in-canvas cursor label.
 * Subscribes to the draft session alone, so it re-renders once per placed
 * vertex rather than per pointer move (the MeasureReadoutChip pattern), and
 * announces the run for screen readers while the in-canvas chip carries the
 * live segment length + bearing.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- stripped (austerity)
function DraftReadoutChip() {
  const draftSession = useStudioStore((s) => s.draftSession);
  if (!draftSession) return null;

  const { tool, vertices } = draftSession;
  const count = vertices.length;
  const isArea = tool === "area";
  const figure = isArea
    ? `${draftAreaM2(vertices).toFixed(1)} m²`
    : `${draftRunLengthM(vertices, false).toFixed(2)} m`;
  const closeHint = isArea
    ? "click the origin to close"
    : "Enter finishes · Backspace steps back";

  return (
    <div
      data-testid="draft-status"
      role="status"
      aria-live="polite"
      style={{
        marginTop: 4,
        fontFamily: "var(--font-tech)",
        fontSize: "var(--gs-font-sm)",
        color: "var(--la-accent)",
      }}
    >
      {isArea ? "Area" : "Polyline"} · {count}{" "}
      {count === 1 ? "vertex" : "vertices"}
      {count >= 2 ? ` · ${figure}` : ""} · {closeHint}
    </div>
  );
}

/** A reusable scrubber track with a progress fill + range input overlay (compact). */
function ScrubberTrack({
  value,
  min,
  max,
  step,
  onChange,
  ariaLabel,
  labels,
  highlightValues,
  currentHighlight,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  ariaLabel: string;
  labels: string[];
  highlightValues?: number[];
  currentHighlight?: number;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <>
      <div
        style={{
          position: "relative",
          width: "100%",
          height: 3,
          background: "var(--gs-line)",
          borderRadius: "var(--gs-radius-pill)",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            height: "100%",
            width: `${pct}%`,
            background: "var(--la-accent)",
            borderRadius: "var(--gs-radius-pill)",
          }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={ariaLabel}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            margin: 0,
            opacity: 0,
            cursor: "pointer",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: `${pct}%`,
            width: 10,
            height: 10,
            transform: "translate(-50%, -50%)",
            background: "var(--la-accent)",
            border: "2px solid var(--gs-canvas)",
            borderRadius: "50%",
            boxShadow: "0 0 8px var(--gs-warning-amber)",
            pointerEvents: "none",
          }}
        />
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 4,
          fontFamily: "var(--font-tech)",
          fontSize: "var(--gs-font-xs)",
          color: "var(--gs-ink-secondary)",
        }}
      >
        {labels.map((label, i) => {
          const isHighlight =
            highlightValues && currentHighlight !== undefined
              ? label.includes(String(currentHighlight))
              : false;
          return (
            <span
              key={i}
              style={{ color: isHighlight ? "var(--la-accent)" : "var(--gs-ink-secondary)" }}
            >
              {label}
            </span>
          );
        })}
      </div>
    </>
  );
}
