"use client";

/**
 * Gold Standard 2026 — Unified WebGL Studio (Fused Rendering Context).
 *
 * The primary operator surface. Mounts the WebGLStudio with ALL canvas data
 * wired: boundary, building, easements, items, strokes, subsurface utilities
 * (from BYDA assets), strike alerts (from trench×utility intersection),
 * terrain heightmap (from spot levels), and the aerial underlay.
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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type {
  CanvasStroke,
  CatalogPlacement,
  ConstructionTrench,
  DesignBydaAsset,
  DesignKeylessOverlay,
  DesignNeighbourBuilding,
  DesignSiteFrameLevel,
  IrrigationZone,
} from "@workstream/contracts";
import { GlassCard } from "./GlassCard";
import { VignetteOverlay } from "./VignetteOverlay";
import { SaveStatusChip } from "./SaveStatusChip";
import { DEFAULT_CAMERA_RIG, type StudioCameraRig } from "./cameraRig";
import { pctToWorld, type PctPoint } from "./coordTransform";
import { PRESENTATION_LENS, TECHNICAL_LENS } from "./PresentationLens";
import {
  useStudioStore,
  seasonLabel,
  seasonMonth,
  leafStatus,
} from "./studioStore";
import { useStudioAutosave, useBeforeUnloadGuard } from "./useStudioAutosave";
import { computeLiveStudioData } from "./canvasBridges";
import { SliceProfileCard } from "./SliceProfileCard";
import { DrainageFlowCard } from "./DrainageFlowCard";
import { EarthworksCard } from "./EarthworksCard";
import { FitSheetCard } from "./FitSheetCard";
import { AssetFanOutDock } from "./AssetFanOutDock";
import { StudioToolRail } from "./StudioToolRail";
import { StudioModeTabs } from "./StudioModeTabs";
import { canvasLayerPolicy } from "./layerPolicy";
import { importSiteTruth } from "./siteTruthImport";
import { StudioCommandPalette } from "./StudioCommandPalette";
import { StudioElevationCard } from "./StudioElevationCard";
import { StudioCadCard } from "./StudioCadCard";
import { SplitViewLens } from "./SplitViewLens";
import { placementsToItems } from "../handoff/state/canvasBridge";
import { toRenderItems } from "./stateBridge";
import { unlockedModes, type CanvasMode, type CanvasProgress } from "../../../lib/canvas-mode";
import { SiteContextBadges } from "../../SiteContextBadges";
import { GardenViewpointStrip } from "../handoff/features/viewpoint/GardenViewpointStrip";
import { viewpointYawDeg, type GardenViewpointLook } from "../handoff/features/tilt/tiltMath";
import { SurveyChecklist } from "../handoff/features/survey/SurveyChecklist";
import { ShareSurface } from "../handoff/features/share/ShareSurface";

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
  /** Aerial photo URI (for the ground underlay texture). */
  aerialUri?: string | null;
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
  bydaAssets = [],
  constructionTrenches = [],
  irrigationZones = [],
  levels = [],
  keylessOverlays = [],
  neighbourBuildings = [],
  outdoorM2 = 0,
  aerialUri = null,
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
  const [rig, setRig] = useState<StudioCameraRig>(DEFAULT_CAMERA_RIG);
  const [presentationMode, setPresentationMode] = useState(false);
  const [activeMode, setActiveMode] = useState<CanvasMode>(initialMode);
  const [cadGhostCount, setCadGhostCount] = useState<number | null>(
    initialCadGhostCount,
  );
  const [quotePersisted, setQuotePersisted] = useState(hasQuote);
  const [portalUri, setPortalUri] = useState<string | null>(quotePortalUri);
  const [visibleLayers, setVisibleLayers] = useState({
    aerial: true,
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
    setViewBlendTarget(1);
    setRig({
      ...DEFAULT_CAMERA_RIG,
      tiltDeg: 76,
      zoom: 1.45,
      rotateDeg: viewpointYawDeg(look),
    });
  };

  const onNativeMode = (mode: CanvasMode) => {
    setActiveMode(mode);
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
      store.setViewBlendTarget(0);
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
  const setSeasonProgress = useStudioStore((s) => s.setSeasonProgress);
  const viewBlendTarget = useStudioStore((s) => s.viewBlendTarget);
  const setViewBlendTarget = useStudioStore((s) => s.setViewBlendTarget);
  const canUndo = useStudioStore((s) => s.historyPast.length > 0);
  const canRedo = useStudioStore((s) => s.historyFuture.length > 0);
  const subsurfaceView = useStudioStore((s) => s.subsurfaceView);
  const strokes = useStudioStore((s) => s.sketchStrokes);
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
    store.setProjectContext(projectId, aerialUri, projectAddress);
    if (initialSketchMode) store.setSketchMode(true);
  }, [initialStrokes, initialPlacements, projectId, aerialUri, projectAddress, initialSketchMode, hydratedRef]);

  // Placements live in the store after hydration — the live source for both
  // the 3D items and the autosave doc. Pure client-side bridge (proven in
  // the SVG studio's client hook); unknown symbol ids degrade gracefully.
  const storePlacements = useStudioStore((s) => s.placements);
  const splitView = useStudioStore((s) => s.splitView);
  const items = useMemo(
    () => toRenderItems(placementsToItems(storePlacements)),
    [storePlacements],
  );
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

  // Sketch photo underlay — upload an on-site aerial/elevation photo as
  // the tracing base (persisted server-side on the survey; refresh re-renders
  // the server component with the new aerialUri — no remount of the scene).
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const uploadSitePhoto = useCallback(
    async (file: File) => {
      setPhotoBusy(true);
      setPhotoError(null);
      try {
        const body = new FormData();
        body.append("aerial", file);
        const res = await fetch(`/api/projects/${projectId}/aerial`, {
          method: "POST",
          body,
        });
        if (!res.ok) {
          const payload = (await res.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(payload?.error ?? `Upload failed (${res.status})`);
        }
        window.location.reload();
      } catch (error) {
        setPhotoError(
          error instanceof Error ? error.message : "Site photo upload failed",
        );
      } finally {
        setPhotoBusy(false);
      }
    },
    [projectId],
  );

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

  // Progress re-derives live from the store — placing the first asset or
  // drawing the first stroke unlocks CAD/quote/present without a reload
  // (the server-rendered snapshot only seeds the initial state).
  const liveProgress = useMemo<CanvasProgress>(
    () => ({
      hasAerial: progress.hasAerial || Boolean(aerialUri),
      hasSketch: progress.hasSketch || strokes.length > 0,
      hasCad:
        progress.hasCad || storePlacements.length > 0 || boundaryPct.length > 0,
      hasQuote: progress.hasQuote,
    }),
    [progress, aerialUri, strokes, storePlacements, boundaryPct],
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
        scaleM,
        boardAspect,
      }),
    [bydaAssets, constructionTrenches, irrigationZones, levels, scaleM, boardAspect],
  );

  // --- Autosave (debounced + retry + backoff) ---
  const autosaveDoc = useMemo(
    () => ({ placements: storePlacements, strokes }),
    [storePlacements, strokes],
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
      tilt: rig.tiltDeg,
    }),
    [boundaryPct, buildingPct, easementsPct, items, strokes, liveData, scaleM, rig.tiltDeg],
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
    aerialUri: visibleLayers.aerial ? aerialUri : null,
    heightmapPoints: liveData.heightmapPoints,
    keylessOverlays: visibleLayers.siteTruth ? keylessOverlays : [],
    neighbourBuildings: visibleLayers.siteTruth ? neighbourBuildings : [],
    showSketch: visibleLayers.sketch,
    layerPolicy: policy,
    onContextLost: () => setWebglLost(true),
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
        <SplitViewLens sceneProps={sceneProps} rig={rig} onRigChange={setRig} />
      ) : (
        <WebGLStudio {...sceneProps} cameraRig={rig} onRigChange={setRig} />
      )}

      {/* ---- The chrome overlay (pointer-transparent; children opt in) ---- */}
      <div
        data-webgl-chrome
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      >
      {/* Atmospheric vignette — matches the 3D post-processing, fades with blend */}
      <VignetteOverlay />

      {/* Left slim tool icons — bare (no container), border chrome per the
          Stitch reference; the drawing owns the middle. */}
      <StudioToolRail
        showTerrainTools={liveData.heightmapPoints.length > 0}
        showDims={boundaryPct.length >= 3}
        showEarth={liveData.heightmapPoints.length > 0 && hasPads}
        showQuote={(items?.length ?? 0) > 0}
        presentActive={presentationMode}
        onPresentToggle={() => setPresentationMode((p) => !p)}
      />

      {/* Asset discovery fan-out dock — bottom-centre, above the growth card */}
      <AssetFanOutDock />

      {/* Command palette — the power-operator surface (Cmd/Ctrl+K). */}
      <StudioCommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        projectId={projectId}
        unlocked={unlocked}
        onMode={(m) => onNativeMode(m as Parameters<typeof onNativeMode>[0])}
        onZoom={(dir) =>
          setRig((r) => ({
            ...r,
            zoom: Math.min(Math.max(r.zoom * (dir === 1 ? 1.25 : 1 / 1.25), 0.1), 50),
          }))
        }
      />

      {/* First-run controls hint — dismissed for the session once seen. */}
      <FirstRunHint />

      {/* Mode tabs — the preserved 8-mode system (GOLD-STANDARD-2026
          ARCHITECTURE §6). Native modes switch in place; classic-board modes
          navigate to ?svg=1&mode=… so nothing dead-ends. */}
      <StudioModeTabs
        projectId={projectId}
        activeMode={activeMode}
        unlocked={unlocked}
        onNativeMode={onNativeMode}
      />

      {/* Native elevation — the classic ElevationBoard as a glass sheet
          (ARCHITECTURE §5: the feature module consumes the new shell). */}
      {activeMode === "elevation" && (
        <StudioElevationCard
          boundaryPct={boundaryPct}
          buildingPct={buildingPct}
          items={studioItems}
          scaleM={scaleM}
          onTraceInPlan={() => setActiveMode("sketch")}
          onClose={() => setActiveMode("sketch")}
        />
      )}

      {/* Native garden — eye-level viewpoints over the live 3D. */}
      {activeMode === "garden" && (
        <div
          style={{
            position: "absolute",
            bottom: 18,
            left: "50%",
            transform: "translateX(-50%)",
            pointerEvents: "auto",
            zIndex: 5,
          }}
        >
          <GardenViewpointStrip
            activeLook={gardenLook}
            elevLook={null}
            mode="plan"
            onSelect={applyGardenLook}
          />
        </div>
      )}

      {/* Native CAD — the AI drafter hub mounts in the right lane (plan
          locks to technical 2D with working-drawing dims — "CAD style 2D"). */}

      {/* Native survey — the completeness checklist as lane glass (the five
          site-truth items; onTraceBuilding stays a classic-board flow). */}
      {activeMode === "survey" && (
        <div
          data-testid="studio-survey-card"
          style={{
            position: "absolute",
            top: 118,
            right: 12,
            width: 292,
            pointerEvents: "auto",
            zIndex: 5,
            borderRadius: "var(--gs-radius-panel)",
            background: "color-mix(in srgb, var(--gs-glass) 38%, transparent)",
            backdropFilter: "blur(var(--gs-blur))",
            WebkitBackdropFilter: "blur(var(--gs-blur))",
            border: "1px solid color-mix(in srgb, var(--gs-line) 35%, transparent)",
            padding: 10,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              marginBottom: 8,
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
                style={{ margin: 0, fontSize: 10.5, color: "var(--gs-ink-secondary)" }}
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
              provenance: l.source === "vicmap_contour" ? "vicmap_contour" : "authored",
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
      )}

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

      {/* ---- Top-left: compact studio meta + view toggle ---- */}
      <GlassCard position="top-left" style={{ padding: "8px 10px" }}>
        <div style={{ fontFamily: "var(--font-tech)", fontSize: 11, color: "var(--gs-ink)" }}>
          <div
            role="group"
            aria-label="Canvas view"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              gap: 12,
              marginBottom: 4,
            }}
          >
            <span style={{ fontWeight: 600, letterSpacing: "0.06em" }}>STUDIO</span>
            {/* Canvas meta as one dense chip line — the drawing IS the hero */}
            <span style={{ color: "var(--gs-ink-secondary)", fontSize: 10.5 }}>
              B{stats.boundaryPoints} · I{stats.items} · S{stats.strokes}
              {stats.strikes > 0 && (
                <span style={{ color: "var(--gs-ink-conflict)" }}> · ⚠{stats.strikes}</span>
              )}
              {" "}| {stats.scaleM.toFixed(0)}m
            </span>
          </div>
          {/* Save status chip — zero layout shift, fixed-width reserved space */}
          <div style={{ marginBottom: 4 }}>
            <SaveStatusChip />
          </div>
          <nav
            aria-label="Project destinations"
            style={{ display: "flex", gap: 8, marginBottom: 6 }}
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

          {/* View toggle — Plan ↔ 3D (drives the fused camera) */}
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
              onClick={() => setViewBlendTarget(0)}
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
                transition: "background 0.2s, color 0.2s",
              }}
            >
              Plan
            </button>
            <button
              type="button"
              aria-pressed={is3D}
              onClick={() => setViewBlendTarget(1)}
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
                transition: "background 0.2s, color 0.2s",
              }}
            >
              3D
            </button>
          </div>

          {/* Camera + history affordances — zoom is wheel-first; the buttons
              make it discoverable and touch-usable. Undo/redo mirror Cmd+Z. */}
          <div
            style={{ display: "flex", gap: 4, marginTop: 6 }}
            role="group"
            aria-label="Camera and history"
          >
            {(
              [
                ["−", "Zoom out", () => setRig((r) => ({ ...r, zoom: Math.max(r.zoom / 1.25, 0.1) }))],
                ["+", "Zoom in", () => setRig((r) => ({ ...r, zoom: Math.min(r.zoom * 1.25, 50) }))],
                ["↶", "Undo (Ctrl+Z)", () => useStudioStore.getState().undo()],
                ["↷", "Redo (Ctrl+Shift+Z)", () => useStudioStore.getState().redo()],
              ] as Array<[string, string, () => void]>
            ).map(([glyph, label, fn]) => {
              const disabled = label.startsWith("Undo") ? !canUndo : label.startsWith("Redo") ? !canRedo : false;
              return (
                <button
                  key={label}
                  type="button"
                  aria-label={label}
                  data-testid={label.startsWith("Zoom out") ? "zoom-out" : label.startsWith("Zoom in") ? "zoom-in" : label.startsWith("Undo") ? "undo-btn" : "redo-btn"}
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

          {/* Measure readout — DOM twin of the in-canvas tape label. A11y +
              e2e surface; subscribes independently so only the chip re-renders. */}
          <MeasureReadoutChip scaleM={scaleM} boardAspect={boardAspect} />
        </div>
      </GlassCard>

      {/* ---- Bottom-center: growth timeline scrubber (compact) ---- */}
      <GlassCard
        position={{
          bottom: 16,
          // Safe-zone centre (clear of the tool rail + right column).
          left: "calc(50% - 85px)",
          transform: "translateX(-50%)",
        }}
        style={{
          width: "min(30rem, calc(100vw - 620px))",
          padding: "8px 12px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 12,
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
      </GlassCard>

      {/* ---- Top-center: sun + season scrubbers (compact twin row) ---- */}
      <div
        style={{
          position: "absolute",
          top: 12,
          // Safe-zone centre (clear of the tool rail + right column).
          left: "calc(50% - 85px)",
          transform: "translateX(-50%)",
          display: "flex",
          gap: 8,
          alignItems: "flex-start",
          pointerEvents: "none",
        }}
      >
        <GlassCard position={{ position: "relative" }} style={{ width: 224, padding: "6px 10px" }}>
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
        </GlassCard>
        <GlassCard position={{ position: "relative" }} style={{ width: 224, padding: "6px 10px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 6,
            }}
          >
            <span style={scrubberLabelStyle}>Season · {seasonLabel(seasonProgress)}</span>
            <span style={{ ...scrubberValueStyle, fontSize: 14 }}>{seasonMonth(seasonProgress)}</span>
          </div>
          <ScrubberTrack
            value={seasonProgress}
            min={0}
            max={1}
            step={0.01}
            onChange={setSeasonProgress}
            ariaLabel="Season"
            labels={["Jan", "Jul", "Dec"]}
          />
        </GlassCard>
      </div>

      {/* ---- THE right-hand chrome column — one column, flex-laid-out.
          Two independently anchored stacks on the same edge collided when
          the fit-sheet grew (caught by webgl-chrome-collision.spec); a single
          flex column cannot self-intersect, and scrolls internally in the
          everything-on state. Fit-content width keeps the strip narrow. */}
      <div
        data-testid="right-chrome-column"
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          alignItems: "flex-end",
          maxHeight: "calc(100dvh - 24px)",
          overflowY: "auto",
          pointerEvents: "auto",
          width: "fit-content",
          scrollbarWidth: "thin",
        }}
      >
        {/* Live conditions as a meta chip set — not a card block */}
        <div
          data-gs-glass-card
          style={{
            display: "flex",
            gap: 4,
            padding: "4px 6px",
            borderRadius: 10,
            background: "color-mix(in srgb, var(--gs-glass) 38%, transparent)",
            backdropFilter: "blur(var(--gs-blur))",
            WebkitBackdropFilter: "blur(var(--gs-blur))",
            border: "1px solid color-mix(in srgb, var(--gs-line) 35%, transparent)",
            pointerEvents: "auto",
          }}
        >
          <MetaChip label="Season" value={seasonLabel(seasonProgress)} />
          <MetaChip label="Leaf" value={leafStatus(seasonProgress, year)} accent />
          <MetaChip label="Sun" value={`${sunMin}m`} />
        </div>
        <div
          data-gs-glass-card
          data-testid="canvas-layer-controls"
          role="group"
          aria-label="Canvas layers"
          style={{
            display: "flex",
            gap: 4,
            padding: "4px 6px",
            borderRadius: "var(--gs-radius-panel)",
            background: "var(--gs-glass-veil)",
            border: "1px solid color-mix(in srgb, var(--gs-line) 35%, transparent)",
          }}
        >
          {(
            [
              ["aerial", "Photo"],
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
                padding: "3px 7px",
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
        {/* Council planning badges + season (GET /site-context) */}
        <SiteContextBadges projectId={projectId} variant="glass" />
        {keylessOverlays.length > 0 ? (
          <div
            data-testid="government-overlay-legend"
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "flex-end",
              gap: 4,
              maxWidth: 300,
              padding: "5px 7px",
              borderRadius: "var(--gs-radius-chip)",
              background: "var(--gs-glass-veil)",
              border: "1px solid color-mix(in srgb, var(--gs-line) 35%, transparent)",
              color: "var(--gs-ink-secondary)",
              fontFamily: "var(--font-ui)",
              fontSize: 10.5,
            }}
          >
            <strong style={{ color: "var(--gs-ink)" }}>Government layers</strong>
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
        {(easementsPct?.length ?? 0) > 0 || subsurfaceView ? (
          <div
            role="note"
            data-testid="site-truth-honesty"
            style={{
              maxWidth: 300,
              padding: "6px 9px",
              borderRadius: "var(--gs-radius-chip)",
              background: "var(--gs-glass-veil)",
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
              maxWidth: 280,
              padding: "5px 8px",
              borderRadius: "var(--gs-radius-chip)",
              background: "var(--gs-glass-veil)",
              color: "var(--gs-ink-secondary)",
              fontFamily: "var(--font-ui)",
              fontSize: 11,
            }}
          >
            Solar analysis unavailable until the property pin is verified.
          </div>
        ) : null}
        {activeMode === "sketch" && (
          <>
            <button
              type="button"
              data-testid="sketch-photo-upload"
              disabled={photoBusy}
              onClick={() => photoInputRef.current?.click()}
              style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 10px",
              borderRadius: "var(--gs-radius-pill)",
              background: "color-mix(in srgb, var(--gs-primary) 10%, transparent)",
              border: "1px solid color-mix(in srgb, var(--gs-primary) 40%, transparent)",
              color: "var(--gs-primary)",
              fontFamily: "var(--font-ui)",
              fontSize: 10.5,
              cursor: photoBusy ? "wait" : "pointer",
              whiteSpace: "nowrap",
              }}
            >
              {photoBusy ? "Uploading…" : "Trace a site photo"}
            </button>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/jpeg,image/png"
              disabled={photoBusy}
              hidden
              aria-label="Choose a site photo to trace"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadSitePhoto(f);
                e.currentTarget.value = "";
              }}
            />
            {photoError ? (
              <p role="alert" style={{ margin: 0, color: "var(--gs-ink-conflict)", fontSize: 11 }}>
                {photoError}
              </p>
            ) : null}
          </>
        )}
        {/* In-context deep link while the subsurface blueprint is open. */}
        {subsurfaceView && (
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
        )}
        {activeMode === "cad" && (
          <StudioCadCard
            projectId={projectId}
            onCadResult={(result) => setCadGhostCount(result.ghost_count)}
          />
        )}
        {(items?.length ?? 0) > 0 &&
          (activeMode === "sketch" ||
            activeMode === "cad" ||
            activeMode === "quote" ||
            activeMode === "garden") && (
          <FitSheetCard
            projectId={projectId}
            items={items ?? []}
            boundaryPct={boundaryPct}
            constructionTrenches={constructionTrenches}
            irrigationZones={irrigationZones}
            scaleM={scaleM}
            outdoorM2={outdoorM2}
          />
        )}
        {activeMode === "quote" && (items?.length ?? 0) === 0 ? (
          <GlassCard
            position={{ position: "relative" }}
            style={{ width: 280, padding: "10px 12px" }}
          >
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
          </GlassCard>
        ) : null}
        {liveData.heightmapPoints.length > 0 && (
          <SliceProfileCard
            scaleM={scaleM}
            boardAspect={boardAspect}
            heightmapPoints={liveData.heightmapPoints}
          />
        )}
        {liveData.heightmapPoints.length > 0 && (
          <DrainageFlowCard
            scaleM={scaleM}
            boardAspect={boardAspect}
            heightmapPoints={liveData.heightmapPoints}
            hydraulicResults={liveData.hydraulicResults}
          />
        )}
        {liveData.heightmapPoints.length > 0 && (
          <EarthworksCard
            scaleM={scaleM}
            boardAspect={boardAspect}
            heightmapPoints={liveData.heightmapPoints}
          />
        )}
      </div>
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
        bottom: 86,
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
      <span>Wheel = zoom · Drag = pan · Plan/3D top-left · Ctrl+K = commands</span>
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
