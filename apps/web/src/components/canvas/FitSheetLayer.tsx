"use client";

import css from "./fitSheetLayer.module.css";

export type FitSheetMeta = {
  brand?: string;
  address: string;
  drawingTitle: string;
  sourceLabel: string;
  scaleLabel: string;
  areaM2?: number | null;
  revision?: string;
  jobRef?: string;
};

export type FitSheetEdge = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: string;
};

type Props = {
  widthM: number;
  heightM: number;
  meta: FitSheetMeta;
  visible?: boolean;
  paper?: boolean;
  /** Parcel edge dimensions in lot-metre space (optional). */
  edges?: FitSheetEdge[];
  showDims?: boolean;
};

function niceGridStep(spanM: number): number {
  if (spanM <= 12) return 1;
  if (spanM <= 30) return 2;
  if (spanM <= 60) return 5;
  return 10;
}

function formatArea(areaM2: number | null | undefined): string | null {
  if (areaM2 == null || !Number.isFinite(areaM2) || areaM2 <= 0) return null;
  if (areaM2 >= 10_000) return `${(areaM2 / 10_000).toFixed(2)} ha`;
  return `${Math.round(areaM2)} m\u00b2`;
}

function issuedLabel(): string {
  try {
    return new Intl.DateTimeFormat("en-AU", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date());
  } catch {
    return "";
  }
}

function dimEndTicks(e: FitSheetEdge, tickLen: number) {
  const dx = e.x2 - e.x1;
  const dy = e.y2 - e.y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * tickLen;
  const ny = (dx / len) * tickLen;
  return {
    ax1: e.x1 - nx,
    ay1: e.y1 - ny,
    ax2: e.x1 + nx,
    ay2: e.y1 + ny,
    bx1: e.x2 - nx,
    by1: e.y2 - ny,
    bx2: e.x2 + nx,
    by2: e.y2 + ny,
  };
}

/** Offset dim text off the string, preferring the side away from parcel centre. */
function dimLabelPoint(
  e: FitSheetEdge,
  offset: number,
  cx: number,
  cy: number,
): { x: number; y: number } {
  const mx = (e.x1 + e.x2) / 2;
  const my = (e.y1 + e.y2) / 2;
  const dx = e.x2 - e.x1;
  const dy = e.y2 - e.y1;
  const len = Math.hypot(dx, dy) || 1;
  const ox = (-dy / len) * offset;
  const oy = (dx / len) * offset;
  const out =
    (mx + ox - cx) ** 2 + (my + oy - cy) ** 2 >=
    (mx - ox - cx) ** 2 + (my - oy - cy) ** 2;
  return out ? { x: mx + ox, y: my + oy } : { x: mx - ox, y: my - oy };
}

function inRect(
  x: number,
  y: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
  pad: number,
): boolean {
  return (
    x >= rx - pad && x <= rx + rw + pad && y >= ry - pad && y <= ry + rh + pad
  );
}

/**
 * Drawing-field chrome for Fit sheet - metre grid, registration, north, dims.
 * Projected onto the Vicmap title frame in lot-metre space.
 */
export function FitSheetLayer({
  widthM,
  heightM,
  meta,
  visible = true,
  paper = true,
  edges = [],
  showDims = true,
}: Props) {
  if (!visible || widthM <= 0 || heightM <= 0) return null;

  const margin = Math.min(widthM, heightM) * 0.04;
  const grid = niceGridStep(Math.max(widthM, heightM));
  // Floor high enough that title / dims stay legible on phone zoom.
  const font = Math.max(0.45, Math.min(widthM, heightM) * 0.034);
  const barLen = Math.min(grid * 2, (widthM - margin * 2) * 0.24);
  const drawW = widthM - margin * 2;
  const drawH = heightM - margin * 2;
  const areaLabel = formatArea(meta.areaM2);
  const issued = issuedLabel();
  const blockW = Math.min(drawW * 0.5, widthM * 0.46);
  const blockH = font * (areaLabel ? 5.85 : 5.35);
  const blockX = widthM - margin - blockW;
  const blockY = heightM - margin - blockH;
  const tickLen = Math.min(font * 0.35, grid * 0.18);
  const cx = widthM / 2;
  const cy = heightM / 2;
  const scaleZone = {
    x: margin,
    y: heightM - margin - font * 2.4,
    w: barLen + font * 2.2,
    h: font * 2.2,
  };

  const vLines: number[] = [];
  for (let x = margin; x <= widthM - margin + 0.001; x += grid) vLines.push(x);
  const hLines: number[] = [];
  for (let y = margin; y <= heightM - margin + 0.001; y += grid) hLines.push(y);

  const sheetEdges: FitSheetEdge[] =
    edges.length > 0
      ? edges
      : [
          {
            x1: margin,
            y1: margin * 0.55,
            x2: widthM - margin,
            y2: margin * 0.55,
            label: `${drawW.toFixed(1)} m`,
          },
          {
            x1: widthM - margin * 0.55,
            y1: margin,
            x2: widthM - margin * 0.55,
            y2: heightM - margin,
            label: `${drawH.toFixed(1)} m`,
          },
        ];

  const metaLine = [
    meta.sourceLabel,
    meta.revision,
    meta.jobRef ? `Job ${meta.jobRef}` : null,
  ]
    .filter(Boolean)
    .join(" \u00b7 ");

  const isMajor = (pos: number, origin: number) => {
    const steps = Math.round((pos - origin) / grid);
    return steps % 2 === 0;
  };

  return (
    <div
      className={`${css.root}${paper ? ` ${css.rootPaper}` : ""}`}
      data-testid="fit-sheet-layer"
      data-paper={paper ? "1" : undefined}
      aria-hidden
    >
      <svg
        className={css.svg}
        viewBox={`0 0 ${widthM} ${heightM}`}
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect
          className={css.outer}
          x={margin * 0.45}
          y={margin * 0.45}
          width={widthM - margin * 0.9}
          height={heightM - margin * 0.9}
        />
        <rect
          className={css.drawing}
          x={margin}
          y={margin}
          width={drawW}
          height={drawH}
        />

        <g className={css.grid}>
          {vLines.map((x) => (
            <line
              key={`v-${x}`}
              className={isMajor(x, margin) ? css.gridMajor : undefined}
              x1={x}
              y1={margin}
              x2={x}
              y2={heightM - margin}
            />
          ))}
          {hLines.map((y) => (
            <line
              key={`h-${y}`}
              className={isMajor(y, margin) ? css.gridMajor : undefined}
              x1={margin}
              y1={y}
              x2={widthM - margin}
              y2={y}
            />
          ))}
        </g>

        <g className={css.ticks}>
          <path
            d={`M ${margin} ${margin + grid * 0.35} L ${margin} ${margin} L ${margin + grid * 0.35} ${margin}`}
          />
          <path
            d={`M ${widthM - margin - grid * 0.35} ${margin} L ${widthM - margin} ${margin} L ${widthM - margin} ${margin + grid * 0.35}`}
          />
          <path
            d={`M ${margin} ${heightM - margin - grid * 0.35} L ${margin} ${heightM - margin} L ${margin + grid * 0.35} ${heightM - margin}`}
          />
          <path
            d={`M ${widthM - margin - grid * 0.35} ${heightM - margin} L ${widthM - margin} ${heightM - margin} L ${widthM - margin} ${heightM - margin - grid * 0.35}`}
          />
        </g>

        <g
          className={css.north}
          transform={`translate(${margin + font * 1.35}, ${margin + font * 1.7})`}
        >
          <polygon
            points={`0,${-font * 1.15} ${font * 0.42},${font * 0.35} 0,${font * 0.12} ${-font * 0.42},${font * 0.35}`}
          />
          <text x={0} y={font * 1.4} textAnchor="middle" fontSize={font * 0.85}>
            N
          </text>
        </g>

        {showDims
          ? sheetEdges.map((e, i) => {
              const label = dimLabelPoint(e, font * 0.55, cx, cy);
              if (
                inRect(
                  label.x,
                  label.y,
                  blockX,
                  blockY,
                  blockW,
                  blockH,
                  font * 0.8,
                ) ||
                inRect(
                  label.x,
                  label.y,
                  scaleZone.x,
                  scaleZone.y,
                  scaleZone.w,
                  scaleZone.h,
                  font * 0.4,
                )
              ) {
                return null;
              }
              const ang =
                (Math.atan2(e.y2 - e.y1, e.x2 - e.x1) * 180) / Math.PI;
              let rot = ang;
              if (rot > 90) rot -= 180;
              if (rot < -90) rot += 180;
              const t = dimEndTicks(e, tickLen);
              return (
                <g key={`dim-${i}`} className={css.dim}>
                  <line x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} />
                  <line
                    className={css.dimTick}
                    x1={t.ax1}
                    y1={t.ay1}
                    x2={t.ax2}
                    y2={t.ay2}
                  />
                  <line
                    className={css.dimTick}
                    x1={t.bx1}
                    y1={t.by1}
                    x2={t.bx2}
                    y2={t.by2}
                  />
                  <text
                    x={label.x}
                    y={label.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={font * 0.72}
                    transform={`rotate(${rot} ${label.x} ${label.y})`}
                  >
                    {e.label}
                  </text>
                </g>
              );
            })
          : null}

        <g className={css.scaleBar}>
          <line
            x1={margin + font * 0.4}
            y1={heightM - margin - font * 1.6}
            x2={margin + font * 0.4 + barLen}
            y2={heightM - margin - font * 1.6}
          />
          <line
            x1={margin + font * 0.4}
            y1={heightM - margin - font * 1.95}
            x2={margin + font * 0.4}
            y2={heightM - margin - font * 1.25}
          />
          <line
            x1={margin + font * 0.4 + barLen}
            y1={heightM - margin - font * 1.95}
            x2={margin + font * 0.4 + barLen}
            y2={heightM - margin - font * 1.25}
          />
          <text
            x={margin + font * 0.4 + barLen / 2}
            y={heightM - margin - font * 0.55}
            textAnchor="middle"
            fontSize={font * 0.7}
          >
            {`${barLen.toFixed(barLen >= 10 ? 0 : 1)} m \u00b7 ${meta.scaleLabel}`}
          </text>
        </g>

        <g className={css.titleBlock}>
          <rect
            x={blockX}
            y={blockY}
            width={blockW}
            height={blockH}
            className={css.titleBlockFrame}
          />
          <line
            x1={blockX}
            y1={blockY + font * 1.28}
            x2={blockX + blockW}
            y2={blockY + font * 1.28}
          />
          <line
            className={css.titleRule}
            x1={blockX}
            y1={blockY + font * 1.4}
            x2={blockX + blockW}
            y2={blockY + font * 1.4}
          />
          <text
            className={css.brand}
            x={blockX + font * 0.35}
            y={blockY + font * 0.9}
            fontSize={font * 0.68}
          >
            {(meta.brand ?? "Curtis & Co").slice(0, 22)}
          </text>
          {issued ? (
            <text
              className={css.mute}
              x={blockX + blockW - font * 0.3}
              y={blockY + font * 0.9}
              textAnchor="end"
              fontSize={font * 0.48}
            >
              {issued}
            </text>
          ) : null}
          <text
            x={blockX + font * 0.35}
            y={blockY + font * 2.2}
            fontSize={font * 0.62}
          >
            {meta.drawingTitle.slice(0, 36)}
          </text>
          <text
            className={css.mute}
            x={blockX + font * 0.35}
            y={blockY + font * 3.05}
            fontSize={font * 0.52}
          >
            {meta.address.slice(0, 42)}
          </text>
          <text
            className={css.mute}
            x={blockX + font * 0.35}
            y={blockY + font * 3.85}
            fontSize={font * 0.48}
          >
            {metaLine.slice(0, 52)}
          </text>
          {areaLabel ? (
            <text
              x={blockX + font * 0.35}
              y={blockY + font * 4.7}
              fontSize={font * 0.52}
            >
              {`Site ${areaLabel}`}
            </text>
          ) : null}
          <text
            className={css.nfc}
            x={blockX + blockW - font * 0.3}
            y={blockY + blockH - font * 0.28}
            textAnchor="end"
            fontSize={font * 0.42}
          >
            Not for construction
          </text>
        </g>
      </svg>
    </div>
  );
}

/** Representational RF from ground width (m) - ~180 mm drawing field. */
export function fitSheetScaleLabel(
  groundWidthM: number | null | undefined,
): string {
  if (groundWidthM == null || groundWidthM <= 0) return "Indicative";
  const paperMm = 180;
  const rf = Math.round((groundWidthM * 1000) / paperMm / 50) * 50;
  const nice = Math.max(50, Math.min(500, rf));
  return `1:${nice}`;
}
