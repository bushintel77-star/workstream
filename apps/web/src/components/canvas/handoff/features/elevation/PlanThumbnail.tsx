"use client";

import { BY_TYPE, type StudioItem } from "../../studioCatalog";
import { ptsAttr, type PctPoint } from "../../geometry";
import css from "./planThumbnail.module.css";

type Props = {
  boundary: PctPoint[];
  building: PctPoint[];
  items: StudioItem[];
  selectedId: string | null;
};

/**
 * Miniature overhead parcel preview — bi-directional CAD ↔ Elevation link.
 */
export function PlanThumbnail({
  boundary,
  building,
  items,
  selectedId,
}: Props) {
  const selected = items.find((i) => i.id === selectedId && !i.ghost) ?? null;
  const label = selected ? BY_TYPE[selected.t].name : "Select an asset";

  return (
    <aside className={css.card} data-testid="elevation-plan-thumbnail">
      <p className={css.kicker}>Plan link</p>
      <p className={css.title}>{label}</p>
      <svg
        className={css.svg}
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden
      >
        <rect width="100" height="100" fill="#faf6f2" />
        {boundary.length >= 3 ? (
          <polygon
            points={ptsAttr(boundary)}
            fill="rgba(36,19,24,0.04)"
            stroke="#241318"
            strokeWidth={1.2}
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
        {building.length >= 3 ? (
          <polygon
            points={ptsAttr(building)}
            fill="rgba(36,19,24,0.08)"
            stroke="#241318"
            strokeWidth={0.9}
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
        {items
          .filter((i) => !i.ghost)
          .map((it) => {
            const d = BY_TYPE[it.t];
            const active = it.id === selectedId;
            const r = active ? 3.2 : 1.8;
            return (
              <g key={it.id}>
                <ellipse
                  cx={it.x}
                  cy={it.y}
                  rx={r * (d.w / 40)}
                  ry={r * (d.h / 40)}
                  fill={
                    active ? "rgba(28,25,23,0.28)" : "rgba(28,25,23,0.14)"
                  }
                  stroke={active ? "#1C1917" : "transparent"}
                  strokeWidth={active ? 1.2 : 0}
                  vectorEffect="non-scaling-stroke"
                />
                {active ? (
                  <circle
                    cx={it.x}
                    cy={it.y}
                    r={5.5}
                    fill="none"
                    stroke="#1C1917"
                    strokeWidth={1}
                    strokeDasharray="2 1.5"
                    vectorEffect="non-scaling-stroke"
                  />
                ) : null}
              </g>
            );
          })}
      </svg>
      {selected ? (
        <p className={css.meta}>
          {selected.x.toFixed(0)}% · {selected.y.toFixed(0)}% on parcel
        </p>
      ) : (
        <p className={css.meta}>Click a profile bar to locate in plan</p>
      )}
    </aside>
  );
}
