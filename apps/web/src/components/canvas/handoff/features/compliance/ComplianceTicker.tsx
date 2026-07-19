"use client";

import type { StudioComplianceReport } from "@workstream/domain";
import css from "./complianceTicker.module.css";

type Props = {
  report: StudioComplianceReport;
  onOpenCompliance: () => void;
};

/**
 * Live regulatory ticker — updates on every geometry commit, no Calculate.
 * Setback metre is the council *rule*, not a measured clearance (unless alert).
 */
export function ComplianceTicker({ report, onOpenCompliance }: Props) {
  const top = report.alerts[0] ?? null;
  return (
    <button
      type="button"
      className={`${css.ticker}${report.canvasSignal !== "ok" ? ` ${css[report.canvasSignal]}` : ""}`}
      data-testid="compliance-ticker"
      data-signal={report.canvasSignal}
      onClick={onOpenCompliance}
      title="Open compliance detail"
    >
      <span className={css.kicker}>Council live</span>
      <span className={css.metrics}>
        {Math.round(report.permeablePct)}% perm
        <span className={css.dot}>·</span>
        {Math.round(report.canopyPct)}% canopy
        <span className={css.dot}>·</span>
        {report.setbackM.toFixed(1)} m rule
      </span>
      {top ? (
        <span className={css.alert}>{top.title}</span>
      ) : (
        <span className={css.ok}>Indicative pass</span>
      )}
    </button>
  );
}
