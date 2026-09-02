/**
 * Gold Standard 2026 — Unified Studio Store (Fused Rendering Context).
 *
 * The single source of truth for ALL studio state — the backbone of the fused
 * rendering context. This store supersedes seasonalStore.ts, extending it with:
 *
 *   - viewBlendTarget [0–1]:  The fused camera axis. 0 = orthographic plan view
 *                             (CAD-accurate, top-down). 1 = perspective oblique
 *                             (3D spatial). The FusedCamera lerps the projection
 *                             matrix + camera position along this axis — the
 *                             user never experiences a hard cut between plan
 *                             and 3D.
 *   - sketchStrokes:          The shared ink layer (CanvasStroke[] in board-%
 *                             space). The SAME strokes render in plan view
 *                             (flat on the ground) and in 3D (raycast-draped).
 *                             No separate SVG sketch surface, no second ink
 *                             system.
 *   - projectId + aerialUri:  Context for persistence (aerial underlay
 *                             retired PR #199 — uri kept for the store API).
 *   - save status machine:    idle/saving/retrying/saved/error + revision.
 *
 * Binding constraint (LA Seasonal Dynamics spec): state read inside useFrame
 * must use `getState()` (transient — zero re-renders). DOM HUD subscribes via
 * selector hooks. The viewBlend is animated in useFrame (FusedCamera eases it
 * toward the target), so the store holds the TARGET value.
 */

import { create } from "zustand";
import type {
  BuildingFootprint,
  CanvasStroke,
  CatalogPlacement,
  ConstructionTrench,
  ConstructionTrenchKind,
  IrrigationZone,
  IrrigationZoneKind,
  KeylessOverlayKind,
  LaborProfile,
  LandscapeFeature,
  MaterialFill,
  NibKind,
  PhotoElevation,
  PhotoTraceStroke,
  SetbackLine,
  SketchCanvas,
} from "@workstream/contracts";
import { PALETTE } from "../../../styles/colorTokens";
import {
  DEFAULT_HATCH_SPACING_PCT,
  hatchLinesForPolygon,
  isClosedRing,
  sunHatchAngleDeg,
} from "./hatchSun";
import { DEFAULT_NIB, NEUTRAL_TELEMETRY, type StylusTelemetry } from "./nibs";
import {
  melbourneSeason,
  type FloraStudioForm,
  type MelbourneSeason,
} from "@workstream/domain";
import {
  DEFAULT_STITCH_EPSILON_M,
  type SpatialPoint,
  type StitchRecord,
} from "@workstream/domain";
import {
  sunDateFromPreset,
  type SunDatePreset,
} from "../handoff/features/sunGrowth/sunDatePreset";
import type { AnnotationDialect } from "./annotations/model";
import type { PctPoint } from "./coordTransform";
import type { FixedPlaneId } from "./planeStack";
import {
  AXO_PITCH_DEG,
  blendTargetForPitch,
  clampPitchDeg,
  DEFAULT_CAMERA_RIG,
  GARDEN_PITCH_DEG,
  isElevationRig,
  nearestFacadeNormalDeg,
  type StudioCameraRig,
} from "./cameraRig";
import { alignRigToActiveCanvas } from "./drawViewAlign";
import {
  convertStrokesToFeatures,
  featureForAcceptedProposal,
  photoTraceScopeNotice,
  proposeSketchCad,
  type SketchCadProposal,
} from "./sketchCad";
import {
  dedupeSelection,
  pruneSelection,
  type SelectionRef,
} from "./selectionPick";
import {
  clampPlacementEdit,
  MASS_PLANT_NOTICE_REF,
  patchClamps,
  reconcileGeneratedPlacements,
  type PlacementFieldKey,
} from "./inspectorPolicy";
import { marqueeSelectRefs } from "./marqueeSelect";
import {
  addDraftVertex as appendDraftVertex,
  areaFeatureFromDraft,
  beginDraftSession,
  canCommitDraft,
  polylineStrokeFromDraft,
  undoDraftVertex as dropLastDraftVertex,
  type DraftSession,
  type DraftTool,
} from "./draftShape";
import type { WorldXZ } from "./snapWorld";
import {
  stitchSketchStrokesToFeatures,
  unstitchFeatureToSketchStrokes,
} from "./stitchBridge";
import type { TrenchPointPct } from "./trenchPath";
import type { ZonePointPct } from "./irrigationZonePath";
import type { PlanePoint } from "./photoTraceMath";

/* -------------------------------------------------------------------------- */
/* Angle-opacity falloff presets (Phase E, turn 14c)                         */
/* -------------------------------------------------------------------------- */

/** Falloff preset for the angle-based opacity shader (turn 14c).
 *  NARROW: steep fade — for working. Edge-on canvases drop out fast.
 *  BALANCED: half-opacity at 46° from face-on — general use.
 *  WIDE: gentle fade — for presenting a fly-through. Canvases stay visible. */
export type FalloffPreset = "NARROW" | "BALANCED" | "WIDE";

/** The smoothstep edge values for each falloff preset. The shader computes
 *  `smoothstep(edge0, edge1, abs(dot(viewDir, normal)))` — a higher edge1
 *  means the fade starts sooner (NARROW); a lower edge1 means canvases stay
 *  visible longer (WIDE). The default 0.0→0.3 was the original hardcoded
 *  value, which is the WIDE preset. */
export const FALLOFF_PRESET_EDGES: Record<FalloffPreset, [number, number]> = {
  // Steep: full opacity only near face-on, fades by ~60° from normal.
  NARROW: [0.0, 0.9],
  // Balanced: half-opacity at 46° from face-on (dot = cos(46°) ≈ 0.69).
  // smoothstep(0.0, 1.38, 0.69) ≈ 0.5; full opacity near face-on.
  BALANCED: [0.0, 1.38],
  // Gentle: the original hardcoded value — full opacity by ~72°, only
  // drops near edge-on. Good for fly-throughs where you want to see all
  // canvases as the camera moves.
  WIDE: [0.0, 0.3],
};

/* -------------------------------------------------------------------------- */
/* Cinematic Fly-Through (Phase 5) + Viewpoint Filmstrip (Phase C)           */
/* -------------------------------------------------------------------------- */

/** A saved camera bookmark — world-space position + look-at target.
 *  Captured during navigation, played back as a CatmullRomCurve3 spline.
 *
 *  Phase C extends the bookmark into a "viewpoint" per the spec §9 state shape
 *  (`viewpoints [{ id, camera, thumb }]`). The `thumb` is a PNG data URL
 *  captured from the live WebGL canvas at capture time, and `rig` snapshots
 *  the full camera rig so a click-restore reproduces the exact view (not just
 *  position + target, which the spline-only fly-through used). */
export interface CameraBookmark {
  id: string;
  /** Camera position in world metres [x, y, z]. */
  position: [number, number, number];
  /** Look-at target in world metres [x, y, z]. */
  target: [number, number, number];
  /** Optional PNG data URL thumbnail (82×52 per §4 Geometry). Captured from
   *  the live WebGL canvas at capture time. Absent on legacy bookmarks. */
  thumb?: string;
  /** Optional rig snapshot for click-to-restore. Absent on legacy bookmarks
   *  (the fly-through spline only needs position + target). */
  rig?: {
    panX: number;
    panY: number;
    zoom: number;
    rotateDeg: number;
    tiltDeg: number;
    focusX: number;
    focusY: number;
  };
  /** Optional camera preset at capture time, for restoring the dock state. */
  preset?: CameraPreset;
}

/* -------------------------------------------------------------------------- */
/* Save status types (the Ui slice of the studio store)                    */
/* -------------------------------------------------------------------------- */

export type SaveStatus = "idle" | "saving" | "retrying" | "saved" | "error";
export type SaveErrorKind = "unreachable" | "stale_client" | "rejected" | null;

/**
 * AI site-setup pipeline state machine.
 * IDLE → ANALYZING_SURVEY → GENERATING_SITE → SUCCESS (auto-resets to IDLE).
 */
export type AiProcessingState =
  | "IDLE"
  | "ANALYZING_SURVEY"
  | "GENERATING_SITE"
  | "SUCCESS";

/**
 * Phase 8 — render quality mode.
 * TECHNICAL: clean drafting (no DoF, standard materials).
 * IMMERSIVE: AAA post-processing (N8AO + dynamic DoF + NPR outlines).
 */
export type RenderMode = "TECHNICAL" | "IMMERSIVE";

/**
 * Phase 8 — camera posture.
 * ORBIT: the standard fused ortho↔perspective rig (FusedCamera).
 * PEDESTRIAN: 1.7m first-person walk-through (PedestrianCamera).
 */
export type CameraPosture = "ORBIT" | "PEDESTRIAN";

/**
 * Phase G — Draw Mode vs View Mode.
 * DRAW: camera locked face-on to the active canvas plane. Orbit/tilt
 *   gestures are disabled; pan/zoom remain. Selecting a canvas re-aligns
 *   the camera to look directly at that plane.
 * VIEW: free orbit (the default — the existing fused camera rig).
 */
export type DrawViewMode = "DRAW" | "VIEW";

/**
 * Landscape Canvas v2 — unified tool ids (handoff §5.1).
 * The vertical ribbon's 13 tools + 2 utility tiles, one active at a time.
 * Maps to the legacy tool flags via setActiveTool's bridge logic.
 */
export type ToolId =
  | "pen" | "line" | "spline"           // DRAW
  | "contour" | "slope" | "cutfill"     // GRADE
  | "tree" | "bed"                      // PLANT
  | "mass" | "path"                     // BUILD
  | "dim" | "section"                   // MEASURE
  | "layers" | "history"               // utility row
  | "none";                             // no tool active (default)

/**
 * Landscape Canvas v2 — camera presets (handoff §6.1).
 * The four-button view dock: PLAN (ortho 0°), AXO (ortho 22°),
 * SEC (ortho 90° elevation/cross-section), 3D (perspective blend).
 */
export type CameraPreset = "plan" | "axo" | "sec" | "3d";
export interface SurveyedPlanLayers {
  enabled: boolean;
  /**
   * Survey bearings on the dimension-ring chips (`B7 · S85°25'26"W · 48.20 m`).
   * Was `propertyLines`, when this flag drew a second copy of the title boundary
   * in `AnnotationLayer`; `DimensionLayer` owns boundary edge truth now, and the
   * boundary line itself is `LotBoundary` — never toggleable, it is the anchor.
   */
  bearings: boolean;
  elevations: boolean;
  plants: boolean;
  materials: boolean;
  callouts: boolean;
  scope: boolean;
}

export interface TradePackVisibility {
  irrigationDrainage: boolean;
  hardscapeConstruction: boolean;
  lightingElectrical: boolean;
}

/* -------------------------------------------------------------------------- */
/* Seasonal math helpers — pure functions (callable from useFrame via getState) */
/* -------------------------------------------------------------------------- */

/**
 * Winter factor — 0 in summer, 1 in deep winter.
 * Southern-hemisphere: winter solstice ≈ June 21 → seasonProgress ≈ 0.47.
 * Uses a smooth cosine envelope centred on 0.47.
 */
export function winterFactor(seasonProgress: number): number {
  const centre = 0.47;
  const phase = (seasonProgress - centre) * Math.PI * 2;
  return Math.max(0, (Math.cos(phase) + 1) / 2);
}

/**
 * Autumn factor — 0 outside autumn, peaks at 1 in mid-autumn.
 * Southern-hemisphere: autumn ≈ Mar–May → seasonProgress ≈ 0.17–0.33.
 * Centred on 0.25 (mid-April).
 */
export function autumnFactor(seasonProgress: number): number {
  const centre = 0.25;
  const phase = (seasonProgress - centre) * Math.PI * 2;
  return Math.max(0, (Math.cos(phase) + 1) / 2);
}

/**
 * Melbourne calendar day-of-year for an instant (single normalisation point
 * for the season axis). The label authority stays in the domain's
 * `melbourneSeason()`; this only converts the sun date back into the 0–1
 * progress value the material factors are expressed in.
 */
function melbourneDayOfYear(when: Date): { year: number; doy: number } {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Melbourne",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(when);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  const year = get("year");
  const month = get("month");
  const day = get("day");
  const start = Date.UTC(year, 0, 0);
  const doy = Math.floor((Date.UTC(year, month - 1, day) - start) / 86_400_000);
  return { year, doy };
}

function daysInYear(year: number): number {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365;
}

/**
 * Derive the 0–1 season axis (0 = Jan 1 → 1 = Dec 31) from the SAME date the
 * sun is sampled at. `seasonProgress` is no longer a free scrubber — it is a
 * pure function of (sunDatePreset, sunMin), which is the single-source link
 * between the rendered sun, the seasonal material factors, and the season
 * label.
 */
export function seasonProgressFromSun(
  preset: SunDatePreset,
  sunMin: number,
  now: Date = new Date(),
): number {
  const when = sunDateFromPreset(preset, sunMin, now);
  const { year, doy } = melbourneDayOfYear(when);
  return doy / daysInYear(year);
}

/**
 * Season label + month for the current sun date, delegating to the domain's
 * `melbourneSeason()` — the single authority for season naming. The old
 * `seasonLabel` / `seasonMonth` progress-lookup tables are removed.
 */
export function melbourneSeasonFromSun(
  preset: SunDatePreset,
  sunMin: number,
  now: Date = new Date(),
): MelbourneSeason {
  return melbourneSeason(sunDateFromPreset(preset, sunMin, now));
}

/**
 * Leaf-status descriptor for the metadata chip, derived from the two axes.
 * Existing (mature) trees hold leaves longer; new plantings drop earlier.
 */
export function leafStatus(seasonProgress: number, growthYear: number): string {
  const w = winterFactor(seasonProgress);
  const a = autumnFactor(seasonProgress);
  if (growthYear < 1) return "Juvenile";
  if (w > 0.7) return "Bare";
  if (w > 0.3) return "Dropping";
  if (a > 0.4) return "Autumn";
  return "Full";
}

/* -------------------------------------------------------------------------- */
/* Easing — used by the FusedCamera to animate viewBlend toward its target    */
/* -------------------------------------------------------------------------- */

/** easeInOutCubic — smooth acceleration/deceleration for camera transitions. */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/* -------------------------------------------------------------------------- */
/* The unified store                                                          */
/* -------------------------------------------------------------------------- */

export interface StudioStoreState {
  // --- Temporal axes (from seasonalStore) ---
  /** Macro-time: 0 = just planted, 10 = 10-year maturity. */
  growthYear: number;
  /**
   * Micro-time: 0 = Jan 1, 1 = Dec 31. DERIVED from (sunDatePreset, sunMin) —
   * never set directly. Material factors read it via getState(); labels use
   * melbourneSeasonFromSun().
   */
  seasonProgress: number;
  /** Minutes past Melbourne midnight — drives the real sun position. */
  sunMin: number;
  /** Calendar preset the sun + season are sampled at (the single time source). */
  sunDatePreset: SunDatePreset;

  // --- View / layer toggles ---
  /** Subsurface blueprint view toggle. */
  subsurfaceView: boolean;
  /** Analytical suncast overlay (plan-sun-cast shadow footprints). DRAFTING
   *  default ON — a shade study is the drafting sheet's job; the 3D VSM shadow
   *  already carries the sunny look. Operator-toggleable for clean sheets. */
  suncastView: boolean;
  /** 3D sketch capture mode — suppresses camera pan, drags become strokes. */
  sketchMode: boolean;

  // --- Elevation Slice instrument (Vertical Truth) ---
  /** Whether the section-cut instrument is active. DOM-subscribed. */
  sliceActive: boolean;
  /** Which axis the cut runs along. "z" = E/W cut (N/S profile), "x" = N/S cut. */
  sliceAxis: "x" | "z";
  /** Position of the cut along the cross-axis, in world metres (lot-centred). */
  slicePosM: number;

  // --- Terrain analysis instruments (drainage + earthworks) ---
  /** Drainage overland-flow overlay (streams + ponding markers). Opt-in. */
  drainageView: boolean;
  /** Earthworks overlay — committed pad masses + cut/fill zones. */
  earthworksView: boolean;

  // --- CAD annotation layers (SVG-studio port, Gap 3) ---
  /** Working-drawing dimension ring (boundary B… + building F… edges). */
  dimsView: boolean;
  /** Master scale overlay — the edge ruler AND the dimension ring live under
   *  this one visible toggle. Opt+R still flips drafting mode and D still
   *  flips dims; this gate is the chrome's single on/off for "scale". */
  scaleView: boolean;
  /** Interactive measure tape tool (mutually exclusive with sketchMode). */
  measureActive: boolean;
  /** The current tape in board-% (a = anchor, b = drag end); null = no tape. */
  measureTape: { a: PctPoint; b: PctPoint } | null;
  /** Itemized fit-sheet quotation card (Phase 3 live quote). */
  fitSheetOpen: boolean;
  /** Schedule sheet — the one light surface (spec 6b / 9.1), derived only. */
  scheduleOpen: boolean;
  /** Selected fixed plane from the spec stack (1.1). Ground is the drawable
   *  target; planting/massing are proposed reference bands. */
  activePlaneId: FixedPlaneId;
  /** Live pointer world XZ during a draw — the E·N·Z chip source (2.6).
   *  `chainage` is metres along the stationing edge, derived via the single
   *  `stationAtPct` source (2.1) — never computed ad hoc. */
  liveCoord: { x: number; z: number; chainage?: number } | null;
  /** Surveyed-plan communication layers (bearing/RL/tags/hatches/callouts/scope). */
  surveyedPlanLayers: SurveyedPlanLayers;
  /** Survey communication dialect on the Survey screen. */
  surveyAnnotationDialect: AnnotationDialect;
  /** CAD communication layers (architectural/technical drawing overlays). */
  cadAnnotationLayers: SurveyedPlanLayers;
  /** CAD communication dialect on the CAD screen. */
  cadAnnotationDialect: AnnotationDialect;
  /** Sketch communication layers (creative design overlays). */
  sketchAnnotationLayers: SurveyedPlanLayers;
  /** Sketch communication dialect on the Sketch screen. */
  sketchAnnotationDialect: AnnotationDialect;
  /** Survey trade communication packs. */
  surveyTradePacks: TradePackVisibility;
  /** CAD trade communication packs. */
  cadTradePacks: TradePackVisibility;
  /** Sketch trade communication packs. */
  sketchTradePacks: TradePackVisibility;

  /** Split view — locked plan | live 3D with linked cameras. */
  splitView: boolean;

  // --- Asset discovery fan-out (Gap 5) ---
  /** The bottom fan-out dock (asset palette). */
  assetsOpen: boolean;
  /** Armed catalog symbol — click the lot to place it; null = not armed. */
  armedSymbolId: string | null;
  /** Drag-drop from the asset dock — AssetPlaceLayer consumes and clears. */
  pendingAssetDrop: { symbolId: string; clientX: number; clientY: number } | null;
  /** Area-draw mass plant (groundcover / bed fill) while a symbol is armed. */
  areaPlantActive: boolean;
  /** Row-draw mass plant (hedge / border run) while a symbol is armed. */
  rowPlantActive: boolean;
  /**
   * The live mass-plant drag in board-% — EPHEMERAL preview state. The
   * spacing guides read it; it is never snapshotted into history and never
   * reaches the autosave payload (useStudioAutosave lists its slices
   * explicitly).
   */
  assetPlantDraft: { mode: "row" | "area"; a: PctPoint; b: PctPoint } | null;
  /** Stem count preview during mass-plant drag — for cost preview in the dock. */
  massPlantPreviewCount: number;
  /** Live cursor client position over the canvas — drives the floating placement toolbar. */
  pointerClientPos: { x: number; y: number } | null;
  /** All canvas placements (CatalogPlacement contract schema). */
  placements: CatalogPlacement[];
  /** Undo/redo doc history — snapshots of {placements, strokes, photoElevations, features, stitchRecords, trenches, zones, canvases, setbackLines, buildingFootprints} (cap 50). */
  historyPast: Array<{
    placements: CatalogPlacement[];
    strokes: CanvasStroke[];
    photoElevations: PhotoElevation[];
    features: LandscapeFeature[];
    stitchRecords: Record<string, StitchRecord>;
    constructionTrenches: ConstructionTrench[];
    irrigationZones: IrrigationZone[];
    canvases: SketchCanvas[];
    setbackLines: SetbackLine[];
    buildingFootprints: BuildingFootprint[];
  }>;
  historyFuture: Array<{
    placements: CatalogPlacement[];
    strokes: CanvasStroke[];
    photoElevations: PhotoElevation[];
    features: LandscapeFeature[];
    stitchRecords: Record<string, StitchRecord>;
    constructionTrenches: ConstructionTrench[];
    irrigationZones: IrrigationZone[];
    canvases: SketchCanvas[];
    setbackLines: SetbackLine[];
    buildingFootprints: BuildingFootprint[];
  }>;

  // --- Flora ring (ranked planting suggestions at a click) ---
  /**
   * The open flora session: click point (board-%), armed form, and the
   * active candidate index. Candidates are DERIVED (FloraRingLayer memo —
   * they re-rank live with the sun scrubber + placements). Opening or
   * moving the session does not disarm; accept disarms, dismiss keeps armed
   * (SVG studio semantics).
   */
  floraSession: {
    x: number;
    y: number;
    form: FloraStudioForm;
    activeIdx: number;
  } | null;

  // --- Fused rendering context ---
  /**
   * The TARGET view blend. 0 = orthographic plan, 1 = perspective 3D.
   * The FusedCamera animates the ACTUAL blend toward this each frame.
   * Set instantly (toggles) or via a slider — the animation handles smoothing.
   */
  viewBlendTarget: number;
  /**
   * The ACTUAL (animated) view blend — the spring-driven value the FusedCamera
   * writes each frame as it eases toward viewBlendTarget. Read via getState()
   * inside useFrame by consumers that must track the camera in lockstep (e.g.,
   * the stroke-drape Y lerp). NOT for DOM subscription — it changes every frame.
   */
  viewBlend: number;
  /**
   * The LIVE camera rig — the transient value StudioControls writes during a
   * pan/zoom gesture (per pointer-move, per wheel). FusedCamera reads it via
   * getState() every frame. NOT for DOM subscription (it changes per frame
   * during a drag). React state holds the COMMITTED rig, synced once on
   * gesture end — so a pan never triggers a React re-render mid-drag.
   */
  liveRig: StudioCameraRig;

  /**
   * Committed elevation flag (φ=90° + facade normal) — DOM-facing mirror of
   * the live rig's elevation state, synced once per gesture end.
   */
  elevationActive: boolean;

  /**
   * Facade azimuth override for the elevation snap — the pinned photo
   * plane's exact bearing. Title boundaries are rarely cardinal; the plane
   * follows the boundary edge, and the camera treats that bearing as a
   * facade normal while the pin is active. Null = cardinals only.
   */
  elevationFacadeAzimuth: number | null;

  // --- Motion-aware chrome recede (AEC-2026 adoption §3.2) ---
  /**
   * True while the camera is orbiting/panning/zooming (+ ~150 ms rest
   * decay). Written ONLY on state flip by ChromeRecedeWatcher inside the
   * R3F loop — never per-frame. Drives the imperative `gs-chrome-receding`
   * body class (opacity-only fade; full opaque paper at rest).
   */
  chromeReceded: boolean;
  /** Hold-H peek: chrome fades while the key is held (user-initiated). */
  chromePeek: boolean;

  // --- Scan-choreographed site-truth reveal (AEC program) ---
  /**
   * The scan reveal stage: "idle" before/after, a ScanStageName while the
   * choreography runs, "done" at the end. The scene director reads this via
   * getState() per frame (transient doctrine); writes happen only on stage
   * flips. scanStageStartedAt (performance.now) anchors each stage's 0→1.
   */
  scanStage: "idle" | "cadastre" | "parcels" | "services" | "terrain" | "flora" | "done";
  scanStageStartedAt: number;

  // --- AI-driven native canvas (AEC program phase 2) ---
  /**
   * The AI generation session. When active, ghost placements render on the
   * canvas as translucent overlays awaiting accept/reject.
   */
  aiSession: {
    prompt: string;
    ghosts: CatalogPlacement[];
    status: "idle" | "thinking" | "ready" | "accepted" | "rejected";
  };

  // --- Shared ink layer ---
  /**
   * All sketch strokes in board-% space (the CanvasStroke contract schema).
   * Rendered linearly today (no spatial index — see layerPolicy.ts
   * NON-GOALS + the FUTURE SPATIAL INDEX CONTRACT: containment-on-insert,
   * never nearest-neighbour, when one is ever built).
   */
  sketchStrokes: CanvasStroke[];

  // --- Spatial Sketching — oriented canvas planes ---
  /**
   * All persisted SketchCanvas planes (the Spatial Sketching primitive).
   * Strokes whose `canvas_id` references a plane here render inside that
   * plane's local coordinate system. The implicit ground plane (canvas_id
   * absent / null) needs no row — it is the legacy default.
   */
  sketchCanvases: SketchCanvas[];
  /**
   * The active canvas plane id — the plane new strokes are drawn onto. null
   * = the implicit ground plane (legacy behaviour). Set by the canvas
   * picker / "new plane" action.
   */
  activeCanvasId: string | null;

  // --- AI Automated Site Setup (Phase 7) ---
  /** Legal setback lines — red dashed non-build zones on the ground plane. */
  setbackLines: SetbackLine[];
  /** Replace all setback lines (hydrate / undo / redo / AI generate). */
  setSetbackLines: (lines: SetbackLine[]) => void;
  /** Building footprints — uneditable 3D house masses framing the garden. */
  buildingFootprints: BuildingFootprint[];
  /** Replace all building footprints (hydrate / undo / redo / AI generate). */
  setBuildingFootprints: (footprints: BuildingFootprint[]) => void;
  /** AI site-setup processing state machine (drives the modal UI). */
  aiProcessingState: AiProcessingState;
  /** Set the AI processing state (drives the modal's loading stages). */
  setAiProcessingState: (state: AiProcessingState) => void;
  /**
   * Process uploaded site documents (survey PDF + title) through the AI
   * pipeline. Calls the mock auto-setup endpoint, then populates the store
   * with the returned topographic canvases + setback lines + building
   * footprints. The mock is the seam — swap the endpoint for a real
   * vision-model call later.
   */
  processSiteDocuments: (
    surveyFile?: File,
    titleFile?: File,
  ) => Promise<void>;

  // --- Spatial UI — workspace toggles (persisted per user) ---
  /** Handedness — mirrors chrome anchors left/right. Default RIGHT. */
  handedness: "RIGHT" | "LEFT";
  /** Chrome scale multiplier (0.85 – 1.30). Default 1.0. */
  uiScale: number;
  /** Drafting mode — true = ruler + crosshair + snap on; false = sketching (zero chrome margin). */
  draftingMode: boolean;
  /** Anchor visibility — ALL (1.0), DIMMED (0.32), FOCUS (0). Per pack §6.2.
   *  In FOCUS the anchors are gone but still functional on hover/pen-approach;
   *  tools remain reachable via ⌘K. */
  anchorVisibility: "ALL" | "DIMMED" | "FOCUS";
  /** Set the anchor visibility mode (pack §6.2, ⌥F). */
  setAnchorVisibility: (v: "ALL" | "DIMMED" | "FOCUS") => void;
  /** Canvas theme — DARK (deep charcoal void) or LIGHT (architectural vellum).
   *  Drives the R3F scene clear color, ground plane albedo, and grid dot color. */
  canvasTheme: "LIGHT" | "DARK";
  /** Toggle between DARK and LIGHT canvas themes. */
  toggleCanvasTheme: () => void;

  // --- Landscape Canvas v2 — tool ribbon + pen-down quiet state ---
  /** The unified active tool id (handoff §5.1). One tool active at a time.
   *  Maps to the legacy tool flags (sketchMode, measureActive, etc.) via
   *  the ribbon's tool-to-store bridge. */
  activeTool: ToolId;
  /** Set the active tool — also updates the legacy tool flags. */
  setActiveTool: (tool: ToolId) => void;
  /** True while the pen/stylus is in contact (pen-down quiet state, §5.5).
   *  Written by FusedSketchLayer on pointer down/up. Drives the ribbon →
   *  rail width and the opacity-only quiet choreography. */
  penDown: boolean;
  /** Set the pen-down flag (FusedSketchLayer writes this). */
  setPenDown: (down: boolean) => void;
  /** The ribbon's named-width dwell is open (400ms pointer dwell or ⌘K).
   *  Standard width at rest, rail while pen is down. */
  ribbonDwellOpen: boolean;
  /** Open/close the ribbon named-width dwell. */
  setRibbonDwellOpen: (open: boolean) => void;
  /** The active camera preset (handoff §6.1). PLAN / AXO / SEC / 3D. */
  cameraPreset: CameraPreset;
  /** Set the camera preset — writes the rig tilt + blend target. */
  setCameraPreset: (preset: CameraPreset) => void;
  /** Overlay kinds the operator has hidden in the Layers legend (absent =
   *  visible). Shared by the scene washes (GovernmentOverlays) and the legend. */
  hiddenOverlayKinds: KeylessOverlayKind[];
  /** Toggle an overlay kind's visibility in the legend. */
  toggleOverlayKind: (kind: KeylessOverlayKind) => void;

  // --- Phase 8: Living Diorama & Spatial Presence ---
  /** Render quality — TECHNICAL (clean drafting) or IMMERSIVE (AAA post-FX). */
  renderMode: RenderMode;
  /** Camera posture — ORBIT (fused rig) or PEDESTRIAN (1.7m walk-through). */
  cameraPosture: CameraPosture;
  /** Toggle between TECHNICAL and IMMERSIVE render modes. */
  toggleRenderMode: () => void;
  /** Set the camera posture (ORBIT or PEDESTRIAN). */
  setCameraPosture: (posture: CameraPosture) => void;

  /** Phase G — Draw Mode locks the camera face-on to the active canvas;
   *  View Mode allows free orbit. View state only. */
  drawViewMode: DrawViewMode;
  /** Toggle between DRAW and VIEW modes (Phase G). */
  toggleDrawViewMode: () => void;
  /** Set the draw/view mode explicitly (Phase G). */
  setDrawViewMode: (mode: DrawViewMode) => void;
  /** Re-align the camera to face the active canvas (Phase G). Called when
   *  entering DRAW mode or when the active canvas changes in DRAW mode. */
  alignCameraToActiveCanvas: () => void;

  // --- Stroke Transfer (Phase 2) ---
  /** The transfer tool is armed — click a stroke to select it as the source,
   *  then click a canvas plane (or depth rail cell) to project it onto. */
  transferToolArmed: boolean;
  /** The source stroke id selected for transfer (null = none selected yet). */
  transferSourceStrokeId: string | null;

  // --- Sketch-to-CAD Extrusion (Phase 6) ---
  /** The extrusion tool is armed — click a closed stroke to select it for
   *  extrusion, then adjust the depth slider and commit. */
  extrusionToolArmed: boolean;
  /** The stroke id selected for extrusion (null = none selected yet). */
  selectedExtrusionStrokeId: string | null;
  /** The current depth slider value (metres) for the extrusion preview. */
  activeExtrusionDepth: number;

  // --- Cinematic Fly-Through (Phase 5) + Viewpoint Filmstrip (Phase C) ---
  /** Saved camera bookmarks / viewpoints — position + look-at + optional
   *  thumbnail + rig snapshot. Captured by the operator during navigation,
   *  played back as a CatmullRomCurve3 spline (fly-through) or restored
   *  individually by clicking the filmstrip thumb. */
  cameraBookmarks: CameraBookmark[];
  /** True while the fly-through animation is playing. Gestures are paused. */
  isPlayingFlythrough: boolean;
  /** Transient camera state — written by FusedCamera each frame, read by
   *  the capture-bookmark action. NOT React-reactive (no set() write). */
  _liveCameraPosition: { position: [number, number, number]; target: [number, number, number] };
  /** The currently-selected viewpoint id in the filmstrip (click-to-restore
   *  target). Null = no viewpoint selected (free camera). View state only —
   *  never enters docSnapshot. */
  activeViewpointId: string | null;
  /** True while recording a walk-through video via MediaRecorder. View state
   *  only — never enters docSnapshot. */
  isRecordingWalk: boolean;

  // --- Phase C2: Viewpoint timeline controls (view state only) ---
  /** Linger time (seconds) the walk pauses at each viewpoint before moving
   *  to the next. 0 = no pause. View state only. */
  walkLingerS: number;
  /** Transition time (seconds) for the camera to fly from one viewpoint to
   *  the next. Controls the spline sampling speed. View state only. */
  walkTransitionS: number;
  /** When true, the walk loops continuously instead of stopping after one
   *  pass. View state only. */
  walkLoop: boolean;
  /** The current playback head position in the sequence (0..1 across all
   *  viewpoints). Read by the filmstrip progress bar. View state only. */
  walkProgress: number;
  /** Per-bookmark visibility keyframes — when non-empty, the walk hides
   *  canvases not listed for the active viewpoint. Maps viewpoint id →
   *  array of canvas ids that remain visible at that viewpoint. View state. */
  viewpointVisibility: Record<string, string[]>;
  /** Set the linger time (seconds) for the walk. */
  setWalkLingerS: (s: number) => void;
  /** Set the transition time (seconds) for the walk. */
  setWalkTransitionS: (s: number) => void;
  /** Toggle the walk loop. */
  toggleWalkLoop: () => void;
  /** Set the walk progress (0..1) — written by FlythroughRig each frame. */
  setWalkProgress: (p: number) => void;
  /** Toggle a canvas id in a viewpoint's visibility keyframe. */
  toggleViewpointVisibility: (viewpointId: string, canvasId: string) => void;

  // --- Photo-trace elevation (sketch capstone) ---
  /**
   * All persisted photo elevations — pinned site photos as frozen camera
   * frames with calibration + plane-space trace strokes (canvas records).
   */
  photoElevations: PhotoElevation[];
  /**
   * The active photo-trace session. While set, freehand ink raycasts onto
   * the pinned photo plane (not the ground) and the camera is pinned to
   * the photo's facade look. calibrate mode drags a reference line instead.
   */
  photoTraceSession: {
    elevationId: string;
    mode: "trace" | "calibrate";
    /** Live reference-line draft in plane space (calibrate mode). */
    calibrateDraft: { a: PlanePoint; b: PlanePoint } | null;
    /** Pending reference length + stamp label for calibration. */
    calibrateReferenceM: number | null;
    calibrateLabel: string;
  } | null;

  // --- Construction trench runs (traced + accepted auto) ---
  /** Armed trench kind — pointer drags become a trench trace; null = off. */
  trenchTool: ConstructionTrenchKind | null;
  /** Live trace draft (kind + points in board-%); null = not drawing. */
  trenchDraft: {
    kind: ConstructionTrenchKind;
    points: TrenchPointPct[];
  } | null;
  /** Committed trenches (traced runs + accepted auto proposals). */
  constructionTrenches: ConstructionTrench[];

  // --- Irrigation zones (traced + proposed) ---
  /** Armed zone kind — pointer drags become a zone trace; null = off. */
  zoneTool: IrrigationZoneKind | null;
  /** Live zone draft (kind + ring points in board-%); null = not drawing. */
  zoneDraft: {
    kind: IrrigationZoneKind;
    points: ZonePointPct[];
  } | null;
  /** Committed zones (traced rings + accepted proposals). */
  irrigationZones: IrrigationZone[];

  // --- Site context (classifier + placement constraints) ---
  /** Title boundary ring in board-% — the site truth sketch→CAD runs against. */
  siteBoundary: PctPoint[];
  /** Dwelling envelope ring in board-% (may be empty). */
  siteBuilding: PctPoint[];
  /** Set both site rings (hydrate / site-truth import). */
  setSiteContext: (boundary: PctPoint[], building: PctPoint[]) => void;

  // --- Landscape features (converted CAD entities → DesignCanvas.features) ---
  /** Committed features — direct-converts + accepted-proposal outline mirrors. */
  features: LandscapeFeature[];
  /** Replace the whole feature array (hydrate / undo / redo). */
  setFeatures: (features: LandscapeFeature[]) => void;
  /** Append converted features (undoable). */
  addFeatures: (features: LandscapeFeature[]) => void;
  /** Remove features by id (undoable). */
  removeFeatures: (ids: string[]) => void;

  // --- Stitch engine (canvasStitcher) — welded CAD geometry + live snaps ---
  /** World-metre welded endpoint nodes — the ε-snap highlight targets. */
  stitchSnapNodes: SpatialPoint[];
  /** Live drawing cursor / unwarped stroke endpoint (world metres). */
  stitchHoverPoint: SpatialPoint | null;
  /** The ε-snap radius (m) used for weld highlights — default 0.15. */
  stitchEpsilonM: number;
  /** featureId → split provenance for the un-stitch primitive. */
  stitchRecords: Record<string, StitchRecord>;
  /** Stamped reply for the last stitch / un-stitch action. */
  stitchNotice: string | null;
  /** Replace the live snap-node set (drawing layers push it on stroke change). */
  setStitchSnapNodes: (nodes: SpatialPoint[]) => void;
  /** Update the live drawing cursor for ε-snap highlights (null = idle). */
  setStitchHoverPoint: (point: SpatialPoint | null) => void;
  setStitchEpsilonM: (epsilonM: number) => void;
  /** Weld the sketch ink into stitched CAD features (undoable); returns entity count. */
  stitchSketchStrokes: (scaleM: number, boardAspect: number) => number;
  /** Split a stitched feature back into sketch strokes (undoable); returns stroke count. */
  unstitchFeature: (featureId: string, scaleM: number, boardAspect: number) => number;
  dismissStitchNotice: () => void;

  // --- Sketch → CAD proposals (tidy path — SVG proposeFromStrokes pattern) ---
  /** Pending ghost proposals from the last tidy run — replaced per run. */
  cadProposals: SketchCadProposal[];
  /** Whether the ghost review card is open. */
  cadReviewOpen: boolean;
  /** Proposal the review card emphasises in-canvas (row focus). */
  cadActiveProposalId: string | null;
  /** Stamped reply/notice — includes the photo-trace scoping stamp. */
  sketchCadNotice: string | null;
  /** Classify strokes → proposals (primary path); opens the review. */
  tidySketchToCad: () => void;
  /** Open/close the review card (close keeps proposals pending). */
  setCadReviewOpen: (open: boolean) => void;
  setCadActiveProposal: (id: string | null) => void;
  /** Accept → live placement (+ mirrored polygon feature when drawn). */
  acceptCadProposal: (id: string) => void;
  rejectCadProposal: (id: string) => void;
  acceptAllCadProposals: () => void;
  /** Accept only proposals at or above the confidence floor (default 0.7). */
  acceptConfidentCadProposals: (minConfidence?: number) => void;
  /** Drop the whole review set without minting placements. */
  rejectAllCadProposals: () => void;
  /** One-click direct convert (recognizeStroke path); returns feature count. */
  convertStrokesToCadFeatures: () => number;

  // --- Selection — ONE state across placements / features / photo strokes ---
  selection: SelectionRef[];
  /** Click select; `additive` keeps current refs (shift-click multi-select). */
  selectRef: (ref: SelectionRef, opts?: { additive?: boolean }) => void;
  /** Shift-click toggle — add when absent, remove when present. */
  toggleSelectRef: (ref: SelectionRef) => void;
  clearSelection: () => void;
  setSelection: (refs: SelectionRef[]) => void;

  // --- Phase H — Selection Mode (isolation + boolean ops) ---
  /** When true, non-selected entities are dimmed with a red-mask overlay
   *  and the boolean op toolbar (add/subtract/invert) is visible. View
   *  state only — never enters docSnapshot. */
  selectionModeActive: boolean;
  /** Toggle selection mode on/off (Phase H). */
  toggleSelectionMode: () => void;
  /** Set selection mode explicitly (Phase H). */
  setSelectionMode: (active: boolean) => void;
  /** Boolean subtract — remove refs from the current selection. */
  subtractFromSelection: (refs: SelectionRef[]) => void;
  /** Boolean invert — select all unselected entities, deselect all selected. */
  invertSelection: () => void;
  /** Select all selectable entities (placements + features + photo strokes). */
  selectAll: () => void;

  // --- Inspector edits (selection-driven property panel) ---
  /**
   * Edit a placement's inspector fields. Clamp-triggering fields
   * (scale, canopy_radius_m) re-clamp the centre against the title
   * boundary before the mutation lands (locked classification —
   * inspectorPolicy.ts); attribute-only fields pass through. Undoable.
   */
  updatePlacementField: (
    id: string,
    patch: Partial<
      Pick<
        CatalogPlacement,
        | "symbol_id"
        | "scale"
        | "rotation_deg"
        | "label"
        | "height_m"
        | "canopy_radius_m"
      >
    >,
  ) => void;
  /**
   * Edit a feature's inspector fields (attribute-only — direct persist).
   * Marks the feature human_locked. Section patches apply only when the
   * section already exists on the feature (the panel hides absent ones).
   */
  updateFeatureField: (
    id: string,
    patch: {
      friendly_name?: string;
      material_fill?: Partial<
        Pick<MaterialFill, "type" | "sku" | "depth_m" | "waste_allocation_pct">
      >;
      brush_recipe_id?: string;
      labor_tier?: LaborProfile["base_difficulty_tier"];
      /**
       * Pad height above existing grade. Setting it turns the region into a
       * cut/fill pad — an EDIT on an existing region, never a drawing mode
       * (spec §8.1). Zero clears it back to a flat region.
       */
      extrude_height_m?: number;
    },
  ) => void;
  /** Latest boundary re-clamp notice (dismissible; re-arms per clamped edit). */
  boundaryNotice: { refId: string; reason: string; at: number } | null;
  dismissBoundaryNotice: () => void;

  // --- Precision drafting (Polyline / Area click-to-place) ---
  /**
   * The live drafting run — the armed tool plus the vertices the operator has
   * placed, in world metres. One session is shared by both tools (spec §5);
   * null = no drafting tool armed, so the pan law is untouched.
   */
  draftSession: DraftSession | null;
  /** Arm a drafting tool (stands down every other pointer-capture tool). */
  beginDraft: (tool: DraftTool) => void;
  /** Place a vertex — already snap-resolved by the drafting layer. */
  addDraftVertex: (vertex: WorldXZ) => void;
  /** Backspace — drop the last vertex. The tool stays armed. */
  undoDraftVertex: () => void;
  /** Esc — drop the whole run AND disarm the tool (sticky-tool exit). */
  cancelDraft: () => void;
  /**
   * Finish the run. Polyline persists a `kind: "shape"` `CanvasStroke` (both
   * `shape_points` and the flattened `points`); Area persists a Polygon
   * `LandscapeFeature`. One undo step, and the tool stays armed with an empty
   * run so a setout can continue. Returns true when something persisted.
   */
  commitDraft: (
    scaleM: number,
    boardAspect: number,
    closed: boolean,
  ) => boolean;

  // --- Marquee box select (tool-gated; option A: placements + features) ---
  /** Whether the marquee rail tool is armed (drag = box, not pan). */
  marqueeActive: boolean;
  /** Arm/disarm marquee (stands down ink / tape / asset / trench / zone). */
  setMarqueeActive: (active: boolean) => void;
  /** Live drag rectangle in board-% (rendered by the scene box overlay). */
  marqueeDraft: { a: PctPoint; b: PctPoint } | null;
  setMarqueeDraft: (draft: { a: PctPoint; b: PctPoint } | null) => void;
  /** Commit a finished box: replace selection (union when additive). */
  marqueeSelectBox: (
    box: { x0: number; y0: number; x1: number; y1: number },
    opts?: { additive?: boolean },
  ) => void;

  // --- Expressive stylus Sketch (Limner nib taxonomy) ---
  /** The armed nib — committed strokes carry its telemetry mapping
   *  (nibs.ts). The floating nib palette (Sketch mode) swaps it. */
  activeNib: NibKind;
  /** Angle-opacity falloff preset (turn 14c). NARROW for working (steeper
   *  fade — edge-on canvases disappear faster), BALANCED for general use
   *  (half-opacity at 46° from face-on), WIDE for presenting a fly-through
   *  (gentler fade — canvases stay visible longer). View state only. */
  falloffPreset: FalloffPreset;
  /** Set the angle-opacity falloff preset. */
  setFalloffPreset: (preset: FalloffPreset) => void;
  /**
   * Latest resolved solar azimuth (0° = north, Melbourne convention) — null
   * when the project has no lat/lng. Written by the sketch layer from the
   * SAME sun sample the light rig uses, so hatching and shadow studies
   * always agree. Drives sun-aware hatching (the inverse sun angle).
   */
  sunAzimuthDeg: number | null;
  /**
   * Live stylus telemetry scratch — the LAST pointer sample, mutated in
   * place per pointer-move WITHOUT set() (the transient-write doctrine:
   * zero DOM re-renders). The nib palette polls it on a slow interval for
   * the pressure/tilt readout. Not a persistence field.
   */
  liveTelemetry: StylusTelemetry;
  /** Sun-aware hatching — hatch fills snap parallel lines to the site's
   *  inverse sun angle. Off → 45° drafting hatch. */
  sunHatchSnap: boolean;
  setActiveNib: (nib: NibKind) => void;
  setSunAzimuthDeg: (deg: number | null) => void;
  setLiveTelemetry: (t: StylusTelemetry) => void;
  setSunHatchSnap: (v: boolean) => void;
  /**
   * Hatch-fill a closed stroke with parallel lines (board-% space). When
   * sunHatchSnap is on and the sun azimuth is known the lines snap to the
   * inverse sun angle; otherwise 45°. Commits the derived hatch strokes in
   * ONE history step; hatch strokes are excluded from sketch→CAD.
   */
  hatchFillStroke: (strokeId: string, opts?: { spacingPct?: number }) => void;

  // --- Project context (for persistence + aerial + flora ranking) ---
  projectId: string;
  aerialUri: string | null;
  /** Project address — feeds flora municipality style-boost + microcopy. */
  projectAddress: string;

  // --- Save status machine ---
  saveStatus: SaveStatus;
  saveErrorKind: SaveErrorKind;
  /** Monotonic revision — bumped after each successful autosave. */
  saveRevision: number;
  /** Epoch ms of the last successful persist (for "Saved Ns ago" labels). */
  savedTick: number;

  // --- Setters ---
  setGrowthYear: (y: number) => void;
  setSunMin: (m: number) => void;
  setSunDatePreset: (p: SunDatePreset) => void;
  setSubsurfaceView: (v: boolean) => void;
  setSuncastView: (v: boolean) => void;
  setSketchMode: (v: boolean) => void;
  setViewBlendTarget: (v: number) => void;
  /**
   * The single orbit axis (pitch 0–90°). One write commits both the live rig
   * tiltDeg and the derived plan/3D blend target — the collapse that makes
   * pitch the only camera parameter UI and gestures need to touch.
   */
  setPitchDeg: (deg: number) => void;
  /**
   * Write the committed elevation flag — see the `elevationActive` state
   * field. Set once per gesture end together with the blend target.
   */
  setElevationActive: (v: boolean) => void;
  /** Flip the motion-aware chrome recede flag (ChromeRecedeWatcher). */
  setChromeReceded: (v: boolean) => void;
  /** Hold-H peek flag — the chrome fades while the key is held. */
  setChromePeek: (v: boolean) => void;
  /** Advance the scan reveal (stage name or "done"/"idle"); stamps the clock. */
  setScanStage: (
    stage: "idle" | "cadastre" | "parcels" | "services" | "terrain" | "flora" | "done",
  ) => void;
  /** Start an AI generation session (prompt → ghosts). */
  startAiSession: (prompt: string) => void;
  /** AI generation resolved — show the ghosts. */
  setAiGhosts: (ghosts: CatalogPlacement[]) => void;
  /** Accept the ghosts — commit as real placements (one undo). */
  acceptAiGhosts: () => void;
  /** Reject/cancel the AI session — ghosts vanish. */
  clearAiSession: () => void;
  /**
   * Set/clear the facade azimuth override (photo pin sets its plane bearing;
   * session exit clears it back to cardinals-only).
   */
  setElevationFacadeAzimuth: (deg: number | null) => void;
  /** Write the animated blend — called per-frame by FusedCamera (transient). */
  setViewBlend: (v: number) => void;
  /** Write the live rig — called per-frame during pan/zoom (transient). */
  setLiveRig: (r: StudioCameraRig) => void;

  setSliceActive: (v: boolean) => void;
  setSliceAxis: (a: "x" | "z") => void;
  setSlicePosM: (v: number) => void;

  setDrainageView: (v: boolean) => void;
  setEarthworksView: (v: boolean) => void;

  setDimsView: (v: boolean) => void;
  setScaleView: (v: boolean) => void;
  /** Arming measure disarms sketch mode (they compete for pointer capture). */
  setMeasureActive: (v: boolean) => void;
  /** Replace the tape (a new anchor press) or clear it (null, null). */
  setMeasureTape: (a: PctPoint | null, b: PctPoint | null) => void;

  setFitSheetOpen: (v: boolean) => void;
  setScheduleOpen: (v: boolean) => void;
  setActivePlaneId: (id: FixedPlaneId) => void;
  setLiveCoord: (v: { x: number; z: number; chainage?: number } | null) => void;
  setSurveyedPlanLayers: (patch: Partial<SurveyedPlanLayers>) => void;
  setSurveyAnnotationDialect: (dialect: AnnotationDialect) => void;
  setCadAnnotationLayers: (patch: Partial<SurveyedPlanLayers>) => void;
  setCadAnnotationDialect: (dialect: AnnotationDialect) => void;
  setSketchAnnotationLayers: (patch: Partial<SurveyedPlanLayers>) => void;
  setSketchAnnotationDialect: (dialect: AnnotationDialect) => void;
  setSurveyTradePacks: (patch: Partial<TradePackVisibility>) => void;
  setCadTradePacks: (patch: Partial<TradePackVisibility>) => void;
  setSketchTradePacks: (patch: Partial<TradePackVisibility>) => void;
  /** Estimate line ids unticked by the operator (quote-view state, not a
   *  canvas mutation — excluded lines leave the estimate, the design stays).
   *  Session-scoped; stale ids are harmless (the filter ignores unknowns). */
  excludedEstimateLineIds: string[];
  toggleEstimateLineExcluded: (id: string) => void;

  setSplitView: (v: boolean) => void;

  setAssetsOpen: (v: boolean) => void;
  /** Arming an asset disarms sketch + measure (pointer-capture exclusion). */
  setArmedSymbolId: (id: string | null) => void;
  setPendingAssetDrop: (
    drop: { symbolId: string; clientX: number; clientY: number } | null,
  ) => void;
  /** Arm the box fill (stands down the row run — one drag gesture, one mode). */
  setAreaPlantActive: (v: boolean) => void;
  /** Arm the row/hedge run (stands down the box fill). */
  setRowPlantActive: (v: boolean) => void;
  setAssetPlantDraft: (
    draft: { mode: "row" | "area"; a: PctPoint; b: PctPoint } | null,
  ) => void;
  setMassPlantPreviewCount: (count: number) => void;
  setPointerClientPos: (pos: { x: number; y: number } | null) => void;
  /**
   * Append many placements in ONE history commit (row / area fill). Centres
   * are reconciled against the title boundary first — outside stems are
   * dropped and the trim is stamped on `boundaryNotice`.
   */
  addPlacements: (placements: CatalogPlacement[]) => void;
  /** Replace the entire placement array (hydrate / undo / branch checkout). */
  setPlacements: (placements: CatalogPlacement[]) => void;
  /** Append a single placement (a place gesture — commits undo history). */
  addPlacement: (placement: CatalogPlacement) => void;
  /** Remove one placement by id — undoable, prunes stale selection refs. */
  removePlacement: (id: string) => void;
  /** Remove many placements in ONE history commit (marquee delete). */
  removePlacements: (ids: string[]) => void;

  // --- Spatial gizmo (TransformControls) state ---
  /** Manipulator mode for a single selected placement (null = off). */
  gizmoMode: "translate" | "rotate" | "scale" | null;
  setGizmoMode: (mode: "translate" | "rotate" | "scale" | null) => void;
  /** True while the gizmo drag is in flight — camera gestures stand down. */
  gizmoDragging: boolean;
  setGizmoDragging: (dragging: boolean) => void;
  /**
   * Begin a gizmo drag — pushes the pre-drag doc onto the undo stack ONCE,
   * so the whole drag is a single undo step (called on first objectChange,
   * not on mousedown, so a mere handle click never pollutes history).
   */
  beginPlacementTransform: (id: string) => void;
  /**
   * Per-frame transient position/rotation while dragging — clamped against
   * the title boundary via constrainAssetCentre (the gizmo "slips" along the
   * edge), boundary notice raised on snap, NO history writes.
   */
  setPlacementTransformTransient: (
    id: string,
    patch: { x_pct?: number; y_pct?: number; rotation_deg?: number; scale?: number },
  ) => void;
  /** End a gizmo drag (seam for future persist/merge). */
  endPlacementTransform: () => void;

  /** Push the current doc onto the undo stack (called by mutating actions). */
  commitHistory: () => void;
  /** Undo / redo the last doc mutation (placements + strokes together). */
  undo: () => void;
  redo: () => void;

  /** Open/move the flora session at a point, or dismiss with null. */
  setFloraSession: (
    session: { x: number; y: number; form: FloraStudioForm } | null,
  ) => void;
  /** Select the active candidate (clamped to the candidate range). */
  setFloraActiveIdx: (idx: number) => void;

  /** Replace the entire stroke array (e.g., on hydrate / undo / redo). */
  setSketchStrokes: (strokes: CanvasStroke[]) => void;
  /** Append a single committed stroke. */
  addSketchStroke: (stroke: CanvasStroke) => void;
  /** Remove strokes by id. */
  removeSketchStrokes: (ids: string[]) => void;
  /** Update a single stroke (e.g., extrude height metadata). */
  updateSketchStroke: (id: string, patch: Partial<CanvasStroke>) => void;

  // --- Spatial Sketching — canvas plane actions ---
  /** Replace the entire canvas-plane array (hydrate / undo / redo). */
  setSketchCanvases: (canvases: SketchCanvas[]) => void;
  /** Add a new canvas plane (undoable). Returns the new plane's id. */
  addSketchCanvas: (canvas: SketchCanvas) => void;
  /** Update a canvas plane by id (position, rotation, label — undoable). */
  updateSketchCanvas: (id: string, patch: Partial<SketchCanvas>) => void;
  /** Remove a canvas plane by id. Strokes referencing it fall back to ground. */
  removeSketchCanvas: (id: string) => void;
  /** Set the active canvas plane id (null = implicit ground plane). */
  setActiveCanvasId: (id: string | null) => void;

  /** The plane a Parallel/Hinge Projection handle is actively adjusting
   *  right after placement — null once dismissed or another tool arms.
   *  Distinct from activeCanvasId: a plane can be active (drawing target)
   *  without a gizmo showing, and vice versa isn't meaningful but this
   *  keeps the gizmo from haunting every future selection of the plane. */
  adjustingCanvasId: string | null;
  setAdjustingCanvasId: (id: string | null) => void;
  /** Pushes one undo snapshot for the whole drag ahead (mirrors
   *  beginPlacementTransform — call once, on first pointer-down tick). */
  beginSketchCanvasTransform: () => void;
  /** Per-frame drag write — no history push (mirrors
   *  setPlacementTransformTransient, minus boundary clamping: planes
   *  aren't site-boundary-constrained). */
  setSketchCanvasTransformTransient: (
    id: string,
    patch: Partial<Pick<SketchCanvas, "position" | "rotation">>,
  ) => void;
  /** Clears redo future at drag end (mirrors endPlacementTransform). */
  endSketchCanvasTransform: () => void;

  /** Retroactive calibration (turn 15c): scale all canvas plane positions
   *  by the given ratio as one undoable action. Strokes are in board-% and
   *  are NOT redrawn — the board_width_m change handles their world-space
   *  scale. Canvas positions are in world metres and must be explicitly
   *  scaled. `scaleHeights` = true → SCALE THEM (x,y,z); false → KEEP
   *  HEIGHTS (x,z only, y unchanged). */
  commitCalibration: (ratio: number, scaleHeights: boolean) => void;

  // --- Canvas rail view state (Phase B) ---
  // Per §14c hard rule: "a faded canvas keeps a 1px edge and its list row
  // — invisible is a view state, not a disappearance." These fields are VIEW
  // state (like hiddenOverlayKinds / anchorVisibility), NOT document state —
  // they never enter docSnapshot and never trigger autosave.
  /** Canvas plane ids the operator has hidden via the cards rail eye toggle.
   *  Absent = visible. A hidden canvas keeps a 1px edge + its card (§14c). */
  hiddenCanvasIds: string[];
  /** Toggle a canvas plane's visibility from the cards rail eye icon. */
  toggleCanvasVisibility: (id: string) => void;
  /** Global opacity for inactive (non-active) canvases — the Mental Canvas
   *  "Transparency Toggle". 1.0 = no fade, lower = fade all inactive canvases
   *  to reduce visual clutter. View state only. */
  inactiveCanvasOpacity: number;
  /** Set the global inactive-canvas opacity (0.15–1.0). */
  setInactiveCanvasOpacity: (v: number) => void;

  /** Phase B2: canvas rail collapse state. When true, the rail shows only
   *  the header bar (no cards). Click the header to expand. View state only. */
  railCollapsed: boolean;
  /** Toggle the canvas rail collapse state (Phase B2). */
  toggleRailCollapsed: () => void;
  /** Phase B2: explicit set for the rail collapse state. */
  setRailCollapsed: (v: boolean) => void;

  /** Phase B2: canvas display order (ids). When non-empty, the cards rail
   *  renders canvases in this order instead of the default Y-height sort.
   *  View state only — does not change spatial positions. */
  canvasOrder: string[];
  /** Phase B2: reorder a canvas to a new position in the display order.
   *  Moves `fromId` before `toId` in the canvasOrder array, then fills any
   *  canvases not yet in the order array at the end (preserving Y-sort
   *  for newcomers). */
  reorderCanvas: (fromId: string, toId: string) => void;

  // --- Spatial UI — workspace toggle actions ---
  /** Set handedness (mirrors chrome anchors left/right). */
  setHandedness: (h: "RIGHT" | "LEFT") => void;
  /** Set chrome scale multiplier (0.85 – 1.30). */
  setUiScale: (scale: number) => void;
  /** Toggle drafting mode (ruler + crosshair + snap vs sketching). */
  setDraftingMode: (on: boolean) => void;

  // --- Stroke Transfer (Phase 2) ---
  /** Arm/disarm the transfer tool. */
  setTransferToolArmed: (on: boolean) => void;
  /** Set the source stroke id for transfer (null = none). */
  setTransferSourceStrokeId: (id: string | null) => void;

  // --- Sketch-to-CAD Extrusion (Phase 6) ---
  /** Toggle the extrusion tool on/off. When off, clears the selected stroke. */
  toggleExtrusionTool: () => void;
  /** Select a stroke for extrusion (called by clicking a stroke while armed). */
  selectExtrusionStroke: (id: string | null) => void;
  /** Set the active extrusion depth slider value (metres). */
  setActiveExtrusionDepth: (depth: number) => void;
  /** Commit the extrusion — saves extrude_height_m to the stroke and disarms. */
  commitExtrusion: (id: string, depth: number) => void;

  // --- Cinematic Fly-Through (Phase 5) + Viewpoint Filmstrip (Phase C) ---
  /** Add a camera bookmark (captured from the current camera position + target). */
  addCameraBookmark: (bookmark: CameraBookmark) => void;
  /** Capture the current camera position + look-at as a bookmark. */
  captureCameraBookmark: () => void;
  /** Remove a camera bookmark by id. */
  removeCameraBookmark: (id: string) => void;
  /** Toggle the fly-through animation playback. */
  toggleFlythrough: () => void;
  /** Capture a viewpoint: bookmark + thumbnail (PNG data URL from the live
   *  WebGL canvas) + rig snapshot + preset. The filmstrip calls this when
   *  the operator taps the capture button. */
  captureViewpoint: (thumb: string) => void;
  /** Restore the camera to a saved viewpoint by id (click-to-restore from
   *  the filmstrip). Sets the active viewpoint, writes the rig, and updates
   *  the camera preset. */
  restoreViewpoint: (id: string) => void;
  /** Set the active viewpoint id (filmstrip selection). Null = free camera. */
  setActiveViewpointId: (id: string | null) => void;
  /** Reorder a viewpoint to a new index in the filmstrip (drag-to-reorder). */
  reorderViewpoint: (id: string, toIndex: number) => void;
  /** Set the recording state for the walk-through video capture. */
  setRecordingWalk: (recording: boolean) => void;

  /** Replace the whole photo-elevation list (hydrate / undo / redo). */
  setPhotoElevations: (elevations: PhotoElevation[]) => void;
  /** Insert or replace one photo elevation record (touch updated_at). */
  upsertPhotoElevation: (elevation: PhotoElevation) => void;
  /** Remove a photo elevation by id. */
  removePhotoElevation: (id: string) => void;
  /** Patch one photo elevation record (calibration, plane placement). */
  updatePhotoElevation: (id: string, patch: Partial<PhotoElevation>) => void;
  /**
   * Open/close the photo-trace session. Opening pins the camera tools:
   * sketch mode arms (plane ink owns pointer capture) and the ground
   * tools (measure/asset/trench/zone) stand down.
   */
  setPhotoTraceSession: (
    session: {
      elevationId: string;
      mode: "trace" | "calibrate";
    } | null,
  ) => void;
  /** Set/clear the live calibration reference-line draft. */
  setPhotoCalibrateDraft: (
    draft: { a: PlanePoint; b: PlanePoint } | null,
  ) => void;
  /** Set the pending reference length + stamp label for calibration. */
  setPhotoCalibrateReference: (referenceM: number | null, label: string) => void;
  /** Commit a traced stroke to a photo elevation (undoable). */
  addPhotoTraceStroke: (elevationId: string, stroke: PhotoTraceStroke) => void;
  /** Remove photo-trace strokes by id (undoable). */
  removePhotoTraceStrokes: (elevationId: string, ids: string[]) => void;

  /** Arm/disarm the trench tool (mutually exclusive with sketch/measure/asset). */
  setTrenchTool: (kind: ConstructionTrenchKind | null) => void;
  /** Start/replace/clear the live trace draft. */
  setTrenchDraft: (
    draft: { kind: ConstructionTrenchKind; points: TrenchPointPct[] } | null,
  ) => void;
  /** Replace all committed trenches (hydrate / accept-all / undo). */
  setConstructionTrenches: (trenches: ConstructionTrench[]) => void;
  /** Commit a completed traced run (clears the draft; tool stays armed). */
  addConstructionTrench: (trench: ConstructionTrench) => void;

  /** Arm/disarm the zone tool (mutually exclusive with sketch/measure/asset/trench). */
  setZoneTool: (kind: IrrigationZoneKind | null) => void;
  /** Start/replace/clear the live zone draft. */
  setZoneDraft: (
    draft: { kind: IrrigationZoneKind; points: ZonePointPct[] } | null,
  ) => void;
  /** Replace all committed zones (hydrate / accept-all / undo). */
  setIrrigationZones: (zones: IrrigationZone[]) => void;
  /** Commit a completed traced zone (clears the draft; tool stays armed). */
  addIrrigationZone: (zone: IrrigationZone) => void;

  setProjectContext: (
    projectId: string,
    aerialUri: string | null,
    projectAddress?: string,
  ) => void;

  setSaveStatus: (status: SaveStatus, errorKind?: SaveErrorKind) => void;
  markSaved: () => void;
  /** Bump after a successful persist (drives downstream data refetch). */
  bumpSaveRevision: () => void;
}

/** Snapshot the undoable doc slices (placements + strokes + photo elevations + features + stitch records + trenches + zones + canvases + setback lines + building footprints). */
function docSnapshot(
  s: Pick<
    StudioStoreState,
    | "placements"
    | "sketchStrokes"
    | "photoElevations"
    | "features"
    | "stitchRecords"
    | "constructionTrenches"
    | "irrigationZones"
    | "sketchCanvases"
    | "setbackLines"
    | "buildingFootprints"
  >,
) {
  return {
    placements: [...s.placements],
    strokes: [...s.sketchStrokes],
    photoElevations: [...s.photoElevations],
    features: [...s.features],
    stitchRecords: { ...s.stitchRecords },
    constructionTrenches: [...s.constructionTrenches],
    irrigationZones: [...s.irrigationZones],
    canvases: [...s.sketchCanvases],
    setbackLines: [...s.setbackLines],
    buildingFootprints: [...s.buildingFootprints],
  };
}

function commitCadProposals(
  s: StudioStoreState,
  proposals: SketchCadProposal[],
) {
  if (proposals.length === 0) return {};
  const past = [...s.historyPast, docSnapshot(s)].slice(-50);
  const placements = [...s.placements];
  const features = [...s.features];
  for (const proposal of proposals) {
    const placement: CatalogPlacement = {
      id: crypto.randomUUID(),
      symbol_id: proposal.symbol_id,
      x_pct: proposal.x_pct,
      y_pct: proposal.y_pct,
      rotation_deg: ((proposal.rotDeg ?? 0) % 360 + 360) % 360,
      scale: proposal.scale ?? 1,
    };
    placements.push(placement);
    const mirrored = featureForAcceptedProposal(placement.id, proposal);
    if (mirrored) features.push(mirrored);
  }
  return {
    placements,
    features,
    cadProposals: [] as SketchCadProposal[],
    cadReviewOpen: false,
    cadActiveProposalId: null,
    historyPast: past,
    historyFuture: [],
  };
}

export const useStudioStore = create<StudioStoreState>((set) => ({
  // Temporal defaults (match the prior seasonalStore defaults)
  growthYear: 10,
  sunDatePreset: "today",
  sunMin: 12 * 60,
  seasonProgress: seasonProgressFromSun("today", 12 * 60),

  // View defaults
  subsurfaceView: false,
  suncastView: true,
  sketchMode: false,
  // Plan view (ortho, CAD-accurate). This is now true of BOTH fields: the rig
  // default carried a 55° pitch until 2026-08-22, so the two disagreed at rest
  // and the camera opened oblique in every mode while the studio believed it
  // was in plan. See DEFAULT_CAMERA_RIG.
  viewBlendTarget: 0,
  viewBlend: 0, // animated value — FusedCamera writes this each frame
  liveRig: DEFAULT_CAMERA_RIG, // transient — StudioControls writes during a gesture
  elevationActive: false, // committed — StudioControls writes once on gesture end
  elevationFacadeAzimuth: null, // photo pins set the plane bearing; exit clears it
  chromeReceded: false, // ChromeRecedeWatcher flips on camera-motion state change
  chromePeek: false, // hold-H peek — keydown/keyup in WebGLStudioPreview
  scanStage: "idle", // scan choreography director flips per stage
  scanStageStartedAt: 0,
  aiSession: { prompt: "", ghosts: [], status: "idle" },

  // Elevation Slice defaults
  sliceActive: false,
  sliceAxis: "z",
  slicePosM: 0,

  // Terrain analysis defaults — earthworks ON: the analysis IS the product,
  // pads + zones appear the moment a pad exists. Drainage is opt-in chrome.
  drainageView: false,
  earthworksView: true,

  // CAD annotation defaults — dims OFF. The old `true` was justified by "the
  // client wants to see sizes", which is a Quote/Present argument: it put a
  // dimension ring on the edges of a lot the operator was still trying to
  // establish in Survey. `DimensionLayer` mounts unconditionally and self-gates
  // on this flag alone with no mode term, so the default WAS the policy. Mode
  // entry now arms it — see modeArmsDims (cad + the pricing modes), which is
  // the pattern CAD already used explicitly and the only path that should exist.
  // The measure tape stays an armed tool, off by default.
  dimsView: false,
  // Scale overlays (edge ruler + dimension ring) default ON — the drawing
  // always opens with its scale reference visible until the operator hides it.
  scaleView: true,
  measureActive: false,
  measureTape: null,

  // Fit-sheet default ON — the live quote IS the product (the card
  // self-gates on an empty canvas).
  fitSheetOpen: true,
  scheduleOpen: false,
  activePlaneId: "ground",
  liveCoord: null,
  surveyedPlanLayers: {
    enabled: true,
    bearings: true,
    elevations: true,
    plants: true,
    materials: true,
    callouts: true,
    scope: true,
  },
  surveyAnnotationDialect: "technical",
  cadAnnotationLayers: {
    enabled: true,
    bearings: true,
    elevations: true,
    plants: true,
    materials: true,
    callouts: true,
    scope: true,
  },
  cadAnnotationDialect: "architectural",
  sketchAnnotationLayers: {
    enabled: true,
    bearings: false,
    elevations: false,
    plants: true,
    materials: true,
    callouts: true,
    scope: true,
  },
  sketchAnnotationDialect: "creative",
  surveyTradePacks: {
    irrigationDrainage: true,
    hardscapeConstruction: true,
    lightingElectrical: false,
  },
  cadTradePacks: {
    irrigationDrainage: true,
    hardscapeConstruction: true,
    lightingElectrical: true,
  },
  sketchTradePacks: {
    irrigationDrainage: false,
    hardscapeConstruction: true,
    lightingElectrical: false,
  },
  // Estimate exclusions — no lines unticked by default.
  excludedEstimateLineIds: [],

  // Split view default off — an explicit two-viewport mode.
  splitView: false,

  // Asset fan-out defaults — dock closed (chrome), nothing armed.
  assetsOpen: false,
  armedSymbolId: null,
  pendingAssetDrop: null,
  areaPlantActive: false,
  rowPlantActive: false,
  assetPlantDraft: null,
  massPlantPreviewCount: 0,
  pointerClientPos: null,
  placements: [],
  // Spatial gizmo defaults — translate armed by default (single placement
  // selection mounts the manipulator), no drag in flight.
  gizmoMode: "translate" as "translate" | "rotate" | "scale" | null,
  gizmoDragging: false,
  /** Undo/redo doc history — snapshots of {placements, strokes} (cap 50). */
  historyPast: [],
  historyFuture: [],

  // Flora ring defaults — no open session.
  floraSession: null,

  // Ink
  sketchStrokes: [],

  // Spatial Sketching — no planes until the operator creates one. The
  // implicit ground plane (activeCanvasId = null) is the legacy default.
  sketchCanvases: [],
  activeCanvasId: null,
  adjustingCanvasId: null,

  // Canvas rail view state (Phase B) — view state, not document state.
  hiddenCanvasIds: [],
  inactiveCanvasOpacity: 1.0,
  // Phase B2 — collapse + reorder (view state only).
  railCollapsed: false,
  canvasOrder: [],

  // AI Automated Site Setup (Phase 7) — no setback lines or building
  // footprints until generated; processing state starts idle.
  setbackLines: [],
  buildingFootprints: [],
  aiProcessingState: "IDLE",

  // Spatial UI — workspace defaults (RIGHT-handed, 100% scale, drafting on).
  handedness: "RIGHT",
  uiScale: 1.0,
  draftingMode: true,
  anchorVisibility: "ALL",
  canvasTheme: "DARK",

  // Phase 8 — default to technical rendering + orbit camera.
  renderMode: "TECHNICAL",
  cameraPosture: "ORBIT",
  // Phase G — default to VIEW (free orbit). DRAW locks the camera face-on.
  drawViewMode: "VIEW",

  // Stroke Transfer — tool starts disarmed, no source selected.
  transferToolArmed: false,
  transferSourceStrokeId: null,

  // Sketch-to-CAD Extrusion — tool starts disarmed, no stroke selected.
  extrusionToolArmed: false,
  selectedExtrusionStrokeId: null,
  activeExtrusionDepth: 1.0,

  // Cinematic Fly-Through + Viewpoint Filmstrip — no bookmarks, not playing,
  // no active viewpoint, not recording. All view state (never docSnapshot).
  cameraBookmarks: [],
  isPlayingFlythrough: false,
  _liveCameraPosition: { position: [0, 0, 0], target: [0, 0, 0] },
  activeViewpointId: null,
  isRecordingWalk: false,
  // Phase C2 — timeline controls (view state only).
  walkLingerS: 0.5,
  walkTransitionS: 2.0,
  walkLoop: false,
  walkProgress: 0,
  viewpointVisibility: {},

  // Site context — hydrated from the server-rendered site frame.
  siteBoundary: [],
  siteBuilding: [],

  // Landscape features — hydrated from DesignCanvas.features.
  features: [],

  // Stitch engine — no live highlights or records until ink exists.
  stitchSnapNodes: [],
  stitchHoverPoint: null,
  stitchEpsilonM: DEFAULT_STITCH_EPSILON_M,
  stitchRecords: {},
  stitchNotice: null,

  // Sketch → CAD proposals — empty until the operator tidies.
  cadProposals: [],
  cadReviewOpen: false,
  cadActiveProposalId: null,
  sketchCadNotice: null,

  // Selection — nothing selected until the operator picks.
  selection: [],
  // Phase H — selection mode (isolation + boolean ops). Off by default.
  selectionModeActive: false,

  // Inspector — no notice until a clamped edit fires.
  boundaryNotice: null,

  // Marquee — disarmed; no live draft.
  marqueeActive: false,
  marqueeDraft: null,

  // Precision drafting — no tool armed, so plain drag still pans.
  draftSession: null,

  // Expressive stylus Sketch — graphite armed by default; sun-hatch snap on;
  // neutral live telemetry until the first pen sample.
  activeNib: DEFAULT_NIB,
  // Angle-opacity falloff — WIDE by default (the original hardcoded value;
  // canvases stay visible during fly-throughs). The operator switches to
  // NARROW for working or BALANCED for general sketching.
  falloffPreset: "WIDE",
  sunAzimuthDeg: null,
  liveTelemetry: { ...NEUTRAL_TELEMETRY },
  sunHatchSnap: true,

  // Photo-trace elevation — no pinned session; records hydrate from the server.
  photoElevations: [],
  photoTraceSession: null,

  // Construction trenches
  trenchTool: null,
  trenchDraft: null,
  constructionTrenches: [],

  // Irrigation zones
  zoneTool: null,
  zoneDraft: null,
  irrigationZones: [],

  // Context
  projectId: "",
  aerialUri: null,
  projectAddress: "",

  // Save status
  saveStatus: "idle",
  saveErrorKind: null,
  saveRevision: 0,
  savedTick: 0,

  setGrowthYear: (growthYear) => set({ growthYear }),
  setSunMin: (sunMin) =>
    set((s) => ({
      sunMin,
      seasonProgress: seasonProgressFromSun(s.sunDatePreset, sunMin),
    })),
  setSunDatePreset: (sunDatePreset) =>
    set((s) => ({
      sunDatePreset,
      seasonProgress: seasonProgressFromSun(sunDatePreset, s.sunMin),
    })),
  setSubsurfaceView: (subsurfaceView) => set({ subsurfaceView }),
  setSuncastView: (suncastView) => set({ suncastView }),
  setSketchMode: (sketchMode) =>
    set(
      sketchMode
        ? {
          sketchMode: true,
          trenchTool: null,
          zoneTool: null,
          draftSession: null,
        }
        : { sketchMode: false },
    ),
  setViewBlendTarget: (viewBlendTarget) =>
    set({ viewBlendTarget: Math.max(0, Math.min(1, viewBlendTarget)) }),
  setPitchDeg: (deg) =>
    set((s) => {
      const pitch = clampPitchDeg(deg);
      return {
        liveRig: { ...s.liveRig, tiltDeg: pitch },
        viewBlendTarget: blendTargetForPitch(pitch),
        elevationActive: false, // pitch alone never carries the facade snap
      };
    }),
  setElevationActive: (elevationActive) => set({ elevationActive }),
  setChromeReceded: (chromeReceded) => set({ chromeReceded }),
  setChromePeek: (chromePeek) => set({ chromePeek }),
  setScanStage: (scanStage) =>
    set({ scanStage, scanStageStartedAt: performance.now() }),
  startAiSession: (prompt) =>
    set({ aiSession: { prompt, ghosts: [], status: "thinking" } }),
  setAiGhosts: (ghosts) =>
    set((s) => ({ aiSession: { ...s.aiSession, ghosts, status: "ready" } })),
  acceptAiGhosts: () =>
    set((s) => {
      if (s.aiSession.ghosts.length > 0) {
        // Commit ghosts as real placements (one undo via addPlacements).
        const committed = s.aiSession.ghosts.map((g) => ({ ...g }));
        // addPlacements handles the undo commit; we clear the session.
        s.addPlacements(committed);
      }
      return { aiSession: { prompt: "", ghosts: [], status: "accepted" } };
    }),
  clearAiSession: () =>
    set({ aiSession: { prompt: "", ghosts: [], status: "idle" } }),
  setElevationFacadeAzimuth: (elevationFacadeAzimuth) =>
    set({ elevationFacadeAzimuth }),
  // Transient per-frame write — no DOM consumer should subscribe to viewBlend
  // directly (it changes every frame). Use viewBlendTarget for UI. Consumers
  // that must track the camera (stroke drape) read via getState() in useFrame.
  setViewBlend: (viewBlend) => set({ viewBlend }),
  // The committed plan/3D target is DERIVED from the rig's pitch, never stored
  // independently: FusedCamera already springs on `blendTargetForPitch(pitch)`
  // each frame, so any writer that moved the pitch without committing the
  // target (every `writeLiveRig` caller — keyboard presets, camera reset, the
  // 3D chip) left the studio rendering perspective while `tiltLocked` still
  // read plan, and editing stayed unlocked under a 3D view. Committing here
  // closes that for all callers at once. Pan/zoom writes do not change pitch,
  // so the target is identical and no extra React render is scheduled.
  setLiveRig: (liveRig) =>
    set((s) => {
      const target = blendTargetForPitch(liveRig.tiltDeg);
      return target === s.viewBlendTarget
        ? { liveRig }
        : { liveRig, viewBlendTarget: target };
    }),

  setSliceActive: (sliceActive) => set({ sliceActive }),
  setSliceAxis: (sliceAxis) => set({ sliceAxis }),
  setSlicePosM: (slicePosM) => set({ slicePosM }),

  setDrainageView: (drainageView) => set({ drainageView }),
  setEarthworksView: (earthworksView) => set({ earthworksView }),

  setDimsView: (dimsView) => set({ dimsView }),
  setScaleView: (scaleView) => set({ scaleView }),
  // Mutual exclusion with sketch mode — both capture ground pointer events.
  setMeasureActive: (measureActive) =>
    set(
      measureActive
        ? {
          measureActive: true,
          sketchMode: false,
          trenchTool: null,
          zoneTool: null,
          draftSession: null,
        }
        : { measureActive: false },
    ),
  setMeasureTape: (a, b) =>
    set({ measureTape: a && b ? { a, b } : null }),

  setFitSheetOpen: (fitSheetOpen) => set({ fitSheetOpen }),
  setScheduleOpen: (scheduleOpen) => set({ scheduleOpen }),
  setActivePlaneId: (activePlaneId) => set({ activePlaneId }),
  setLiveCoord: (liveCoord) => set({ liveCoord }),
  setSurveyedPlanLayers: (patch) =>
    set((s) => ({
      surveyedPlanLayers: { ...s.surveyedPlanLayers, ...patch },
    })),
  setSurveyAnnotationDialect: (surveyAnnotationDialect) =>
    set({ surveyAnnotationDialect }),
  setCadAnnotationLayers: (patch) =>
    set((s) => ({
      cadAnnotationLayers: { ...s.cadAnnotationLayers, ...patch },
    })),
  setCadAnnotationDialect: (cadAnnotationDialect) =>
    set({ cadAnnotationDialect }),
  setSketchAnnotationLayers: (patch) =>
    set((s) => ({
      sketchAnnotationLayers: { ...s.sketchAnnotationLayers, ...patch },
    })),
  setSketchAnnotationDialect: (sketchAnnotationDialect) =>
    set({ sketchAnnotationDialect }),
  setSurveyTradePacks: (patch) =>
    set((s) => ({ surveyTradePacks: { ...s.surveyTradePacks, ...patch } })),
  setCadTradePacks: (patch) =>
    set((s) => ({ cadTradePacks: { ...s.cadTradePacks, ...patch } })),
  setSketchTradePacks: (patch) =>
    set((s) => ({ sketchTradePacks: { ...s.sketchTradePacks, ...patch } })),
  toggleEstimateLineExcluded: (id) =>
    set((s) => ({
      excludedEstimateLineIds: s.excludedEstimateLineIds.includes(id)
        ? s.excludedEstimateLineIds.filter((x) => x !== id)
        : [...s.excludedEstimateLineIds, id],
    })),

  setSplitView: (splitView) => set({ splitView }),

  setAssetsOpen: (assetsOpen) => set({ assetsOpen }),
  // Mutual exclusion: the armed placement layer owns ground pointer events,
  // so sketch mode and the measure tape must stand down.
  // Mass-plant modes are normalized on EVERY transition: they are only
  // meaningful for the symbol they were armed with, so a stale Area/Row
  // toggle must never silently resume when the next symbol arms (the
  // toolbar defaults to single-place; every disarm path — Esc, tool and
  // mode switches — clears them through here).
  setArmedSymbolId: (armedSymbolId) =>
    set(
      armedSymbolId
        ? {
          armedSymbolId,
          sketchMode: false,
          measureActive: false,
          trenchTool: null,
          zoneTool: null,
          draftSession: null,
          areaPlantActive: false,
          rowPlantActive: false,
        }
        : {
          armedSymbolId: null,
          assetPlantDraft: null,
          massPlantPreviewCount: 0,
          pointerClientPos: null,
          areaPlantActive: false,
          rowPlantActive: false,
        },
    ),
  setPendingAssetDrop: (pendingAssetDrop) => set({ pendingAssetDrop }),
  // Box fill and row run compete for the same drag — arming one stands the
  // other down (and drops any half-drawn preview).
  setAreaPlantActive: (areaPlantActive) =>
    set(
      areaPlantActive
        ? { areaPlantActive: true, rowPlantActive: false, assetPlantDraft: null }
        : { areaPlantActive: false, assetPlantDraft: null },
    ),
  setRowPlantActive: (rowPlantActive) =>
    set(
      rowPlantActive
        ? { rowPlantActive: true, areaPlantActive: false, assetPlantDraft: null }
        : { rowPlantActive: false, assetPlantDraft: null },
    ),
  setAssetPlantDraft: (assetPlantDraft) => set({ assetPlantDraft }),
  setMassPlantPreviewCount: (massPlantPreviewCount) => set({ massPlantPreviewCount }),
  setPointerClientPos: (pointerClientPos) => set({ pointerClientPos }),
  setPlacements: (placements) => set({ placements }),
  updatePlacementField: (id, patch) =>
    set((s) => {
      const past = [...s.historyPast, docSnapshot(s)].slice(-50);
      let notice = s.boundaryNotice;
      const placements = s.placements.map((p) => {
        if (p.id !== id) return p;
        const merged = { ...p, ...patch };
        if (!patchClamps(patch as Partial<Record<PlacementFieldKey, unknown>>)) {
          return merged;
        }
        const clamped = clampPlacementEdit(
          merged,
          s.siteBoundary,
          s.siteBuilding,
        );
        if (clamped.snapped) {
          notice = {
            refId: id,
            reason: clamped.reason ?? "Centre snapped into the outdoor area",
            at: Date.now(),
          };
        }
        return { ...merged, x_pct: clamped.x, y_pct: clamped.y };
      });
      return {
        placements,
        boundaryNotice: notice,
        historyPast: past,
        historyFuture: [],
      };
    }),
  updateFeatureField: (id, patch) =>
    set((s) => {
      const past = [...s.historyPast, docSnapshot(s)].slice(-50);
      const features = s.features.map((f) => {
        if (f.id !== id) return f;
        const materialFill =
          patch.material_fill && f.material_fill
            ? { ...f.material_fill, ...patch.material_fill }
            : f.material_fill;
        const scatter =
          patch.brush_recipe_id && f.procedural_scatter_contents
            ? {
              ...f.procedural_scatter_contents,
              brush_recipe_id: patch.brush_recipe_id,
            }
            : f.procedural_scatter_contents;
        const labor =
          patch.labor_tier && f.labor_profile
            ? { ...f.labor_profile, base_difficulty_tier: patch.labor_tier }
            : f.labor_profile;
        // A non-positive height clears the pad (the contract only models a
        // positive extrusion — absent means flat).
        const heightM =
          patch.extrude_height_m === undefined
            ? f.extrude_height_m
            : patch.extrude_height_m > 0
              ? patch.extrude_height_m
              : undefined;
        return {
          ...f,
          metadata: {
            ...f.metadata,
            friendly_name: patch.friendly_name ?? f.metadata.friendly_name,
            user_modification_state: "human_locked" as const,
          },
          material_fill: materialFill,
          procedural_scatter_contents: scatter,
          labor_profile: labor,
          extrude_height_m: heightM,
        };
      });
      return { features, historyPast: past, historyFuture: [] };
    }),
  dismissBoundaryNotice: () => set({ boundaryNotice: null }),
  setMarqueeActive: (active) =>
    set(
      active
        ? {
          marqueeActive: true,
          sketchMode: false,
          armedSymbolId: null,
          measureActive: false,
          trenchTool: null,
          zoneTool: null,
          draftSession: null,
        }
        : { marqueeActive: false },
    ),
  beginDraft: (tool) =>
    set({
      draftSession: beginDraftSession(tool),
      // Arming a drafting tool takes ground pointer capture, so every other
      // capture tool stands down (the marquee tool-gate pattern).
      sketchMode: false,
      measureActive: false,
      armedSymbolId: null,
      assetPlantDraft: null,
      trenchTool: null,
      trenchDraft: null,
      zoneTool: null,
      zoneDraft: null,
      marqueeActive: false,
      marqueeDraft: null,
      floraSession: null,
    }),
  addDraftVertex: (vertex) =>
    set((s) =>
      s.draftSession
        ? { draftSession: appendDraftVertex(s.draftSession, vertex) }
        : {},
    ),
  undoDraftVertex: () =>
    set((s) =>
      s.draftSession
        ? { draftSession: dropLastDraftVertex(s.draftSession) }
        : {},
    ),
  cancelDraft: () => set({ draftSession: null }),
  commitDraft: (scaleM, boardAspect, closed) => {
    const session = useStudioStore.getState().draftSession;
    if (!session || !canCommitDraft(session, closed)) return false;
    if (session.tool === "area") {
      // Area must close — the ring IS the region (spec §5).
      const feature = areaFeatureFromDraft({
        id: crypto.randomUUID(),
        vertices: session.vertices,
        scaleM,
        boardAspect,
      });
      if (!feature) return false;
      set((s) => ({
        features: [...s.features, feature],
        draftSession: { tool: "area", vertices: [] },
        historyPast: [...s.historyPast, docSnapshot(s)].slice(-50),
        historyFuture: [],
      }));
      return true;
    }
    const stroke = polylineStrokeFromDraft({
      id: crypto.randomUUID(),
      vertices: session.vertices,
      closed,
      scaleM,
      boardAspect,
    });
    if (!stroke) return false;
    set((s) => ({
      sketchStrokes: [...s.sketchStrokes, stroke],
      draftSession: { tool: "polyline", vertices: [] },
      historyPast: [...s.historyPast, docSnapshot(s)].slice(-50),
      historyFuture: [],
    }));
    return true;
  },
  setMarqueeDraft: (marqueeDraft) => set({ marqueeDraft }),
  marqueeSelectBox: (box, opts) =>
    set((s) => {
      const refs = marqueeSelectRefs(s.placements, s.features, box);
      return {
        selection: opts?.additive
          ? dedupeSelection([...s.selection, ...refs])
          : refs,
        marqueeDraft: null,
      };
    }),
  setActiveNib: (activeNib) => set({ activeNib }),
  setFalloffPreset: (falloffPreset) => set({ falloffPreset }),
  setSunAzimuthDeg: (sunAzimuthDeg) => set({ sunAzimuthDeg }),
  // Transient scratch write — mutates the shared telemetry object in place
  // WITHOUT set(), so per-pointer-move updates never re-render DOM
  // subscribers (the liveRig transient doctrine). The nib palette polls
  // getState().liveTelemetry on a slow interval for its readout.
  setLiveTelemetry: (t) => {
    const s = useStudioStore.getState().liveTelemetry;
    s.pressure = t.pressure;
    s.tiltX = t.tiltX;
    s.tiltY = t.tiltY;
    s.azimuth = t.azimuth;
    s.altitude = t.altitude;
  },
  setSunHatchSnap: (sunHatchSnap) => set({ sunHatchSnap }),
  hatchFillStroke: (strokeId, opts) =>
    set((s) => {
      const parent = s.sketchStrokes.find((st) => st.id === strokeId);
      const pts = parent?.points;
      if (!pts || pts.length < 3) return {};
      const ring: PctPoint[] = pts.map((p) => ({ x: p.x_pct, y: p.y_pct }));
      if (!isClosedRing(ring)) return {};
      const angle =
        s.sunHatchSnap && s.sunAzimuthDeg != null
          ? sunHatchAngleDeg(s.sunAzimuthDeg)
          : 45;
      const spacing = opts?.spacingPct ?? DEFAULT_HATCH_SPACING_PCT;
      const lines = hatchLinesForPolygon(ring, angle, spacing);
      if (lines.length === 0) return {};
      const round2 = (v: number) => Math.round(v * 100) / 100;
      const baseColor = parent.color ?? PALETTE.sketchInk;
      const baseWidth = parent.width_px ?? 2;
      const hatchStrokes: CanvasStroke[] = lines.map((ln) => ({
        id: crypto.randomUUID(),
        points: [
          { x_pct: round2(ln.a.x), y_pct: round2(ln.a.y) },
          { x_pct: round2(ln.b.x), y_pct: round2(ln.b.y) },
        ],
        color: baseColor,
        width_px: Math.max(0.75, baseWidth * 0.5),
        kind: "ink",
        nib: "ink-03",
        hatch: { of: parent.id, angle_deg: angle, spacing_pct: spacing },
      }));
      const past = [...s.historyPast, docSnapshot(s)].slice(-50);
      return {
        sketchStrokes: [...s.sketchStrokes, ...hatchStrokes],
        historyPast: past,
        historyFuture: [],
      };
    }),
  addPlacement: (placement) =>
    set((s) => {
      const past = [...s.historyPast, docSnapshot(s)].slice(-50);
      return { placements: [...s.placements, placement], historyPast: past, historyFuture: [] };
    }),
  addPlacements: (added) =>
    set((s) => {
      if (added.length === 0) return {};
      // Generated centres invent positions — reconcile against the title
      // boundary before they can enter the document.
      const { kept, reason } = reconcileGeneratedPlacements(
        added,
        s.siteBoundary,
        s.siteBuilding,
      );
      const notice = reason
        ? { refId: MASS_PLANT_NOTICE_REF, reason, at: Date.now() }
        : s.boundaryNotice;
      if (kept.length === 0) return { boundaryNotice: notice };
      const past = [...s.historyPast, docSnapshot(s)].slice(-50);
      return {
        placements: [...s.placements, ...kept],
        boundaryNotice: notice,
        historyPast: past,
        historyFuture: [],
      };
    }),
  removePlacement: (id) =>
    set((s) => {
      const past = [...s.historyPast, docSnapshot(s)].slice(-50);
      const placements = s.placements.filter((p) => p.id !== id);
      return {
        placements,
        selection: pruneSelection(s.selection, {
          placements,
          features: s.features,
          photoElevations: s.photoElevations,
        }),
        historyPast: past,
        historyFuture: [],
      };
    }),
  removePlacements: (ids) => {
    const idSet = new Set(ids);
    set((s) => {
      const past = [...s.historyPast, docSnapshot(s)].slice(-50);
      const placements = s.placements.filter((p) => !idSet.has(p.id));
      return {
        placements,
        selection: pruneSelection(s.selection, {
          placements,
          features: s.features,
          photoElevations: s.photoElevations,
        }),
        historyPast: past,
        historyFuture: [],
      };
    });
  },
  setGizmoMode: (gizmoMode) => set({ gizmoMode }),
  setGizmoDragging: (gizmoDragging) => set({ gizmoDragging }),
  beginPlacementTransform: () =>
    set((s) => ({
      historyPast: [...s.historyPast, docSnapshot(s)].slice(-50),
      historyFuture: [],
    })),
  setPlacementTransformTransient: (id, patch) =>
    set((s) => {
      let notice = s.boundaryNotice;
      const placements = s.placements.map((p) => {
        if (p.id !== id) return p;
        const merged = { ...p, ...patch };
        // Rotation-only / scale-only patches never reposition (attribute edits);
        // scale is floored at 0.1 to match the inspector's min. Position patches
        // re-clamp per frame so the gizmo "slips" along the title edge instead
        // of crossing it.
        if (patch.x_pct === undefined && patch.y_pct === undefined) {
          return patch.scale !== undefined
            ? { ...merged, scale: Math.max(0.1, patch.scale) }
            : merged;
        }
        const clamped = clampPlacementEdit(
          merged,
          s.siteBoundary,
          s.siteBuilding,
        );
        if (clamped.snapped) {
          notice = {
            refId: id,
            reason: clamped.reason ?? "Centre snapped into the outdoor area",
            at: Date.now(),
          };
        }
        return { ...merged, x_pct: clamped.x, y_pct: clamped.y };
      });
      return { placements, boundaryNotice: notice };
    }),
  endPlacementTransform: () =>
    set(() => ({ historyFuture: [] })),

  commitHistory: () =>
    set((s) => ({
      historyPast: [...s.historyPast, docSnapshot(s)].slice(-50),
      historyFuture: [],
    })),
  undo: () =>
    set((s) => {
      const prev = s.historyPast[s.historyPast.length - 1];
      if (!prev) return {};
      return {
        placements: prev.placements,
        sketchStrokes: prev.strokes,
        photoElevations: prev.photoElevations,
        features: prev.features,
        stitchRecords: { ...prev.stitchRecords },
        constructionTrenches: prev.constructionTrenches,
        irrigationZones: prev.irrigationZones,
        sketchCanvases: prev.canvases,
        setbackLines: prev.setbackLines,
        buildingFootprints: prev.buildingFootprints,
        selection: pruneSelection(s.selection, {
          placements: prev.placements,
          features: prev.features,
          photoElevations: prev.photoElevations,
        }),
        historyPast: s.historyPast.slice(0, -1),
        historyFuture: [...s.historyFuture, docSnapshot(s)].slice(-50),
      };
    }),
  redo: () =>
    set((s) => {
      const next = s.historyFuture[s.historyFuture.length - 1];
      if (!next) return {};
      return {
        placements: next.placements,
        sketchStrokes: next.strokes,
        photoElevations: next.photoElevations,
        features: next.features,
        stitchRecords: { ...next.stitchRecords },
        constructionTrenches: next.constructionTrenches,
        irrigationZones: next.irrigationZones,
        sketchCanvases: next.canvases,
        setbackLines: next.setbackLines,
        buildingFootprints: next.buildingFootprints,
        selection: pruneSelection(s.selection, {
          placements: next.placements,
          features: next.features,
          photoElevations: next.photoElevations,
        }),
        historyFuture: s.historyFuture.slice(0, -1),
        historyPast: [...s.historyPast, docSnapshot(s)].slice(-50),
      };
    }),

  setFloraSession: (session) =>
    set((s) =>
      session
        ? { floraSession: { ...session, activeIdx: 0 }, armedSymbolId: s.armedSymbolId }
        : { floraSession: null },
    ),
  setFloraActiveIdx: (idx) =>
    set((s) =>
      s.floraSession
        ? { floraSession: { ...s.floraSession, activeIdx: Math.max(0, idx) } }
        : {},
    ),

  setSketchStrokes: (sketchStrokes) => set({ sketchStrokes }),
  addSketchStroke: (stroke) =>
    set((s) => {
      const past = [...s.historyPast, docSnapshot(s)].slice(-50);
      return { sketchStrokes: [...s.sketchStrokes, stroke], historyPast: past, historyFuture: [] };
    }),
  removeSketchStrokes: (ids) => {
    const idSet = new Set(ids);
    set((s) => {
      const past = [...s.historyPast, docSnapshot(s)].slice(-50);
      return { sketchStrokes: s.sketchStrokes.filter((st) => !idSet.has(st.id)), historyPast: past, historyFuture: [] };
    });
  },
  updateSketchStroke: (id, patch) =>
    set((s) => ({
      sketchStrokes: s.sketchStrokes.map((st) =>
        st.id === id ? { ...st, ...patch } : st,
      ),
    })),

  // --- Spatial Sketching — canvas plane actions ---
  setSketchCanvases: (sketchCanvases) => set({ sketchCanvases }),
  addSketchCanvas: (canvas) =>
    set((s) => {
      const past = [...s.historyPast, docSnapshot(s)].slice(-50);
      return {
        sketchCanvases: [...s.sketchCanvases, canvas],
        activeCanvasId: canvas.id,
        historyPast: past,
        historyFuture: [],
      };
    }),
  updateSketchCanvas: (id, patch) =>
    set((s) => {
      const past = [...s.historyPast, docSnapshot(s)].slice(-50);
      return {
        sketchCanvases: s.sketchCanvases.map((c) =>
          c.id === id ? { ...c, ...patch } : c,
        ),
        historyPast: past,
        historyFuture: [],
      };
    }),
  removeSketchCanvas: (id) =>
    set((s) => {
      const past = [...s.historyPast, docSnapshot(s)].slice(-50);
      // Strokes referencing the removed plane fall back to the ground plane
      // (canvas_id = null) — they are not deleted.
      const sketchStrokes = s.sketchStrokes.map((st) =>
        st.canvas_id === id ? { ...st, canvas_id: null } : st,
      );
      return {
        sketchCanvases: s.sketchCanvases.filter((c) => c.id !== id),
        sketchStrokes,
        activeCanvasId: s.activeCanvasId === id ? null : s.activeCanvasId,
        historyPast: past,
        historyFuture: [],
      };
    }),
  setActiveCanvasId: (id) =>
    set((s) => {
      // Phase G: in DRAW mode, re-align the camera to the new active canvas.
      if (s.drawViewMode === "DRAW") {
        const rig = alignRigToActiveCanvas(
          id,
          s.sketchCanvases.map((c) => ({ id: c.id, rotation: c.rotation })),
          s.liveRig,
        );
        return { activeCanvasId: id, liveRig: rig };
      }
      return { activeCanvasId: id };
    }),

  setAdjustingCanvasId: (id) => set({ adjustingCanvasId: id }),
  beginSketchCanvasTransform: () =>
    set((s) => ({
      historyPast: [...s.historyPast, docSnapshot(s)].slice(-50),
      historyFuture: [],
    })),
  setSketchCanvasTransformTransient: (id, patch) =>
    set((s) => ({
      sketchCanvases: s.sketchCanvases.map((c) =>
        c.id === id ? { ...c, ...patch } : c,
      ),
    })),
  endSketchCanvasTransform: () => set(() => ({ historyFuture: [] })),

  commitCalibration: (ratio, scaleHeights) =>
    set((s) => {
      const past = [...s.historyPast, docSnapshot(s)].slice(-50);
      // Scale canvas positions (world metres). Strokes are in board-% and
      // are NOT redrawn — the board_width_m change handles their world scale.
      const sketchCanvases = s.sketchCanvases.map((c) => {
        const [x, y, z] = c.position;
        return {
          ...c,
          position: scaleHeights
            ? [x * ratio, y * ratio, z * ratio]
            : [x * ratio, y, z * ratio],
        } as SketchCanvas;
      });
      return {
        sketchCanvases,
        historyPast: past,
        historyFuture: [],
      };
    }),

  // Canvas rail view state (Phase B) — mirrors toggleOverlayKind's pattern.
  toggleCanvasVisibility: (id) =>
    set((s) => ({
      hiddenCanvasIds: s.hiddenCanvasIds.includes(id)
        ? s.hiddenCanvasIds.filter((c) => c !== id)
        : [...s.hiddenCanvasIds, id],
    })),
  setInactiveCanvasOpacity: (v) =>
    set({ inactiveCanvasOpacity: Math.max(0.15, Math.min(1.0, v)) }),

  // Phase B2 — canvas rail collapse + reorder (view state only).
  toggleRailCollapsed: () => set((s) => ({ railCollapsed: !s.railCollapsed })),
  setRailCollapsed: (v) => set({ railCollapsed: v }),
  reorderCanvas: (fromId, toId) =>
    set((s) => {
      if (fromId === toId) return {};
      // Build the full order: start with canvasOrder, append any canvases
      // not yet tracked (preserving Y-sort for newcomers).
      const known = new Set(s.canvasOrder);
      const extras = s.sketchCanvases
        .filter((c) => !known.has(c.id))
        .sort((a, b) => b.position[1] - a.position[1])
        .map((c) => c.id);
      const order = [...s.canvasOrder, ...extras];
      const fromIdx = order.indexOf(fromId);
      const toIdx = order.indexOf(toId);
      if (fromIdx === -1 || toIdx === -1) return {};
      // Remove fromId and insert before toId.
      order.splice(fromIdx, 1);
      const newToIdx = order.indexOf(toId);
      order.splice(newToIdx, 0, fromId);
      return { canvasOrder: order };
    }),

  // --- AI Automated Site Setup (Phase 7) ---
  setSetbackLines: (setbackLines) => set({ setbackLines }),
  setBuildingFootprints: (buildingFootprints) => set({ buildingFootprints }),
  setAiProcessingState: (aiProcessingState) => set({ aiProcessingState }),
  processSiteDocuments: async (surveyFile, titleFile) => {
    const store = useStudioStore.getState();
    if (store.aiProcessingState !== "IDLE") return;
    const projectId = store.projectId;
    if (!projectId) return;

    store.setAiProcessingState("ANALYZING_SURVEY");

    const formData = new FormData();
    if (surveyFile) formData.append("survey", surveyFile);
    if (titleFile) formData.append("title", titleFile);

    let res: Response;
    try {
      res = await fetch(
        `/api/projects/${projectId}/design-canvas/auto-setup`,
        {
          method: "POST",
          body: formData,
          cache: "no-store",
        },
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[processSiteDocuments] fetch failed", msg);
      store.setAiProcessingState("IDLE");
      return;
    }

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("[processSiteDocuments] API error", res.status, detail);
      store.setAiProcessingState("IDLE");
      return;
    }

    const payload = (await res.json()) as {
      canvases: SketchCanvas[];
      setback_lines: SetbackLine[];
      building_footprints: BuildingFootprint[];
    };

    store.setAiProcessingState("GENERATING_SITE");

    // Commit the AI-generated canvases + setback lines + building footprints
    // in ONE undo step.
    set((s) => ({
      sketchCanvases: payload.canvases,
      setbackLines: payload.setback_lines,
      buildingFootprints: payload.building_footprints,
      activeCanvasId: payload.canvases[0]?.id ?? s.activeCanvasId,
      aiProcessingState: "SUCCESS",
      historyPast: [...s.historyPast, docSnapshot(s)].slice(-50),
      historyFuture: [],
    }));

    // Auto-reset to IDLE after a brief success flash (the modal closes on
    // SUCCESS; the reset lets a future run start cleanly).
    window.setTimeout(() => {
      if (useStudioStore.getState().aiProcessingState === "SUCCESS") {
        useStudioStore.setState({ aiProcessingState: "IDLE" });
      }
    }, 1500);
  },

  // --- Spatial UI — workspace toggle actions ---
  setHandedness: (handedness) => set({ handedness }),
  setUiScale: (uiScale) => set({ uiScale: Math.max(0.85, Math.min(1.3, uiScale)) }),
  setDraftingMode: (draftingMode) => set({ draftingMode }),
  setAnchorVisibility: (anchorVisibility) => set({ anchorVisibility }),
  toggleCanvasTheme: () =>
    set((s) => ({ canvasTheme: s.canvasTheme === "DARK" ? "LIGHT" : "DARK" })),

  // --- Landscape Canvas v2 — tool ribbon + pen-down quiet state ---
  activeTool: "none",
  setActiveTool: (tool) => {
    const s = useStudioStore.getState();
    // Bridge: the unified tool id drives the legacy tool flags so the
    // existing scene layers (FusedSketchLayer, MeasureLayer, etc.) respond
    // without each one needing to know about the ribbon.
    const patch: Partial<StudioStoreState> = { activeTool: tool };
    // Clear all tool flags first, then set the ones for the active tool.
    patch.sketchMode = tool === "pen";
    patch.measureActive = tool === "dim";
    patch.sliceActive = tool === "section";
    patch.earthworksView = tool === "cutfill";
    patch.extrusionToolArmed = tool === "mass";
    patch.transferToolArmed = tool === "path";
    patch.trenchTool = null;
    patch.zoneTool = null;
    patch.trenchDraft = null;
    patch.zoneDraft = null;
    patch.armedSymbolId = tool === "tree" ? (s.armedSymbolId ?? "canopy") : tool === "bed" ? (s.armedSymbolId ?? "bed") : null;
    patch.areaPlantActive = tool === "bed";
    patch.rowPlantActive = false;
    patch.assetPlantDraft = null;
    patch.pendingAssetDrop = null;
    patch.marqueeActive = false;
    patch.marqueeDraft = null;
    patch.draftSession = null;
    patch.draftingMode = tool === "line" || tool === "spline" ? true : s.draftingMode;
    set(patch);
  },
  penDown: false,
  setPenDown: (down) => set({ penDown: down }),
  ribbonDwellOpen: false,
  setRibbonDwellOpen: (ribbonDwellOpen) => set({ ribbonDwellOpen }),
  cameraPreset: "plan",
  hiddenOverlayKinds: [],
  toggleOverlayKind: (kind) =>
    set((s) => ({
      hiddenOverlayKinds: s.hiddenOverlayKinds.includes(kind)
        ? s.hiddenOverlayKinds.filter((k) => k !== kind)
        : [...s.hiddenOverlayKinds, kind],
    })),
  /**
   * Landscape Canvas v2 — camera dock presets (handoff §6.1). PLAN/AXO/SEC
   * are orthographic drafting views; 3D is the perspective blend.
   *
   * The committed plan/3D target and the elevation flag are DERIVED from the
   * rig exactly as the orbit-gesture path commits them — never hardcoded per
   * preset. Hardcoding `viewBlendTarget: 0` for AXO (tilt 22°) left the
   * camera rendering perspective while the studio believed it was plan:
   * FusedCamera springs on `blendTargetForPitch(pitch)` every frame and
   * ignores the stored target, and StudioScene computed `tiltLocked` from the
   * target — so editing stayed unlocked under a 3D view (the same bug class
   * the pitch-collapse refactor fixed for mode entry, see the
   * webgl-camera-mode-entry spec).
   *
   * SEC (tilt 90°) snaps the azimuth to the nearest facade normal — the
   * exact elevation snap, so `isElevationRig` is true and the CAD convention
   * re-enables editing at the orthographic horizon. The store is the single
   * commit point for every preset writer (dock click, keyboard 1–4, HUD hit).
   */
  setCameraPreset: (preset) => {
    const live = useStudioStore.getState().liveRig;
    const rig = { ...live };
    if (preset === "plan") {
      rig.tiltDeg = 0;
    } else if (preset === "axo") {
      rig.tiltDeg = AXO_PITCH_DEG;
    } else if (preset === "sec") {
      rig.tiltDeg = 90;
      // With a section cut active the elevation faces the CUT, not the
      // building facade (spec 9.6 camera law): a "z" cut runs along X and its
      // curtain faces ±Z (look N/S); an "x" cut faces ±X (look E/W).
      const { sliceActive, sliceAxis } = useStudioStore.getState();
      rig.rotateDeg = sliceActive
        ? sliceAxis === "z"
          ? 0
          : 90
        : nearestFacadeNormalDeg(rig.rotateDeg);
    } else {
      // 3D — the garden-eye perspective blend. Floor the zoom to the dock's
      // documented drone-orbit framing (zoom in stays untouched).
      rig.tiltDeg = GARDEN_PITCH_DEG;
      rig.zoom = Math.max(rig.zoom, 1.45);
    }
    set({
      cameraPreset: preset,
      liveRig: rig,
      viewBlendTarget: blendTargetForPitch(rig.tiltDeg),
      elevationActive: isElevationRig(
        rig,
        useStudioStore.getState().elevationFacadeAzimuth,
      ),
    });
  },

  // --- Phase 8: Living Diorama & Spatial Presence ---
  toggleRenderMode: () =>
    set((s) => ({
      renderMode: s.renderMode === "TECHNICAL" ? "IMMERSIVE" : "TECHNICAL",
    })),
  setCameraPosture: (cameraPosture) => set({ cameraPosture }),

  // Phase G — Draw Mode vs View Mode.
  toggleDrawViewMode: () =>
    set((s) => {
      const next = s.drawViewMode === "DRAW" ? "VIEW" : "DRAW";
      if (next === "DRAW") {
        // Entering DRAW mode: align the camera to the active canvas.
        const rig = alignRigToActiveCanvas(
          s.activeCanvasId,
          s.sketchCanvases.map((c) => ({ id: c.id, rotation: c.rotation })),
          s.liveRig,
        );
        return { drawViewMode: next, liveRig: rig };
      }
      return { drawViewMode: next };
    }),
  setDrawViewMode: (mode) =>
    set((s) => {
      if (mode === "DRAW") {
        const rig = alignRigToActiveCanvas(
          s.activeCanvasId,
          s.sketchCanvases.map((c) => ({ id: c.id, rotation: c.rotation })),
          s.liveRig,
        );
        return { drawViewMode: mode, liveRig: rig };
      }
      return { drawViewMode: mode };
    }),
  alignCameraToActiveCanvas: () =>
    set((s) => {
      if (s.drawViewMode !== "DRAW") return {};
      const rig = alignRigToActiveCanvas(
        s.activeCanvasId,
        s.sketchCanvases.map((c) => ({ id: c.id, rotation: c.rotation })),
        s.liveRig,
      );
      return { liveRig: rig };
    }),

  // --- Stroke Transfer (Phase 2) ---
  setTransferToolArmed: (on) =>
    set(on ? { transferToolArmed: true } : { transferToolArmed: false, transferSourceStrokeId: null }),
  setTransferSourceStrokeId: (transferSourceStrokeId) => set({ transferSourceStrokeId }),

  // --- Sketch-to-CAD Extrusion (Phase 6) ---
  toggleExtrusionTool: () =>
    set((s) => ({
      extrusionToolArmed: !s.extrusionToolArmed,
      selectedExtrusionStrokeId: null,
    })),
  selectExtrusionStroke: (id) => set({ selectedExtrusionStrokeId: id }),
  setActiveExtrusionDepth: (depth) => set({ activeExtrusionDepth: depth }),
  commitExtrusion: (id, depth) => {
    const s = useStudioStore.getState();
    const stroke = s.sketchStrokes.find((st) => st.id === id);
    if (!stroke) return;
    s.updateSketchStroke(id, {
      extrude_height_m: depth > 0 ? depth : undefined,
    });
    set({ extrusionToolArmed: false, selectedExtrusionStrokeId: null });
  },

  // --- Cinematic Fly-Through (Phase 5) + Viewpoint Filmstrip (Phase C) ---
  addCameraBookmark: (bookmark) =>
    set((s) => ({ cameraBookmarks: [...s.cameraBookmarks, bookmark] })),
  captureCameraBookmark: () => {
    const cam = useStudioStore.getState()._liveCameraPosition;
    const bookmark: CameraBookmark = {
      id: crypto.randomUUID(),
      position: [cam.position[0], cam.position[1], cam.position[2]],
      target: [cam.target[0], cam.target[1], cam.target[2]],
    };
    set((s) => ({ cameraBookmarks: [...s.cameraBookmarks, bookmark] }));
  },
  removeCameraBookmark: (id) =>
    set((s) => ({
      cameraBookmarks: s.cameraBookmarks.filter((b) => b.id !== id),
      activeViewpointId: s.activeViewpointId === id ? null : s.activeViewpointId,
    })),
  toggleFlythrough: () =>
    set((s) => ({ isPlayingFlythrough: !s.isPlayingFlythrough })),

  // --- Viewpoint Filmstrip (Phase C) ---
  // captureViewpoint takes a pre-captured thumbnail (PNG data URL from the
  // live WebGL canvas) and snapshots the full camera state: position, target,
  // rig, preset. The filmstrip component handles the canvas.toDataURL call
  // (it has the canvas ref) and passes the result here.
  captureViewpoint: (thumb) => {
    const state = useStudioStore.getState();
    const cam = state._liveCameraPosition;
    const rig = state.liveRig;
    const preset = state.cameraPreset;
    const bookmark: CameraBookmark = {
      id: crypto.randomUUID(),
      position: [cam.position[0], cam.position[1], cam.position[2]],
      target: [cam.target[0], cam.target[1], cam.target[2]],
      thumb,
      rig: { ...rig },
      preset,
    };
    set((s) => ({
      cameraBookmarks: [...s.cameraBookmarks, bookmark],
      activeViewpointId: bookmark.id,
    }));
  },
  // restoreViewpoint writes the saved rig back to liveRig + viewBlendTarget +
  // cameraPreset. FusedCamera springs to the new rig on the next frame.
  restoreViewpoint: (id) => {
    const state = useStudioStore.getState();
    const vp = state.cameraBookmarks.find((b) => b.id === id);
    if (!vp || !vp.rig) return;
    set({
      liveRig: { ...vp.rig },
      viewBlendTarget: blendTargetForPitch(vp.rig.tiltDeg),
      cameraPreset: vp.preset ?? state.cameraPreset,
      activeViewpointId: id,
    });
  },
  setActiveViewpointId: (id) => set({ activeViewpointId: id }),
  reorderViewpoint: (id, toIndex) =>
    set((s) => {
      const list = [...s.cameraBookmarks];
      const fromIndex = list.findIndex((b) => b.id === id);
      if (fromIndex === -1) return {};
      const [item] = list.splice(fromIndex, 1);
      list.splice(Math.max(0, Math.min(toIndex, list.length)), 0, item!);
      return { cameraBookmarks: list };
    }),
  setRecordingWalk: (recording) => set({ isRecordingWalk: recording }),

  // Phase C2 — timeline controls (view state only).
  setWalkLingerS: (s) => set({ walkLingerS: Math.max(0, Math.min(10, s)) }),
  setWalkTransitionS: (s) => set({ walkTransitionS: Math.max(0.5, Math.min(30, s)) }),
  toggleWalkLoop: () => set((s) => ({ walkLoop: !s.walkLoop })),
  setWalkProgress: (p) => set({ walkProgress: Math.max(0, Math.min(1, p)) }),
  toggleViewpointVisibility: (viewpointId, canvasId) =>
    set((s) => {
      const current = s.viewpointVisibility[viewpointId] ?? [];
      const next = current.includes(canvasId)
        ? current.filter((id) => id !== canvasId)
        : [...current, canvasId];
      return {
        viewpointVisibility: { ...s.viewpointVisibility, [viewpointId]: next },
      };
    }),

  setPhotoElevations: (photoElevations) => set({ photoElevations }),
  upsertPhotoElevation: (elevation) =>
    set((s) => {
      const exists = s.photoElevations.some((e) => e.id === elevation.id);
      const photoElevations = exists
        ? s.photoElevations.map((e) => (e.id === elevation.id ? elevation : e))
        : [...s.photoElevations, elevation];
      return { photoElevations };
    }),
  removePhotoElevation: (id) =>
    set((s) => ({
      photoElevations: s.photoElevations.filter((e) => e.id !== id),
      photoTraceSession:
        s.photoTraceSession?.elevationId === id ? null : s.photoTraceSession,
      elevationFacadeAzimuth:
        s.photoTraceSession?.elevationId === id
          ? null
          : s.elevationFacadeAzimuth,
    })),
  updatePhotoElevation: (id, patch) =>
    set((s) => ({
      photoElevations: s.photoElevations.map((e) =>
        e.id === id ? { ...e, ...patch, updated_at: new Date().toISOString() } : e,
      ),
    })),
  setPhotoTraceSession: (session) =>
    set((s) => {
      if (!session) {
        // Exit clears the facade-azimuth override — cardinals-only snaps
        // resume (the pin's arbitrary boundary bearing no longer applies).
        return { photoTraceSession: null, elevationFacadeAzimuth: null };
      }
      const elev = s.photoElevations.find((e) => e.id === session.elevationId);
      if (!elev) return {};
      return {
        photoTraceSession: {
          elevationId: session.elevationId,
          mode: session.mode,
          calibrateDraft: null,
          calibrateReferenceM:
            s.photoTraceSession?.elevationId === session.elevationId
              ? s.photoTraceSession.calibrateReferenceM
              : null,
          calibrateLabel:
            s.photoTraceSession?.elevationId === session.elevationId
              ? s.photoTraceSession.calibrateLabel
              : "",
        },
        // The plane owns pointer capture while pinned — ground tools stand down.
        sketchMode: true,
        measureActive: false,
        armedSymbolId: null,
        trenchTool: null,
        zoneTool: null,
        floraSession: null,
        draftSession: null,
      };
    }),
  setPhotoCalibrateDraft: (calibrateDraft) =>
    set((s) =>
      s.photoTraceSession
        ? { photoTraceSession: { ...s.photoTraceSession, calibrateDraft } }
        : {},
    ),
  setPhotoCalibrateReference: (calibrateReferenceM, calibrateLabel) =>
    set((s) =>
      s.photoTraceSession
        ? { photoTraceSession: { ...s.photoTraceSession, calibrateReferenceM, calibrateLabel } }
        : {},
    ),
  addPhotoTraceStroke: (elevationId, stroke) =>
    set((s) => {
      const past = [...s.historyPast, docSnapshot(s)].slice(-50);
      const photoElevations = s.photoElevations.map((e) =>
        e.id === elevationId
          ? {
            ...e,
            strokes: [...e.strokes, stroke],
            updated_at: new Date().toISOString(),
          }
          : e,
      );
      return { photoElevations, historyPast: past, historyFuture: [] };
    }),
  removePhotoTraceStrokes: (elevationId, ids) => {
    const idSet = new Set(ids);
    set((s) => {
      const past = [...s.historyPast, docSnapshot(s)].slice(-50);
      const photoElevations = s.photoElevations.map((e) =>
        e.id === elevationId
          ? {
            ...e,
            strokes: e.strokes.filter((st) => !idSet.has(st.id)),
            updated_at: new Date().toISOString(),
          }
          : e,
      );
      return { photoElevations, historyPast: past, historyFuture: [] };
    });
  },

  setTrenchTool: (trenchTool) =>
    set(
      trenchTool
        ? {
          trenchTool,
          sketchMode: false,
          measureActive: false,
          armedSymbolId: null,
          zoneTool: null,
          draftSession: null,
        }
        : { trenchTool: null },
    ),
  setTrenchDraft: (trenchDraft) => set({ trenchDraft }),
  setConstructionTrenches: (constructionTrenches) => set({ constructionTrenches }),
  addConstructionTrench: (trench) =>
    set((s) => ({
      constructionTrenches: [...s.constructionTrenches, trench],
      trenchDraft: null,
      // Trenches are durable doc slices (autosaved + strike-checked) — the
      // draw commit is one undo step, same as a placement.
      historyPast: [...s.historyPast, docSnapshot(s)].slice(-50),
      historyFuture: [],
    })),

  setZoneTool: (zoneTool) =>
    set(
      zoneTool
        ? {
          zoneTool,
          sketchMode: false,
          measureActive: false,
          armedSymbolId: null,
          trenchTool: null,
          draftSession: null,
        }
        : { zoneTool: null },
    ),
  setZoneDraft: (zoneDraft) => set({ zoneDraft }),
  setIrrigationZones: (irrigationZones) => set({ irrigationZones }),
  addIrrigationZone: (zone) =>
    set((s) => ({
      irrigationZones: [...s.irrigationZones, zone],
      zoneDraft: null,
      // Zones are durable doc slices (autosaved + hydraulic-fed) — the draw
      // commit is one undo step, same as a placement.
      historyPast: [...s.historyPast, docSnapshot(s)].slice(-50),
      historyFuture: [],
    })),

  setProjectContext: (projectId, aerialUri, projectAddress) =>
    set({ projectId, aerialUri, projectAddress: projectAddress ?? "" }),

  setSaveStatus: (saveStatus, errorKind) =>
    set({ saveStatus, saveErrorKind: errorKind ?? null }),
  markSaved: () =>
    set({ saveStatus: "saved", saveErrorKind: null, savedTick: Date.now() }),
  bumpSaveRevision: () =>
    set((s) => ({ saveRevision: s.saveRevision + 1, savedTick: Date.now() })),

  setSiteContext: (siteBoundary, siteBuilding) =>
    set({ siteBoundary, siteBuilding }),

  setFeatures: (features) => set({ features }),
  addFeatures: (incoming) =>
    set((s) => {
      const past = [...s.historyPast, docSnapshot(s)].slice(-50);
      return {
        features: [...s.features, ...incoming],
        historyPast: past,
        historyFuture: [],
      };
    }),
  removeFeatures: (ids) => {
    const idSet = new Set(ids);
    set((s) => {
      const past = [...s.historyPast, docSnapshot(s)].slice(-50);
      const features = s.features.filter((f) => !idSet.has(f.id));
      return {
        features,
        selection: pruneSelection(s.selection, {
          placements: s.placements,
          features,
          photoElevations: s.photoElevations,
        }),
        historyPast: past,
        historyFuture: [],
      };
    });
  },

  /**
   * Tidy strokes → CAD proposals (primary path). Classifies the CURRENT
   * board-% ink with the context-aware classifier, replaces the pending
   * proposal set, and opens the ghost review. Photo-trace strokes are
   * explicitly scoped out with a stamped notice — never silently excluded.
   * Source ink is kept on accept (SVG parity — ink is the provenance).
   */
  tidySketchToCad: () =>
    set((s) => {
      const proposals = proposeSketchCad(s.sketchStrokes, {
        boundary: s.siteBoundary,
        building: s.siteBuilding,
      });
      const photoStrokeCount = s.photoElevations.reduce(
        (n, e) => n + e.strokes.length,
        0,
      );
      const photoNote =
        photoStrokeCount > 0 ? ` ${photoTraceScopeNotice(photoStrokeCount)}` : "";
      const notice =
        proposals.length === 0
          ? photoNote !== ""
            ? photoNote.trim()
            : "No convertible strokes — draw a path, bed, or canopy mark first."
          : `Formalized ${proposals.length} stroke${proposals.length === 1 ? "" : "es"} into CAD proposals — strokes stay as reference ink; accept or reject each.${photoNote}`;
      return {
        cadProposals: proposals,
        cadReviewOpen: proposals.length > 0,
        cadActiveProposalId: proposals[0]?.id ?? null,
        sketchCadNotice: notice,
      };
    }),
  setCadReviewOpen: (cadReviewOpen) => set({ cadReviewOpen }),
  setCadActiveProposal: (cadActiveProposalId) => set({ cadActiveProposalId }),

  acceptCadProposal: (id) =>
    set((s) => {
      const proposal = s.cadProposals.find((p) => p.id === id);
      if (!proposal) return {};
      const placement: CatalogPlacement = {
        id: crypto.randomUUID(),
        symbol_id: proposal.symbol_id,
        x_pct: proposal.x_pct,
        y_pct: proposal.y_pct,
        rotation_deg: ((proposal.rotDeg ?? 0) % 360 + 360) % 360,
        scale: proposal.scale ?? 1,
      };
      const mirrored = featureForAcceptedProposal(placement.id, proposal);
      const past = [...s.historyPast, docSnapshot(s)].slice(-50);
      const remaining = s.cadProposals.filter((p) => p.id !== id);
      return {
        placements: [...s.placements, placement],
        features: mirrored ? [...s.features, mirrored] : s.features,
        cadProposals: remaining,
        cadReviewOpen: remaining.length > 0,
        cadActiveProposalId: remaining[0]?.id ?? null,
        historyPast: past,
        historyFuture: [],
      };
    }),

  rejectCadProposal: (id) =>
    set((s) => {
      const remaining = s.cadProposals.filter((p) => p.id !== id);
      return {
        cadProposals: remaining,
        cadReviewOpen: remaining.length > 0,
        cadActiveProposalId: remaining[0]?.id ?? null,
      };
    }),

  acceptAllCadProposals: () =>
    set((s) => commitCadProposals(s, s.cadProposals)),
  acceptConfidentCadProposals: (minConfidence = 0.7) =>
    set((s) => {
      const keep = s.cadProposals.filter((p) => p.confidence >= minConfidence);
      if (keep.length === 0) return {};
      const leftover = s.cadProposals.filter((p) => p.confidence < minConfidence);
      return { ...commitCadProposals(s, keep), cadProposals: leftover, cadReviewOpen: leftover.length > 0, cadActiveProposalId: leftover[0]?.id ?? null };
    }),
  rejectAllCadProposals: () =>
    set({
      cadProposals: [],
      cadReviewOpen: false,
      cadActiveProposalId: null,
    }),

  /**
   * One-click direct convert (recognizeStroke path) → LandscapeFeatures.
   * Ink is kept (SVG convertStrokes parity). Returns the converted count.
   */
  convertStrokesToCadFeatures: () => {
    const current = useStudioStore.getState();
    const { features, converted } = convertStrokesToFeatures(
      current.sketchStrokes,
    );
    if (features.length === 0) {
      set({
        sketchCadNotice:
          "No strokes recognised as ditch/path/wall/bed — draw a straight run or closed loop first.",
      });
      return 0;
    }
    set((s) => {
      const past = [...s.historyPast, docSnapshot(s)].slice(-50);
      return {
        features: [...s.features, ...features],
        sketchCadNotice: `Converted ${converted} stroke${converted === 1 ? "" : "s"} to CAD features — ink stays as reference.`,
        historyPast: past,
        historyFuture: [],
      };
    });
    return converted;
  },

  // --- Stitch engine actions ---
  setStitchSnapNodes: (nodes) => set({ stitchSnapNodes: nodes }),
  setStitchHoverPoint: (point) => set({ stitchHoverPoint: point }),
  setStitchEpsilonM: (epsilonM) => set({ stitchEpsilonM: epsilonM }),
  dismissStitchNotice: () => set({ stitchNotice: null }),

  /**
   * Weld the board-% sketch ink into stitched CAD features (canvasStitcher
   * → LandscapeFeature[]). Source ink stays as reference (SVG convert
   * parity) and the whole action is one undo step (Ctrl+Z). Returns the
   * number of stitched entities.
   */
  stitchSketchStrokes: (scaleM, boardAspect) => {
    const current = useStudioStore.getState();
    const { features, records, count } = stitchSketchStrokesToFeatures(
      current.sketchStrokes,
      scaleM,
      boardAspect,
      current.stitchEpsilonM,
    );
    if (count === 0) {
      set({
        stitchNotice:
          "Nothing to stitch — strokes must meet within the 0.15 m snap tolerance to weld.",
      });
      return 0;
    }
    set((s) => {
      const past = [...s.historyPast, docSnapshot(s)].slice(-50);
      return {
        features: [...s.features, ...features],
        stitchRecords: { ...s.stitchRecords, ...records },
        stitchNotice: `Stitched ${count} ${count === 1 ? "entity" : "entities"} — source ink stays as reference; Undo or Un-stitch to revert.`,
        historyPast: past,
        historyFuture: [],
      };
    });
    return count;
  },

  /**
   * Split a stitched feature back into sketch strokes — the non-destructive
   * un-stitch primitive. Undoable (one step); returns the stroke count.
   */
  unstitchFeature: (featureId, scaleM, boardAspect) => {
    const current = useStudioStore.getState();
    const record = current.stitchRecords[featureId];
    if (!record) return 0;
    const strokes = unstitchFeatureToSketchStrokes(record, scaleM, boardAspect);
    set((s) => {
      const past = [...s.historyPast, docSnapshot(s)].slice(-50);
      const features = s.features.filter((f) => f.id !== featureId);
      const records = { ...s.stitchRecords };
      delete records[featureId];
      return {
        features,
        stitchRecords: records,
        sketchStrokes: [...s.sketchStrokes, ...strokes],
        selection: pruneSelection(s.selection, {
          placements: s.placements,
          features,
          photoElevations: s.photoElevations,
        }),
        stitchNotice: `Un-stitched — split back into ${strokes.length} ${strokes.length === 1 ? "stroke" : "strokes"}.`,
        historyPast: past,
        historyFuture: [],
      };
    });
    return strokes.length;
  },

  selectRef: (ref, opts) =>
    set((s) => ({
      selection: opts?.additive
        ? dedupeSelection([...s.selection, ref])
        : [ref],
    })), toggleSelectRef: (ref) =>
      set((s) => ({
        selection: dedupeSelection(
          s.selection.some(
            (r) =>
              r.kind === ref.kind &&
              r.id === ref.id &&
              r.elevationId === ref.elevationId,
          )
            ? s.selection.filter(
              (r) =>
                !(
                  r.kind === ref.kind &&
                  r.id === ref.id &&
                  r.elevationId === ref.elevationId
                ),
            )
            : [...s.selection, ref],
        ),
      })),
  clearSelection: () => set({ selection: [] }),
  setSelection: (selection) => set({ selection: dedupeSelection(selection) }),

  // Phase H — Selection Mode (isolation + boolean ops).
  toggleSelectionMode: () =>
    set((s) => ({ selectionModeActive: !s.selectionModeActive })),
  setSelectionMode: (selectionModeActive) => set({ selectionModeActive }),
  subtractFromSelection: (refs) =>
    set((s) => {
      const removeSet = new Set(
        refs.map((r) => `${r.kind}:${r.id}:${r.elevationId ?? ""}`),
      );
      return {
        selection: s.selection.filter(
          (r) => !removeSet.has(`${r.kind}:${r.id}:${r.elevationId ?? ""}`),
        ),
      };
    }),
  invertSelection: () =>
    set((s) => {
      const allRefs: SelectionRef[] = [
        ...s.placements.map((p) => ({ kind: "placement" as const, id: p.id })),
        ...s.features.map((f) => ({ kind: "feature" as const, id: f.id })),
        ...s.photoElevations.flatMap((e) =>
          e.strokes.map((st) => ({
            kind: "photoStroke" as const,
            id: st.id,
            elevationId: e.id,
          })),
        ),
      ];
      const selectedSet = new Set(
        s.selection.map(
          (r) => `${r.kind}:${r.id}:${r.elevationId ?? ""}`,
        ),
      );
      const inverted = allRefs.filter(
        (r) => !selectedSet.has(`${r.kind}:${r.id}:${r.elevationId ?? ""}`),
      );
      return { selection: dedupeSelection(inverted) };
    }),
  selectAll: () =>
    set((s) => ({
      selection: dedupeSelection([
        ...s.placements.map((p) => ({ kind: "placement" as const, id: p.id })),
        ...s.features.map((f) => ({ kind: "feature" as const, id: f.id })),
        ...s.photoElevations.flatMap((e) =>
          e.strokes.map((st) => ({
            kind: "photoStroke" as const,
            id: st.id,
            elevationId: e.id,
          })),
        ),
      ]),
    })),
}));
