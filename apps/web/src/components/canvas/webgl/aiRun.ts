/**
 * Phase S — AI run from camera dock (spec §18b).
 *
 * There is no prompt box. The drawing is the prompt. Inputs are geometry,
 * materials, species from the schedule, sun time and growth year — all
 * already in the file. The run states each input and its count instead of
 * asking the designer to describe their own drawing.
 *
 * It runs from the camera dock, beside the time pill. It is a way of
 * looking, not a tool. It lands as a derived view, scrubbable against the
 * drawing underneath. It never becomes geometry and is never a source.
 *
 * Two refusals, permanent:
 *   1. It will not add planting that was not specified (an empty bed renders
 *      empty).
 *   2. It will not change or become geometry.
 *
 * Binding: docs/MENTAL-CANVAS-ROADMAP.md Phase S.
 * Reference: README §18b.
 */

/** A staged AI run — real per-stage progress and elapsed time. */
export interface AiRunStage {
  id: string;
  label: string;
  /** 0–1 completion. */
  progress: number;
  /** Elapsed ms. */
  elapsedMs: number;
  /** True when the stage has stalled (no progress for >5s). */
  stalled: boolean;
}

export type AiRunStatus = "idle" | "running" | "complete" | "stalled" | "error";

/** The full state of an AI run. */
export interface AiRunState {
  status: AiRunStatus;
  stages: AiRunStage[];
  /** The current stage index. */
  currentStageIdx: number;
  /** The inputs that were read from the file, each with its count. */
  inputs: AiRunInput[];
  /** The scrub position (0 = ink underneath, 1 = full render). */
  scrubPosition: number;
  /** Epoch ms when the run started. */
  startedAt?: number;
  /** Epoch ms when the run completed. */
  completedAt?: number;
  /** True when the render is stale (a bed was edited after the run). */
  stale: boolean;
  /** Reason the render is stale, if applicable. */
  staleReason?: string;
}

/** An input read from the file — stated with its count, not described. */
export interface AiRunInput {
  kind: "geometry" | "materials" | "species" | "sun" | "growthYear";
  label: string;
  count: number;
}

/** The default AI run state — idle. */
export const IDLE_RUN: AiRunState = {
  status: "idle",
  stages: [],
  currentStageIdx: 0,
  inputs: [],
  scrubPosition: 0,
  stale: false,
};

/** The standard run stages (spec §18b — staged like 12c). */
export const RUN_STAGES: { id: string; label: string }[] = [
  { id: "read-inputs", label: "Reading inputs" },
  { id: "geometry", label: "Processing geometry" },
  { id: "materials", label: "Applying materials" },
  { id: "species", label: "Placing species" },
  { id: "sun", label: "Computing sun" },
  { id: "growth", label: "Applying growth year" },
  { id: "render", label: "Rendering" },
];

/**
 * S.2 — build the inputs list from the file. Each input is stated with its
 * count, not described. No free-text input.
 */
export function buildRunInputs(opts: {
  placementCount: number;
  featureCount: number;
  materialCount: number;
  speciesCount: number;
  sunTime?: string;
  growthYear?: number;
}): AiRunInput[] {
  const inputs: AiRunInput[] = [
    { kind: "geometry", label: "Geometry", count: opts.placementCount + opts.featureCount },
    { kind: "materials", label: "Materials", count: opts.materialCount },
    { kind: "species", label: "Species", count: opts.speciesCount },
  ];
  if (opts.sunTime) {
    inputs.push({ kind: "sun", label: `Sun ${opts.sunTime}`, count: 1 });
  }
  if (opts.growthYear != null) {
    inputs.push({ kind: "growthYear", label: `Growth year ${opts.growthYear}`, count: 1 });
  }
  return inputs;
}

/** Start a new AI run. */
export function startRun(inputs: AiRunInput[]): AiRunState {
  return {
    status: "running",
    stages: RUN_STAGES.map((s) => ({
      id: s.id,
      label: s.label,
      progress: 0,
      elapsedMs: 0,
      stalled: false,
    })),
    currentStageIdx: 0,
    inputs,
    scrubPosition: 0,
    startedAt: Date.now(),
    stale: false,
  };
}

/**
 * S.3 — update a stage's progress. A stalled stage (no progress for >5s)
 * shows as stalled, never as a moving spinner.
 */
export function updateStageProgress(
  state: AiRunState,
  stageIdx: number,
  progress: number,
  elapsedMs: number,
): AiRunState {
  const stages = [...state.stages];
  stages[stageIdx] = {
    ...stages[stageIdx]!,
    progress: Math.max(0, Math.min(1, progress)),
    elapsedMs,
    stalled: progress === stages[stageIdx]!.progress && elapsedMs > 5000,
  };
  // Advance current stage when complete
  let currentStageIdx = state.currentStageIdx;
  if (stages[stageIdx]!.progress >= 1 && stageIdx === currentStageIdx) {
    currentStageIdx = Math.min(stageIdx + 1, stages.length - 1);
  }
  return { ...state, stages, currentStageIdx };
}

/** Complete a run. */
export function completeRun(state: AiRunState): AiRunState {
  return {
    ...state,
    status: "complete",
    completedAt: Date.now(),
    scrubPosition: 1,
    stages: state.stages.map((s) => ({ ...s, progress: 1 })),
  };
}

/**
 * S.5 — scrub the result. At 0 the ink is untouched underneath.
 */
export function setScrubPosition(state: AiRunState, position: number): AiRunState {
  return { ...state, scrubPosition: Math.max(0, Math.min(1, position)) };
}

/**
 * S.9 — mark the render stale when the drawing changes. The reason is named.
 */
export function markStale(state: AiRunState, reason: string): AiRunState {
  return { ...state, stale: true, staleReason: reason };
}

/**
 * S.6 — refusal 1: an unspecified bed renders empty. A bed with no species
 * produces no planting. This is a permanent refusal — the run will not add
 * planting that was not specified.
 */
export const REFUSAL_UNSPECIFIED_BED =
  "An empty bed renders empty. The run will not add planting that was not specified.";

/**
 * S.7 — refusal 2: the run cannot write geometry. No code path from the run
 * touches objects or a stroke. This is a permanent refusal.
 */
export const REFUSAL_NO_GEOMETRY_WRITE =
  "The run cannot write geometry. It lands as a derived view, never as a source.";

/**
 * S.8 — anything placed on a sheet from a run carries this stamp.
 */
export const INDICATIVE_STAMP = "indicative render, not a construction document";
