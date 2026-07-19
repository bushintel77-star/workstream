"use client";

import type { SiteComplianceStats } from "@workstream/domain";
import css from "./complianceDock.module.css";

type Props = {
  stats: SiteComplianceStats;
  paper?: boolean;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
};

export function ComplianceDock({
  stats,
  paper = false,
  collapsed = false,
  onToggleCollapsed,
}: Props) {
  if (collapsed) {
    return (
      <aside
        className={`${css.hud} ${css.hudCollapsed}${paper ? ` ${css.hudPaper}` : ""}`}
        data-testid="compliance-dock"
      >
        <button
          type="button"
          className={css.toggle}
          onClick={onToggleCollapsed}
        >
          Compliance
        </button>
        <span
          className={`${css.pill} ${stats.pass ? css.pillPass : css.pillFail}`}
        >
          {stats.pass ? "Pass" : "Review"}
        </span>
      </aside>
    );
  }

  return (
    <aside
      className={`${css.hud}${paper ? ` ${css.hudPaper}` : ""}`}
      data-testid="compliance-dock"
    >
      <div className={css.headerRow}>
        <p className={css.kicker}>Compliance</p>
        {onToggleCollapsed ? (
          <button type="button" className={css.toggle} onClick={onToggleCollapsed}>
            Collapse
          </button>
        ) : null}
      </div>
      <span
        className={`${css.pill} ${stats.pass ? css.pillPass : css.pillFail}`}
      >
        {stats.pass ? "Indicative pass" : "Review required"}
      </span>
      <div className={css.row}>
        <span className={css.rowLabel}>Outdoor area</span>
        <span className={css.rowValue}>{stats.outdoorAreaM2} m²</span>
        <span className={css.rowLabel}>Permeable surface</span>
        <span className={css.rowValue}>
          {stats.permeablePct}% / {stats.permeableMinPct}% min
        </span>
        <span className={css.rowLabel}>Canopy at maturity</span>
        <span className={css.rowValue}>
          {stats.canopyMaturityPct}% / {stats.canopyTargetPct}% target
        </span>
      </div>
      <p className={css.verdict}>{stats.verdict}</p>
    </aside>
  );
}
