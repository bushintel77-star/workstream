"use client";

import { useEffect, useState } from "react";
import type { StudioEstimateReport } from "@workstream/domain";
import { quoteDocToShareLines } from "@workstream/domain";
import { QuoteLineRow } from "./QuoteLineRow";
import { QuoteTotalsBar } from "./QuoteTotalsBar";
import { useQuoteDoc } from "./useQuoteDoc";
import css from "./quoteBuilder.module.css";

type Props = {
  projectId?: string | null;
  address: string;
  estimate: StudioEstimateReport;
  estimateSettling?: boolean;
  onShare?: (payload: {
    quoteLines: Array<{
      id: string;
      label: string;
      unit: string;
      qty: number;
      total: number;
    }>;
    totalInclGst: number;
  }) => void;
  onBack: () => void;
  onOpenLibrary?: () => void;
  onFit?: () => void;
};

/**
 * Editable quote builder — engine overlay with responsive desktop/mobile layout.
 */
export function QuoteBuilder({
  projectId,
  address,
  estimate,
  estimateSettling = false,
  onShare,
  onBack,
  onOpenLibrary,
  onFit,
}: Props) {
  const {
    loaded,
    saving,
    dirty,
    resolved,
    doc,
    setOverride,
    resetLine,
    resetAll,
    addCustomLine,
    setMarginPct,
  } = useQuoteDoc({ projectId, estimate });
  const [showPlan, setShowPlan] = useState(false);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 899px)");
    const sync = () => setCompact(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const empty = estimate.lines.filter((l) => l.total > 0).length === 0;

  return (
    <div
      className={`${css.root}${compact ? ` ${css.rootCompact}` : ""}`}
      data-testid="quote-builder"
    >
      <header className={css.top}>
        <div className={css.topMain}>
          <button type="button" className={css.back} onClick={onBack}>
            Back
          </button>
          <h1 className={css.h1}>Quote</h1>
          <p className={css.addr}>{address}</p>
        </div>
        <div className={css.actions}>
          <button type="button" onClick={addCustomLine}>
            Add line
          </button>
          <button type="button" onClick={resetAll}>
            Reset to estimate
          </button>
          {onFit ? (
            <button type="button" className={css.overflowAction} onClick={onFit}>
              Fit
            </button>
          ) : null}
          {onShare ? (
            <button
              type="button"
              className={css.primary}
              onClick={() =>
                onShare({
                  quoteLines: quoteDocToShareLines(resolved),
                  totalInclGst: Math.max(resolved.totalInclGst, 0.01),
                })
              }
            >
              Share
            </button>
          ) : null}
          {compact ? (
            <button type="button" onClick={() => setShowPlan((v) => !v)}>
              {showPlan ? "Hide plan" : "View plan"}
            </button>
          ) : null}
        </div>
        {dirty || saving ? (
          <p className={css.savePulse} data-testid="quote-save-status">
            {saving ? "Saving…" : "Unsaved edits"}
          </p>
        ) : null}
      </header>

      {resolved.orphanOverrides.length > 0 ? (
        <div className={css.orphanBanner} role="status">
          {resolved.orphanOverrides.length} override
          {resolved.orphanOverrides.length === 1 ? "" : "s"} no longer match
          the live estimate — review before sharing.
        </div>
      ) : null}

      <div className={css.body}>
        {(!compact || showPlan) && !compact ? (
          <aside className={css.planPane} aria-label="Plan preview">
            <p className={css.planCue}>Live plan totals feed this quote</p>
            <p className={css.mono}>
              {estimate.lines.filter((l) => l.total > 0).length} costed lines
            </p>
            {estimateSettling ? (
              <div className={css.skeleton} aria-hidden />
            ) : null}
          </aside>
        ) : null}
        {compact && showPlan ? (
          <aside className={css.planPane} aria-label="Plan preview">
            <p className={css.planCue}>Live plan totals feed this quote</p>
          </aside>
        ) : null}

        <main className={css.quotePane}>
          {!loaded || estimateSettling ? (
            <div className={css.skeleton} data-testid="quote-loading" />
          ) : empty ? (
            <div className={css.empty} data-testid="quote-empty">
              <p>Place assets with rate SKUs to build a quote</p>
              {onOpenLibrary ? (
                <button type="button" className={css.primary} onClick={onOpenLibrary}>
                  Open library
                </button>
              ) : null}
            </div>
          ) : (
            resolved.sections.map((section) => (
              <details
                key={section.id}
                className={css.section}
                open={!compact || section.id === resolved.sections[0]?.id}
              >
                <summary>{section.label}</summary>
                <table className={css.table}>
                  {!compact ? (
                    <thead>
                      <tr>
                        <th scope="col">Label</th>
                        <th scope="col">Unit</th>
                        <th scope="col">Qty</th>
                        <th scope="col">Rate</th>
                        <th scope="col">Total</th>
                        <th scope="col">Actions</th>
                      </tr>
                    </thead>
                  ) : null}
                  <tbody>
                    {section.lines.map((line) => (
                      <QuoteLineRow
                        key={line.id}
                        line={line}
                        compact={compact}
                        onQty={(qty) => setOverride(line.line_id, { qty })}
                        onRate={(rate) => setOverride(line.line_id, { rate })}
                        onNotes={(notes) => setOverride(line.line_id, { notes })}
                        onExclude={(excluded) =>
                          setOverride(line.line_id, { excluded })
                        }
                        onProvisional={(is_provisional) =>
                          setOverride(line.line_id, { is_provisional })
                        }
                        onAlternateSelect={(alternate_selected) =>
                          setOverride(line.line_id, { alternate_selected })
                        }
                        onReset={() => resetLine(line.line_id)}
                      />
                    ))}
                  </tbody>
                </table>
              </details>
            ))
          )}

          <p className={css.honesty}>
            Indicative — confirm before tender. Prices ex-supplier at time of
            estimate.
          </p>
        </main>
      </div>

      <QuoteTotalsBar
        resolved={resolved}
        marginPct={doc.margin.global_pct}
        onMarginPct={setMarginPct}
      />
    </div>
  );
}
