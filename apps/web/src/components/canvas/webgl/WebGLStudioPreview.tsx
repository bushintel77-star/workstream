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
 * This is no longer a "dev-only preview" — it is the default mount. The legacy
 * SVG studio (HandoffDesignStudio) is the ?svg=1 fallback.
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
import { VignetteOverlay } from "./VignetteOverlay";
import { SaveStatusChip } from "./SaveStatusChip";
import { DEFAULT_CAMERA_RIG, type StudioCameraRig } from "./cameraRig";
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
import { useStudioAutosave, useBeforeUnloadGuard } from "./useStudioAutosave";
import { computeLiveStudioData } from "./canvasBridges";
import { SliceProfileCard } from "./SliceProfileCard";
import { DrainageFlowCard } from "./DrainageFlowCard";
import { EarthworksCard } from "./EarthworksCard";
import { FitSheetCard } from "./FitSheetCard";
import { AssetFanOutDock } from "./AssetFanOutDock";
import { StudioToolRail } from "./StudioToolRail";
import { PerimeterTabStrip, type MetaTabId } from "./PerimeterTabStrip";
import { canvasLayerPolicy } from "./layerPolicy";
import { importSiteTruth } from "./siteTruthImport";
import { StudioCommandPalette } from "./StudioCommandPalette";
import { StudioElevationCard } from "./StudioElevationCard";
import { StudioCadCard } from "./StudioCadCard";
import { InspectorCard } from "./InspectorCard";
import { SitePhotoGallery } from "./SitePhotoGallery";
import { PhotoTraceHud } from "./PhotoTraceHud";
import { PhotoElevationSheet } from "./PhotoElevationSheet";
import { SplitViewLens } from "./SplitViewLens";
import { placementsToItems, featuresOntoItems } from "../handoff/state/canvasBridge";
import { toRenderItems } from "./stateBridge";
import { SketchCadReviewCard } from "./SketchCadReviewCard";
import {
  nearestFeatureId,
  nearestPlacementId,
} from "./selectionPick";
import { unlockedModes, type CanvasMode, type CanvasProgress } from "../../../lib/canvas-mode";
import { SiteContextBadges } from "../../SiteContextBadges";
import { GardenViewpointStrip } from "../handoff/features/viewpoint/GardenViewpointStrip";
import { viewpointYawDeg, type GardenViewpointLook } from "../handoff/features/tilt/tiltMath";
import { SurveyChecklist } from "../handoff/features/survey/SurveyChecklist";
import { ShareSurface } from "../handoff/features/share/ShareSurface";
import { PresentSurface } from "../handoff/features/present/PresentSurface";

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
  const fitSheetOpen = useStudioStore((s) => s.fitSheetOpen);
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

  // Deep-link entry: ?mode=quote opens the fit-sheet, ?mode=present arms the
  // presentation lens, ?mode=garden frames the 3D garden view. Sketch stays
  // un-armed (the rail / ?tool=sketch owns the draw cursor) — the tab already
  // marks the sketch surface active.
  useEffect(() => {
    if (initialMode === "quote") {
      useStudioStore.getState().setFitSheetOpen(true);
    } else if (initialMode === "present") {
      setPresentationMode(true);
    }
  }, [initialMode]);

  // Garden viewpoint — eye-level rig presets per cardinal look. The yaw
  // reuses the classic tiltMath mapping so N/E/S/W mean the same thing in
  // both studios.
  const [gardenLook, setGardenLook] = useState<GardenViewpointLook>("S");
  const applyGardenLook = (look: GardenViewpointLook) => {
    setGardenLook(look);
    // Pitch is the single camera axis — raise to a garden eye-level 76° and
    // let setPitchDeg commit the derived 3D blend target in the same write.
    useStudioStore.getState().setPitchDeg(76);
    writeLiveRig({
      ...DEFAULT_CAMERA_RIG,
      tiltDeg: 76,
      zoom: 1.45,
      rotateDeg: viewpointYawDeg(look),
    });
  };

  const onNativeMode = (mode: CanvasMode) => {
    setActiveMode(mode);
    setMetaTab(null);
    if (mode !== "present") setPresentationMode(false);
    const store = useStudioStore.getState();
    if (mode === "sketch") {
      store.setArmedSymbolId(null);
      store.setMeasureActive(false);
      store.setSketchMode(true);
    } else if (mode === "quote") {
      store.setFitSheetOpen(true);
    } else if (mode === "garden") {
      applyGardenLook(gardenLook);
    } else if (mode === "cad") {
      // CAD style = technical 2D: locked plan view with working-drawing dims.
      store.setPitchDeg(0);
      if (boundaryPct.length >= 3) store.setDimsView(true);
    } else if (mode === "present") {
      setPresentationMode(true);
    }
    // survey / share / elevation mount their glass cards on activeMode.
  };

  // --- Store subscriptions (DOM HUD re-renders; 3D reads via getState) ---
  const year = useStudioStore((s) => s.growthYear);
  const setYear = useStudioStore((s) => s.setGrowthYear);
  const growthFactor = year / 10;
  const sunMin = useStudioStore((s) => s.sunMin);
  const setSunMin = useStudioStore((s) => s.setSunMin);
  const seasonProgress = useStudioStore((s) => s.seasonProgress);
  const sunDatePreset = useStudioStore((s) => s.sunDatePreset);
  const setSunDatePreset = useStudioStore((s) => s.setSunDatePreset);
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
  const storeTrenches = useStudioStore((s) => s.constructionTrenches);
  const storeZones = useStudioStore((s) => s.irrigationZones);
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
  useStudioAutosave(projectId, autosaveDoc);
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

  // Pads exist ⇔ any committed stroke carries an extrusion height — gates the
  // Earth toggle + EarthworksCard.
  const hasPads = useMemo(
    () => strokes.some((s) => (s.extrude_height_m ?? 0) > 0),
    [strokes],
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
            gap: 12,
            padding: 20,
            borderRadius: "var(--gs-radius-panel)",
            background: "var(--gs-glass-veil-strong)",
            border: "1px solid var(--gs-line)",
          }}
        >
          <h1 style={{ margin: 0, fontSize: 20 }}>3D canvas unavailable</h1>
          <p style={{ margin: 0, color: "var(--gs-ink-secondary)" }}>
            The graphics context is unavailable or was interrupted. Your saved
            drawing is unchanged.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                minHeight: 40,
                padding: "0 12px",
                borderRadius: "var(--gs-radius-chip)",
                border: "1px solid var(--gs-primary)",
                background: "var(--gs-primary)",
                color: "var(--gs-panel)",
              }}
            >
              Reload canvas
            </button>
            <a
              href={`/projects/${projectId}?svg=1&mode=${activeMode}`}
              style={{ alignSelf: "center", color: "var(--gs-primary)" }}
            >
              Open vector fallback
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        cursor: "grab",
      }}
      onPointerDown={(e) => {
        // Grabbing while panning the drawing; text inputs opt back out.
        if (
          e.target instanceof HTMLElement &&
          (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable)
        ) return;
        e.currentTarget.style.cursor = "grabbing";
      }}
      onPointerUp={(e) => { e.currentTarget.style.cursor = "grab"; }}
      onPointerLeave={(e) => { e.currentTarget.style.cursor = "grab"; }}
    >
      {/* The render surface: ONE studio, or the split lens (locked plan |
          live 3D, linked cameras). The DOM chrome overlays whichever is
          mounted — one chrome, two viewports. */}
      {splitView ? (
        <SplitViewLens sceneProps={sceneProps} />
      ) : (
        <WebGLStudio {...sceneProps} />
      )}

      {/* ---- The chrome overlay (pointer-transparent; children opt in) ---- */}
      <div
        data-webgl-chrome
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      >
      {/* Atmospheric vignette — matches the 3D post-processing, fades with blend */}
      <VignetteOverlay />
      <style>{`@keyframes wsPanelIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }`}</style>

      {/* ---- Perimeter tab strip — the single chrome anchor. One
          browser-tab chip strip hugs the top edge; modes on the left,
          meta surfaces on the right, live stats as the trailing status
          cell. Panels drop into the right dock, not beneath it. ---- */}
      <div
        style={{
          position: "absolute",
          top: 12,
          left: "50%",
          transform: "translateX(-50%)",
          pointerEvents: "none",
          zIndex: 6,
          maxWidth: "calc(100% - 120px)",
        }}
      >
        <PerimeterTabStrip
          activeMode={activeMode}
          unlocked={unlocked}
          onNativeMode={onNativeMode}
          metaTabs={[
            {
              id: "studio",
              label: "Studio",
              active: metaTab === "studio",
              onToggle: () => setMetaTab(metaTab === "studio" ? null : "studio"),
            },
            {
              id: "sun",
              label: "Sun",
              active: metaTab === "sun",
              onToggle: () => setMetaTab(metaTab === "sun" ? null : "sun"),
            },
            {
              id: "growth",
              label: "Growth",
              active: metaTab === "growth",
              onToggle: () => setMetaTab(metaTab === "growth" ? null : "growth"),
            },
            {
              id: "layers",
              label: "Layers",
              active: metaTab === "layers",
              onToggle: () => setMetaTab(metaTab === "layers" ? null : "layers"),
            },
            {
              id: "site",
              label: "Site",
              active: metaTab === "site",
              onToggle: () => setMetaTab(metaTab === "site" ? null : "site"),
            },
            {
              id: "fit",
              label: "Fit",
              active: fitSheetOpen,
              onToggle: () =>
                useStudioStore.getState().setFitSheetOpen(!fitSheetOpen),
            },
            ...(liveData.heightmapPoints.length > 0
              ? [
                  {
                    id: "terrain" as MetaTabId,
                    label: "Terrain",
                    active: metaTab === "terrain",
                    onToggle: () =>
                      setMetaTab(metaTab === "terrain" ? null : "terrain"),
                  },
                ]
              : []),
          ]}
          trailing={
            <>
              <span
                data-testid="strip-stats"
                aria-label={`Canvas summary: ${stats.boundaryPoints} boundary points, ${stats.items} items, ${stats.strokes} strokes`}
                style={{
                  fontFamily: "var(--font-tech)",
                  fontSize: 10.5,
                  fontWeight: 500,
                  letterSpacing: "0.02em",
                  fontVariantNumeric: "tabular-nums",
                  color: "var(--gs-ink-secondary)",
                  whiteSpace: "nowrap",
                }}
              >
                B{stats.boundaryPoints} · I{stats.items} · S{stats.strokes}
                {stats.strikes > 0 && (
                  <span style={{ color: "var(--gs-ink-conflict)" }}>
                    {" "}
                    · ⚠{stats.strikes}
                  </span>
                )}
                {" "}| {stats.scaleM.toFixed(0)}m
              </span>
              <SaveStatusChip />
              <MeasureReadoutChip scaleM={scaleM} boardAspect={boardAspect} />
            </>
          }
        />
      </div>

      {/* ---- Elevation mode: the wide board sheet stays a centred overlay
          (it cannot fit a dock) — centring is now against the full canvas,
          fixing the old broken containing block (UI survey §1.1). ---- */}
      {activeMode === "elevation" ? (
        <StudioElevationCard
          boundaryPct={boundaryPct}
          buildingPct={buildingPct}
          items={studioItems}
          scaleM={scaleM}
          onTraceInPlan={() => setActiveMode("sketch")}
          onClose={() => setActiveMode("sketch")}
        />
      ) : null}

      {/* ---- Right dock — the single right-edge panel host. Mode/meta
          surfaces and the CAD review card dock here instead of hanging
          centred over the drawing (UI survey §1.3). ---- */}
      <div
        style={{
          position: "absolute",
          top: 152,
          right: 12,
          width: 360,
          display: "flex",
          flexDirection: "column",
          gap: 6,
          alignItems: "flex-end",
          pointerEvents: "none",
          zIndex: 10,
          maxWidth: "calc(100% - 120px)",
          // The dock scrolls internally — the estimation companion can exceed
          // the viewport without escaping it (chrome-collision gate).
          maxHeight: "calc(100dvh - 170px)",
          overflowY: "auto",
          scrollbarWidth: "none",
        }}
      >
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

        <InspectorCard />

        {(() => {
          let body: ReactNode | null = null;
          let dismiss: (() => void) | null = null;

          if (activeMode === "survey") {
            body = (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  <button
                    type="button"
                    data-testid="import-site-truth"
                    disabled={truthBusy}
                    onClick={() => void runSiteTruthImport()}
                    style={{
                      fontFamily: "var(--font-ui)",
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "6px 10px",
                      borderRadius: "var(--gs-radius-chip)",
                      border: "1px solid var(--gs-primary)",
                      background: "var(--gs-primary)",
                      color: "var(--gs-panel)",
                      cursor: truthBusy ? "wait" : "pointer",
                    }}
                  >
                    {truthBusy ? "Tracing Vicmap…" : "Import site truth (Vicmap)"}
                  </button>
                  {truthMsg ? (
                    <p
                      role="status"
                      data-testid="site-truth-result"
                      style={{
                        margin: 0,
                        fontSize: 10.5,
                        color: "var(--gs-ink-secondary)",
                      }}
                    >
                      {truthMsg}
                    </p>
                  ) : null}
                </div>
                <SurveyChecklist
                  boundary={boundaryPct}
                  building={buildingPct ?? []}
                  items={studioItems}
                  levels={levels.map((l) => ({
                    x: l.x_pct,
                    y: l.y_pct,
                    z: l.z_m,
                    provenance:
                      l.source === "vicmap_contour" ? "vicmap_contour" : "authored",
                  }))}
                  services={bydaAssets.map((a) =>
                    a.ring.map((p) => ({ x: p.x_pct, y: p.y_pct })),
                  )}
                  easements={(easementsPct ?? []).map((ring) =>
                    ring.map((p) => ({ x: p.x, y: p.y })),
                  )}
                  onClose={() => setActiveMode("sketch")}
                />
              </div>
            );
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
              <StudioCadCard
                projectId={projectId}
                onCadResult={(result) => setCadGhostCount(result.ghost_count)}
              />
            );
          } else if (activeMode === "sketch" && metaTab == null) {
            body = (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
                      fontSize: 11,
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
                      fontSize: 10.5,
                      color: "var(--gs-ink-secondary)",
                    }}
                  >
                    {strokes.length} stroke{strokes.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    data-testid="sketch-tidy"
                    disabled={strokes.length === 0}
                    onClick={() => useStudioStore.getState().tidySketchToCad()}
                    title={
                      strokes.length === 0
                        ? "Draw ink first — strokes become CAD proposals"
                        : "Classify strokes into confidence-scored CAD proposals"
                    }
                    style={{
                      flex: 1,
                      padding: "5px 8px",
                      border: "1px solid var(--gs-primary)",
                      borderRadius: "var(--gs-radius-chip)",
                      background: "var(--gs-primary)",
                      color: "var(--gs-panel)",
                      fontFamily: "var(--font-ui)",
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: strokes.length === 0 ? "not-allowed" : "pointer",
                      opacity: strokes.length === 0 ? 0.5 : 1,
                    }}
                  >
                    Tidy → CAD proposals
                  </button>
                  <button
                    type="button"
                    data-testid="sketch-convert-cad"
                    disabled={strokes.length === 0}
                    onClick={() =>
                      useStudioStore.getState().convertStrokesToCadFeatures()
                    }
                    title="One-click convert — ditch/path/wall/bed CAD linework, ink kept as reference"
                    style={{
                      flex: 1,
                      padding: "5px 8px",
                      border: "1px solid color-mix(in srgb, var(--gs-line-strong) 60%, transparent)",
                      borderRadius: "var(--gs-radius-chip)",
                      background: "transparent",
                      color: "var(--gs-ink-secondary)",
                      fontFamily: "var(--font-ui)",
                      fontSize: 11,
                      cursor: strokes.length === 0 ? "not-allowed" : "pointer",
                      opacity: strokes.length === 0 ? 0.5 : 1,
                    }}
                  >
                    Convert to CAD features
                  </button>
                </div>
                {cadProposals.length > 0 && !cadReviewOpen ? (
                  <button
                    type="button"
                    data-testid="cad-review-open"
                    onClick={() => setCadReviewOpen(true)}
                    style={{
                      padding: "5px 8px",
                      border: "1px solid color-mix(in srgb, var(--gs-primary) 45%, transparent)",
                      borderRadius: "var(--gs-radius-chip)",
                      background: "color-mix(in srgb, var(--gs-primary) 14%, transparent)",
                      color: "var(--gs-primary)",
                      fontFamily: "var(--font-ui)",
                      fontSize: 11,
                      cursor: "pointer",
                    }}
                  >
                    Review {cadProposals.length} CAD proposal
                    {cadProposals.length === 1 ? "" : "s"}
                  </button>
                ) : null}
                {sketchCadNotice ? (
                  <p
                    role="status"
                    data-testid="sketch-cad-notice"
                    style={{
                      margin: 0,
                      fontSize: 10.5,
                      lineHeight: 1.4,
                      color: /photo-traced/.test(sketchCadNotice)
                        ? "var(--gs-ink-conflict)"
                        : "var(--gs-ink-secondary)",
                    }}
                  >
                    {sketchCadNotice}
                  </p>
                ) : null}
              </div>
            );
          } else if (metaTab === "studio") {
            dismiss = () => setMetaTab(null);
            body = (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
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
                      fontSize: 11,
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
                      fontSize: 10.5,
                      color: "var(--gs-ink-secondary)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    B {stats.boundaryPoints} · I {stats.items} · S {stats.strokes}
                    {stats.strikes > 0 && (
                      <span style={{ color: "var(--gs-ink-conflict)" }}>
                        {" "}
                        · ⚠ {stats.strikes}
                      </span>
                    )}{" "}
                    | {stats.scaleM.toFixed(0)} m
                  </span>
                </div>
                <SaveStatusChip />
                <nav
                  aria-label="Project destinations"
                  style={{ display: "flex", gap: 10 }}
                >
                  <a
                    href="/home"
                    style={{ color: "var(--gs-ink-secondary)", fontSize: 10.5 }}
                  >
                    Sites
                  </a>
                  <a
                    href={`/projects/${projectId}/outputs`}
                    style={{ color: "var(--gs-primary)", fontSize: 10.5 }}
                  >
                    Outputs
                  </a>
                </nav>
                <div
                  style={{
                    display: "flex",
                    borderRadius: 6,
                    border: "1px solid var(--gs-line)",
                    overflow: "hidden",
                  }}
                >
                  <button
                    type="button"
                    aria-pressed={!is3D}
                    onClick={() => setPitchDeg(0)}
                    style={{
                      flex: 1,
                      padding: "2px 10px",
                      border: "none",
                      background: !is3D ? "var(--gs-chip-active)" : "transparent",
                      color: !is3D
                        ? "var(--gs-chip-active-ink)"
                        : "var(--gs-ink-secondary)",
                      fontFamily: "var(--font-ui)",
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Plan
                  </button>
                  <button
                    type="button"
                    aria-pressed={is3D}
                    onClick={() => setPitchDeg(DEFAULT_CAMERA_RIG.tiltDeg)}
                    style={{
                      flex: 1,
                      padding: "2px 10px",
                      border: "none",
                      background: is3D ? "var(--gs-chip-active)" : "transparent",
                      color: is3D
                        ? "var(--gs-chip-active-ink)"
                        : "var(--gs-ink-secondary)",
                      fontFamily: "var(--font-ui)",
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    3D
                  </button>
                </div>
                <div
                  style={{ display: "flex", gap: 4 }}
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
                      <button
                        key={label}
                        type="button"
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
                        style={{
                          flex: 1,
                          padding: "2px 0",
                          border: "1px solid color-mix(in srgb, var(--gs-line) 55%, transparent)",
                          borderRadius: "var(--gs-radius-chip)",
                          background: "transparent",
                          color: disabled ? "var(--gs-ink-muted)" : "var(--gs-ink-secondary)",
                          fontFamily: "var(--font-tech)",
                          fontSize: 12,
                          cursor: disabled ? "not-allowed" : "pointer",
                        }}
                      >
                        {glyph}
                      </button>
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
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div
                  style={{
                    display: "flex",
                    gap: 4,
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
                    <span style={{ ...scrubberValueStyle, fontSize: 14 }}>
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
                    <span style={{ ...scrubberValueStyle, fontSize: 14 }}>
                      {seasonMeta.month}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                    {SUN_DATE_PRESETS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        aria-pressed={sunDatePreset === p}
                        onClick={() => setSunDatePreset(p)}
                        style={{
                          padding: "2px 6px",
                          borderRadius: "var(--gs-radius-chip)",
                          border: "1px solid color-mix(in srgb, var(--gs-line) 45%, transparent)",
                          background:
                            sunDatePreset === p
                              ? "var(--gs-chip-active)"
                              : "transparent",
                          color:
                            sunDatePreset === p
                              ? "var(--gs-chip-active-ink)"
                              : "var(--gs-ink-secondary)",
                          fontFamily: "var(--font-ui)",
                          fontSize: 10,
                          cursor: "pointer",
                        }}
                      >
                        {sunDatePresetLabel(p)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          } else if (metaTab === "growth") {
            dismiss = () => setMetaTab(null);
            body = (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
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
                style={{ display: "flex", gap: 4, flexWrap: "wrap" }}
              >
                {(
                  [
                    ["sketch", "Ink"],
                    ["siteTruth", "Site truth"],
                    ["design", "Design"],
                  ] as const
                ).map(([layer, label]) => (
                  <button
                    key={layer}
                    type="button"
                    aria-pressed={visibleLayers[layer]}
                    onClick={() =>
                      setVisibleLayers((current) => ({
                        ...current,
                        [layer]: !current[layer],
                      }))
                    }
                    style={{
                      padding: "3px 8px",
                      borderRadius: "var(--gs-radius-chip)",
                      border: "1px solid color-mix(in srgb, var(--gs-line) 45%, transparent)",
                      background: visibleLayers[layer]
                        ? "var(--gs-chip-active)"
                        : "transparent",
                      color: visibleLayers[layer]
                        ? "var(--gs-chip-active-ink)"
                        : "var(--gs-ink-secondary)",
                      fontFamily: "var(--font-ui)",
                      fontSize: 10.5,
                      cursor: "pointer",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            );
          } else if (metaTab === "site") {
            dismiss = () => setMetaTab(null);
            body = (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
                      gap: 4,
                      padding: "5px 7px",
                      borderRadius: "var(--gs-radius-chip)",
                      background: "var(--gs-surface-fill)",
                      border: "1px solid color-mix(in srgb, var(--gs-line) 45%, transparent)",
                      color: "var(--gs-ink-secondary)",
                      fontFamily: "var(--font-ui)",
                      fontSize: 10.5,
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
                      style={{ color: "var(--gs-primary)" }}
                    >
                      Open VicPlan
                    </a>
                    <a
                      href="https://www.vic.gov.au/find-my-local-council"
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "var(--gs-primary)" }}
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
                    gap: 4,
                    padding: "6px 9px",
                    borderRadius: "var(--gs-radius-chip)",
                    background: "var(--gs-surface-fill)",
                    border: "1px solid color-mix(in srgb, var(--gs-line) 45%, transparent)",
                    color: "var(--gs-ink-secondary)",
                    fontFamily: "var(--font-ui)",
                    fontSize: 10.5,
                    lineHeight: 1.45,
                  }}
                >
                  <span style={{ color: "var(--gs-ink)" }}>
                    Aboriginal cultural heritage (ACHRIS) is not part of the
                    public overlay washes — check the register before design.
                  </span>
                  <span style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    <a
                      href="https://achris.vic.gov.au/"
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "var(--gs-primary)" }}
                    >
                      ACHRIS register
                    </a>
                    <a
                      href="https://www.environment.vic.gov.au/biodiversity/naturekit"
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "var(--gs-primary)" }}
                    >
                      NatureKit (EVC)
                    </a>
                    <a
                      href="https://elevation.fsdf.org.au/"
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "var(--gs-primary)" }}
                    >
                      ELVIS elevation
                    </a>
                    <a
                      href="https://mapshare.vic.gov.au/vicplan/"
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "var(--gs-primary)" }}
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
                      fontSize: 11,
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
                      style={{ color: "var(--gs-primary)" }}
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
                      fontSize: 11,
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
                      gap: 4,
                      padding: "4px 8px",
                      borderRadius: "var(--gs-radius-pill)",
                      background: "color-mix(in srgb, var(--gs-truth-ink) 12%, transparent)",
                      border: "1px solid color-mix(in srgb, var(--gs-truth-ink) 40%, transparent)",
                      color: "var(--gs-ink-truth)",
                      fontFamily: "var(--font-ui)",
                      fontSize: 10.5,
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
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
                  gap: 8,
                  color: "var(--gs-ink)",
                  fontFamily: "var(--font-ui)",
                  fontSize: 11,
                  lineHeight: 1.45,
                }}
              >
                <strong>Build the concept before pricing</strong>
                <span style={{ color: "var(--gs-ink-secondary)" }}>
                  Add accepted planting or hardscape items to create a live fit-sheet.
                </span>
                <button
                  type="button"
                  onClick={() => onNativeMode("cad")}
                  style={{
                    minHeight: 32,
                    borderRadius: "var(--gs-radius-chip)",
                    border: "1px solid color-mix(in srgb, var(--gs-primary) 45%, transparent)",
                    background: "color-mix(in srgb, var(--gs-primary) 14%, transparent)",
                    color: "var(--gs-primary)",
                    fontFamily: "var(--font-ui)",
                    cursor: "pointer",
                  }}
                >
                  Open CAD drafter
                </button>
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
                maxHeight: "min(420px, calc(100dvh - 240px))",
                overflowY: "auto",
                scrollbarWidth: "thin",
                borderRadius: "var(--gs-radius-panel)",
                background: "var(--gs-panel-grad)",
                border: "1px solid color-mix(in srgb, var(--gs-line) 55%, transparent)",
                boxShadow: "var(--gs-shadow-2)",
                padding: "12px 14px",
                display: "flex",
                flexDirection: "column",
                gap: 6,
                animation: "wsPanelIn 160ms ease-out",
              }}
            >
              {dismiss ? (
                <button
                  type="button"
                  aria-label="Close panel"
                  onClick={dismiss}
                  style={{
                    position: "absolute",
                    top: 6,
                    right: 6,
                    width: 24,
                    height: 24,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "var(--gs-radius-pill)",
                    border: "1px solid transparent",
                    background: "transparent",
                    color: "var(--gs-ink-secondary)",
                    fontSize: 14,
                    lineHeight: 1,
                    cursor: "pointer",
                  }}
                >
                  ×
                </button>
              ) : null}
              {body}
            </div>
          );
        })()}

        {/* Estimation companion — semi-persistent in the dock (estimation-dock
            spec §3): renders alongside any mode surface, toggleable via the
            Fit tab, self-gating on fitSheetOpen/items/summary. */}
        {!splitView && fitSheetOpen ? (
          <FitSheetCard
            projectId={projectId}
            items={items ?? []}
            boundaryPct={boundaryPct}
            constructionTrenches={constructionTrenches}
            irrigationZones={irrigationZones}
            scaleM={scaleM}
            outdoorM2={outdoorM2}
          />
        ) : null}
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

      {/* Selection chip — the ONE selection state readout (placements,
          features, photo-trace strokes). Esc clears; survives mode switches. */}
      {selection.length > 0 ? (
        <div
          data-testid="selection-chip"
          role="status"
          aria-live="polite"
          style={{
            position: "absolute",
            left: 60,
            bottom: 12,
            display: "flex",
            alignItems: "center",
            gap: 8,
            pointerEvents: "auto",
            padding: "5px 10px",
            borderRadius: "var(--gs-radius-pill)",
            background: "var(--gs-chip-active)",
            color: "var(--gs-chip-active-ink)",
            fontFamily: "var(--font-ui)",
            fontSize: 11,
            boxShadow: "var(--gs-shadow-2)",
          }}
        >
          <span data-testid="selection-count">
            {selection.length} selected · Esc clears
          </span>
          <button
            type="button"
            data-testid="selection-clear"
            aria-label="Clear selection"
            onClick={() => useStudioStore.getState().clearSelection()}
            style={{
              border: "none",
              background: "transparent",
              color: "var(--gs-chip-active-ink)",
              fontFamily: "var(--font-ui)",
              fontSize: 11,
              cursor: "pointer",
              padding: 0,
            }}
          >
            Clear
          </button>
        </div>
      ) : null}

      {/* Asset discovery fan-out dock — bottom-centre, above the growth card */}
      <AssetFanOutDock />

      {/* Photo-trace HUD — the only chrome while a photo is pinned. */}
      <PhotoTraceHud />

      {/* Photo elevation sheet — the trace's print artifact. */}
      {photoSheetId ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "auto",
            zIndex: 7,
          }}
        >
          <PhotoElevationSheet
            elevationId={photoSheetId}
            onClose={() => setPhotoSheetId(null)}
          />
        </div>
      ) : null}

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

      {/* First-run controls hint — dismissed for the session once seen. */}
      <FirstRunHint />

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
            zIndex: 6,
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
          module consumes the new shell). Last chrome child so the paper
          deck owns the surface while presenting; Back exits to CAD. */}
      {presentationMode && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "auto",
            zIndex: 8,
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
      </div>
    </div>
  );
}


/**
 * First-run controls hint — one dismissible chip, remembered for the
 * browser session. Zoom/pan/Cmd+K were invisible until asked; make the
 * control scheme discoverable once.
 */
function FirstRunHint() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!sessionStorage.getItem("gs-controls-hint-seen")) setShow(true);
  }, []);
  if (!show) return null;
  return (
    <div
      data-testid="controls-hint"
      style={{
        position: "absolute",
        bottom: 160,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "5px 10px",
        borderRadius: "var(--gs-radius-pill)",
        background: "color-mix(in srgb, var(--gs-glass) 45%, transparent)",
        backdropFilter: "blur(var(--gs-blur))",
        WebkitBackdropFilter: "blur(var(--gs-blur))",
        border: "1px solid color-mix(in srgb, var(--gs-line) 35%, transparent)",
        pointerEvents: "auto",
        zIndex: 5,
        fontFamily: "var(--font-ui)",
        fontSize: 11,
        color: "var(--gs-ink-secondary)",
      }}
    >
      <span>Wheel = zoom · Drag = pan · Tabs = surfaces · Ctrl+K = commands</span>
      <button
        type="button"
        aria-label="Dismiss controls hint"
        data-testid="controls-hint-dismiss"
        onClick={() => {
          sessionStorage.setItem("gs-controls-hint-seen", "1");
          setShow(false);
        }}
        style={{
          all: "unset",
          cursor: "pointer",
          color: "var(--gs-primary)",
          fontFamily: "var(--font-tech)",
          padding: "0 4px",
        }}
      >
        ✕
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Shared UI primitives                                                       */
/* -------------------------------------------------------------------------- */

const scrubberLabelStyle: React.CSSProperties = {
  fontFamily: "var(--font-ui)",
  fontSize: 10.5,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--gs-ink-secondary)",
};

const scrubberValueStyle: React.CSSProperties = {
  fontFamily: "var(--font-tech)",
  fontSize: 14,
  fontWeight: 500,
  color: "var(--gs-primary)",
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
        gap: 4,
        padding: "2px 7px",
        borderRadius: 999,
        border: "1px solid color-mix(in srgb, var(--gs-line) 45%, transparent)",
        fontFamily: "var(--font-tech)",
        fontSize: 10.5,
        color: "var(--gs-ink-secondary)",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ letterSpacing: "0.06em", textTransform: "uppercase" }}>{label}</span>
      <span style={{ color: accent ? "var(--gs-primary)" : "var(--gs-ink)", fontSize: 11 }}>
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
        fontSize: 11,
        color: "var(--gs-primary)",
      }}
    >
      Measure · {lengthM.toFixed(2)} m · Esc clears
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
          borderRadius: 9999,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            height: "100%",
            width: `${pct}%`,
            background: "var(--gs-primary)",
            borderRadius: 9999,
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
            background: "var(--gs-primary)",
            border: "2px solid var(--gs-canvas)",
            borderRadius: "50%",
            boxShadow: "0 0 8px rgba(251,191,36,0.6)",
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
          fontSize: 10.5,
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
              style={{ color: isHighlight ? "var(--gs-primary)" : "var(--gs-ink-secondary)" }}
            >
              {label}
            </span>
          );
        })}
      </div>
    </>
  );
}
