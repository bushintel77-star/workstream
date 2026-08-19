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
  CanvasStroke,
  CatalogPlacement,
  ConstructionTrench,
  ConstructionTrenchKind,
  IrrigationZone,
  IrrigationZoneKind,
  LaborProfile,
  LandscapeFeature,
  MaterialFill,
  PhotoElevation,
  PhotoTraceStroke,
} from "@workstream/contracts";
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
import type { PctPoint } from "./coordTransform";
import {
  blendTargetForPitch,
  clampPitchDeg,
  DEFAULT_CAMERA_RIG,
  type StudioCameraRig,
} from "./cameraRig";
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
  patchClamps,
  type PlacementFieldKey,
} from "./inspectorPolicy";
import { marqueeSelectRefs } from "./marqueeSelect";
import {
  stitchSketchStrokesToFeatures,
  unstitchFeatureToSketchStrokes,
} from "./stitchBridge";
import type { TrenchPointPct } from "./trenchPath";
import type { ZonePointPct } from "./irrigationZonePath";
import type { PlanePoint } from "./photoTraceMath";

/* -------------------------------------------------------------------------- */
/* Save status types (the Ui slice of the studio store)                    */
/* -------------------------------------------------------------------------- */

export type SaveStatus = "idle" | "saving" | "retrying" | "saved" | "error";
export type SaveErrorKind = "unreachable" | "stale_client" | "rejected" | null;

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
  /** Interactive measure tape tool (mutually exclusive with sketchMode). */
  measureActive: boolean;
  /** The current tape in board-% (a = anchor, b = drag end); null = no tape. */
  measureTape: { a: PctPoint; b: PctPoint } | null;
  /** Itemized fit-sheet quotation card (Phase 3 live quote). */
  fitSheetOpen: boolean;

  /** Split view — locked plan | live 3D with linked cameras. */
  splitView: boolean;

  // --- Asset discovery fan-out (Gap 5) ---
  /** The bottom fan-out dock (asset palette). */
  assetsOpen: boolean;
  /** Armed catalog symbol — click the lot to place it; null = not armed. */
  armedSymbolId: string | null;
  /** All canvas placements (CatalogPlacement contract schema). */
  placements: CatalogPlacement[];
  /** Undo/redo doc history — snapshots of {placements, strokes, photoElevations, features, stitchRecords} (cap 50). */
  historyPast: Array<{
    placements: CatalogPlacement[];
    strokes: CanvasStroke[];
    photoElevations: PhotoElevation[];
    features: LandscapeFeature[];
    stitchRecords: Record<string, StitchRecord>;
  }>;
  historyFuture: Array<{
    placements: CatalogPlacement[];
    strokes: CanvasStroke[];
    photoElevations: PhotoElevation[];
    features: LandscapeFeature[];
    stitchRecords: Record<string, StitchRecord>;
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

  // --- Shared ink layer ---
  /** All sketch strokes in board-% space (the CanvasStroke contract schema). */
  sketchStrokes: CanvasStroke[];

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
    },
  ) => void;
  /** Latest boundary re-clamp notice (dismissible; re-arms per clamped edit). */
  boundaryNotice: { refId: string; reason: string; at: number } | null;
  dismissBoundaryNotice: () => void;

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
  /** Arming measure disarms sketch mode (they compete for pointer capture). */
  setMeasureActive: (v: boolean) => void;
  /** Replace the tape (a new anchor press) or clear it (null, null). */
  setMeasureTape: (a: PctPoint | null, b: PctPoint | null) => void;

  setFitSheetOpen: (v: boolean) => void;
  /** Estimate line ids unticked by the operator (quote-view state, not a
   *  canvas mutation — excluded lines leave the estimate, the design stays).
   *  Session-scoped; stale ids are harmless (the filter ignores unknowns). */
  excludedEstimateLineIds: string[];
  toggleEstimateLineExcluded: (id: string) => void;

  setSplitView: (v: boolean) => void;

  setAssetsOpen: (v: boolean) => void;
  /** Arming an asset disarms sketch + measure (pointer-capture exclusion). */
  setArmedSymbolId: (id: string | null) => void;
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
  gizmoMode: "translate" | "rotate" | null;
  setGizmoMode: (mode: "translate" | "rotate" | null) => void;
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
    patch: { x_pct?: number; y_pct?: number; rotation_deg?: number },
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

/** Snapshot the undoable doc slices (placements + strokes + photo elevations + features + stitch records). */
function docSnapshot(
  s: Pick<
    StudioStoreState,
    | "placements"
    | "sketchStrokes"
    | "photoElevations"
    | "features"
    | "stitchRecords"
  >,
) {
  return {
    placements: [...s.placements],
    strokes: [...s.sketchStrokes],
    photoElevations: [...s.photoElevations],
    features: [...s.features],
    stitchRecords: { ...s.stitchRecords },
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
  sketchMode: false,
  viewBlendTarget: 0, // start in plan view (ortho, CAD-accurate)
  viewBlend: 0, // animated value — FusedCamera writes this each frame
  liveRig: DEFAULT_CAMERA_RIG, // transient — StudioControls writes during a gesture
  elevationActive: false, // committed — StudioControls writes once on gesture end
  elevationFacadeAzimuth: null, // photo pins set the plane bearing; exit clears it

  // Elevation Slice defaults
  sliceActive: false,
  sliceAxis: "z",
  slicePosM: 0,

  // Terrain analysis defaults — earthworks ON: the analysis IS the product,
  // pads + zones appear the moment a pad exists. Drainage is opt-in chrome.
  drainageView: false,
  earthworksView: true,

  // CAD annotation defaults — dims ON (the client wants to see sizes);
  // the measure tape is an armed tool, off by default.
  dimsView: true,
  measureActive: false,
  measureTape: null,

  // Fit-sheet default ON — the live quote IS the product (the card
  // self-gates on an empty canvas).
  fitSheetOpen: true,
  // Estimate exclusions — no lines unticked by default.
  excludedEstimateLineIds: [],

  // Split view default off — an explicit two-viewport mode.
  splitView: false,

  // Asset fan-out defaults — dock closed (chrome), nothing armed.
  assetsOpen: false,
  armedSymbolId: null,
  placements: [],
  // Spatial gizmo defaults — translate armed by default (single placement
  // selection mounts the manipulator), no drag in flight.
  gizmoMode: "translate" as "translate" | "rotate" | null,
  gizmoDragging: false,
  /** Undo/redo doc history — snapshots of {placements, strokes} (cap 50). */
  historyPast: [],
  historyFuture: [],

  // Flora ring defaults — no open session.
  floraSession: null,

  // Ink
  sketchStrokes: [],

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

  // Inspector — no notice until a clamped edit fires.
  boundaryNotice: null,

  // Marquee — disarmed; no live draft.
  marqueeActive: false,
  marqueeDraft: null,

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
  setSketchMode: (sketchMode) =>
    set(
      sketchMode
        ? { sketchMode: true, trenchTool: null, zoneTool: null }
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
  setElevationFacadeAzimuth: (elevationFacadeAzimuth) =>
    set({ elevationFacadeAzimuth }),
  // Transient per-frame write — no DOM consumer should subscribe to viewBlend
  // directly (it changes every frame). Use viewBlendTarget for UI. Consumers
  // that must track the camera (stroke drape) read via getState() in useFrame.
  setViewBlend: (viewBlend) => set({ viewBlend }),
  setLiveRig: (liveRig) => set({ liveRig }),

  setSliceActive: (sliceActive) => set({ sliceActive }),
  setSliceAxis: (sliceAxis) => set({ sliceAxis }),
  setSlicePosM: (slicePosM) => set({ slicePosM }),

  setDrainageView: (drainageView) => set({ drainageView }),
  setEarthworksView: (earthworksView) => set({ earthworksView }),

  setDimsView: (dimsView) => set({ dimsView }),
  // Mutual exclusion with sketch mode — both capture ground pointer events.
  setMeasureActive: (measureActive) =>
    set(
      measureActive
        ? { measureActive: true, sketchMode: false, trenchTool: null, zoneTool: null }
        : { measureActive: false },
    ),
  setMeasureTape: (a, b) =>
    set({ measureTape: a && b ? { a, b } : null }),

  setFitSheetOpen: (fitSheetOpen) => set({ fitSheetOpen }),
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
  setArmedSymbolId: (armedSymbolId) =>
    set(
      armedSymbolId
        ? { armedSymbolId, sketchMode: false, measureActive: false, trenchTool: null, zoneTool: null }
        : { armedSymbolId: null },
    ),
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
          }
        : { marqueeActive: false },
    ),
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
  addPlacement: (placement) =>
    set((s) => {
      const past = [...s.historyPast, docSnapshot(s)].slice(-50);
      return { placements: [...s.placements, placement], historyPast: past, historyFuture: [] };
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
        // Rotation-only patches never touch the boundary (attribute edit);
        // position patches re-clamp per frame so the gizmo "slips" along
        // the title edge instead of crossing it.
        if (patch.x_pct === undefined && patch.y_pct === undefined) {
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
          }
        : { trenchTool: null },
    ),
  setTrenchDraft: (trenchDraft) => set({ trenchDraft }),
  setConstructionTrenches: (constructionTrenches) => set({ constructionTrenches }),
  addConstructionTrench: (trench) =>
    set((s) => ({
      constructionTrenches: [...s.constructionTrenches, trench],
      trenchDraft: null,
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
          }
        : { zoneTool: null },
    ),
  setZoneDraft: (zoneDraft) => set({ zoneDraft }),
  setIrrigationZones: (irrigationZones) => set({ irrigationZones }),
  addIrrigationZone: (zone) =>
    set((s) => ({
      irrigationZones: [...s.irrigationZones, zone],
      zoneDraft: null,
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
    set((s) => {
      if (s.cadProposals.length === 0) return {};
      const past = [...s.historyPast, docSnapshot(s)].slice(-50);
      const placements = [...s.placements];
      const features = [...s.features];
      for (const proposal of s.cadProposals) {
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
        cadProposals: [],
        cadReviewOpen: false,
        cadActiveProposalId: null,
        historyPast: past,
        historyFuture: [],
      };
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
    })),  toggleSelectRef: (ref) =>
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
}));
