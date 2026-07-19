"use client";

import { useState } from "react";
import {
  deriveConfidenceFactors,
  ghostCategoryFromSymbol,
  type ConfidenceFactor,
} from "@workstream/domain";
import css from "./ghostReviewCard.module.css";

type Props = {
  title: string;
  why: string;
  confidence: number;
  symbolId?: string;
  suggestionId: string;
  stale?: boolean;
  costHint?: string | null;
  index?: number;
  total?: number;
  onAccept: () => void;
  onReject: () => void;
  onPrev?: () => void;
  onNext?: () => void;
};

export function GhostReviewCard({
  title,
  why,
  confidence,
  symbolId = "",
  suggestionId,
  stale = false,
  costHint = null,
  index = 0,
  total = 1,
  onAccept,
  onReject,
  onPrev,
  onNext,
}: Props) {
  const [factorsOpen, setFactorsOpen] = useState(false);
  const pct = Math.round(confidence * 100);
  const category = ghostCategoryFromSymbol(symbolId, title);
  const factors: ConfidenceFactor[] = deriveConfidenceFactors(
    suggestionId,
    confidence,
    category,
  );

  return (
    <div
      className={`${css.card}${stale ? ` ${css.cardStale}` : ""}`}
      data-testid="ghost-review-card"
    >
      <p className={css.title}>{title}</p>
      <p className={css.why}>{why}</p>
      {costHint ? <p className={css.meta}>{costHint}</p> : null}
      {stale ? (
        <p className={css.meta}>Nearby edit — recheck this suggestion</p>
      ) : null}
      <button
        type="button"
        className={css.confRow}
        title="Click to expand confidence factors"
        onClick={() => setFactorsOpen((v) => !v)}
      >
        <span className={css.confTrack}>
          <span
            className={`${css.confFill}${pct < 65 ? ` ${css.confFillLow}` : ""}`}
            style={{ width: `${pct}%` }}
          />
        </span>
        <span className={css.confPct}>{pct}%</span>
        <span className={css.chevron}>{factorsOpen ? "▴" : "▾"}</span>
      </button>
      {factorsOpen ? (
        <div className={css.factors}>
          {factors.map((f) => (
            <div key={f.label} className={css.factorRow}>
              <span>{f.label}</span>
              <span>{f.pct}%</span>
              <div className={css.factorTrack}>
                <div
                  className={css.factorFill}
                  style={{ width: `${f.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : null}
      <div className={css.actions}>
        <button
          type="button"
          className={`${css.btn} ${css.btnAccept}`}
          data-testid="ghost-review-accept"
          onClick={onAccept}
        >
          Accept
        </button>
        <button
          type="button"
          className={`${css.btn} ${css.btnReject}`}
          data-testid="ghost-review-reject"
          onClick={onReject}
        >
          Reject
        </button>
      </div>
      {total > 1 ? (
        <div className={css.nav}>
          <button type="button" className={css.navBtn} onClick={onPrev}>
            Prev
          </button>
          <span className={css.meta}>
            {index + 1} / {total}
          </span>
          <button type="button" className={css.navBtn} onClick={onNext}>
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}
