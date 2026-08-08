"use client";

import type { ResolveQuoteResult } from "@workstream/domain";
import css from "./quoteBuilder.module.css";

const aud = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
});

type Props = {
  resolved: ResolveQuoteResult;
  marginPct: number;
  onMarginPct: (n: number) => void;
};

export function QuoteTotalsBar({ resolved, marginPct, onMarginPct }: Props) {
  return (
    <footer className={css.totals} data-testid="quote-totals-bar">
      <label className={css.marginField}>
        <span>Margin</span>
        <input
          type="number"
          min={0}
          max={100}
          step={0.5}
          value={marginPct}
          onChange={(e) => onMarginPct(Number(e.target.value) || 0)}
          aria-label="Global margin percent"
        />
        <span className={css.pct}>%</span>
      </label>
      <div className={css.totalRow}>
        <span>Subtotal</span>
        <span className={css.mono}>{aud.format(resolved.subtotalExGst)}</span>
      </div>
      <div className={css.totalRow}>
        <span>Margin</span>
        <span className={css.mono}>{aud.format(resolved.marginAmount)}</span>
      </div>
      <div className={css.totalRow}>
        <span>GST (10%)</span>
        <span className={css.mono}>{aud.format(resolved.gst)}</span>
      </div>
      <div className={`${css.totalRow} ${css.totalGrand}`}>
        <span>Total incl GST</span>
        <span className={css.mono}>{aud.format(resolved.totalInclGst)}</span>
      </div>
    </footer>
  );
}
