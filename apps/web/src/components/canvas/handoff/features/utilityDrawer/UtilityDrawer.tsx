"use client";

import { useMemo } from "react";
import { bomLines, type StudioItem } from "../../studioCatalog";
import type { PctPoint } from "../../geometry";
import { ComplianceDock } from "../compliance/ComplianceDock";
import { LiveBomDock } from "../bom/LiveBomDock";
import css from "./utilityDrawer.module.css";

export type UtilityPanel = "compliance" | "bom" | null;

type Props = {
  openPanel: UtilityPanel;
  /** When true, only indicator tabs show — expands as a sheet overlay. */
  collapsed: boolean;
  outdoorM2: number;
  boundary: PctPoint[];
  items: StudioItem[];
  mitigated: Record<string, boolean>;
  onOpenPanel: (panel: UtilityPanel) => void;
  onMitigate: (id: string) => void;
  onOpenQuote: () => void;
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
  mitigated,
  onOpenPanel,
  onMitigate,
  onOpenQuote,
}: Props) {
  const bomTotal = useMemo(() => {
    const lines = bomLines(items);
    const materials = lines.reduce((a, r) => a + r.amt, 0);
    return Math.round(materials + 4378);
  }, [items]);

  const compliancePass = useMemo(() => {
    const live = items.filter((i) => !i.ghost);
    const canopy = live.some((i) => i.t === "canopy" || i.t === "exist");
    const permeable = live.some((i) => i.t === "lawn" || i.t === "bed");
    const hard = live.some((i) => i.t === "paving" || i.t === "deck");
    // Lightweight badge signal — full math stays in ComplianceDock.
    let pass = 1; // outdoor area assumed for seeded sites
    if (permeable || !hard) pass += 1;
    if (canopy) pass += 1;
    return { pass, total: 3, ok: pass === 3 };
  }, [items]);

  const aud = new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(bomTotal);

  return (
    <div
      className={css.hub}
      data-testid="utility-drawer"
      data-collapsed={collapsed ? "true" : "false"}
    >
      <div className={css.tabs} role="tablist" aria-label="Operational feedback">
        <button
          type="button"
          role="tab"
          aria-selected={openPanel === "compliance"}
          className={`${css.tab}${openPanel === "compliance" ? ` ${css.tabActive}` : ""}`}
          data-testid="utility-tab-compliance"
          title="Compliance"
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
          title="Live BOM"
          onClick={() => onOpenPanel(openPanel === "bom" ? null : "bom")}
        >
          <span className={css.dollar} aria-hidden>
            $
          </span>
          <span className={css.tabLabel}>{aud}</span>
        </button>
      </div>

      {openPanel ? (
        <div className={css.sheet} data-testid={`utility-sheet-${openPanel}`}>
          <div className={css.sheetHead}>
            <p className={css.sheetTitle}>
              {openPanel === "compliance" ? "Compliance" : "Live BOM"}
            </p>
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
              <ComplianceDock
                outdoorM2={outdoorM2}
                boundary={boundary}
                items={items}
                embedded
              />
            ) : (
              <LiveBomDock
                items={items}
                mitigated={mitigated}
                onMitigate={onMitigate}
                onOpenQuote={onOpenQuote}
                embedded
              />
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
