import { randomUUID } from "crypto";
import type {
  CatalogPlacement,
  OverlayProposal,
  ProjectOrchestrationWorld,
} from "@workstream/contracts";
import { buildOrchestrationWorld } from "@workstream/domain";
import type { Store } from "@workstream/db";

type ProjectKey = string;

type OverlayState = {
  dismissed: Set<string>;
  accepted: Set<string>;
  /** Last computed fingerprint — for stale detection. */
  lastFingerprint?: string;
};

const overlayState = new Map<ProjectKey, OverlayState>();

function key(ownerId: string, projectId: string): ProjectKey {
  return `${ownerId}:${projectId}`;
}

function stateFor(ownerId: string, projectId: string): OverlayState {
  const k = key(ownerId, projectId);
  let s = overlayState.get(k);
  if (!s) {
    s = { dismissed: new Set(), accepted: new Set() };
    overlayState.set(k, s);
  }
  return s;
}

/** Build live orchestration world from store (deterministic + preemptive). */
export async function getOrchestrationWorld(
  store: Store,
  ownerId: string,
  projectId: string,
): Promise<ProjectOrchestrationWorld> {
  const [canvas, cad, survey, symbols, rates] = await Promise.all([
    store.getDesignCanvas(ownerId, projectId),
    store.getCadDocument(ownerId, projectId),
    store.getSurvey(ownerId, projectId),
    store.listCatalogSymbols(ownerId),
    store.listRateCard(ownerId),
  ]);
  const st = stateFor(ownerId, projectId);
  const world = buildOrchestrationWorld({
    projectId,
    canvas,
    cad,
    symbols,
    rates,
    survey,
    dismissedOverlayIds: st.dismissed,
    acceptedOverlayIds: st.accepted,
  });
  if (st.lastFingerprint && st.lastFingerprint !== world.fingerprint) {
    world.stale = false; // recomputed fresh
  }
  st.lastFingerprint = world.fingerprint;
  return world;
}

/** Called after canvas/CAD mutations — recomputes world (no blocking). */
export async function refreshOrchestration(
  store: Store,
  ownerId: string,
  projectId: string,
): Promise<ProjectOrchestrationWorld> {
  return getOrchestrationWorld(store, ownerId, projectId);
}

export async function dismissOverlay(
  store: Store,
  ownerId: string,
  projectId: string,
  proposalId: string,
): Promise<ProjectOrchestrationWorld> {
  const st = stateFor(ownerId, projectId);
  st.dismissed.add(proposalId);
  st.accepted.delete(proposalId);
  return getOrchestrationWorld(store, ownerId, projectId);
}

export async function acceptOverlay(
  store: Store,
  ownerId: string,
  projectId: string,
  proposalId: string,
): Promise<{
  world: ProjectOrchestrationWorld;
  overlay: OverlayProposal | null;
  placed: CatalogPlacement | null;
}> {
  const worldBefore = await getOrchestrationWorld(store, ownerId, projectId);
  const overlay =
    worldBefore.overlays.find((o) => o.id === proposalId) ?? null;
  if (!overlay) {
    return { world: worldBefore, overlay: null, placed: null };
  }

  const st = stateFor(ownerId, projectId);
  st.accepted.add(proposalId);
  st.dismissed.delete(proposalId);

  let placed: CatalogPlacement | null = null;
  const symbolId = overlay.suggest_symbol_id;
  if (
    symbolId &&
    (overlay.kind === "trp_ring" || overlay.kind === "drainage") &&
    overlay.x_pct != null &&
    overlay.y_pct != null
  ) {
    const canvas = await store.getDesignCanvas(ownerId, projectId);
    const placements = [...(canvas?.placements ?? [])];
    const already = placements.some(
      (p) =>
        p.symbol_id === symbolId &&
        Math.abs(p.x_pct - overlay.x_pct!) < 1.5 &&
        Math.abs(p.y_pct - overlay.y_pct!) < 1.5,
    );
    if (!already) {
      placed = {
        id: randomUUID(),
        symbol_id: symbolId,
        x_pct: overlay.x_pct,
        y_pct: overlay.y_pct,
        rotation_deg: 0,
        scale: 1,
        label:
          overlay.kind === "trp_ring"
            ? "TRP (preemptive)"
            : "Drainage (preemptive)",
      };
      placements.push(placed);
      await store.upsertDesignCanvas(ownerId, projectId, {
        placements,
        strokes: canvas?.strokes ?? [],
        irrigation_zones: canvas?.irrigation_zones ?? [],
        annotations: canvas?.annotations ?? [],
      });
    }
  }

  const world = await getOrchestrationWorld(store, ownerId, projectId);
  return { world, overlay, placed };
}

/** Test helper — clear in-memory overlay decisions. */
export function resetOrchestrationStateForTests(): void {
  overlayState.clear();
}
