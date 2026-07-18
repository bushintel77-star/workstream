"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  BomLine,
  BomTier,
  OverlayProposal,
  ProjectOrchestrationWorld,
} from "@workstream/contracts";
import {
  acceptOrchestrationOverlayAction,
  dismissOrchestrationOverlayAction,
  getOrchestrationAction,
} from "../../app/actions";
import {
  requestOrchestrationRefresh,
  subscribeMutationHud,
  type MutationHudSnapshot,
} from "../../lib/canvas-mutation-bus";
import css from "./liveBomHud.module.css";

const TIER_ORDER: BomTier[] = [
  "primary",
  "secondary",
  "tertiary",
  "labour",
  "logistics",
  "fee",
];

const TIER_LABEL: Record<BomTier, string> = {
  primary: "Primary",
  secondary: "Secondary",
  tertiary: "Tertiary",
  labour: "Labour",
  logistics: "Logistics",
  fee: "Fees",
};

const aud = (n: number) =>
  new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(n);

type Props = {
  projectId: string;
  /** Bump to refetch after canvas/CAD mutations. */
  refreshKey?: number;
  onWorld?: (world: ProjectOrchestrationWorld | null) => void;
};

function groupByTier(lines: BomLine[]): Map<BomTier, BomLine[]> {
  const map = new Map<BomTier, BomLine[]>();
  for (const tier of TIER_ORDER) map.set(tier, []);
  for (const line of lines) {
    const bucket = map.get(line.tier) ?? [];
    bucket.push(line);
    map.set(line.tier, bucket);
  }
  return map;
}

export function LiveBomHud({ projectId, refreshKey = 0, onWorld }: Props) {
  const router = useRouter();
  const [world, setWorld] = useState<ProjectOrchestrationWorld | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [activeOverlay, setActiveOverlay] = useState<OverlayProposal | null>(
    null,
  );
  const [mutationHud, setMutationHud] = useState<MutationHudSnapshot>({
    phase: "IDLE",
    optimisticCost: null,
    pendingPrecise: false,
  });
  const [pending, startTransition] = useTransition();

  const load = useCallback(() => {
    startTransition(async () => {
      try {
        const next = await getOrchestrationAction(projectId);
        setWorld(next);
        onWorld?.(next);
        setActiveOverlay((prev) => {
          if (!prev) return null;
          return next.overlays.find((o) => o.id === prev.id) ?? null;
        });
      } catch {
        setWorld(null);
        onWorld?.(null);
      }
    });
  }, [onWorld, projectId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  useEffect(() => subscribeMutationHud(setMutationHud), []);

  const mutating =
    mutationHud.phase === "MUTATING" || mutationHud.phase === "RESOLVED";
  const displayTotal =
    mutating && mutationHud.optimisticCost != null
      ? mutationHud.optimisticCost
      : (world?.bom_total ?? mutationHud.optimisticCost);

  if (!world || world.spatial_facts.length === 0) {
    return (
      <aside
        className={`${css.hud} ${mutating ? css.hudMutating : ""}`}
        data-testid="live-bom-hud"
        data-mutation-phase={mutationHud.phase}
      >
        <p className={css.kicker}>Live BOM</p>
        {mutating && displayTotal != null ? (
          <p className={`${css.total} ${css.totalPending}`}>
            {aud(displayTotal)}
            <span className={css.pendingHint}> estimating</span>
          </p>
        ) : (
          <p className={css.empty}>
            Place hardscape or planting - preemptive materials appear here.
          </p>
        )}
      </aside>
    );
  }

  const readyOverlays = world.overlays.filter((o) => o.status === "ready");
  const byTier = groupByTier(world.live_bom);

  return (
    <aside
      className={`${css.hud} ${mutating ? css.hudMutating : ""}`}
      data-testid="live-bom-hud"
      data-mutation-phase={mutationHud.phase}
    >
      <div className={css.summary}>
        <div>
          <p className={css.kicker}>Live BOM / preemptive</p>
          <p
            className={`${css.total} ${mutating ? css.totalPending : ""} ${mutationHud.phase === "IDLE" && mutationHud.optimisticCost != null ? css.totalSettle : ""}`}
          >
            {aud(displayTotal ?? world.bom_total)} incl. GST
            {mutating ? (
              <span className={css.pendingHint}> live</span>
            ) : null}
          </p>
        </div>
        <button
          type="button"
          className={css.toggle}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Hide lines" : `${world.live_bom.length} lines`}
        </button>
      </div>

      {world.risks.length > 0 ? (
        <div className={css.risks}>
          {world.risks.map((r) => (
            <button
              key={r.id}
              type="button"
              className={`${css.chip} ${r.severity === "critical" ? css.chipCritical : ""}`}
              title={r.detail}
              onClick={() => {
                const ov = world.overlays.find((o) => o.id === r.overlay_id);
                if (ov) setActiveOverlay(ov);
              }}
            >
              {r.title}
            </button>
          ))}
        </div>
      ) : null}

      {activeOverlay && activeOverlay.status === "ready" ? (
        <div className={css.overlayPanel} data-testid="live-bom-overlay">
          <p className={css.overlayTitle}>{activeOverlay.title}</p>
          <p className={css.overlayDetail}>{activeOverlay.detail}</p>
          <div className={css.overlayActions}>
            <button
              type="button"
              className={`${css.btn} ${css.btnPrimary}`}
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const res = await acceptOrchestrationOverlayAction(
                    projectId,
                    activeOverlay.id,
                  );
                  setWorld(res.world);
                  onWorld?.(res.world);
                  setActiveOverlay(null);
                  if (res.placed) {
                    requestOrchestrationRefresh();
                    router.refresh();
                  }
                })
              }
            >
              Accept overlay
            </button>
            <button
              type="button"
              className={css.btn}
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const next = await dismissOrchestrationOverlayAction(
                    projectId,
                    activeOverlay.id,
                  );
                  setWorld(next);
                  onWorld?.(next);
                  setActiveOverlay(null);
                })
              }
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : readyOverlays.length > 0 ? (
        <button
          type="button"
          className={css.toggle}
          onClick={() => setActiveOverlay(readyOverlays[0] ?? null)}
        >
          {readyOverlays.length} mitigation overlay
          {readyOverlays.length === 1 ? "" : "s"} ready
        </button>
      ) : null}

      {expanded ? (
        <ul className={css.tiers}>
          {TIER_ORDER.map((tier) => {
            const rows = byTier.get(tier) ?? [];
            if (rows.length === 0) return null;
            return (
              <li key={tier} className={css.tierBlock}>
                <p className={css.tierLabel}>{TIER_LABEL[tier]}</p>
                {rows.map((row) => (
                  <div key={row.id} className={css.line}>
                    <span>
                      {row.label} / {row.qty} {row.unit}
                    </span>
                    <span>{aud(row.total)}</span>
                    {row.notes ? (
                      <span className={css.lineMeta}>{row.notes}</span>
                    ) : null}
                  </div>
                ))}
              </li>
            );
          })}
        </ul>
      ) : null}
    </aside>
  );
}
