"use client";

/**
 * Gold Standard 2026 — Fit-Sheet Card as a floating glass capsule.
 *
 * Previously a docked right-edge sidebar (FitSheetCard width=272px,
 * position: relative) that ate the canvas's right margin. Now an
 * un-docked floating capsule anchored to the right margin via
 * `position: fixed` so the canvas keeps its full edge-to-edge width.
 *
 * Display modes:
 *   PILL (collapsible)      — minimal "[ 🧾 Live Quote: $3,294.39 ]"
 *                             off the right margin. Click expands.
 *   CAPSULE (expanded)      — full itemized content rendered inside
 *                             a glass surface, with a close affordance
 *                             that collapses back to pill. Esc also
 *                             closes.
 *
 * Persistence: the user's last choice is saved to localStorage so the
 * capsule stays in the same shape across sessions.
 *
 * Z-stack (Canvas-First):
 *   chrome tier (--cf-z-chrome) — sits below the canvas-mode panels
 *   (--cf-z-app) and the assembly tools. Never above a mode panel.
 *
 * Binding: docs/GOLD-STANDARD-2026.md §3 Phase 3 (Itemized Fit-Sheet).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  sectionForEstimateTier,
  solveLiveTradeEstimate,
  type StudioEstimateLine,
} from "@workstream/domain";
import { Button } from "./Button";
import { useStudioStore } from "./studioStore";
import { useStudioEstimate } from "../../../lib/use-studio-estimate";
import type { RenderItem } from "./sceneItems";
import type { PctPoint } from "./coordTransform";
import type {
  ConstructionTrench,
  IrrigationZone,
} from "@workstream/contracts";
import {
  buildEstimateArgsFromStudio,
  excludeEstimateLines,
  summarizeFitSheet,
  fmtAud,
} from "./fitSheet";

const labelStyle: React.CSSProperties = {
  fontSize: "var(--gs-font-xs)",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--gs-ink-secondary)",
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  gap: "var(--gs-space-3)",
  borderBottom: "1px solid var(--gs-line)",
  paddingBottom: 3,
  marginBottom: 3,
};

const figureStyle: React.CSSProperties = {
  fontFamily: "var(--font-tech)",
  fontSize: "var(--gs-font-xs)",
  color: "var(--gs-ink)",
  whiteSpace: "nowrap",
};

/** Tiny per-line tick — checked = included in the quote. */
const tickStyle: React.CSSProperties = {
  all: "unset",
  cursor: "pointer",
  fontFamily: "var(--font-tech)",
  fontSize: "var(--gs-font-sm)",
  color: "var(--gs-ink-truth)",
  width: 16,
  textAlign: "center",
  flex: "0 0 auto",
};

const STORAGE_KEY = "workstream.fitSheet.expanded";

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
        fontSize: "var(--gs-font-xs)",
        fontWeight: 600,
        letterSpacing: "0.05em",
        color,
        border: `1px solid color-mix(in srgb, ${color} 35%, transparent)`,
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
        borderRadius: "var(--gs-radius-pill)",
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
  const excludedEstimateLineIds = useStudioStore(
    (s) => s.excludedEstimateLineIds,
  );
  const toggleEstimateLineExcluded = useStudioStore(
    (s) => s.toggleEstimateLineExcluded,
  );
  const excludedSet = useMemo(
    () => new Set(excludedEstimateLineIds),
    [excludedEstimateLineIds],
  );

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

  const excludedLines = useMemo(
    () =>
      excludedSet.size === 0
        ? []
        : estimate.lines.filter((l) => excludedSet.has(l.id)),
    [estimate, excludedSet],
  );
  const filteredEstimate = useMemo(
    () => excludeEstimateLines(estimate, excludedSet),
    [estimate, excludedSet],
  );

  const summary = useMemo(() => {
    if (filteredEstimate.lines.length === 0) return null;
    const telemetry = solveLiveTradeEstimate({ report: filteredEstimate });
    return summarizeFitSheet(filteredEstimate, telemetry);
  }, [filteredEstimate]);

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
    <FitSheetCapsule
      summary={summary}
      excludedLines={excludedLines}
      settling={settling}
      toggleEstimateLineExcluded={toggleEstimateLineExcluded}
      backendTotal={backendTotal}
      backendBusy={backendBusy}
      runBackendFetch={runBackendFetch}
      driftPct={driftPct}
    />
  );
}

/**
 * Floating glass capsule — pill (default off first open) or expanded.
 * Persists expanded/collapsed preference in localStorage.
 *
 * `pointer-events: none` on the outer wrapper so the canvas keeps full
 * event coverage; the surface opt back in via `pointer-events: auto`.
 */
function FitSheetCapsule({
  summary,
  excludedLines,
  settling,
  toggleEstimateLineExcluded,
  backendTotal,
  backendBusy,
  runBackendFetch,
  driftPct,
}: {
  summary: {
    sections: Array<{
      id: string;
      label: string;
      subtotal: number;
      lines: StudioEstimateLine[];
    }>;
    stockLines: Array<{
      estimateLineId: string;
      inStock: boolean;
      mode: string;
    }>;
    subtotal: number;
    gst: number;
    total: number;
    stats: { hardscapeM2: number; excavateM3: number; tipperLoads: number };
    procurementAlert: string | null;
  };
  excludedLines: Array<{
    id: string;
    label: string;
    total: number;
  }>;
  settling: boolean;
  toggleEstimateLineExcluded: (lineId: string) => void;
  backendTotal: number | null;
  backendBusy: boolean;
  runBackendFetch: () => Promise<void>;
  driftPct: number | null;
}) {
  const [expanded, setExpanded] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, expanded ? "1" : "0");
    } catch {
      /* private-mode etc — ignore */
    }
  }, [expanded]);

  // Esc collapses. Document-level handler so it fires regardless of which
  // capsule sub-element has focus.
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [expanded]);

  const outerStyle: React.CSSProperties = {
    position: "fixed",
    right: 16,
    bottom: 16,
    zIndex: "var(--cf-z-chrome)",
    pointerEvents: "none",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: "var(--gs-space-2)",
    transition: "opacity var(--gs-base)",
  };

  const surfaceStyle: React.CSSProperties = {
    pointerEvents: "auto",
    background: "var(--gs-glass-veil)",
    backdropFilter: "blur(var(--gs-blur))",
    WebkitBackdropFilter: "blur(var(--gs-blur))",
    border: "1px solid color-mix(in srgb, var(--gs-line) 55%, transparent)",
    boxShadow: "var(--gs-shadow-2)",
    color: "var(--gs-ink)",
    fontFamily: "var(--font-ui)",
    overflow: "hidden",
  };

  if (!expanded) {
    return (
      <div style={outerStyle}>
        <button
          type="button"
          aria-label={`Open live quote, total ${fmtAud(summary.total)}`}
          aria-expanded={false}
          data-testid="fit-sheet-pill"
          onClick={() => setExpanded(true)}
          style={{
            ...surfaceStyle,
            padding: "var(--gs-space-3) var(--gs-space-6)",
            borderRadius: "var(--gs-radius-pill)",
            display: "inline-flex",
            alignItems: "baseline",
            gap: "var(--gs-space-3)",
            cursor: "pointer",
            transition: "transform var(--gs-fast), box-shadow var(--gs-fast)",
            fontSize: "var(--gs-font-sm)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-1px)";
            e.currentTarget.style.boxShadow = "var(--gs-shadow-3)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "var(--gs-shadow-2)";
          }}
        >
          <span aria-hidden style={{ fontSize: "var(--gs-font-md)" }}>
            🧾
          </span>
          <span style={labelStyle}>Live Quote</span>
          <span
            data-testid="fit-sheet-pill-total"
            style={{
              fontFamily: "var(--font-tech)",
              fontSize: "var(--gs-font-h3)",
              fontWeight: 600,
              color: "var(--gs-primary)",
              letterSpacing: "0.01em",
            }}
          >
            {fmtAud(summary.total)}
          </span>
          {settling && (
            <span
              data-testid="fit-sheet-settling"
              style={{
                fontFamily: "var(--font-tech)",
                fontSize: "var(--gs-font-xs)",
                color: "var(--gs-primary)",
              }}
            >
              ● pricing
            </span>
          )}
          {excludedLines.length > 0 && (
            <span
              title={`${excludedLines.length} line${
                excludedLines.length === 1 ? "" : "s"
              } excluded from quote`}
              style={{
                fontFamily: "var(--font-tech)",
                fontSize: "var(--gs-font-xs)",
                color: "var(--gs-ink-muted)",
                background:
                  "color-mix(in srgb, var(--gs-warning) 18%, transparent)",
                border:
                  "1px solid color-mix(in srgb, var(--gs-warning) 35%, transparent)",
                borderRadius: "var(--gs-radius-pill)",
                padding: "1px 6px",
              }}
            >
              −{excludedLines.length}
            </span>
          )}
        </button>
      </div>
    );
  }

  // Expanded: full body inside a glass panel.
  return (
    <div style={outerStyle}>
      <div
        role="dialog"
        aria-label={`Itemized quotation, total ${fmtAud(summary.total)}`}
        data-testid="fit-sheet-card"
        style={{
          ...surfaceStyle,
          width: 320,
          maxWidth: "calc(100vw - 32px)",
          maxHeight: "min(calc(100dvh - 96px), 600px)",
          borderRadius: "var(--gs-radius-panel)",
          padding: "10px 12px",
          display: "flex",
          flexDirection: "column",
          gap: "var(--gs-space-3)",
          animation: "wsPanelIn 160ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
          }}
        >
          <span style={labelStyle}>Itemized Quotation</span>
          <Button
            variant="icon"
            aria-label="Collapse quotation back to summary pill"
            onClick={() => setExpanded(false)}
          >
            ×
          </Button>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--gs-space-3)",
            overflowY: "auto",
            flex: 1,
            minHeight: 0,
          }}
        >
          {/* Itemized lines */}
          <div data-testid="fit-sheet-lines">
            {[...summary.sections.flatMap((s) => s.lines)]
              .sort((a, b) => b.total - a.total)
              .map((line) => {
                const stock = summary.stockLines.find(
                  (s) => s.estimateLineId === line.id,
                );
                const section = sectionForEstimateTier(line.tier, line.label);
                return (
                  <div key={line.id} style={rowStyle}>
                    <button
                      type="button"
                      aria-pressed="true"
                      aria-label={`Exclude ${line.label} from quote`}
                      data-testid={`fit-line-tick-${line.id}`}
                      onClick={() => toggleEstimateLineExcluded(line.id)}
                      style={tickStyle}
                    >
                      ✓
                    </button>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          fontSize: "var(--gs-font-sm)",
                          color: "var(--gs-ink)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={line.label}
                      >
                        {line.label}
                      </div>
                      <div
                        style={{
                          fontSize: "var(--gs-font-xs)",
                          color: "var(--gs-ink-secondary)",
                        }}
                      >
                        {section} · {line.qty.toFixed(1)} {line.unit} @{" "}
                        {fmtAud(line.rate)}
                      </div>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--gs-space-3)",
                      }}
                    >
                      {stock && (
                        <StockChip inStock={stock.inStock} mode={stock.mode} />
                      )}
                      <span style={figureStyle}>{fmtAud(line.total)}</span>
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Section subtotals */}
          <div
            data-testid="fit-sheet-sections"
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "var(--gs-space-2)",
            }}
          >
            {summary.sections.map((s) => (
              <span
                key={s.id}
                title={`${s.lines.length} lines`}
                style={{
                  fontSize: "var(--gs-font-xs)",
                  fontFamily: "var(--font-tech)",
                  color: "var(--gs-ink-secondary)",
                  border: "1px solid var(--gs-line)",
                  borderRadius: "var(--gs-radius-md)",
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
            }}
          >
            <span style={{ ...labelStyle, color: "var(--gs-ink)" }}>
              Total incl GST
            </span>
            <span
              style={{
                fontFamily: "var(--font-tech)",
                fontSize: "var(--gs-font-h2)",
                fontWeight: 600,
                color: "var(--gs-primary)",
              }}
            >
              {fmtAud(summary.total)}
            </span>
          </div>

          {/* Excluded lines */}
          {excludedLines.length > 0 && (
            <div
              data-testid="fit-sheet-excluded"
              style={{
                borderTop: "1px dashed var(--gs-line)",
                paddingTop: 4,
              }}
            >
              <div style={labelStyle}>
                Excluded from quote ({excludedLines.length})
              </div>
              {excludedLines.map((line) => (
                <div
                  key={line.id}
                  data-testid={`fit-line-excluded-${line.id}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--gs-space-3)",
                    padding: "2px 0",
                  }}
                >
                  <button
                    type="button"
                    aria-pressed="false"
                    aria-label={`Include ${line.label} in quote`}
                    data-testid={`fit-line-tick-${line.id}`}
                    onClick={() => toggleEstimateLineExcluded(line.id)}
                    style={{ ...tickStyle, color: "var(--gs-ink-muted)" }}
                  >
                    ◌
                  </button>
                  <span
                    style={{
                      fontSize: "var(--gs-font-xs)",
                      color: "var(--gs-ink-muted)",
                      textDecoration: "line-through",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      flex: 1,
                      minWidth: 0,
                    }}
                    title={line.label}
                  >
                    {line.label}
                  </span>
                  <span style={{ ...figureStyle, color: "var(--gs-ink-muted)" }}>
                    {fmtAud(line.total)}
                  </span>
                  <span
                    style={{
                      fontSize: "var(--gs-font-xs)",
                      color: "var(--gs-ink-muted)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    not in quote
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Backend estimate */}
          <div
            data-testid="fit-sheet-backend"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              gap: "var(--gs-space-3)",
            }}
            title="Backend instant estimate of the saved canvas (POST /costing/sketch)"
          >
            <span style={labelStyle}>Backend estimate</span>
            <span
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: "var(--gs-space-3)",
              }}
            >
              {driftPct != null && Math.abs(driftPct) > 2 ? (
                <span
                  data-testid="fit-sheet-drift"
                  style={{
                    fontFamily: "var(--font-tech)",
                    fontSize: "var(--gs-font-xs)",
                    padding: "1px 5px",
                    borderRadius: "var(--gs-radius-pill)",
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
                  fontSize: "var(--gs-font-sm)",
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
              fontFamily: "var(--font-tech)",
              fontSize: "var(--gs-font-xs)",
              color: "var(--gs-ink-secondary)",
            }}
          >
            <span>{summary.stats.hardscapeM2.toFixed(0)} m² hardscape</span>
            <span>{summary.stats.excavateM3.toFixed(1)} m³ excavate</span>
            <span>{summary.stats.tipperLoads} tippers</span>
          </div>

          {/* Procurement alert */}
          {summary.procurementAlert && (
            <div
              data-testid="fit-sheet-alert"
              style={{
                padding: "var(--gs-space-3) var(--gs-space-4) var(--gs-space-3) var(--gs-space-6)",
                borderLeft: "2px solid var(--gs-primary)",
                background:
                  "color-mix(in srgb, var(--gs-primary) 10%, transparent)",
                borderRadius: "0 6px 6px 0",
                fontSize: "var(--gs-font-xs)",
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
              fontSize: "var(--gs-font-xs)",
              color: "var(--gs-ink-secondary)",
              letterSpacing: "0.04em",
            }}
          >
            Indicative — confirm before tender
          </div>
        </div>
      </div>
    </div>
  );
}
