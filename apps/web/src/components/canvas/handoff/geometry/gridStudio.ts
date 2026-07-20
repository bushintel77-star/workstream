import type { GridGrain } from "./snap";

export type { GridGrain };

/**
 * Micro grid studio — formations an architect / gardener can skim by hover,
 * plus ink for eye comfort. Visual only for formation/ink; snap step = grain.
 */

export type GridFormation = "ortho" | "dots" | "diamond" | "veil";

export type GridInk = "charcoal" | "slate" | "paper" | "mist" | "signal";

export const GRID_FORMATIONS: readonly GridFormation[] = [
  "ortho",
  "dots",
  "diamond",
  "veil",
] as const;

export const GRID_INKS: readonly GridInk[] = [
  "charcoal",
  "slate",
  "paper",
  "mist",
  "signal",
] as const;

export const GRID_GRAINS: readonly GridGrain[] = [
  "fine",
  "medium",
  "coarse",
] as const;

export const GRID_FORMATION_LABEL: Record<GridFormation, string> = {
  ortho: "Ortho — technical squares",
  dots: "Dots — soft sketch field",
  diamond: "Diamond — 45° drafting",
  veil: "Veil — whisper lines",
};

export const GRID_INK_LABEL: Record<GridInk, string> = {
  charcoal: "Charcoal",
  slate: "Slate gray",
  paper: "Paper white",
  mist: "Off-white mist",
  signal: "Signal pink",
};

/** Stroke / fill colour for the draft mesh. */
export const GRID_INK_STROKE: Record<GridInk, string> = {
  charcoal: "rgba(28, 25, 23, 0.14)",
  slate: "rgba(90, 90, 95, 0.2)",
  paper: "rgba(255, 255, 255, 0.42)",
  mist: "rgba(245, 240, 232, 0.55)",
  signal: "rgba(255, 45, 149, 0.28)",
};

export function nextInRing<T>(list: readonly T[], current: T): T {
  const i = list.indexOf(current);
  return list[(i < 0 ? 0 : i + 1) % list.length]!;
}

export type GridStudioPrefs = {
  formation: GridFormation;
  ink: GridInk;
  grain: GridGrain;
  snap: boolean;
};

export function loadGridStudioPrefs(
  projectId: string,
): Partial<GridStudioPrefs> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(`ws-grid-studio:${projectId}`);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<GridStudioPrefs>;
  } catch {
    return null;
  }
}

export function saveGridStudioPrefs(
  projectId: string,
  prefs: GridStudioPrefs,
): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      `ws-grid-studio:${projectId}`,
      JSON.stringify(prefs),
    );
  } catch {
    /* quota / private mode */
  }
}
