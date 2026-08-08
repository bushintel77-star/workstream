"use client";

import { BY_TYPE, type StudioItem } from "../../studioCatalog";
import { ptsAttr, type PctPoint } from "../../geometry";
import {
  elevationTagFor,
  hasElevationPresence,
  resolveItemFamily,
  resolveItemHeightM,
  resolveItemSpreadM,
} from "../../geometry/itemHeight";
import {
  mixOnHex,
  semanticForTheme,
} from "../../../../../styles/colorTokens";
import { GardenElevationGlyph } from "./GardenElevationGlyph";
import css from "./planThumbnail.module.css";

type Props = {
  boundary: PctPoint[];
  building: PctPoint[];
  items: StudioItem[];
  selectedId: string | null;
  /** Night lens — joins the dark board. */
  night?: boolean;
};

/** Profile swatch box (viewBox units) — the silhouette keeps its true aspect. */
const SWATCH = { w: 44, h: 26, groundY: 24, fitW: 40, fitH: 20 } as const;

/**
 * Miniature overhead parcel preview — bi-directional CAD ↔ Elevation link.
 *
 * The selected asset also gets a profile swatch: the same silhouette family the
 * board draws, sized at its real spread × mature height, so the thumbnail is a
 * true preview of the elevation rather than a generic marker. The swatch is
 * deliberately untextured — `ElevationTextureDefs` is mounted once by the
 * elevation board, and duplicating those pattern ids in one document would be
 * invalid, so the swatch reads through the glyph's flat token wash.
 */
export function PlanThumbnail({
  boundary,
  building,
  items,
  selectedId,
  night = false,
}: Props) {
  const L = semanticForTheme(night);
  const selected = items.find((i) => i.id === selectedId && !i.ghost) ?? null;
  const label = selected ? elevationTagFor(selected) : "Select an asset";
  const profile = selected && hasElevationPresence(selected) ? selected : null;
  const heightM = profile ? resolveItemHeightM(profile) : 0;
  const spreadM = profile
    ? (resolveItemSpreadM(profile) ?? heightM * 0.6)
    : 0;
  const fit =
    profile && heightM > 0 && spreadM > 0
      ? Math.min(SWATCH.fitW / spreadM, SWATCH.fitH / heightM)
      : 0;
  const profileBox = {
    x: SWATCH.w / 2 - (spreadM * fit) / 2,
    y: SWATCH.groundY - heightM * fit,
    w: spreadM * fit,
    h: heightM * fit,
  };

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
        <rect width="100" height="100" fill={L.sheetPaper} />
        {boundary.length >= 3 ? (
          <polygon
            points={ptsAttr(boundary)}
            fill={mixOnHex(L.textPrimary, 4, L.canvas)}
            stroke={L.textPrimary}
            strokeWidth={1.2}
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
        {building.length >= 3 ? (
          <polygon
            points={ptsAttr(building)}
            fill={mixOnHex(L.textPrimary, 8, L.canvas)}
            stroke={L.textPrimary}
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
                    active
                      ? mixOnHex(L.textPrimary, 28, L.canvas)
                      : mixOnHex(L.textPrimary, 14, L.canvas)
                  }
                  stroke={active ? L.textPrimary : "transparent"}
                  strokeWidth={active ? 1.2 : 0}
                  vectorEffect="non-scaling-stroke"
                />
                {active ? (
                  <circle
                    cx={it.x}
                    cy={it.y}
                    r={5.5}
                    fill="none"
                    stroke={L.textPrimary}
                    strokeWidth={1}
                    strokeDasharray="2 1.5"
                    vectorEffect="non-scaling-stroke"
                  />
                ) : null}
              </g>
            );
          })}
      </svg>
      {profile ? (
        <div className={css.profile} data-testid="elevation-profile-swatch">
          <svg
            className={css.profileSvg}
            viewBox={`0 0 ${SWATCH.w} ${SWATCH.h}`}
            preserveAspectRatio="xMidYMax meet"
            aria-hidden
            data-elev-family={resolveItemFamily(profile) ?? "plain"}
          >
            <line
              x1={0}
              y1={SWATCH.groundY}
              x2={SWATCH.w}
              y2={SWATCH.groundY}
              stroke={mixOnHex(L.textPrimary, 45, L.canvas)}
              strokeWidth={0.6}
              vectorEffect="non-scaling-stroke"
            />
            <GardenElevationGlyph
              family={resolveItemFamily(profile)}
              box={profileBox}
              night={night}
            />
          </svg>
          <span className={css.profileMeta}>
            {heightM.toFixed(1)} m h
            {spreadM > 0 ? ` · ${spreadM.toFixed(1)} m w` : ""}
          </span>
        </div>
      ) : null}
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
