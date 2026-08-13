"use client";

import { useMemo } from "react";
import {
  computeBuildableArea,
  distanceToBuildableEdgeM,
  nearestBuildableSegmentIndex,
  pointInBuildableRemnant,
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
  /** Layers / Cmd+K pin — full stroke opacity when true. */
  pinned: boolean;
  boundary: PctPoint[];
  building: PctPoint[];
  easements: PctPoint[][];
  bydaAssets: DesignBydaAsset[];
  keylessOverlays: DesignKeylessOverlay[];
  items: StudioItem[];
  setbackM: number;
  boardWidthM: number;
  /** Live plan zoom so the projected laser stroke tracks world scale. */
  planZoom: number;
  /** Board cursor in % — drives live setback chip. */
  cursorPct: PctPoint | null;
  /** Show live within/violation chip (high-stakes or pin). */
  showValidation: boolean;
  onPinChange: (pinned: boolean) => void;
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
 * Buildable area wash — context-aware laser envelope with live setback chip.
 */
export function BuildableAreaOverlay({
  active,
  pinned,
  boundary,
  building,
  easements,
  bydaAssets,
  keylessOverlays,
  items,
  setbackM,
  boardWidthM,
  planZoom,
  cursorPct,
  showValidation,
  onPinChange,
}: Props) {
  const result: BuildableAreaResult | null = useMemo(() => {
    if (!active || boundary.length < 3 || !(boardWidthM > 0)) return null;

    const tpzCircles: TpzCircleInput[] = items
      .filter((it) => it.t === "exist" && it.dbhM && it.dbhM > 0)
      .map((it) => ({
        id: it.id,
        x_pct: it.x,
        y_pct: it.y,
        radius_m: tpzRadiusFromDbhCm(it.dbhM! * 100),
        label: "TPZ — existing tree",
      }));

    const overlays: OverlayInput[] = keylessOverlays
      .filter(
        (ov) =>
          ov.kind === "flood" ||
          ov.kind === "heritage" ||
          ov.kind === "bushfire",
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

  const validation = useMemo(() => {
    if (!result || !showValidation || !cursorPct) return null;
    const inside = pointInBuildableRemnant(
      cursorPct.x,
      cursorPct.y,
      result.polygons,
    );
    if (inside) {
      return { ok: true as const, distanceM: 0, nearest: null };
    }
    const distanceM = distanceToBuildableEdgeM(
      cursorPct.x,
      cursorPct.y,
      result.polygons,
      boardWidthM,
    );
    const nearest = nearestBuildableSegmentIndex(
      cursorPct.x,
      cursorPct.y,
      result.polygons,
    );
    return { ok: false as const, distanceM, nearest };
  }, [result, showValidation, cursorPct, boardWidthM]);

  if (!active || !result) return null;

  const lotClip =
    boundary.length >= 3
      ? boundary.map((p) => `${p.x},${p.y}`).join(" ")
      : null;

  const strokeOpacity = pinned ? 1 : 0.4;
  const washOpacity = pinned ? 0.06 : 0.04;
  const worldScale = Math.max(planZoom, 0.35);
  const violated = validation != null && !validation.ok;

  return (
    <CameraChrome>
      <div
        className={css.root}
        data-testid="buildable-area-overlay"
        data-pinned={pinned ? "1" : "0"}
        data-intensity={pinned ? "full" : "auto"}
        data-violation={violated ? "1" : "0"}
      >
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
                fill="var(--hc-buildable, var(--ok))"
                fillOpacity={washOpacity}
              />
            </pattern>
          </defs>
          <g clipPath={lotClip ? "url(#ws-buildable-lot-clip)" : undefined}>
            {result.polygons.map((ring, i) => {
              if (ring.length < 3) return null;
              const pts = ring.map((p) => [p.x_pct, p.y_pct] as const);
              const n = pts.length;
              return (
                <g key={`buildable-${i}`}>
                  <polygon
                    points={domainPtsAttr(ring)}
                    fill="url(#ws-buildable-fill)"
                    stroke="var(--hc-buildable, var(--ok))"
                    strokeWidth={0.28 * worldScale}
                    strokeOpacity={strokeOpacity}
                    strokeDasharray={`${0.8 * worldScale} ${0.6 * worldScale}`}
                    data-testid="buildable-polygon"
                    data-laser="1"
                  />
                  {violated &&
                  validation?.nearest &&
                  validation.nearest.polygonIndex === i
                    ? (() => {
                        const si = validation.nearest!.segmentIndex;
                        const a = pts[si]!;
                        const b = pts[(si + 1) % n]!;
                        return (
                          <line
                            x1={a[0]}
                            y1={a[1]}
                            x2={b[0]}
                            y2={b[1]}
                            stroke="var(--hc-danger)"
                            strokeWidth={0.45 * worldScale}
                            strokeOpacity="0.95"
                            data-testid="buildable-violation-segment"
                          />
                        );
                      })()
                    : null}
                </g>
              );
            })}
          </g>
        </svg>
        {showValidation || pinned ? (
          <BuildableAreaChip
            pinned={pinned}
            validation={validation}
            onPinChange={onPinChange}
          />
        ) : null}
        {pinned ? <BuildableAreaAttribution result={result} /> : null}
      </div>
    </CameraChrome>
  );
}

function BuildableAreaChip({
  pinned,
  validation,
  onPinChange,
}: {
  pinned: boolean;
  validation: {
    ok: boolean;
    distanceM: number;
  } | null;
  onPinChange: (pinned: boolean) => void;
}) {
  const face =
    validation == null
      ? "Buildable area"
      : validation.ok
        ? "Within buildable area"
        : `Setback violation: ${validation.distanceM.toLocaleString("en-AU")} m`;
  const tone =
    validation == null ? "neutral" : validation.ok ? "ok" : "danger";

  return (
    <div
      className={css.chip}
      data-testid="buildable-area-chip"
      data-tone={tone}
    >
      <span className={css.chipFace}>{face}</span>
      <button
        type="button"
        className={css.pinBtn}
        data-testid="buildable-area-pin"
        data-on={pinned ? "true" : "false"}
        aria-pressed={pinned}
        title={pinned ? "Unpin buildable area" : "Pin buildable area"}
        onClick={() => onPinChange(!pinned)}
      >
        <span aria-hidden>{pinned ? "Unpin" : "Pin"}</span>
      </button>
    </div>
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
          {" "}
          of {result.lot_m2.toLocaleString("en-AU")} m²
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
