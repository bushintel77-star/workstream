"use client";

import { useMemo } from "react";
import {
  computeBuildableArea,
  tpzRadiusFromDbhCm,
  type BuildableAreaResult,
  type OverlayInput,
  type BoardPctPoint,
  type TpzCircleInput,
} from "@workstream/domain";
import type { DesignBydaAsset, DesignKeylessOverlay } from "@workstream/contracts";
import type { PctPoint } from "../../geometry";
import type { StudioItem } from "../../studioCatalog";
import { CameraChrome } from "../../CameraChrome";
import css from "./buildableArea.module.css";

type Props = {
  active: boolean;
  boundary: PctPoint[];
  building: PctPoint[];
  easements: PctPoint[][];
  bydaAssets: DesignBydaAsset[];
  keylessOverlays: DesignKeylessOverlay[];
  items: StudioItem[];
  setbackM: number;
  boardWidthM: number;
};

/** Web PctPoint {x, y} → domain PctPoint {x_pct, y_pct}. */
function toDomain(p: PctPoint): BoardPctPoint {
  return { x_pct: p.x, y_pct: p.y };
}

function ringToDomain(ring: PctPoint[]): BoardPctPoint[] {
  return ring.map(toDomain);
}

/** SVG points attribute from domain BoardPctPoint (x_pct, y_pct). */
function domainPtsAttr(ring: BoardPctPoint[]): string {
  return ring.map((p) => `${p.x_pct},${p.y_pct}`).join(" ");
}

/**
 * Buildable area wash — the site minus every exclusion, rendered as a
 * translucent fill. The attribution breakdown lives in a bottom-left panel,
 * keeping the plan as the hero (canvas-first 2026 UX).
 */
export function BuildableAreaOverlay({
  active,
  boundary,
  building,
  easements,
  bydaAssets,
  keylessOverlays,
  items,
  setbackM,
  boardWidthM,
}: Props) {
  const result: BuildableAreaResult | null = useMemo(() => {
    if (!active || boundary.length < 3 || !(boardWidthM > 0)) return null;

    // TPZ circles from placed existing trees with DBH.
    const tpzCircles: TpzCircleInput[] = items
      .filter((it) => it.t === "exist" && it.dbhM && it.dbhM > 0)
      .map((it) => ({
        id: it.id,
        x_pct: it.x,
        y_pct: it.y,
        radius_m: tpzRadiusFromDbhCm(it.dbhM! * 100),
        label: "TPZ — existing tree",
      }));

    // Overlays that exclude building: flood, heritage, bushfire.
    const overlays: OverlayInput[] = keylessOverlays
      .filter((ov) =>
        ov.kind === "flood" ||
        ov.kind === "heritage" ||
        ov.kind === "bushfire"
      )
      .map((ov) => ({
        kind: ov.kind as "flood" | "heritage" | "bushfire",
        rings: ov.rings.map((ring) =>
          ring.map((p) => ({ x_pct: p.x_pct, y_pct: p.y_pct })),
        ),
        label: ov.label,
      }));

    return computeBuildableArea({
      boundary: ringToDomain(boundary),
      building: building.length >= 3 ? ringToDomain(building) : undefined,
      easements: easements.length > 0 ? easements.map(ringToDomain) : undefined,
      byda_assets: bydaAssets.map((a) => ({
        kind: a.kind,
        ring: a.ring.map((p) => ({ x_pct: p.x_pct, y_pct: p.y_pct })),
      })),
      tpz_circles: tpzCircles,
      overlays,
      setback_m: setbackM,
      board_width_m: boardWidthM,
    });
  }, [
    active,
    boundary,
    building,
    easements,
    bydaAssets,
    keylessOverlays,
    items,
    setbackM,
    boardWidthM,
  ]);

  if (!active || !result) return null;

  const lotClip = boundary.length >= 3
    ? boundary.map((p) => `${p.x},${p.y}`).join(" ")
    : null;

  return (
    <CameraChrome>
      <div className={css.root} data-testid="buildable-area-overlay">
        <svg
          className={css.svg}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden
        >
          <defs>
            {lotClip ? (
              <clipPath
                id="ws-buildable-lot-clip"
                clipPathUnits="userSpaceOnUse"
              >
                <polygon points={lotClip} />
              </clipPath>
            ) : null}
            <pattern
              id="ws-buildable-fill"
              width="3"
              height="3"
              patternUnits="userSpaceOnUse"
            >
              <rect
                width="3"
                height="3"
                fill="var(--hc-buildable, #4a9)"
                fillOpacity="0.06"
              />
            </pattern>
          </defs>
          <g
            clipPath={lotClip ? "url(#ws-buildable-lot-clip)" : undefined}
          >
            {result.polygons.map((ring, i) => {
              if (ring.length < 3) return null;
              return (
                <polygon
                  key={`buildable-${i}`}
                  points={domainPtsAttr(ring)}
                  fill="url(#ws-buildable-fill)"
                  stroke="var(--hc-buildable, #4a9)"
                  strokeWidth="0.3"
                  strokeOpacity="0.5"
                  strokeDasharray="0.8 0.6"
                  data-testid="buildable-polygon"
                />
              );
            })}
          </g>
        </svg>
        <BuildableAreaAttribution result={result} />
      </div>
    </CameraChrome>
  );
}

function BuildableAreaAttribution({ result }: { result: BuildableAreaResult }) {
  if (result.exclusions.length === 0) {
    return (
      <div className={css.attribution} data-testid="buildable-attribution">
        <p className={css.headline}>
          <span className={css.buildableValue}>
            {result.buildable_m2.toLocaleString("en-AU")} m²
          </span>
          <span className={css.headlineLabel}> buildable</span>
        </p>
        <p className={css.sub}>No exclusions — full lot available.</p>
      </div>
    );
  }

  return (
    <div className={css.attribution} data-testid="buildable-attribution">
      <p className={css.headline}>
        <span className={css.buildableValue}>
          {result.buildable_m2.toLocaleString("en-AU")} m²
        </span>
        <span className={css.headlineLabel}> buildable</span>
        <span className={css.lotValue}>
          {" "}of {result.lot_m2.toLocaleString("en-AU")} m²
        </span>
      </p>
      <ul className={css.exclusionList}>
        {result.exclusions.map((excl, i) => (
          <li key={`${excl.kind}-${i}`} className={css.exclusionItem}>
            <span className={css.exclusionLabel}>{excl.label}</span>
            <span className={css.exclusionArea}>
              −{excl.area_m2.toLocaleString("en-AU")} m²
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
