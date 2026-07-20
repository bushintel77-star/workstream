"use client";

import type { TradeTelemetry } from "@workstream/domain";
import css from "./ambientBudgetMargin.module.css";

type Props = {
  trade: TradeTelemetry;
  /** Prefer estimate total when trade is sparse; else trade total. */
  displayTotalInclGst: number;
};

const aud = (n: number) =>
  new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(n);

/**
 * Ambient budget margin line — 1px base rule + live trade total.
 * Soft amber gate when over budget or wholesale unverified.
 */
export function AmbientBudgetMargin({ trade, displayTotalInclGst }: Props) {
  const unverified = trade.mode === "ai_estimated";
  const overBudget =
    trade.budgetLimitAud != null &&
    displayTotalInclGst > trade.budgetLimitAud;
  const alert = overBudget || unverified;

  return (
    <div
      className={`${css.root}${alert ? ` ${css.alert}` : ""}`}
      data-testid="ambient-budget-margin"
      data-mode={trade.mode}
      data-over-budget={overBudget ? "true" : "false"}
    >
      <div className={css.rule} aria-hidden />
      <div className={css.readout}>
        <span className={css.total} data-testid="ambient-budget-total">
          {aud(displayTotalInclGst)}
        </span>
        <span className={css.sep}>AUD</span>
        <span className={css.badge}>
          {unverified
            ? "AI Estimated — Wholesale Unverified"
            : "Live Trade Matched"}
        </span>
        {trade.budgetLimitAud != null ? (
          <span className={css.budget}>
            Gate {aud(trade.budgetLimitAud)}
            {overBudget ? " · over" : ""}
          </span>
        ) : null}
      </div>
    </div>
  );
}
