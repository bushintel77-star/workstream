"use client";

import type { BoardSustainabilityMetric } from "@workstream/contracts";
import type { StudioComplianceReport, StudioEstimateReport } from "@workstream/domain";
import type { StudioItem } from "../../studioCatalog";
import type { PctPoint } from "../../geometry";
import { ComplianceDock } from "../compliance/ComplianceDock";
import { LiveBomDock } from "../bom/LiveBomDock";
import { PermitTodosPanel } from "../permitTodos/PermitTodosPanel";
import { SustainabilityDock } from "../sustainability/SustainabilityDock";
import css from "./utilityDrawer.module.css";

export type UtilityPanel = "compliance" | "bom" | "sustainability" | null;

const PANEL_TITLE: Record<Exclude<UtilityPanel, null>, string> = {
  compliance: "Compliance",
  bom: "Live cost",
  sustainability: "Sustainability",
};

type Props = {
  openPanel: UtilityPanel;
  /** When true, only indicator tabs show — expands as a sheet overlay. */
  collapsed: boolean;
  outdoorM2: number;
  boundary: PctPoint[];
  items: StudioItem[];
  estimate: StudioEstimateReport;
  mitigated: Record<string, boolean>;
  complianceSignal?: "ok" | "watch" | "critical";
  compliancePass?: number;
  /** Council read for sidecar — replaces the old bottom-left ticker card. */
  councilSummary?: {
    permeablePct: number;
    canopyPct: number;
    setbackM: number;
  } | null;
  projectId?: string;
  projectAddress?: string;
  complianceReport?: StudioComplianceReport | null;
  /** Board sustainability read-out — omit when the report has not landed. */
  sustainability?: {
    metrics: BoardSustainabilityMetric[];
    measured: number;
    assessed: number;
  } | null;
  onOpenPanel: (panel: UtilityPanel) => void;
  onMitigate: (id: string) => void;
  onOpenQuote: () => void;
  onQuotePromoted?: () => void;
  /** Canvas-first: dismiss the whole summoned lane back to a quiet drawing. */
  onClose?: () => void;
  settling?: boolean;
};

/**
 * Right-hand utility hub — Compliance + Live BOM collapse to indicator tabs
 * so the drawing plane stays clear during Trace/Edit.
 */
export function UtilityDrawer({
  openPanel,
  collapsed,
  outdoorM2,
  boundary,
  items,
  estimate,
  mitigated,
  complianceSignal = "ok",
  compliancePass: passCount = 3,
  councilSummary = null,
  projectId,
  projectAddress = "",
  complianceReport = null,
  sustainability = null,
  onOpenPanel,
  onMitigate,
  onOpenQuote,
  onQuotePromoted,
  onClose,
  settling = false,
}: Props) {
  const compliancePass = {
    pass: passCount,
    total: 3,
    ok: complianceSignal === "ok",
  };

  const aud = new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(estimate.totalInclGst);

  const councilTip = councilSummary
    ? `${Math.round(councilSummary.permeablePct)}% perm · ${Math.round(councilSummary.canopyPct)}% canopy · ${councilSummary.setbackM.toFixed(1)} m rule`
    : "Compliance";

  return (
    <div
      className={css.hub}
      data-testid="utility-drawer"
      data-collapsed={collapsed ? "true" : "false"}
    >
      {onClose ? (
        <button
          type="button"
          className={css.hubDismiss}
          data-testid="utility-drawer-dismiss"
          aria-label="Hide data lane"
          title="Hide — quiet canvas"
          onClick={onClose}
        >
          ×
        </button>
      ) : null}
      <div className={css.tabs} role="tablist" aria-label="Operational feedback">
        <button
          type="button"
          role="tab"
          aria-selected={openPanel === "compliance"}
          className={`${css.tab}${openPanel === "compliance" ? ` ${css.tabActive}` : ""}`}
          data-testid="utility-tab-compliance"
          title={councilTip}
          onClick={() =>
            onOpenPanel(openPanel === "compliance" ? null : "compliance")
          }
        >
          <span
            className={`${css.shield}${compliancePass.ok ? ` ${css.shieldOk}` : ` ${css.shieldWarn}`}`}
            aria-hidden
          >
            {compliancePass.ok ? "✓" : "!"}
          </span>
          <span className={css.tabLabel}>
            {compliancePass.pass}/{compliancePass.total}
          </span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={openPanel === "bom"}
          className={`${css.tab}${openPanel === "bom" ? ` ${css.tabActive}` : ""}`}
          data-testid="utility-tab-bom"
          title="Live cost"
          onClick={() => onOpenPanel(openPanel === "bom" ? null : "bom")}
        >
          <span className={css.dollar} aria-hidden>
            $
          </span>
          <span className={css.tabLabel}>{aud}</span>
        </button>
        {/* Calm sidecar metric — only tabbed once the board report has landed. */}
        {sustainability && sustainability.metrics.length > 0 ? (
          <button
            type="button"
            role="tab"
            aria-selected={openPanel === "sustainability"}
            className={`${css.tab}${openPanel === "sustainability" ? ` ${css.tabActive}` : ""}`}
            data-testid="utility-tab-sustainability"
            title={`SITES v2 / UN SDG read-out — ${sustainability.measured} of ${sustainability.assessed} metrics measurable from this board`}
            onClick={() =>
              onOpenPanel(
                openPanel === "sustainability" ? null : "sustainability",
              )
            }
          >
            <span className={css.leaf} aria-hidden>
              ◇
            </span>
            <span className={css.tabLabel}>
              {sustainability.measured}/{sustainability.assessed}
            </span>
          </button>
        ) : null}
      </div>

      {openPanel ? (
        <div className={css.sheet} data-testid={`utility-sheet-${openPanel}`}>
          <div className={css.sheetHead}>
            <p className={css.sheetTitle}>{PANEL_TITLE[openPanel]}</p>
            <button
              type="button"
              className={css.sheetClose}
              aria-label="Close panel"
              onClick={() => onOpenPanel(null)}
            >
              ×
            </button>
          </div>
          <div className={css.sheetBody}>
            {openPanel === "compliance" ? (
              <>
                {councilSummary ? (
                  <p
                    className={css.councilSidecar}
                    data-testid="council-sidecar-metrics"
                  >
                    {councilTip}
                  </p>
                ) : null}
                <ComplianceDock
                  outdoorM2={outdoorM2}
                  boundary={boundary}
                  items={items}
                  embedded
                />
                {projectId && complianceReport ? (
                  <PermitTodosPanel
                    projectId={projectId}
                    address={projectAddress}
                    outdoorM2={outdoorM2}
                    items={items}
                    compliance={complianceReport}
                    embedded
                  />
                ) : null}
              </>
            ) : openPanel === "sustainability" ? (
              <SustainabilityDock
                metrics={sustainability?.metrics ?? []}
                measured={sustainability?.measured ?? 0}
                assessed={sustainability?.assessed ?? 0}
                embedded
              />
            ) : (
              <LiveBomDock
                projectId={projectId}
                estimate={estimate}
                mitigated={mitigated}
                onMitigate={onMitigate}
                onOpenQuote={onOpenQuote}
                onQuotePromoted={onQuotePromoted}
                settling={settling}
                embedded
              />
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
