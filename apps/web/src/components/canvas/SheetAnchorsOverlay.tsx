"use client";

import css from "./siteCanvas.module.css";

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
};

type Props = {
  widthM: number;
  heightM: number;
  qsRows?: SheetQsRow[] | null;
  overlays?: SheetReadyOverlay[] | null;
};

/**
 * Quantity / orchestration chips in lot-metre space (SW origin, Y-up),
 * projected with the design frame onto the Vicmap title.
 */
export function SheetAnchorsOverlay({
  widthM,
  heightM,
  qsRows,
  overlays,
}: Props) {
  if (widthM <= 0 || heightM <= 0) return null;
  const rows = (qsRows ?? []).slice(0, 24);
  const ready = (overlays ?? []).filter((o) => o.status === "ready");
  if (rows.length === 0 && ready.length === 0) return null;

  return (
    <div
      className={css.sheetAnchors}
      data-testid="sheet-anchors-overlay"
      aria-hidden
    >
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
