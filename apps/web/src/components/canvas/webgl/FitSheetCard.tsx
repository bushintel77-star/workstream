"use client";

/**
 * Gold Standard 2026 — Fit-Sheet Card (live itemized quotation + stock pulse).
 *
 * The Gap 5 Phase-3 instrument: an itemized quotation GlassCard live-synced
 * to the canvas. Everything derives client-side from geometry the studio
 * already holds — `useStudioEstimate` (sync seed + Web Worker settle) prices
 * the drawing, `solveLiveTradeEstimate` matches hub offers for the material
 * stock pulse, and `summarizeFitSheet` (fitSheet.ts) groups it all into
 * quote sections. No fetch: edits to items/trenches/zones recompute the
 * sheet on the next frame.
 *
 * Layout follows the Stitch part-2 "Itemized Quotation" reference: top lines
 * with qty × rate + stock chips (IN STOCK / LOW STOCK / AI EST), section
 * subtotals, summary block (Subtotal / GST / Total incl GST), site stats,
 * gold procurement alert when a matched hub offer is out of stock, and the
 * standard honesty footer. All --gs-* tokens; Space Grotesk for figures.
 *
 * Binding: docs/GOLD-STANDARD-2026.md §3 Phase 3 (Itemized Fit-Sheet)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { solveLiveTradeEstimate } from "@workstream/domain";
import { GlassCard } from "./GlassCard";
import { useStudioStore } from "./studioStore";
import { useStudioEstimate } from "../../../lib/use-studio-estimate";
import type { RenderItem } from "./sceneItems";
import type { PctPoint } from "./coordTransform";
import type {
  ConstructionTrench,
  IrrigationZone,
} from "@workstream/contracts";
import { buildEstimateArgsFromStudio, summarizeFitSheet, fmtAud } from "./fitSheet";

const labelStyle: React.CSSProperties = {
  fontSize: 10.5,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--gs-ink-secondary)",
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  gap: 6,
  borderBottom: "1px solid var(--gs-line)",
  paddingBottom: 3,
  marginBottom: 3,
};

const figureStyle: React.CSSProperties = {
  fontFamily: "var(--font-tech)",
  fontSize: 10,
  color: "var(--gs-ink)",
  whiteSpace: "nowrap",
};

function StockChip({ inStock, mode }: { inStock: boolean; mode: string }) {
  const text = mode !== "live_matched" ? "AI EST" : inStock ? "IN STOCK" : "LOW STOCK";
  const color =
    mode !== "live_matched"
      ? "var(--gs-ink-secondary)"
      : inStock
        ? "var(--gs-ink-truth)"
        : "var(--gs-primary)";
  return (
    <span
      data-testid="fit-sheet-stock-chip"
      style={{
        fontFamily: "var(--font-tech)",
        fontSize: 9.5,
        fontWeight: 600,
        letterSpacing: "0.05em",
        color,
        border: `1px solid color-mix(in srgb, ${color} 35%, transparent)`,
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
        borderRadius: 999,
        padding: "0px 5px",
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );
}

export interface FitSheetCardProps {
  items: RenderItem[];
  boundaryPct: PctPoint[];
  constructionTrenches: ConstructionTrench[];
  irrigationZones: IrrigationZone[];
  scaleM: number;
  outdoorM2: number;
  /** For the backend sketch-cost fetch (one visible source of truth). */
  projectId: string;
}

export function FitSheetCard({
  items,
  boundaryPct,
  constructionTrenches,
  irrigationZones,
  scaleM,
  outdoorM2,
  projectId,
}: FitSheetCardProps) {
  const fitSheetOpen = useStudioStore((s) => s.fitSheetOpen);

  const args = useMemo(
    () =>
      buildEstimateArgsFromStudio({
        items,
        boundaryPct,
        constructionTrenches,
        irrigationZones,
        scaleM,
        outdoorM2,
      }),
    [items, boundaryPct, constructionTrenches, irrigationZones, scaleM, outdoorM2],
  );

  const { estimate, settling } = useStudioEstimate(args);

  const summary = useMemo(() => {
    if (estimate.lines.length === 0) return null;
    const telemetry = solveLiveTradeEstimate({ report: estimate });
    return summarizeFitSheet(estimate, telemetry);
  }, [estimate]);

  // Backend instant estimate (POST /costing/sketch) — prices the SAVED
  // canvas, fetched once when the card opens + on manual refresh. Drift vs
  // the client-side parametric total is shown so the two paths can't silently
  // diverge. The attempt-once ref matters: a failed fetch returns null, and a
  // null-check gate would refire the effect forever (each fire is a POST
  // that also writes a costing row).
  const [backendTotal, setBackendTotal] = useState<number | null>(null);
  const [backendBusy, setBackendBusy] = useState(false);
  const attemptedRef = useRef(false);
  const runBackendFetch = useCallback(async () => {
    if (!projectId) return;
    setBackendBusy(true);
    try {
      const { fetchSketchEstimateAction } = await import("../../../app/actions");
      const res = await fetchSketchEstimateAction(projectId);
      setBackendTotal(res?.costing?.total ?? null);
    } finally {
      setBackendBusy(false);
    }
  }, [projectId]);
  useEffect(() => {
    if (!fitSheetOpen || attemptedRef.current) return;
    attemptedRef.current = true;
    void runBackendFetch();
  }, [fitSheetOpen, runBackendFetch]);

  const driftPct =
    backendTotal != null && backendTotal > 0 && summary
      ? (summary.total / backendTotal - 1) * 100
      : null;

  if (!fitSheetOpen || items.length === 0 || !summary) return null;

  return (
    <GlassCard
      // Relative — a child of the top-right HUD column in WebGLStudioPreview.
      position={{ position: "relative" }}
      style={{ width: 272, padding: "8px 10px" }}
    >
      <div
        data-testid="fit-sheet-card"
        style={{ fontFamily: "var(--font-ui)", color: "var(--gs-ink)" }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 8,
          }}
        >
          <span style={labelStyle}>Itemized Quotation</span>
            {settling && (
            <span
              data-testid="fit-sheet-settling"
              style={{
                fontFamily: "var(--font-tech)",
                fontSize: 9.5,
                color: "var(--gs-primary)",
              }}
            >
              ● pricing…
            </span>
          )}
        </div>

        {/* Top itemized lines */}
        <div data-testid="fit-sheet-lines">
          {summary.topLines.map(({ line, section }) => {
            const stock = summary.stockLines.find(
              (s) => s.estimateLineId === line.id,
            );
            return (
              <div key={line.id} style={rowStyle}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--gs-ink)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={line.label}
                  >
                    {line.label}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--gs-ink-secondary)" }}>
                    {section} · {line.qty.toFixed(1)} {line.unit} @ {fmtAud(line.rate)}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {stock && <StockChip inStock={stock.inStock} mode={stock.mode} />}
                  <span style={figureStyle}>{fmtAud(line.total)}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Section subtotals */}
        <div
          data-testid="fit-sheet-sections"
          style={{ display: "flex", flexWrap: "wrap", gap: 4, margin: "6px 0 8px" }}
        >
          {summary.sections.map((s) => (
            <span
              key={s.id}
              title={`${s.lines.length} lines`}
              style={{
                fontSize: 10,
                fontFamily: "var(--font-tech)",
                color: "var(--gs-ink-secondary)",
                border: "1px solid var(--gs-line)",
                borderRadius: 6,
                padding: "2px 6px",
              }}
            >
              {s.label} {fmtAud(s.subtotal)}
            </span>
          ))}
        </div>

        {/* Summary block */}
        <div style={rowStyle}>
          <span style={labelStyle}>Subtotal ex GST</span>
          <span style={figureStyle}>{fmtAud(summary.subtotal)}</span>
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>GST 10%</span>
          <span style={figureStyle}>{fmtAud(summary.gst)}</span>
        </div>
        <div
          data-testid="fit-sheet-total"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginTop: 4,
          }}
        >
          <span style={{ ...labelStyle, color: "var(--gs-ink)" }}>Total incl GST</span>
          <span
            style={{
              fontFamily: "var(--font-tech)",
              fontSize: 16,
              fontWeight: 600,
              color: "var(--gs-primary)",
            }}
          >
            {fmtAud(summary.total)}
          </span>
        </div>

        {/* Backend sketch estimate — one visible source of truth (the saved
            canvas is priced server-side; refresh re-prices after autosave). */}
        <div
          data-testid="fit-sheet-backend"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 6,
            marginTop: 3,
          }}
          title="Backend instant estimate of the saved canvas (POST /costing/sketch)"
        >
          <span style={labelStyle}>Backend estimate</span>
          <span style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            {driftPct != null && Math.abs(driftPct) > 2 ? (
              <span
                data-testid="fit-sheet-drift"
                style={{
                  fontFamily: "var(--font-tech)",
                  fontSize: 10,
                  padding: "1px 5px",
                  borderRadius: 999,
                  color:
                    Math.abs(driftPct) > 10
                      ? "var(--gs-warning)"
                      : "var(--gs-ink-truth)",
                  border: `1px solid color-mix(in srgb, ${
                    Math.abs(driftPct) > 10
                      ? "var(--gs-warning)"
                      : "var(--gs-ink-truth)"
                  } 45%, transparent)`,
                }}
              >
                {driftPct > 0 ? "+" : "−"}
                {Math.abs(driftPct).toFixed(0)}% studio vs backend
              </span>
            ) : null}
            <span style={{ ...figureStyle, color: "var(--gs-ink-secondary)" }}>
              {backendBusy
                ? "…"
                : backendTotal != null
                  ? fmtAud(backendTotal)
                  : "—"}
            </span>
            <button
              type="button"
              aria-label="Refresh backend estimate"
              title="Re-price the saved canvas"
              onClick={() => void runBackendFetch()}
              disabled={backendBusy}
              style={{
                all: "unset",
                cursor: backendBusy ? "wait" : "pointer",
                fontFamily: "var(--font-tech)",
                fontSize: 11,
                color: "var(--gs-ink-secondary)",
                padding: "0 2px",
              }}
            >
              ⟳
            </button>
          </span>
        </div>

        {/* Site stats */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 5,
            fontFamily: "var(--font-tech)",
            fontSize: 10,
            color: "var(--gs-ink-secondary)",
          }}
        >
          <span>{summary.stats.hardscapeM2.toFixed(0)} m² hardscape</span>
          <span>{summary.stats.excavateM3.toFixed(1)} m³ excavate</span>
          <span>{summary.stats.tipperLoads} tippers</span>
        </div>

        {/* Procurement alert — gold left-rule chip (Stitch part-2 idiom) */}
        {summary.procurementAlert && (
          <div
            data-testid="fit-sheet-alert"
            style={{
              marginTop: 5,
              padding: "6px 8px 6px 10px",
              borderLeft: "2px solid var(--gs-primary)",
              background: "color-mix(in srgb, var(--gs-primary) 10%, transparent)",
              borderRadius: "0 6px 6px 0",
              fontSize: 10,
              color: "var(--gs-ink)",
              lineHeight: 1.4,
            }}
          >
            {summary.procurementAlert}
          </div>
        )}

        {/* Honesty footer */}
        <div
          style={{
            marginTop: 5,
            fontSize: 10,
            color: "var(--gs-ink-secondary)",
            letterSpacing: "0.04em",
          }}
        >
          Indicative — confirm before tender
        </div>
      </div>
    </GlassCard>
  );
}
