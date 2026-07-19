"use client";

import { useMemo, useState } from "react";
import {
  projectElevationItems,
  type ElevationAxis,
} from "@workstream/domain";
import css from "./elevationProfile.module.css";

export type ElevationPlanItem = {
  id: string;
  label: string;
  x_pct: number;
  y_pct: number;
  scale?: number;
  height_m?: number;
  ghost?: boolean;
  stale?: boolean;
};

type Props = {
  items: ElevationPlanItem[];
  buildingHeightM?: number;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  onTraceInPlan?: () => void;
};

export function ElevationProfile({
  items,
  buildingHeightM = 2.7,
  selectedId = null,
  onSelect,
  onTraceInPlan,
}: Props) {
  const [axis, setAxis] = useState<ElevationAxis>("front");
  const projection = useMemo(
    () => projectElevationItems(items, axis, buildingHeightM),
    [axis, buildingHeightM, items],
  );

  const maxH = Math.max(
    buildingHeightM,
    ...projection.items.map((i) => i.heightM),
    1,
  );

  return (
    <div className={css.root} data-testid="elevation-profile">
      <span className={css.north}>N ↑</span>
      <div className={css.axisToggle}>
        <button
          type="button"
          className={`${css.axisBtn}${axis === "front" ? ` ${css.axisBtnActive}` : ""}`}
          onClick={() => setAxis("front")}
        >
          Front
        </button>
        <button
          type="button"
          className={`${css.axisBtn}${axis === "side" ? ` ${css.axisBtnActive}` : ""}`}
          onClick={() => setAxis("side")}
        >
          Side
        </button>
      </div>
      <div className={css.profile}>
        <div className={css.ground} />
        <div
          className={css.building}
          style={{ height: `${(buildingHeightM / maxH) * 55}%` }}
        />
        {projection.items.map((it) => {
          const selected = selectedId === it.id;
          return (
            <div
              key={it.id}
              role="button"
              tabIndex={0}
              className={`${css.item}${it.ghost ? ` ${css.itemGhost}` : ""}${selected ? ` ${css.itemSelected}` : ""}${it.stale ? ` ${css.itemStale}` : ""}`}
              style={{
                left: `${Math.min(92, Math.max(2, it.xPct))}%`,
                width: `${it.widthPct}%`,
                height: `${(it.heightM / maxH) * 55}%`,
              }}
              onClick={() => onSelect?.(selected ? null : it.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSelect?.(selected ? null : it.id);
              }}
            >
              <span className={css.label}>
                {it.label} · {it.heightM.toFixed(1)} m
              </span>
            </div>
          );
        })}
        {selectedId && onTraceInPlan ? (
          <button
            type="button"
            className={css.linkPill}
            style={{ left: "50%", top: "8%" }}
            data-testid="elevation-trace-plan"
            onClick={onTraceInPlan}
          >
            ⇄ Trace in plan
          </button>
        ) : null}
      </div>
    </div>
  );
}
