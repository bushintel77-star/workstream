"use client";

import { useMemo } from "react";
import { isTier1WrightsTerrace } from "@workstream/domain";
import { Tier1SavingsLedger } from "../../../../tier1";
import { bomLines, type StudioItem } from "../../studioCatalog";
import css from "./quote.module.css";

type Props = {
  address: string;
  items: StudioItem[];
  draftUnverified?: boolean;
  pendingGhosts?: number;
  onReviewGhosts?: () => void;
  onBack: () => void;
};

const aud = (n: number) =>
  new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(n);

/**
 * Quote lens — live BOM total + Wrights Terrace Tier-1 value ledger when address matches.
 */
export function QuoteSurface({
  address,
  items,
  draftUnverified = false,
  pendingGhosts = 0,
  onReviewGhosts,
  onBack,
}: Props) {
  const lines = useMemo(() => bomLines(items), [items]);
  const materials = lines.reduce((a, r) => a + r.amt, 0);
  const total = Math.round((materials + 4378) * 0.92);
  const tier1 = isTier1WrightsTerrace(address);

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
        <h2 className={css.total}>{aud(total)}</h2>
        <p className={css.lead}>
          Incl. GST from the live BOM on this working drawing. Not a formal tender —
          promote from Share when the client is ready.
        </p>
        <ul className={css.lines}>
          {lines.map((row) => (
            <li key={row.name}>
              <span>{row.name}</span>
              <span>{aud(row.amt)}</span>
            </li>
          ))}
        </ul>
        {tier1 ? (
          <div className={css.ledger} data-testid="tier1-quote-ledger">
            <Tier1SavingsLedger variant="compact" showTarget />
          </div>
        ) : null}
        <button type="button" className={css.back} onClick={onBack}>
          Back to CAD
        </button>
      </div>
    </div>
  );
}
