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
 * Composition: the Estimate tab embeds the existing FitSheetCard content
 * (its section/lines/total/testids and the exclude ticks are the same), the
 * Sourcing tab embeds SupplierFeedCard. Only the ACTIVE tab mounts, so the
 * dock never stacks two cards. The panel is the single surface; the cards
 * inside are its tab bodies.
 *
 * Coexistence: as a dock companion alongside a tall mode panel (survey, sketch,
 * cad, garden) the Estimate tab defaults to the COMPACT running-estimate
 * summary — total + item count, one row, expand affordance — so the ambient
 * estimate never fights the active mode panel for the dock's capped height.
 * The panel only opens the full itemized card when it is the primary surface
 * (quote mode, `defaultCollapsed=false`).
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
}: EstimatorPanelProps) {
  const [tab, setTab] = useState<EstimatorTab>("estimate");

  // Contextual tabs: sourcing only makes sense when there is a live trade
  // feed to consult; the estimate tab is the home tab.
  const hasItems = (items?.length ?? 0) > 0;
  const tabs: Array<{ id: EstimatorTab; label: string }> = [
    { id: "estimate", label: "Estimate" },
    ...(hasItems ? [{ id: "sourcing" as const, label: "Sourcing" }] : []),
  ];

  // If the active tab stops being available (e.g. items deleted), fall back.
  useEffect(() => {
    if (tab === "sourcing" && !hasItems) setTab("estimate");
  }, [tab, hasItems]);

  // Inside the panel, the estimate should open expanded (the itemized card),
  // not as a collapsed pill — the panel IS the expanded surface. Preseed the
  // existing preference so FitSheetCard's capsule opens expanded here. When
  // the panel is a dock companion (defaultCollapsed), the estimate opens as
  // the compact running-estimate summary instead — it is ambient information
  // there, so the itemized card is always the user's on-demand choice and we
  // never seed the expanded preference.
  useEffect(() => {
    if (defaultCollapsed) return;
    try {
      window.localStorage.setItem("workstream.fitSheet.expanded", "1");
    } catch {
      /* private mode — ignore */
    }
  }, [defaultCollapsed]);

  if (!hasItems) return null;

  const title = signedOffLoading ? "Estimator" : signedOff ? "Quote" : "Estimator";
  const statusWord = signedOffLoading
    ? "…"
    : signedOff
      ? "Committed"
      : "Provisional";

  return (
    <section
      data-testid="estimator-panel"
      data-gs-glass-card
      aria-label={`${title} panel`}
      style={{
        position: "relative",
        pointerEvents: "auto",
        width: "min(360px, calc(100vw - 32px))",
        maxHeight: "min(640px, calc(100dvh - 200px))",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        borderRadius: "var(--gs-radius-panel)",
        background: "var(--gs-panel-grad)",
        border: "1px solid color-mix(in srgb, var(--gs-line) 55%, transparent)",
        boxShadow: "var(--gs-shadow-2)",
        padding: "10px 12px",
        gap: "var(--gs-space-3)",
        animation: "wsPanelIn 160ms cubic-bezier(0.22, 1, 0.36, 1)",
      }}
    >
      {/* Header — title + status + close */}
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
            color: "var(--gs-ink-secondary)",
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
            color: signedOff ? "var(--gs-ink-success, var(--gs-ink-secondary))" : "var(--gs-ink-muted)",
          }}
        >
          {statusWord}
        </span>
      </div>

      {/* Tabs */}
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

      {/* Active tab body — only the active one mounts (no stacked cards). */}
      <div
        role="tabpanel"
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          scrollbarWidth: "thin",
          gap: "var(--gs-space-3)",
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
          />
        ) : (
          <SupplierFeedCard />
        )}
      </div>
    </section>
  );
}
