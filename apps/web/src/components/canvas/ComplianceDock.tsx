"use client";

import type { SiteComplianceStats } from "@workstream/domain";
import css from "./complianceDock.module.css";

type Props = {
  stats: SiteComplianceStats;
  paper?: boolean;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
};

function clampPct(n: number) {
  return Math.max(0, Math.min(100, n));
}

export function ComplianceDock({
  stats,
  paper = false,
  collapsed = false,
  onToggleCollapsed,
}: Props) {
  if (collapsed) {
    return (
      <button
        type="button"
        className={`${css.tab}${paper ? ` ${css.hudPaper}` : ""}`}
        data-testid="compliance-dock"
        title="Expand compliance"
        onClick={onToggleCollapsed}
      >
        <span
          className={`${css.dot} ${stats.pass ? css.dotPass : css.dotFail}`}
        />
        <span className={stats.pass ? css.tabPass : css.tabFail}>
          {stats.pass ? "PASS" : "REVIEW"}
        </span>
      </button>
    );
  }

  const canopyFill = clampPct(
    (stats.canopyMaturityPct / Math.max(stats.canopyTargetPct, 1)) * 100,
  );

  return (
    <aside
      className={`${css.hud}${paper ? ` ${css.hudPaper}` : ""}`}
      data-testid="compliance-dock"
    >
      <div className={css.headerRow}>
        <p className={css.kicker}>Compliance</p>
        <div className={css.headerActions}>
          <span
            className={`${css.pill} ${stats.pass ? css.pillPass : css.pillFail}`}
          >
            {stats.pass ? "PASS" : "REVIEW"}
          </span>
          {onToggleCollapsed ? (
            <button
              type="button"
              className={css.collapse}
              title="Collapse"
              onClick={onToggleCollapsed}
            >
              –
            </button>
          ) : null}
        </div>
      </div>

      <div className={css.metric}>
        <p className={css.metricKey}>Outdoor area</p>
        <p className={css.metricVal}>{stats.outdoorAreaM2.toFixed(2)} m²</p>
      </div>

      <div className={css.metric}>
        <p className={css.metricKey}>
          Permeable · min {stats.permeableMinPct}%
        </p>
        <p
          className={`${css.metricVal} ${
            stats.permeablePct >= stats.permeableMinPct ? css.ok : css.bad
          }`}
        >
          {stats.permeablePct}%
        </p>
        <div className={css.barTrack}>
          <div
            className={`${css.barFill} ${
              stats.permeablePct >= stats.permeableMinPct ? css.barOk : css.barBad
            }`}
            style={{ width: `${clampPct(stats.permeablePct)}%` }}
          />
          <div
            className={css.barTick}
            style={{ left: `${clampPct(stats.permeableMinPct)}%` }}
            aria-hidden
          />
        </div>
      </div>

      <div className={css.metric}>
        <p className={css.metricKey}>
          Canopy @ maturity · {stats.canopyTargetPct}%
        </p>
        <p
          className={`${css.metricVal} ${
            stats.canopyMaturityPct >= stats.canopyTargetPct ? css.ok : css.warn
          }`}
        >
          {stats.canopyMaturityPct}%
        </p>
        <div className={css.barTrack}>
          <div
            className={`${css.barFill} ${
              stats.canopyMaturityPct >= stats.canopyTargetPct
                ? css.barOk
                : css.barWarn
            }`}
            style={{ width: `${canopyFill}%` }}
          />
          <div
            className={css.barTick}
            style={{ left: `${clampPct(stats.canopyTargetPct)}%` }}
            aria-hidden
          />
        </div>
      </div>

      <p className={css.verdict}>{stats.verdict}</p>
    </aside>
  );
}
