"use client";

import { useMemo, useState, useTransition } from "react";
import type {
  DesignCanvas,
  IrrigationZone,
  ProjectOrchestrationWorld,
} from "@workstream/contracts";
import {
  matchLeftoversToNeed,
  proposeIrrigationAssist,
  proposeLightingAssist,
  registerLeftover,
  type LeftoverStock,
} from "@workstream/domain";
import { saveDesignCanvasAction } from "../../app/actions";
import css from "./studioAssistPanel.module.css";

const POOL_KEY = "ws-resource-pool";

type Props = {
  projectId: string;
  world: ProjectOrchestrationWorld | null;
  canvas: DesignCanvas | null;
  paper?: boolean;
  onCanvasSaved?: (canvas: DesignCanvas) => void;
};

function readPool(): LeftoverStock[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(POOL_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as LeftoverStock[];
  } catch {
    return [];
  }
}

function writePool(items: LeftoverStock[]) {
  window.localStorage.setItem(POOL_KEY, JSON.stringify(items));
}

export function StudioAssistPanel({
  projectId,
  world,
  canvas,
  paper,
  onCanvasSaved,
}: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [poolNote, setPoolNote] = useState<string | null>(null);
  const lighting = useMemo(
    () => (world ? proposeLightingAssist(world.spatial_facts) : []),
    [world],
  );
  const leftoverHint = useMemo(() => {
    const pool = readPool();
    return matchLeftoversToNeed(pool, "STONE-DEC", 0.5);
  }, [open, poolNote]);

  if (!canvas) return null;

  const applyIrrigation = () => {
    startTransition(async () => {
      const zones: IrrigationZone[] = proposeIrrigationAssist({
        openAreaM2: world?.spatial_facts.reduce((s, f) => s + f.area_m2, 0) ?? 90,
      });
      const nextZones = [...(canvas.irrigation_zones ?? []), ...zones];
      const res = await saveDesignCanvasAction(
        projectId,
        canvas.placements,
        canvas.strokes ?? [],
        nextZones,
        canvas.annotations ?? [],
        canvas.features ?? [],
      );
      onCanvasSaved?.(res.canvas);
    });
  };

  const registerDemoLeftover = () => {
    const left = registerLeftover({
      orderQty: 1,
      usedQty: 0.75,
      sku: "STONE-DEC",
      label: "Decorative stone",
      sourceProjectId: projectId,
    });
    if (!left) return;
    const pool = readPool();
    writePool([left, ...pool].slice(0, 20));
    setPoolNote(`${left.qty} t ${left.label} available across jobs`);
  };

  return (
    <div
      className={`${css.wrap}${paper ? ` ${css.paper}` : ""}`}
      data-testid="studio-assist-panel"
    >
      <button
        type="button"
        className={css.toggle}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Hide assist" : "Assist"}
      </button>
      {open ? (
        <div className={css.panel}>
          <p className={css.kicker}>Irrigation & lighting</p>
          <button
            type="button"
            className={css.btn}
            disabled={pending}
            data-testid="assist-irrigation"
            onClick={applyIrrigation}
          >
            First-pass irrigation
          </button>
          <p className={css.meta}>
            {lighting.length > 0
              ? `${lighting.length} lighting points near trees (preview)`
              : "Place trees to unlock lighting assist preview"}
          </p>
          <p className={css.kicker}>Resource pool</p>
          <button
            type="button"
            className={css.btn}
            data-testid="assist-leftover"
            onClick={registerDemoLeftover}
          >
            Register leftover stone
          </button>
          {poolNote ? <p className={css.meta}>{poolNote}</p> : null}
          {leftoverHint ? (
            <p className={css.chip} data-testid="leftover-chip">
              Leftover: {leftoverHint.qty} {leftoverHint.unit} {leftoverHint.label}
            </p>
          ) : null}
          <p className={css.kicker}>Presentation</p>
          <p className={css.meta}>
            Elevations, sun studies and quote share from the mode strip — same
            commercial truth as Instant Planner.
          </p>
        </div>
      ) : null}
    </div>
  );
}
