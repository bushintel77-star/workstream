"use client";

import { useMemo } from "react";
import {
  calculateGST,
  calculateLineTotal,
  calculateSubtotal,
  calculateTotal,
  irrigationLineItems,
  summarizeIrrigationZones,
  summarizePlacementsForQuote,
  type CanvasGroundScale,
} from "@workstream/domain";
import type { CatalogPlacement, CatalogSymbol, IrrigationZone } from "@workstream/contracts";
import type { RateCardItem } from "../../lib/api";
import s from "./studioPanel.module.css";

type Props = {
  placements: CatalogPlacement[];
  irrigationZones: IrrigationZone[];
  symbols: CatalogSymbol[];
  rateCard: RateCardItem[];
  scale: CanvasGroundScale;
  onCopySchedule: (markdown: string) => void;
  onOpenOutputs: () => void;
  saving: boolean;
};

function aud(n: number): string {
  return n.toLocaleString("en-AU", { style: "currency", currency: "AUD" });
}

export function StudioSchedulePanel({
  placements,
  irrigationZones,
  symbols,
  rateCard,
  scale,
  onCopySchedule,
  onOpenOutputs,
  saving,
}: Props) {
  const rateMap = useMemo(
    () => new Map(rateCard.map((r) => [r.sku, r])),
    [rateCard],
  );

  const placementRows = useMemo(
    () => summarizePlacementsForQuote(placements, symbols),
    [placements, symbols],
  );

  const irrigSummary = useMemo(
    () => summarizeIrrigationZones(irrigationZones, scale),
    [irrigationZones, scale],
  );

  const irrigRows = useMemo(() => {
    const lookup = new Map(
      rateCard.map((r) => [r.sku, { label: r.label, unit: r.unit }]),
    );
    return irrigationLineItems(irrigSummary, lookup);
  }, [irrigSummary, rateCard]);

  const rows = useMemo(() => {
    const out: {
      label: string;
      qty: number;
      unit: string;
      sku: string;
      rate: number | null;
      lineTotal: number | null;
      missing: boolean;
    }[] = [];

    for (const row of placementRows) {
      const sku = row.rate_card_sku ?? "—";
      const rc = row.rate_card_sku ? rateMap.get(row.rate_card_sku) : undefined;
      const rate = rc?.rate ?? null;
      out.push({
        label: row.label,
        qty: row.count,
        unit: rc?.unit ?? "ea",
        sku,
        rate,
        lineTotal: rate != null ? calculateLineTotal(row.count, rate) : null,
        missing: Boolean(row.rate_card_sku && !rc),
      });
    }

    for (const row of irrigRows) {
      const rc = rateMap.get(row.sku);
      const rate = rc?.rate ?? null;
      out.push({
        label: row.label,
        qty: row.qty,
        unit: row.unit,
        sku: row.sku,
        rate,
        lineTotal: rate != null ? calculateLineTotal(row.qty, rate) : null,
        missing: !rc,
      });
    }

    return out.sort((a, b) => a.label.localeCompare(b.label));
  }, [placementRows, irrigRows, rateMap]);

  const subtotal = calculateSubtotal(
    rows.map((r) => r.lineTotal ?? 0).filter((t) => t > 0),
  );
  const gst = calculateGST(subtotal);
  const total = calculateTotal(subtotal, gst);

  function buildMarkdown(): string {
    const lines = ["| Asset | Qty | SKU | Line total |", "| --- | ---: | --- | ---: |"];
    for (const row of rows) {
      lines.push(
        `| ${row.label} | ${row.qty} | ${row.sku} | ${row.lineTotal != null ? aud(row.lineTotal) : "—"} |`,
      );
    }
    lines.push("", `Subtotal ex-GST: ${aud(subtotal)}`, `GST: ${aud(gst)}`, `Total inc-GST: ${aud(total)}`);
    return lines.join("\n");
  }

  return (
    <div className={`${s.panel} ${s.panelRail}`} data-testid="studio-schedule-panel">
      <h3 className={s.panelTitle}>Schedule</h3>
      <p className={s.panelHint}>
        Live preview from the plan — indicative only. Save before opening outputs.
      </p>
      {rows.length === 0 ? (
        <ol className={s.stepList}>
          <li>Place symbols from the asset library</li>
          <li>Draw irrigation zones or mass planting beds</li>
          <li>Line items and totals appear here automatically</li>
        </ol>
      ) : (
        <table className={s.scheduleTable}>
          <thead>
            <tr>
              <th>Asset</th>
              <th>Qty</th>
              <th>SKU</th>
              <th>Rate</th>
              <th>Line</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.sku}-${row.label}`}>
                <td>{row.label}</td>
                <td>
                  {row.qty} {row.unit}
                </td>
                <td data-testid={row.sku ? `schedule-sku-${row.sku}` : undefined}>
                  {row.sku}
                  {row.missing ? <span className={s.missingPill}> Missing rate</span> : null}
                </td>
                <td>{row.rate != null ? aud(row.rate) : "—"}</td>
                <td>{row.lineTotal != null ? aud(row.lineTotal) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {rows.length > 0 ? (
        <div className={s.totalCard}>
          <div className={s.totalCardRow}>
            <span>Subtotal ex-GST</span>
            <span>{aud(subtotal)}</span>
          </div>
          <div className={s.totalCardRow}>
            <span>GST</span>
            <span>{aud(gst)}</span>
          </div>
          <div className={`${s.totalCardRow} ${s.totalCardGrand}`}>
            <span>Total inc-GST</span>
            <span>{aud(total)}</span>
          </div>
        </div>
      ) : null}
      <div className={s.exportRow}>
        <button type="button" className={s.btn} onClick={() => onCopySchedule(buildMarkdown())}>
          Copy schedule
        </button>
        <button
          type="button"
          className={s.primaryBtn}
          disabled={saving}
          onClick={onOpenOutputs}
        >
          {saving ? "Saving…" : "Save & open outputs"}
        </button>
      </div>
    </div>
  );
}
