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
import type { CanvasStroke } from "@workstream/contracts";

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

/** Human-readable season label (Southern-hemisphere / Melbourne convention). */
export function seasonLabel(seasonProgress: number): string {
  const p = seasonProgress;
  if (p < 0.083 || p >= 0.92) return "Summer";
  if (p < 0.33) return "Autumn";
  if (p < 0.58) return "Winter";
  return "Spring";
}

/** Month name from seasonProgress (0 = Jan, 1 = Dec). */
export function seasonMonth(seasonProgress: number): string {
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const idx = Math.min(11, Math.floor(seasonProgress * 12));
  return months[idx] ?? "Jan";
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
  /** Micro-time: 0 = Jan 1, 1 = Dec 31. */
  seasonProgress: number;
  /** Minutes past Melbourne midnight — drives the real sun position. */
  sunMin: number;

  // --- View / layer toggles ---
  /** Subsurface blueprint view toggle. */
  subsurfaceView: boolean;
  /** 3D sketch capture mode — suppresses camera pan, drags become strokes. */
  sketchMode: boolean;

  // --- Fused rendering context ---
  /**
   * The TARGET view blend. 0 = orthographic plan, 1 = perspective 3D.
   * The FusedCamera animates the ACTUAL blend toward this each frame.
   * Set instantly (toggles) or via a slider — the animation handles smoothing.
   */
  viewBlendTarget: number;

  // --- Shared ink layer ---
  /** All sketch strokes in board-% space (the CanvasStroke contract schema). */
  sketchStrokes: CanvasStroke[];

  // --- Project context (for persistence + aerial) ---
  projectId: string;
  aerialUri: string | null;

  // --- Save status machine ---
  saveStatus: SaveStatus;
  saveErrorKind: SaveErrorKind;
  /** Monotonic revision — bumped after each successful autosave. */
  saveRevision: number;
  /** Epoch ms of the last successful persist (for "Saved Ns ago" labels). */
  savedTick: number;

  // --- Setters ---
  setGrowthYear: (y: number) => void;
  setSeasonProgress: (s: number) => void;
  setSunMin: (m: number) => void;
  setSubsurfaceView: (v: boolean) => void;
  setSketchMode: (v: boolean) => void;
  setViewBlendTarget: (v: number) => void;

  /** Replace the entire stroke array (e.g., on hydrate / undo / redo). */
  setSketchStrokes: (strokes: CanvasStroke[]) => void;
  /** Append a single committed stroke. */
  addSketchStroke: (stroke: CanvasStroke) => void;
  /** Remove strokes by id. */
  removeSketchStrokes: (ids: string[]) => void;
  /** Update a single stroke (e.g., extrude height metadata). */
  updateSketchStroke: (id: string, patch: Partial<CanvasStroke>) => void;

  setProjectContext: (projectId: string, aerialUri: string | null) => void;

  setSaveStatus: (status: SaveStatus, errorKind?: SaveErrorKind) => void;
  markSaved: () => void;
  /** Bump after a successful persist (drives downstream data refetch). */
  bumpSaveRevision: () => void;
}

export const useStudioStore = create<StudioStoreState>((set) => ({
  // Temporal defaults (match the prior seasonalStore defaults)
  growthYear: 10,
  seasonProgress: 0.25,
  sunMin: 12 * 60,

  // View defaults
  subsurfaceView: false,
  sketchMode: false,
  viewBlendTarget: 0, // start in plan view (ortho, CAD-accurate)

  // Ink
  sketchStrokes: [],

  // Context
  projectId: "",
  aerialUri: null,

  // Save status
  saveStatus: "idle",
  saveErrorKind: null,
  saveRevision: 0,
  savedTick: 0,

  setGrowthYear: (growthYear) => set({ growthYear }),
  setSeasonProgress: (seasonProgress) => set({ seasonProgress }),
  setSunMin: (sunMin) => set({ sunMin }),
  setSubsurfaceView: (subsurfaceView) => set({ subsurfaceView }),
  setSketchMode: (sketchMode) => set({ sketchMode }),
  setViewBlendTarget: (viewBlendTarget) =>
    set({ viewBlendTarget: Math.max(0, Math.min(1, viewBlendTarget)) }),

  setSketchStrokes: (sketchStrokes) => set({ sketchStrokes }),
  addSketchStroke: (stroke) =>
    set((s) => ({ sketchStrokes: [...s.sketchStrokes, stroke] })),
  removeSketchStrokes: (ids) => {
    const idSet = new Set(ids);
    set((s) => ({ sketchStrokes: s.sketchStrokes.filter((st) => !idSet.has(st.id)) }));
  },
  updateSketchStroke: (id, patch) =>
    set((s) => ({
      sketchStrokes: s.sketchStrokes.map((st) =>
        st.id === id ? { ...st, ...patch } : st,
      ),
    })),

  setProjectContext: (projectId, aerialUri) => set({ projectId, aerialUri }),

  setSaveStatus: (saveStatus, errorKind) =>
    set({ saveStatus, saveErrorKind: errorKind ?? null }),
  markSaved: () =>
    set({ saveStatus: "saved", saveErrorKind: null, savedTick: Date.now() }),
  bumpSaveRevision: () =>
    set((s) => ({ saveRevision: s.saveRevision + 1, savedTick: Date.now() })),
}));
