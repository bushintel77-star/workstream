"use client";

import css from "./fitSheetSchedulePanel.module.css";

export type FitSheetScheduleRow = {
  id: string;
  label: string;
  qty: number;
  unit: string;
};

type Props = {
  rows: FitSheetScheduleRow[];
  totals?: {
    hardscape_m2?: number;
    planting_ea?: number;
    irrigation_lm?: number;
  } | null;
  areaM2?: number | null;
  visible?: boolean;
};

/** On-sheet quantity schedule for Fit sheet / quote paper. */
export function FitSheetSchedulePanel({
  rows,
  totals = null,
  areaM2 = null,
  visible = true,
}: Props) {
  if (!visible || (rows.length === 0 && !totals && areaM2 == null)) return null;
  const show = rows.slice(0, 8);

  return (
    <aside
      className={css.panel}
      data-testid="fit-sheet-schedule"
      aria-label="Quantity schedule"
    >
      <p className={css.title}>Schedule</p>
      {areaM2 != null ? (
        <p className={css.meta}>
          Site {Math.round(areaM2).toLocaleString("en-AU")} m²
        </p>
      ) : null}
      {totals ? (
        <p className={css.meta}>
          {[
            totals.hardscape_m2
              ? `Hard ${totals.hardscape_m2.toFixed(1)} m²`
              : null,
            totals.planting_ea ? `Plant ${totals.planting_ea} ea` : null,
            totals.irrigation_lm
              ? `Irrig ${totals.irrigation_lm.toFixed(1)} lm`
              : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      ) : null}
      {show.length > 0 ? (
        <table className={css.table}>
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
            </tr>
          </thead>
          <tbody>
            {show.map((r) => (
              <tr key={r.id}>
                <td>{r.label}</td>
                <td>
                  {r.qty} {r.unit}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </aside>
  );
}
