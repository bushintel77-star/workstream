import type { ReactNode } from "react";
import { TIER1_WRIGHTS_SAVINGS } from "@workstream/domain";
import lg from "./tier1SavingsLedger.module.css";

export type Tier1Savings = {
  removed_ex: number;
  deployed_ex: number;
  net_ex: number;
  net_inc_gst: number;
  target_total_inc_gst: number;
};

function aud(n: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(n);
}

type Props = {
  savings?: Tier1Savings;
  variant?: "full" | "compact";
  heading?: string;
  showTarget?: boolean;
  footer?: ReactNode;
};

/** Shared Proposal v3 savings ledger — portal, quote/share docks, studio. */
export function Tier1SavingsLedger({
  savings = TIER1_WRIGHTS_SAVINGS,
  variant = "full",
  heading = "Value reallocation",
  showTarget = true,
  footer,
}: Props) {
  const wrapClass =
    variant === "compact" ? `${lg.wrap} ${lg.wrapCompact}` : lg.wrap;

  return (
    <section className={wrapClass} aria-labelledby="tier1-ledger-heading">
      <h2 id="tier1-ledger-heading" className={lg.heading}>
        {heading}
      </h2>
      {showTarget ? (
        <p className={lg.target}>
          Target quote {aud(savings.target_total_inc_gst)} incl. GST · net saving{" "}
          {aud(Math.abs(savings.net_inc_gst))} vs cottage-scatter scope
        </p>
      ) : null}
      <div className={lg.ledger}>
        <div className={lg.col}>
          <span className={lg.kicker}>Removed</span>
          <span className={lg.amount}>{aud(savings.removed_ex)}</span>
          <p className={lg.note}>
            Cottage perennials, ferns, organic mulch, redundant irrigation zone.
          </p>
        </div>
        <div className={lg.col}>
          <span className={lg.kicker}>Deployed</span>
          <span className={lg.amount}>{aud(savings.deployed_ex)}</span>
          <p className={lg.note}>
            Cycas anchors, Buxus structure, Mondo grid, bluestone screenings, deck
            strip lighting.
          </p>
        </div>
      </div>
      {footer ? <div className={lg.footer}>{footer}</div> : null}
    </section>
  );
}
