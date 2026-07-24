"use client";

import {
  isTier1WrightsTerrace,
  type StudioEstimateReport,
} from "@workstream/domain";
import { Tier1SavingsLedger } from "../../../../tier1";
import css from "./quote.module.css";

type Props = {
  address: string;
  estimate: StudioEstimateReport;
  draftUnverified?: boolean;
  pendingGhosts?: number;
  onReviewGhosts?: () => void;
  onShare?: () => void;
  onBack: () => void;
};

const aud = (n: number) =>
  new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(n);

/**
 * Quote lens — same continuous preemptive estimate as Live BOM (no mode math split).
 */
export function QuoteSurface({
  address,
  estimate,
  draftUnverified = false,
  pendingGhosts = 0,
  onReviewGhosts,
  onShare,
  onBack,
}: Props) {
  const tier1 = isTier1WrightsTerrace(address);
  const lines = estimate.lines.filter((l) => l.total > 0).slice(0, 18);
  /**
   * Empty BOM is an empty state, not a $0 quote. A "$0 incl. GST" hero next
   * to the tier-1 ledger's target figure reads as a contradiction — and a
   * shareable $0 quote is meaningless. Real data or graceful empty.
   */
  const hasCostedBom = lines.length > 0 && estimate.totalInclGst > 0;

  if (!hasCostedBom) {
    return (
      <div className={css.root} data-testid="quote-surface">
        <div className={css.card}>
          <p className={css.kicker}>Indicative quote</p>
          <div data-testid="quote-empty-state">
            <h2 className={css.emptyTitle}>Nothing costed yet</h2>
            <p className={css.lead}>
              The quote builds itself from the live BOM on this working
              drawing. Place plants, surfaces or structures in CAD and the
              figures appear here as you draw.
            </p>
          </div>
          <button type="button" className={css.back} onClick={onBack}>
            Back to CAD
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={css.root} data-testid="quote-surface">
      <div className={css.card}>
        {draftUnverified ? (
          <div className={css.draftGate} data-testid="quote-ai-draft-gate">
            <p className={css.draftGateTitle}>AI draft unverified</p>
            <p className={css.draftGateBody}>
              {pendingGhosts} pending proposal
              {pendingGhosts === 1 ? "" : "s"} still sit on the drawing. Accept or
              reject them before treating this quote as client-ready.
            </p>
            {onReviewGhosts ? (
              <button type="button" className={css.draftGateBtn} onClick={onReviewGhosts}>
                Review AI proposals
              </button>
            ) : null}
          </div>
        ) : null}
        <p className={css.kicker}>Indicative quote</p>
        <h2 className={css.total}>{aud(estimate.totalInclGst)}</h2>
        <p className={css.lead}>
          Incl. GST from the live preemptive BOM on this working drawing. Survey
          services (drainage, RL levels, easements) are locked as site context.
          Promote from Share for a client-ready quote revision.
        </p>
        <ul className={css.lines}>
          {lines.map((row) => (
            <li key={row.id}>
              <span>
                {row.label}
                {row.qty > 0 ? (
                  <small>
                    {" "}
                    · {row.qty} {row.unit}
                  </small>
                ) : null}
              </span>
              <span>{aud(row.total)}</span>
            </li>
          ))}
        </ul>
        {tier1 ? (
          <div className={css.ledger} data-testid="tier1-quote-ledger">
            <Tier1SavingsLedger variant="compact" showTarget />
          </div>
        ) : null}
        {!draftUnverified && onShare ? (
          <button
            type="button"
            className={css.back}
            data-testid="quote-go-share"
            onClick={onShare}
          >
            Share with client →
          </button>
        ) : null}
        <button type="button" className={css.back} onClick={onBack}>
          Back to CAD
        </button>
      </div>
    </div>
  );
}
