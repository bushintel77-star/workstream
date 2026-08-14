/**
 * Gold Standard 2026 — Dual-Axis Time Engine (zustand store).
 *
 * Two decoupled time axes drive the WebGL studio:
 *   - growthYear [0–10]:   Macro-time. Base geometry + scale (trunk, canopy
 *                          volume, root spread). The existing 10-year sim.
 *   - seasonProgress [0–1]: Micro-time. Jan 1 → Dec 31. Drives material
 *                          properties, environmental lighting, fog, and the
 *                          seasonal canopy multiplier.
 *
 * Binding constraint (LA Seasonal Dynamics spec): seasonal transitions must
 * NEVER trigger React re-renders inside the R3F <Canvas>. useFrame loops read
 * via `useSeasonalStore.getState()` (transient — direct memory read, zero
 * re-renders). DOM HUD chips subscribe via selector hooks (re-render is fine
 * — they live outside the canvas in the chrome overlay).
 *
 * Southern-hemisphere season convention (Melbourne): winter = Jun–Aug
 * (seasonProgress ≈ 0.42–0.58), autumn = Mar–May (≈ 0.17–0.33).
 */

import { create } from "zustand";

export interface SeasonalState {
  /** Macro-time: 0 = just planted, 10 = 10-year maturity. */
  growthYear: number;
  /** Micro-time: 0 = Jan 1, 1 = Dec 31. */
  seasonProgress: number;
  /** Minutes past Melbourne midnight — drives the real sun position. */
  sunMin: number;
  /** Subsurface blueprint view toggle — when true, the ground transitions to
   *  architectural vellum and the hairline CAD utility lines render. */
  subsurfaceView: boolean;
  /** 3D sketch mode — when true, camera pan is suppressed and pointer drags
   *  capture draped strokes on the 3D ground plane. */
  sketchMode: boolean;

  setGrowthYear: (y: number) => void;
  setSeasonProgress: (s: number) => void;
  setSunMin: (m: number) => void;
  setSubsurfaceView: (v: boolean) => void;
  setSketchMode: (v: boolean) => void;
}

export const useSeasonalStore = create<SeasonalState>((set) => ({
  growthYear: 10, // default: mature (matches the prior growthFactor default of 1)
  seasonProgress: 0.25, // default: spring (Oct — planting season in Melbourne)
  sunMin: 12 * 60, // default: noon
  subsurfaceView: false, // default: physical world (not blueprint)
  sketchMode: false, // default: orbit mode (not sketching)
  setGrowthYear: (growthYear) => set({ growthYear }),
  setSeasonProgress: (seasonProgress) => set({ seasonProgress }),
  setSunMin: (sunMin) => set({ sunMin }),
  setSubsurfaceView: (subsurfaceView) => set({ subsurfaceView }),
  setSketchMode: (sketchMode) => set({ sketchMode }),
}));

/* -------------------------------------------------------------------------- */
/* Seasonal math helpers — pure functions, callable from useFrame via getState */
/* -------------------------------------------------------------------------- */

/**
 * Winter factor — 0 in summer, 1 in deep winter.
 * Southern-hemisphere: winter solstice ≈ June 21 → seasonProgress ≈ 0.47.
 * Uses a smooth cosine envelope centred on 0.47.
 */
export function winterFactor(seasonProgress: number): number {
  // Cosine bell: 1 at centre (0.47), 0 at the opposite point (0.97).
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
 * Human-readable season label (Southern-hemisphere / Melbourne convention).
 */
export function seasonLabel(seasonProgress: number): string {
  const p = seasonProgress;
  if (p < 0.083 || p >= 0.92) return "Summer";
  if (p < 0.33) return "Autumn";
  if (p < 0.58) return "Winter";
  return "Spring";
}

/**
 * Month name from seasonProgress (0 = Jan, 1 = Dec).
 */
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
export function leafStatus(
  seasonProgress: number,
  growthYear: number,
): string {
  const w = winterFactor(seasonProgress);
  const a = autumnFactor(seasonProgress);
  // Very young saplings (year < 1) are evergreen stubs.
  if (growthYear < 1) return "Juvenile";
  if (w > 0.7) return "Bare";
  if (w > 0.3) return "Dropping";
  if (a > 0.4) return "Autumn";
  return "Full";
}
