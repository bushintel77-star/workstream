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

/** Process-local cache; durable source of truth is the store snapshot. */
const overlayState = new Map<ProjectKey, OverlayState>();

function key(ownerId: string, projectId: string): ProjectKey {
  return `${ownerId}:${projectId}`;
}

async function loadState(
  store: Store,
  ownerId: string,
  projectId: string,
): Promise<OverlayState> {
  const k = key(ownerId, projectId);
  const cached = overlayState.get(k);
  if (cached) return cached;

  const persisted = await store.getOrchestrationOverlayState(ownerId, projectId);
  const s: OverlayState = {
    dismissed: new Set(persisted.dismissed),
    accepted: new Set(persisted.accepted),
  };
  overlayState.set(k, s);
  return s;
}

async function saveState(
  store: Store,
  ownerId: string,
  projectId: string,
  st: OverlayState,
): Promise<void> {
  await store.setOrchestrationOverlayState(ownerId, projectId, {
    accepted: [...st.accepted],
    dismissed: [...st.dismissed],
  });
}

/** Build live orchestration world from store (deterministic + preemptive). */
export async function getOrchestrationWorld(
  store: Store,
  ownerId: string,
  projectId: string,
): Promise<ProjectOrchestrationWorld> {
  const [canvas, cad, survey, symbols, rates, st] = await Promise.all([
    store.getDesignCanvas(ownerId, projectId),
    store.getCadDocument(ownerId, projectId),
    store.getSurvey(ownerId, projectId),
    store.listCatalogSymbols(ownerId),
    store.listRateCard(ownerId),
    loadState(store, ownerId, projectId),
  ]);
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
  const st = await loadState(store, ownerId, projectId);
  st.dismissed.add(proposalId);
  st.accepted.delete(proposalId);
  await saveState(store, ownerId, projectId, st);
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

  const st = await loadState(store, ownerId, projectId);
  st.accepted.add(proposalId);
  st.dismissed.delete(proposalId);
  await saveState(store, ownerId, projectId, st);

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
