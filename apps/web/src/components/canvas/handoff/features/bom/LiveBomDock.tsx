"use client";

import type { StudioEstimateReport } from "@workstream/domain";
import css from "./bom.module.css";

type Props = {
  estimate: StudioEstimateReport;
  mitigated: Record<string, boolean>;
  onMitigate: (id: string) => void;
  onOpenQuote: () => void;
  embedded?: boolean;
};

const aud = (n: number) =>
  new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(n);

/**
 * Live preemptive BOM — secondary/tertiary materials, labour, tippers, GST.
 * Updates with every geometry commit; no Design↔Quote mode switch.
 */
export function LiveBomDock({
  estimate,
  mitigated,
  onMitigate,
  onOpenQuote,
  embedded = false,
}: Props) {
  const primary = estimate.lines.filter((l) => l.tier === "primary");
  const shadowed = estimate.lines.filter((l) => l.tier !== "primary");
  const horizonChips = estimate.horizon.filter(
    (h) => h.kind === "drainage" || h.kind === "tpz" || h.kind === "engineer",
  );

  return (
    <aside
      className={`${css.dock}${embedded ? ` ${css.embedded}` : ""}`}
      data-testid="live-bom-hud"
    >
      {!embedded ? (
        <div className={css.head}>
          <p className={css.kicker}>Live BOM / preemptive</p>
          <span className={css.kicker}>{estimate.lines.length} lines</span>
        </div>
      ) : (
        <p className={css.kicker}>{estimate.lines.length} lines</p>
      )}
      <button type="button" className={css.total} onClick={onOpenQuote}>
        {aud(estimate.totalInclGst)} <span className={css.gst}>incl. GST</span>
      </button>
      <p className={css.meta}>
        {estimate.hardscapeM2 > 0
          ? `${estimate.hardscapeM2.toFixed(1)} m² hard · ${estimate.excavateM3.toFixed(1)} m³ dig · ${estimate.tipperLoads} tipper`
          : "Place hardscape to shadow assembly costs"}
      </p>
      <div className={css.lines}>
        {primary.slice(0, 6).map((row) => (
          <div key={row.id} className={css.line}>
            <span>{row.label}</span>
            <span className={css.amt}>{aud(row.total)}</span>
          </div>
        ))}
        {shadowed.length > 0 ? (
          <div className={css.shadowHead}>
            Shadowed assembly · labour · logistics
          </div>
        ) : null}
        {shadowed.slice(0, 8).map((row) => (
          <div key={row.id} className={`${css.line} ${css.shadowLine}`}>
            <span title={row.notes}>{row.label}</span>
            <span className={css.amt}>{aud(row.total)}</span>
          </div>
        ))}
      </div>
      {horizonChips.length > 0 ? (
        <div className={css.chips}>
          {horizonChips.map((m) => (
            <button
              key={m.id}
              type="button"
              className={css.chip}
              data-on={mitigated[m.id] ? "true" : "false"}
              title={m.detail}
              onClick={() => onMitigate(m.id)}
            >
              {mitigated[m.id] ? "Noted · " : ""}
              {m.title.length > 28 ? `${m.title.slice(0, 26)}…` : m.title}
            </button>
          ))}
        </div>
      ) : null}
      <p className={css.foot}>
        Preemptive estimate — GST {aud(estimate.gst)} · not a formal tender
      </p>
    </aside>
  );
}
