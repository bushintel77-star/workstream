"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
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
  subscribeMutationHud,
  type MutationHudSnapshot,
} from "../../lib/canvas-mutation-bus";
import { useLiveBomPreview } from "../../lib/use-live-bom-preview";
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
  /** Cream Fit sheet - ink panel instead of glass. */
  paper?: boolean;
  /** Slim CAD strip: total only until expanded. */
  compact?: boolean;
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

export function LiveBomHud({
  projectId,
  refreshKey = 0,
  paper = false,
  compact = false,
  onWorld,
}: Props) {
  const [world, setWorld] = useState<ProjectOrchestrationWorld | null>(null);
  const [expanded, setExpanded] = useState(!compact);
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

  const { workerTotal, skeletal } = useLiveBomPreview(
    world?.spatial_facts,
    mutationHud,
  );

  const mutating =
    mutationHud.phase === "MUTATING" || mutationHud.phase === "RESOLVED";
  const showOptimistic =
    mutationHud.phase === "MUTATING" && mutationHud.optimisticCost != null;
  /** MUTATING: optimistic; pending: worker preview; settled: API total wins. */
  const displayTotal = showOptimistic
    ? mutationHud.optimisticCost
    : skeletal
      ? (workerTotal ?? world?.bom_total ?? mutationHud.optimisticCost)
      : (world?.bom_total ?? workerTotal ?? mutationHud.optimisticCost);

  const hudClass = `${css.hud}${mutating ? ` ${css.hudMutating}` : ""}${
    skeletal ? ` ${css.hudSkeletal}` : ""
  }${paper ? ` ${css.hudPaper}` : ""}${compact ? ` ${css.hudCompact}` : ""}`;

  if (!world || world.spatial_facts.length === 0) {
    return (
      <aside
        className={hudClass}
        data-testid="live-bom-hud"
        data-mutation-phase={mutationHud.phase}
        data-skeletal={skeletal ? "1" : undefined}
        data-paper={paper ? "1" : undefined}
      >
        <p className={css.kicker}>Live BOM</p>
        {(mutating || skeletal) && displayTotal != null ? (
          <p
            className={`${css.total} ${css.totalPending}${skeletal ? ` ${css.skeletalPulse}` : ""}`}
          >
            {aud(displayTotal)}
            <span className={css.pendingHint}> estimating</span>
          </p>
        ) : (
          <p className={css.empty}>
            Draft or draw on Fit sheet - preemptive materials appear here.
          </p>
        )}
      </aside>
    );
  }

  const readyOverlays = world.overlays.filter((o) => o.status === "ready");
  const byTier = groupByTier(world.live_bom);
  const settled =
    mutationHud.phase === "IDLE" &&
    !skeletal &&
    (workerTotal != null || mutationHud.optimisticCost != null);

  return (
    <aside
      className={hudClass}
      data-testid="live-bom-hud"
      data-mutation-phase={mutationHud.phase}
      data-skeletal={skeletal ? "1" : undefined}
      data-paper={paper ? "1" : undefined}
    >
      <div className={css.summary}>
        <div>
          <p className={css.kicker}>Live BOM / preemptive</p>
          <p
            className={`${css.total} ${skeletal || mutating ? css.totalPending : ""} ${skeletal ? css.skeletalPulse : ""} ${settled ? css.totalSettle : ""}`}
          >
            {aud(displayTotal ?? world.bom_total)} incl. GST
            {skeletal || mutating ? (
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

      {expanded && world.risks.length > 0 ? (
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

      {expanded && activeOverlay && activeOverlay.status === "ready" ? (
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
      ) : expanded && readyOverlays.length > 0 ? (
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
