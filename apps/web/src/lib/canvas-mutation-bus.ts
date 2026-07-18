import type { MutationPhase } from "./canvas-mutation-fsm";

export type MutationHudSnapshot = {
  phase: MutationPhase;
  optimisticCost: number | null;
  pendingPrecise: boolean;
};

type Listener = (snap: MutationHudSnapshot) => void;

const IDLE: MutationHudSnapshot = {
  phase: "IDLE",
  optimisticCost: null,
  pendingPrecise: false,
};

let snapshot: MutationHudSnapshot = IDLE;
const listeners = new Set<Listener>();

export function publishMutationHud(next: MutationHudSnapshot): void {
  snapshot = next;
  for (const fn of listeners) fn(snapshot);
}

export function subscribeMutationHud(fn: Listener): () => void {
  listeners.add(fn);
  fn(snapshot);
  return () => {
    listeners.delete(fn);
  };
}

export function getMutationHud(): MutationHudSnapshot {
  return snapshot;
}

const ORCH_REFRESH = "workstream:orchestration-refresh";

/** After RESOLVED precise work, ask SiteCanvas to refetch orchestration. */
export function requestOrchestrationRefresh(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(ORCH_REFRESH));
}

export function onOrchestrationRefreshRequest(fn: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => fn();
  window.addEventListener(ORCH_REFRESH, handler);
  return () => window.removeEventListener(ORCH_REFRESH, handler);
}
