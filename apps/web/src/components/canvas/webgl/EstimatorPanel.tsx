"use client";

/**
 * Gold Standard 2026 — Estimator panel (contextual tabbed estimation surface).
 *
 * The right dock's estimation companion is ONE floating glass panel, not a
 * stack of cards: a stage-aware title ("Estimator" while the estimate is
 * provisional; "Quote" after signoff — the committed final), a live total
 * chip, and tabs [Estimate | Sourcing]. It behaves like the "Set up your
 * site" panel: floating glass, spans the canvas height, contextual — it
 * opens itself in the costing stages and only surfaces tabs that have
 * something to say.
 *
 * Coexistence: as a dock companion alongside a tall mode panel (survey, sketch,
 * cad, garden) the Estimate tab defaults to the COMPACT running-estimate
 * summary — total + item count + provisional label, one row, expand affordance
 * — so the ambient estimate never fights the active mode panel for the dock's
 * capped height. Header and tabs stay hidden until the operator expands the
 * summary on demand.
 */

import { useEffect, useState } from "react";
import { FitSheetCard, type FitSheetCardProps } from "./FitSheetCard";
import { SupplierFeedCard } from "./SupplierFeedCard";
import { Button } from "./Button";

type EstimatorTab = "estimate" | "sourcing";

export interface EstimatorPanelProps {
  projectId: string;
  items: FitSheetCardProps["items"];
  boundaryPct: FitSheetCardProps["boundaryPct"];
  constructionTrenches: FitSheetCardProps["constructionTrenches"];
  irrigationZones: FitSheetCardProps["irrigationZones"];
  scaleM: FitSheetCardProps["scaleM"];
  outdoorM2: FitSheetCardProps["outdoorM2"];
  /** Signoff exists → the estimate is committed (final stage). */
  signedOff: boolean;
  /** True while the signoff state is still loading (no confident label). */
  signedOffLoading: boolean;
  /**
   * Default the Estimate tab to the compact "running estimate" summary
   * (total + item count, one row, expand affordance) instead of the itemized
   * card. Set when the panel is a dock companion alongside a tall mode panel
   * (survey/sketch/cad/garden) — the summary is ambient there, so the mode
   * panel keeps the vertical space and the estimator never fights it for the
   * dock's height. When false the estimator is the primary surface (quote) and
   * opens the full itemized card.
   */
  defaultCollapsed?: boolean;
  /** ResCode A2-6 canopy assessment — threaded to the fit-sheet row. */
  canopy?: FitSheetCardProps["canopy"];
}

export function EstimatorPanel({
  projectId,
  items,
  boundaryPct,
  constructionTrenches,
  irrigationZones,
  scaleM,
  outdoorM2,
  signedOff,
  signedOffLoading,
  defaultCollapsed = false,
  canopy = null,
}: EstimatorPanelProps) {
  const [tab, setTab] = useState<EstimatorTab>("estimate");
  /** Companion mode: operator expanded the running-estimate summary. */
  const [detailOpen, setDetailOpen] = useState(false);

  const hasItems = (items?.length ?? 0) > 0;
  const tabs: Array<{ id: EstimatorTab; label: string }> = [
    { id: "estimate", label: "Estimate" },
    ...(hasItems ? [{ id: "sourcing" as const, label: "Sourcing" }] : []),
  ];

  useEffect(() => {
    if (tab === "sourcing" && !hasItems) setTab("estimate");
  }, [tab, hasItems]);

  useEffect(() => {
    if (!defaultCollapsed) setDetailOpen(false);
  }, [defaultCollapsed]);

  // No storage seeding here: this panel used to force-write
  // workstream.fitSheet.expanded="1" on primary mounts, which polluted a
  // fresh context and made the capsule re-mount expanded — contradicting
  // its own persistence contract (empty storage = collapsed pill). The
  // capsule owns the preference end to end (read-on-mount + persist on
  // change only).

  if (!hasItems) return null;

  const title = signedOffLoading ? "Estimator" : signedOff ? "Quote" : "Estimator";
  const statusWord = signedOffLoading
    ? "…"
    : signedOff
      ? "Committed"
      : "Provisional";

  const showFullChrome = !defaultCollapsed || detailOpen;

  return (
    <section
      data-testid="estimator-panel"
      data-estimator-companion={
        defaultCollapsed ? (detailOpen ? "expanded" : "compact") : "primary"
      }
      data-gs-glass-card
      aria-label={`${title} panel`}
      style={{
        position: "relative",
        pointerEvents: "auto",
        /* Fill the wrapper (which owns the right gutter beside the flush
         * UnifiedPanel). A fixed 360px here overflowed the 340px wrapper
         * and bled 20px under the panel (chrome-collision gate). */
        width: "100%",
        boxSizing: "border-box",
        flex: showFullChrome ? "0 1 auto" : "0 0 auto",
        minHeight: 0,
        maxHeight: showFullChrome
          ? "min(280px, calc(100dvh - 360px))"
          : undefined,
        display: "flex",
        flexDirection: "column",
        borderRadius: "var(--gs-radius-panel)",
        background: "var(--gs-panel-grad)",
        border: "1px solid color-mix(in srgb, var(--gs-line) 55%, transparent)",
        boxShadow: "var(--gs-shadow-2)",
        padding: showFullChrome ? "10px 12px" : "6px 8px",
        gap: showFullChrome ? "var(--gs-space-3)" : 0,
        animation: "wsPanelIn 160ms cubic-bezier(0.22, 1, 0.36, 1)",
      }}
    >
      {showFullChrome ? (
        <>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              gap: "var(--gs-space-2)",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-tech)",
                fontSize: "var(--gs-font-xs)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--la-ink-secondary)",
              }}
            >
              {title}
            </span>
            <span
              data-testid="estimator-status"
              style={{
                fontFamily: "var(--font-tech)",
                fontSize: "var(--gs-font-micro)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: signedOff
                  ? "var(--gs-ink-success, var(--la-ink-secondary))"
                  : "var(--la-ink-muted)",
              }}
            >
              {statusWord}
            </span>
          </div>

          <div
            role="tablist"
            aria-label="Estimator sections"
            style={{
              display: "flex",
              gap: "var(--gs-space-2)",
            }}
          >
            {tabs.map((t) => (
              <Button
                key={t.id}
                size="xs"
                variant="chip"
                role="tab"
                aria-selected={tab === t.id}
                aria-pressed={tab === t.id}
                active={tab === t.id}
                data-testid={`estimator-tab-${t.id}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </Button>
            ))}
          </div>
        </>
      ) : null}

      <div
        role="tabpanel"
        style={{
          display: "flex",
          flexDirection: "column",
          flex: showFullChrome ? 1 : undefined,
          minHeight: 0,
          overflowY: showFullChrome && detailOpen ? "auto" : undefined,
          scrollbarWidth: "thin",
          gap: showFullChrome ? "var(--gs-space-3)" : 0,
        }}
      >
        {tab === "estimate" ? (
          <FitSheetCard
            projectId={projectId}
            items={items}
            boundaryPct={boundaryPct}
            constructionTrenches={constructionTrenches}
            irrigationZones={irrigationZones}
            scaleM={scaleM}
            outdoorM2={outdoorM2}
            allowExpanded={!defaultCollapsed}
            compact={defaultCollapsed}
            expanded={defaultCollapsed ? detailOpen : undefined}
            onExpandedChange={
              defaultCollapsed
                ? (open) => {
                    setDetailOpen(open);
                  }
                : undefined
            }
            statusLabel={statusWord === "…" ? "Provisional" : statusWord}
            canopy={canopy}
          />
        ) : (
          <SupplierFeedCard />
        )}
      </div>
    </section>
  );
}
