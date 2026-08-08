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

const STATUS_RANK: Record<BoardSustainabilityMetric["status"], number> = {
  short: 0,
  on_track: 1,
  measured: 2,
  absent: 3,
};

function formatValue(m: BoardSustainabilityMetric): string {
  if (m.value == null) return "Not measured";
  return m.unit === "%" ? `${m.value}%` : `${m.value} ${m.unit}`;
}

function formatTarget(m: BoardSustainabilityMetric): string | null {
  if (m.target == null) return null;
  if (m.id === "et-water-budget") {
    return ` · supply ${m.target}${m.unit === "L/day" ? " L/day" : m.unit}`;
  }
  return ` · target ${m.target}${m.unit === "%" ? "%" : ` ${m.unit}`}`;
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

  const shortCount = metrics.filter((m) => m.status === "short").length;
  const ordered = [...metrics].sort(
    (a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status],
  );

  return (
    <aside
      className={`${css.dock}${embedded ? ` ${css.embedded}` : ""}`}
      data-testid="sustainability-dock"
      data-short={shortCount > 0 ? String(shortCount) : "0"}
    >
      <div className={css.head}>
        <p className={css.kicker}>
          {embedded ? "SITES v2 · UN SDG" : "Sustainability"}
        </p>
        <span className={css.countPill} data-short={shortCount > 0 ? "1" : "0"}>
          {measured}/{assessed}
          {shortCount > 0 ? ` · ${shortCount} short` : ""}
        </span>
      </div>
      <p className={css.liveHint}>
        Live after save — measured or absent, never a comfortable zero.
      </p>

      {ordered.map((m) => {
        const short = m.status === "short";
        const absent = m.status === "absent";
        const showBar =
          m.unit === "%" && m.target != null && m.value != null;
        return (
          <div
            key={m.id}
            className={css.metric}
            data-status={m.status}
            data-testid={`sustainability-metric-${m.id}`}
          >
            <p className={css.metricKey}>
              {m.label}
              {formatTarget(m) ? (
                <span className={css.target}>{formatTarget(m)}</span>
              ) : null}
            </p>
            <p
              className={`${css.metricVal}${absent ? ` ${css.absent}` : short ? ` ${css.short}` : ` ${css.ok}`}`}
            >
              {formatValue(m)}
            </p>
            {showBar ? (
              <div className={css.bar}>
                <div
                  className={css.barFill}
                  data-status={m.status}
                  style={{
                    width: `${Math.min(100, Math.max(0, m.value!))}%`,
                  }}
                />
                <div
                  className={css.barTick}
                  style={{
                    left: `${Math.min(100, Math.max(0, m.target!))}%`,
                  }}
                />
              </div>
            ) : null}
            <p className={css.statement}>{m.statement}</p>
            {m.model ? (
              <p className={css.model}>
                <span className={css.modelLabel}>Modelled</span> {m.model}
              </p>
            ) : null}
            <div className={css.citeRow}>
              <p className={css.cite}>SITES v2 · {m.sites_credit}</p>
              <div className={css.sdgRow} aria-label="UN SDGs">
                {m.sdg.map((n) => (
                  <span key={n} className={css.sdgChip}>
                    {n}
                  </span>
                ))}
              </div>
              <span className={css.basis} data-basis={m.basis}>
                {BASIS_LABEL[m.basis]}
              </span>
            </div>
          </div>
        );
      })}
    </aside>
  );
}
