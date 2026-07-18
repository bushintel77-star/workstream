export type MutationPhase = "IDLE" | "MUTATING" | "RESOLVED";

export type MutationCostCache = {
  /** Baseline cost at mutation start (AUD). */
  baselineCost: number;
  /** Baseline area proxy (pixel area, pct area, or placement count). */
  baselineArea: number;
};

export type MutationFsmState = {
  phase: MutationPhase;
  cache: MutationCostCache | null;
  /** Optimistic cost shown during MUTATING. */
  optimisticCost: number | null;
  pendingPrecise: boolean;
};

export function createMutationFsm(
  initialCost = 0,
): MutationFsmState {
  return {
    phase: "IDLE",
    cache: null,
    optimisticCost: initialCost > 0 ? initialCost : null,
    pendingPrecise: false,
  };
}

/** pointerdown on geometry / paint drag start */
export function beginMutation(
  state: MutationFsmState,
  baselineCost: number,
  baselineArea: number,
): MutationFsmState {
  const area = Math.max(baselineArea, 1e-6);
  return {
    phase: "MUTATING",
    cache: { baselineCost, baselineArea: area },
    optimisticCost: baselineCost,
    pendingPrecise: false,
  };
}

/**
 * Cheap heuristic during drag: scale cached cost by area ratio.
 * Call throttled (~100ms), never on every pointermove for heavy work.
 */
export function mutateHeuristic(
  state: MutationFsmState,
  currentArea: number,
): MutationFsmState {
  if (state.phase !== "MUTATING" || !state.cache) return state;
  const ratio = Math.max(currentArea, 0) / state.cache.baselineArea;
  const optimisticCost =
    Math.round(state.cache.baselineCost * ratio * 100) / 100;
  return { ...state, optimisticCost };
}

/** pointerup - enter RESOLVED while precise work runs */
export function resolveMutation(state: MutationFsmState): MutationFsmState {
  if (state.phase !== "MUTATING") return state;
  return {
    ...state,
    phase: "RESOLVED",
    pendingPrecise: true,
  };
}

/** Precise BOM/geo result arrived */
export function commitPrecise(
  state: MutationFsmState,
  preciseCost: number,
): MutationFsmState {
  return {
    phase: "IDLE",
    cache: null,
    optimisticCost: preciseCost,
    pendingPrecise: false,
  };
}

export function cancelMutation(state: MutationFsmState): MutationFsmState {
  return {
    phase: "IDLE",
    cache: null,
    optimisticCost: state.cache?.baselineCost ?? state.optimisticCost,
    pendingPrecise: false,
  };
}
