"use client";

import type { DesignSchemeSnapshot, Pt } from "../../studioCatalog";
import css from "./variationFilmstrip.module.css";

type Props = {
  scheme: DesignSchemeSnapshot;
  boundary: Pt[];
  building: Pt[];
};

function ringPath(pts: Pt[]): string {
  if (pts.length < 2) return "";
  return `${pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ")} Z`;
}

function centrePath(pts: Pt[]): string {
  if (pts.length < 2) return "";
  return pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
}

/** Tiny plan minimap for scheme filmstrip — same title boundary, scheme ink. */
export function SchemePlanThumb({ scheme, boundary, building }: Props) {
  return (
    <svg
      className={css.miniPlan}
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
      data-testid={`scheme-plan-${scheme.letter}`}
    >
      {boundary.length >= 3 ? (
        <path d={ringPath(boundary)} className={css.miniBoundary} />
      ) : null}
      {building.length >= 3 ? (
        <path d={ringPath(building)} className={css.miniBuilding} />
      ) : null}
      {(scheme.pathCorridors ?? []).map((c) => (
        <path
          key={c.id}
          d={centrePath(c.points)}
          className={css.miniPath}
          data-material={c.material}
        />
      ))}
      {scheme.items
        .filter((it) => !it.ghost)
        .map((it) => (
          <circle
            key={it.id}
            cx={it.x}
            cy={it.y}
            r={it.t === "canopy" || it.t === "exist" ? 2.4 : 1.4}
            className={css.miniItem}
            data-type={it.t}
          />
        ))}
    </svg>
  );
}
