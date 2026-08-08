"use client";

import { useMemo, useState } from "react";
import { formatLabourChip, type StudioEstimateReport } from "@workstream/domain";
import css from "./bom.module.css";

type Props = {
  estimate: StudioEstimateReport;
  mitigated: Record<string, boolean>;
  onMitigate: (id: string) => void;
  onOpenQuote: () => void;
  embedded?: boolean;
  /** Soft skeletal pulse while estimate / save settles (Canvas-First). */
  settling?: boolean;
};

const aud = (n: number) =>
  new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(n);

function friendlyPrimary(label: string): string {
  return label
    .replace(/\s+[—-]\s+surface$/i, "")
    .replace(/^Bluestone paving$/i, "Bluestone")
    .replace(/^Timber deck$/i, "Deck")
    .replace(/^Instant turf$/i, "Turf")
    .replace(/^Mass plant bed$/i, "Planting")
    .replace(/^Clipped hedge$/i, "Hedge")
    .replace(/^Canopy tree$/i, "Canopy")
    .replace(/^Feature tree$/i, "Feature")
    .replace(/^French drain$/i, "Drain");
}

/**
 * Floating Live BOM HUD — total + material tags only.
 * Nested assembly / labour / tippers stay under Advanced (Canvas-First).
 */
export function LiveBomDock({
  estimate,
  mitigated,
  onMitigate,
  onOpenQuote,
  embedded = false,
  settling = false,
}: Props) {
  const [advanced, setAdvanced] = useState(false);
  const primary = estimate.lines.filter((l) => l.tier === "primary");
  const shadowed = estimate.lines.filter((l) => l.tier !== "primary");
  const horizonChips = estimate.horizon.filter((h) => !mitigated[h.id]);
  const labourChip = useMemo(() => {
    let hours = 0;
    for (const line of estimate.lines) {
      if (line.tier !== "labour") continue;
      const unit = line.unit.toLowerCase();
      if (unit === "hr" || unit === "hour" || unit === "hrs" || unit === "h") {
        hours += line.qty;
      } else if (unit === "ea") {
        hours += line.qty * 0.5;
      }
    }
    return formatLabourChip(Math.round(hours * 10) / 10);
  }, [estimate.lines]);

  const horizonLabel = (kind: (typeof horizonChips)[number]["kind"]) => {
    switch (kind) {
      case "drainage":
        return "Drainage tip";
      case "tpz":
        return "Tree protection";
      case "engineer":
        return "Engineer check";
      case "spoil":
        return "Spoil / tipper";
      case "assembly":
        return "Assembly note";
      default:
        return "Horizon tip";
    }
  };

  return (
    <aside
      className={`${css.dock}${embedded ? ` ${css.embedded}` : ""}`}
      data-testid="live-bom-hud"
    >
      {!embedded ? (
        <div className={css.head}>
          <p className={css.kicker}>Instant Planner</p>
          {labourChip !== "—" ? (
            <span className={css.labourChip} data-testid="instant-planner-labour">
              {labourChip}
            </span>
          ) : null}
        </div>
      ) : (
        <p className={css.kicker}>Instant Planner</p>
      )}
      <button
        type="button"
        className={`${css.total}${settling ? ` ${css.totalPulse}` : ""}`}
        onClick={onOpenQuote}
        data-testid="live-bom-total"
        data-settling={settling ? "true" : "false"}
      >
        {aud(estimate.totalInclGst)}{" "}
        <span className={css.gst}>incl. GST</span>
      </button>
      <p className={css.meta}>
        {estimate.hardscapeM2 > 0
          ? `About ${estimate.hardscapeM2.toFixed(0)} m² hardscape · trade hubs cached`
          : "Tag materials on the plan — cost updates as you draw"}
      </p>
      <div className={css.lines}>
        {primary.slice(0, 5).map((row) => (
          <div key={row.id} className={css.line}>
            <span>{friendlyPrimary(row.label)}</span>
            <span className={css.amt}>{aud(row.total)}</span>
          </div>
        ))}
      </div>
      {shadowed.length > 0 ? (
        <div className={css.advanced}>
          <button
            type="button"
            className={css.advancedToggle}
            data-testid="live-bom-advanced"
            aria-expanded={advanced}
            onClick={() => setAdvanced((v) => !v)}
          >
            {advanced ? "Hide assembly detail" : "Advanced"}
          </button>
          {advanced ? (
            <div className={css.advancedBody} data-testid="live-bom-advanced-body">
              <p className={css.shadowHead}>
                Assembly · labour · logistics (engine)
              </p>
              {shadowed.slice(0, 16).map((row) => (
                <div key={row.id} className={`${css.line} ${css.shadowLine}`}>
                  <span title={row.notes}>{row.label}</span>
                  <span className={css.amt}>{aud(row.total)}</span>
                </div>
              ))}
              {estimate.tipperLoads > 0 ? (
                <p className={css.meta}>
                  {estimate.excavateM3.toFixed(1)} m³ dig · {estimate.tipperLoads}{" "}
                  tipper load
                  {estimate.tipperLoads === 1 ? "" : "s"}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      {horizonChips.length > 0 ? (
        <div className={css.chips} data-testid="live-bom-horizon">
          <p className={css.shadowHead}>Preemptive horizon</p>
          {horizonChips.map((m) => (
            <button
              key={m.id}
              type="button"
              className={css.chip}
              data-on="false"
              data-testid={`live-bom-horizon-${m.kind}`}
              title={m.detail}
              onClick={() => onMitigate(m.id)}
            >
              {horizonLabel(m.kind)}
            </button>
          ))}
        </div>
      ) : null}
      <p className={css.foot}>Indicative — not a formal tender</p>
    </aside>
  );
}
