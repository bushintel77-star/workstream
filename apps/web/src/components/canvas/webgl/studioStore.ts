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
 *   - projectId + aerialUri:  Context for persistence + the aerial underlay.
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
} from "@workstream/contracts";
import {
  melbourneSeason,
  type FloraStudioForm,
  type MelbourneSeason,
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
import type { TrenchPointPct } from "./trenchPath";
import type { ZonePointPct } from "./irrigationZonePath";

/* -------------------------------------------------------------------------- */
/* Save status types (ported from useStudioState.ts Ui slice)                 */
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
  /** Undo/redo doc history — snapshots of {placements, strokes} (cap 50). */
  historyPast: Array<{ placements: CatalogPlacement[]; strokes: CanvasStroke[] }>;
  historyFuture: Array<{ placements: CatalogPlacement[]; strokes: CanvasStroke[] }>;

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

  // --- Shared ink layer ---
  /** All sketch strokes in board-% space (the CanvasStroke contract schema). */
  sketchStrokes: CanvasStroke[];

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

  setSplitView: (v: boolean) => void;

  setAssetsOpen: (v: boolean) => void;
  /** Arming an asset disarms sketch + measure (pointer-capture exclusion). */
  setArmedSymbolId: (id: string | null) => void;
  /** Replace the entire placement array (hydrate / undo / branch checkout). */
  setPlacements: (placements: CatalogPlacement[]) => void;
  /** Append a single placement (a place gesture — commits undo history). */
  addPlacement: (placement: CatalogPlacement) => void;

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

  // Split view default off — an explicit two-viewport mode.
  splitView: false,

  // Asset fan-out defaults — dock closed (chrome), nothing armed.
  assetsOpen: false,
  armedSymbolId: null,
  placements: [],
  /** Undo/redo doc history — snapshots of {placements, strokes} (cap 50). */
  historyPast: [],
  historyFuture: [],

  // Flora ring defaults — no open session.
  floraSession: null,

  // Ink
  sketchStrokes: [],

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
  addPlacement: (placement) =>
    set((s) => {
      const past = [
        ...s.historyPast,
        { placements: [...s.placements], strokes: [...s.sketchStrokes] },
      ].slice(-50);
      return { placements: [...s.placements, placement], historyPast: past, historyFuture: [] };
    }),

  commitHistory: () =>
    set((s) => ({
      historyPast: [
        ...s.historyPast,
        { placements: [...s.placements], strokes: [...s.sketchStrokes] },
      ].slice(-50),
      historyFuture: [],
    })),
  undo: () =>
    set((s) => {
      const prev = s.historyPast[s.historyPast.length - 1];
      if (!prev) return {};
      return {
        placements: prev.placements,
        sketchStrokes: prev.strokes,
        historyPast: s.historyPast.slice(0, -1),
        historyFuture: [
          ...s.historyFuture,
          { placements: [...s.placements], strokes: [...s.sketchStrokes] },
        ].slice(-50),
      };
    }),
  redo: () =>
    set((s) => {
      const next = s.historyFuture[s.historyFuture.length - 1];
      if (!next) return {};
      return {
        placements: next.placements,
        sketchStrokes: next.strokes,
        historyFuture: s.historyFuture.slice(0, -1),
        historyPast: [
          ...s.historyPast,
          { placements: [...s.placements], strokes: [...s.sketchStrokes] },
        ].slice(-50),
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
      const past = [
        ...s.historyPast,
        { placements: [...s.placements], strokes: [...s.sketchStrokes] },
      ].slice(-50);
      return { sketchStrokes: [...s.sketchStrokes, stroke], historyPast: past, historyFuture: [] };
    }),
  removeSketchStrokes: (ids) => {
    const idSet = new Set(ids);
    set((s) => {
      const past = [
        ...s.historyPast,
        { placements: [...s.placements], strokes: [...s.sketchStrokes] },
      ].slice(-50);
      return { sketchStrokes: s.sketchStrokes.filter((st) => !idSet.has(st.id)), historyPast: past, historyFuture: [] };
    });
  },
  updateSketchStroke: (id, patch) =>
    set((s) => ({
      sketchStrokes: s.sketchStrokes.map((st) =>
        st.id === id ? { ...st, ...patch } : st,
      ),
    })),

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
}));
