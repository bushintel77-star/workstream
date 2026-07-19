"use client";

import { useMemo } from "react";
import { projectElevationItems } from "@workstream/domain";
import type { ElevationPlanItem } from "./ElevationProfile";
import css from "./sheetElevationPanel.module.css";

type Props = {
  items: ElevationPlanItem[];
  widthM: number;
  visible?: boolean;
};

export function SheetElevationPanel({
  items,
  widthM,
  visible = true,
}: Props) {
  const front = useMemo(
    () => projectElevationItems(items, "front"),
    [items],
  );
  const side = useMemo(
    () => projectElevationItems(items, "side"),
    [items],
  );

  if (!visible || widthM < 380) return null;

  return (
    <div className={css.panel} data-testid="sheet-elevation-panel">
      <p className={css.title}>Elevations</p>
      {(["Front elevation", "Side elevation"] as const).map((label, idx) => {
        const proj = idx === 0 ? front : side;
        const maxH = Math.max(
          proj.buildingH,
          ...proj.items.map((i) => i.heightM),
          1,
        );
        return (
          <div key={label} className={css.row}>
            <p className={css.rowLabel}>{label}</p>
            <div className={css.mini}>
              <div
                className={css.building}
                style={{ height: `${(proj.buildingH / maxH) * 100}%` }}
              />
              {proj.items.slice(0, 6).map((it) => (
                <div
                  key={it.id}
                  className={css.silhouette}
                  style={{
                    left: `${it.xPct * 0.55 + 45}%`,
                    width: `${Math.max(4, it.widthPct * 0.4)}%`,
                    height: `${(it.heightM / maxH) * 100}%`,
                  }}
                />
              ))}
              <span className={css.width}>{widthM.toFixed(1)} m</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
