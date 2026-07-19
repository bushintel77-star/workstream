"use client";

import css from "./siteCanvas.module.css";
import overlayCss from "./sheetAnchorsOverlay.module.css";

export type SheetQsRow = {
  id: string;
  qty: number;
  unit: string;
  anchor: { x: number; y: number };
};

export type SheetReadyOverlay = {
  id: string;
  kind: string;
  detail?: string;
  status: string;
  x_pct?: number | null;
  y_pct?: number | null;
  radius_m?: number | null;
};

type Props = {
  widthM: number;
  heightM: number;
  qsRows?: SheetQsRow[] | null;
  overlays?: SheetReadyOverlay[] | null;
  councilOpacity?: number;
};

/**
 * Quantity / orchestration chips + TPZ rings in lot-metre space
 * (SW origin, Y-up), projected with the design frame onto the Vicmap title.
 */
export function SheetAnchorsOverlay({
  widthM,
  heightM,
  qsRows,
  overlays,
  councilOpacity = 1,
}: Props) {
  if (widthM <= 0 || heightM <= 0) return null;
  const rows = (qsRows ?? []).slice(0, 24);
  const ready = (overlays ?? []).filter((o) => o.status === "ready");
  const tpz = (overlays ?? []).filter(
    (o) =>
      o.kind === "trp_ring" &&
      o.x_pct != null &&
      o.y_pct != null &&
      (o.radius_m ?? 0) > 0 &&
      (o.status === "ready" || o.status === "accepted"),
  );
  if (rows.length === 0 && ready.length === 0 && tpz.length === 0) return null;

  return (
    <div
      className={css.sheetAnchors}
      data-testid="sheet-anchors-overlay"
      aria-hidden
      style={{ opacity: Math.max(0, Math.min(1, councilOpacity)) }}
    >
      <svg
        className={overlayCss.tpzSvg}
        viewBox={`0 0 ${widthM} ${heightM}`}
        preserveAspectRatio="none"
      >
        {tpz.map((o) => {
          const cx = ((o.x_pct ?? 50) / 100) * widthM;
          const cy = (1 - (o.y_pct ?? 50) / 100) * heightM;
          const r = o.radius_m ?? 3;
          return (
            <circle
              key={`tpz-${o.id}`}
              className={overlayCss.tpzCircle}
              cx={cx}
              cy={cy}
              r={r}
              data-testid="tpz-circle"
            />
          );
        })}
      </svg>
      {rows.map((row) => {
        const left = `${(row.anchor.x / widthM) * 100}%`;
        const top = `${(1 - row.anchor.y / heightM) * 100}%`;
        return (
          <span
            key={row.id}
            className={`${css.chip} ${css.chipOnSheet}`}
            style={{ left, top }}
          >
            {row.qty} {row.unit}
          </span>
        );
      })}
      {ready.map((o) =>
        o.x_pct != null && o.y_pct != null ? (
          <span
            key={o.id}
            className={`${css.chip} ${css.overlayGhost} ${css.chipOnSheet}`}
            style={{ left: `${o.x_pct}%`, top: `${o.y_pct}%` }}
            title={o.detail}
          >
            {o.kind === "trp_ring"
              ? "TRP"
              : o.kind === "drainage"
                ? "Drain"
                : "Hold"}
          </span>
        ) : null,
      )}
    </div>
  );
}
