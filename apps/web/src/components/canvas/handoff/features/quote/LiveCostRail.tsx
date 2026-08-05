"use client";

import { useMemo, useState } from "react";
import {
  type StudioEstimateReport,
  quoteDocToShareLines,
} from "@workstream/domain";
import { useQuoteDoc } from "./useQuoteDoc";
import { QuoteBuilder } from "./QuoteBuilder";
import css from "./liveCostRail.module.css";

const aud = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  maximumFractionDigits: 0,
}).format;

const audFull = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
}).format;

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
  onOpenLibrary?: () => void;
  onFit?: () => void;
  onClose?: () => void;
};

/**
 * Progressive cost rail — lives in the right data lane alongside the drawing.
 *
 * Three stages of substance:
 *   1. Seed (empty canvas): slim total chip + "place assets to build a quote"
 *   2. Estimation (items placed): running total, line count, top items, margin
 *   3. Quote (Expand tapped): full QuoteBuilder slides out as a wider drawer
 *
 * The drawing is never hidden — the rail is a lane panel, not a mode takeover.
 * Wears the same dark grey frame language as the header (--ws-frame tokens).
 */
export function LiveCostRail({
  projectId,
  address,
  estimate,
  estimateSettling = false,
  onShare,
  onOpenLibrary,
  onFit,
  onClose,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const { resolved, doc, setMarginPct, saving, dirty } = useQuoteDoc({
    projectId,
    estimate,
  });

  const costedLines = useMemo(
    () => estimate.lines.filter((l) => l.total > 0),
    [estimate.lines],
  );
  const lineCount = costedLines.length;
  const empty = lineCount === 0;

  const topItems = useMemo(
    () =>
      [...costedLines]
        .sort((a, b) => b.total - a.total)
        .slice(0, 5)
        .map((l) => ({ id: l.id, label: l.label, total: l.total })),
    [costedLines],
  );

  const sectionSummary = useMemo(
    () =>
      resolved.sections
        .filter((s) => s.lines.length > 0)
        .map((s) => ({
          id: s.id,
          label: s.label,
          count: s.lines.length,
          subtotal: s.subtotal,
        })),
    [resolved.sections],
  );

  // Stage 3 — expanded QuoteBuilder drawer
  if (expanded) {
    return (
      <div className={css.expandedWrap} data-testid="live-cost-rail-expanded">
        <QuoteBuilder
          projectId={projectId}
          address={address}
          estimate={estimate}
          estimateSettling={estimateSettling}
          onShare={onShare}
          onBack={() => setExpanded(false)}
          onOpenLibrary={onOpenLibrary}
          onFit={onFit}
          embeddedInRail
        />
      </div>
    );
  }

  // Stages 1 + 2 — slim rail in the right data lane
  return (
    <aside
      className={css.rail}
      data-testid="live-cost-rail"
      data-stage={empty ? "seed" : "estimation"}
    >
      <header className={css.railHead}>
        <div className={css.railHeadMain}>
          <p className={css.kicker}>Live cost</p>
          <button
            type="button"
            className={css.closeBtn}
            aria-label="Close cost rail"
            data-testid="live-cost-rail-close"
            onClick={onClose}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <button
          type="button"
          className={`${css.total}${estimateSettling ? ` ${css.totalPulse}` : ""}`}
          data-testid="live-cost-rail-total"
          data-settling={estimateSettling ? "true" : "false"}
          onClick={() => !empty && setExpanded(true)}
          disabled={empty}
          title={empty ? "Place assets to build a quote" : "Expand to full quote builder"}
        >
          {audFull(estimate.totalInclGst)}
          <span className={css.totalSuffix}>incl. GST</span>
        </button>
      </header>

      {empty ? (
        <div className={css.seedBody} data-testid="live-cost-rail-empty">
          <p className={css.seedHint}>
            Place assets on the plan to build a live quote.
          </p>
          {onOpenLibrary ? (
            <button
              type="button"
              className={css.seedCta}
              onClick={onOpenLibrary}
            >
              Open library
            </button>
          ) : null}
        </div>
      ) : (
        <div className={css.estimationBody}>
          <div className={css.statRow}>
            <div className={css.stat}>
              <span className={css.statLabel}>Lines</span>
              <span className={css.statValue}>{lineCount}</span>
            </div>
            <div className={css.stat}>
              <span className={css.statLabel}>Hardscape</span>
              <span className={css.statValue}>
                {estimate.hardscapeM2 > 0
                  ? `${estimate.hardscapeM2.toFixed(0)} m²`
                  : "—"}
              </span>
            </div>
            <div className={css.stat}>
              <span className={css.statLabel}>Excavate</span>
              <span className={css.statValue}>
                {estimate.excavateM3 > 0
                  ? `${estimate.excavateM3.toFixed(0)} m³`
                  : "—"}
              </span>
            </div>
          </div>

          {topItems.length > 0 ? (
            <div className={css.topItems} data-testid="live-cost-rail-top-items">
              <p className={css.sectionLabel}>Top items</p>
              {topItems.map((item) => (
                <div key={item.id} className={css.topItem}>
                  <span className={css.topItemLabel}>{item.label}</span>
                  <span className={css.topItemAmt}>{aud(item.total)}</span>
                </div>
              ))}
            </div>
          ) : null}

          {sectionSummary.length > 0 ? (
            <div className={css.sections} data-testid="live-cost-rail-sections">
              <p className={css.sectionLabel}>Sections</p>
              {sectionSummary.map((s) => (
                <div key={s.id} className={css.sectionRow}>
                  <span className={css.sectionName}>{s.label}</span>
                  <span className={css.sectionMeta}>
                    {s.count} · {aud(s.subtotal)}
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          <div className={css.marginRow}>
            <label className={css.marginField}>
              <span>Margin</span>
              <input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={doc.margin.global_pct}
                onChange={(e) => setMarginPct(Number(e.target.value) || 0)}
                aria-label="Global margin percent"
              />
              <span className={css.pct}>%</span>
            </label>
          </div>

          <div className={css.totalsMini} data-testid="live-cost-rail-totals">
            <div className={css.totalRow}>
              <span>Subtotal</span>
              <span className={css.mono}>{audFull(resolved.subtotalExGst)}</span>
            </div>
            <div className={css.totalRow}>
              <span>Margin</span>
              <span className={css.mono}>{audFull(resolved.marginAmount)}</span>
            </div>
            <div className={css.totalRow}>
              <span>GST (10%)</span>
              <span className={css.mono}>{audFull(resolved.gst)}</span>
            </div>
            <div className={`${css.totalRow} ${css.totalGrand}`}>
              <span>Total incl GST</span>
              <span className={css.mono}>{audFull(resolved.totalInclGst)}</span>
            </div>
          </div>

          {dirty || saving ? (
            <p className={css.savePulse} data-testid="live-cost-rail-save">
              {saving ? "Saving…" : "Unsaved edits"}
            </p>
          ) : null}

          <div className={css.actions}>
            <button
              type="button"
              className={css.expandBtn}
              onClick={() => setExpanded(true)}
              data-testid="live-cost-rail-expand"
            >
              Expand to full quote
            </button>
            {onShare ? (
              <button
                type="button"
                className={css.shareBtn}
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
        </div>
      )}

      <p className={css.honesty}>Indicative — confirm before tender</p>
    </aside>
  );
}
