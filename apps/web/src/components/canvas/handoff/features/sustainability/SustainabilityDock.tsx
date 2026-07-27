"use client";

import type { BoardSustainabilityMetric } from "@workstream/contracts";
import css from "./sustainability.module.css";

type Props = {
  metrics: BoardSustainabilityMetric[];
  measured: number;
  assessed: number;
  /** Render without absolute dock chrome (utility drawer sheet). */
  embedded?: boolean;
};

/** How strong the evidence is — the operator reads this before quoting it. */
const BASIS_LABEL: Record<BoardSustainabilityMetric["basis"], string> = {
  vicmap: "Vicmap fact",
  operator: "your sketch",
  derived: "estimate",
  seed: "demo geometry",
  absent: "no data",
};

function formatValue(m: BoardSustainabilityMetric): string {
  if (m.value == null) return "Not measured";
  return m.unit === "%" ? `${m.value}%` : `${m.value} ${m.unit}`;
}

/**
 * Sustainability read-out — a calm sidecar metric, never a headline figure.
 *
 * Every number is arithmetic over the same saved board the findings reason on,
 * aligned to SITES v2 by credit name and mapped to the UN SDGs it serves. A
 * metric the board cannot measure says so; it never shows a comfortable zero,
 * because an unmeasured site is not a site with no water demand. Where a figure
 * is modelled rather than measured, the assumption is printed with it so the
 * number can be checked instead of trusted.
 */
export function SustainabilityDock({
  metrics,
  measured,
  assessed,
  embedded = false,
}: Props) {
  if (metrics.length === 0) return null;

  return (
    <aside
      className={`${css.dock}${embedded ? ` ${css.embedded}` : ""}`}
      data-testid="sustainability-dock"
    >
      {!embedded ? (
        <div className={css.head}>
          <p className={css.kicker}>Sustainability</p>
          <span className={css.countPill}>
            {measured}/{assessed}
          </span>
        </div>
      ) : null}

      {metrics.map((m) => {
        const short = m.status === "short";
        const absent = m.status === "absent";
        return (
          <div key={m.id} className={css.metric} data-status={m.status}>
            <p className={css.metricKey}>
              {m.label}
              {m.target != null ? (
                <span className={css.target}> · target {m.target}{m.unit}</span>
              ) : null}
            </p>
            <p
              className={`${css.metricVal}${absent ? ` ${css.absent}` : short ? ` ${css.short}` : ` ${css.ok}`}`}
            >
              {formatValue(m)}
            </p>
            {m.target != null && m.value != null ? (
              <div className={css.bar}>
                <div
                  className={css.barFill}
                  data-status={m.status}
                  /* Width is data, not decoration — it has to come from the value. */
                  style={{ width: `${Math.min(100, Math.max(0, m.value))}%` }}
                />
                <div
                  className={css.barTick}
                  style={{ left: `${Math.min(100, Math.max(0, m.target))}%` }}
                />
              </div>
            ) : null}
            <p className={css.statement}>{m.statement}</p>
            {m.model ? (
              <p className={css.model}>
                <span className={css.modelLabel}>Modelled</span> {m.model}
              </p>
            ) : null}
            <p className={css.cite}>
              SITES v2 · {m.sites_credit} · SDG {m.sdg.join(", ")}
              {" · "}
              <span className={css.basis} data-basis={m.basis}>
                {BASIS_LABEL[m.basis]}
              </span>
            </p>
          </div>
        );
      })}
    </aside>
  );
}
