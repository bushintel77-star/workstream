"use client";

import { useEffect, useState } from "react";
import type { StudioEstimateReport } from "@workstream/domain";
import { isTier1WrightsTerrace, quoteDocToShareLines, TIER1_WRIGHTS_SAVINGS } from "@workstream/domain";
import { Tier1SavingsLedger } from "@/components/tier1/Tier1SavingsLedger";
import { QuoteLineRow } from "./QuoteLineRow";
import { QuoteTotalsBar } from "./QuoteTotalsBar";
import { useQuoteDoc } from "./useQuoteDoc";
import css from "./quoteBuilder.module.css";

const aud = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
});

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
  /** When true, renders inside the LiveCostRail — no absolute positioning,
   * uses dark frame tokens instead of light --hc-invert. */
  embeddedInRail?: boolean;
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
  embeddedInRail = false,
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
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 719px)");
    const sync = () => setCompact(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const costedLineCount = estimate.lines.filter((l) => l.total > 0).length;
  const empty = costedLineCount === 0;
  const tier1 = isTier1WrightsTerrace(address);

  return (
    <div
      className={`${css.root}${compact ? ` ${css.rootCompact}` : ""}${embeddedInRail ? ` ${css.rootEmbedded}` : ""}`}
      data-testid="quote-surface"
      data-embedded={embeddedInRail ? "1" : "0"}
    >
      <header className={css.top}>
        <div className={css.topMain}>
          <button
            type="button"
            className={css.closeBtn}
            aria-label="Close quote panel"
            data-testid="quote-close"
            onClick={onBack}
          >
            ×
          </button>
          <h1 className={css.h1}>Quote</h1>
          <span className={css.countBadge}>
            {costedLineCount} line{costedLineCount === 1 ? "" : "s"}
          </span>
          {!compact ? <p className={css.addr}>{address}</p> : null}
        </div>
        <div className={css.actions}>
          <button type="button" onClick={addCustomLine}>
            Add line
          </button>
          <button type="button" onClick={resetAll}>
            Reset
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
        <main className={css.quotePane}>
          {tier1 && !estimateSettling ? (
            <Tier1SavingsLedger
              savings={TIER1_WRIGHTS_SAVINGS}
              variant="compact"
              heading="Value reallocation"
            />
          ) : null}
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
            <>
              {!compact ? (
                <div className={css.globalHeader} role="row" data-testid="quote-global-header">
                  <div className={`${css.lineCell} ${css.lineCellLabel}`} role="columnheader">
                    Item
                  </div>
                  <div className={`${css.lineCell} ${css.lineCellUnit}`} role="columnheader">
                    Unit
                  </div>
                  <div className={`${css.lineCell} ${css.lineCellQty}`} role="columnheader">
                    Qty
                  </div>
                  <div className={`${css.lineCell} ${css.lineCellRate}`} role="columnheader">
                    Rate
                  </div>
                  <div className={`${css.lineCell} ${css.lineCellTotal}`} role="columnheader">
                    Total
                  </div>
                  <div className={`${css.lineCell} ${css.lineCellActions}`} role="columnheader" />
                </div>
              ) : null}
              {resolved.sections.map((section) => (
                <details
                  key={section.id}
                  className={css.section}
                  open={!compact || section.id === resolved.sections[0]?.id}
                >
                  <summary>
                    <span className={css.sectionName}>{section.label}</span>
                    <span className={css.sectionMeta}>
                      {section.lines.length} line{section.lines.length === 1 ? "" : "s"} · {aud.format(section.subtotal)}
                    </span>
                  </summary>
                  <div className={css.table} role="grid" aria-label={section.label}>
                    <div role="rowgroup">
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
                    </div>
                  </div>
                </details>
              ))}
            </>
          )}

          <p className={css.honesty}>
            Indicative — confirm before tender. Prices ex-supplier at time of
            estimate.
          </p>

          <QuoteTotalsBar
            resolved={resolved}
            marginPct={doc.margin.global_pct}
            onMarginPct={setMarginPct}
          />
        </main>
      </div>
    </div>
  );
}
