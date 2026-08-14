"use client";

/**
 * Sketch Pad — corner metadata chips (context-aware).
 *
 * The chips pivot their math based on the active view plane:
 *   - Plan mode: horizontal metrics — area (m²) + perimeter (m) + cost bracket
 *   - Elevation mode: vertical metrics — height (m) + ground-to-top clearance (m)
 *
 * The same corner positions, the same glass styling — only the numbers + labels
 * change. No properties panel needed.
 */

import type { CSSProperties } from "react";
import type { SketchTool, SketchView } from "./sketchHelpers";
import { formatCostBracket } from "./sketchHelpers";

export interface SketchChipsProps {
  view: SketchView;
  /** Plan-mode live estimate (area/cost) — null until ≥3 points drawn. */
  liveEstimate: { areaM2: number; costLow: number; costHigh: number } | null;
  /** Plan-mode perimeter for the live stroke. */
  livePerimeterM: number | null;
  /** Elevation-mode live height — null until ≥2 points drawn. */
  liveHeight: { heightM: number; groundToTopM: number } | null;
  strokeCount: number;
  activeTool: SketchTool;
}

const chipBase: CSSProperties = {
  background: "color-mix(in srgb, var(--gs-glass) 70%, transparent)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  borderRadius: 12,
  border: "1px solid color-mix(in srgb, var(--gs-line) 50%, transparent)",
  padding: "10px 16px",
  fontFamily: "var(--font-tech)",
  zIndex: 10,
  pointerEvents: "none",
};

const labelStyle: CSSProperties = {
  fontFamily: "var(--font-ui)",
  fontSize: 10,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--gs-ink-secondary)",
  marginBottom: 4,
};

const valueStyle: CSSProperties = {
  fontSize: 18,
  fontWeight: 500,
  color: "var(--gs-primary)",
  fontVariantNumeric: "tabular-nums",
};

const metaStyle: CSSProperties = {
  fontSize: 12,
  color: "var(--gs-ink-secondary)",
  marginTop: 2,
  fontVariantNumeric: "tabular-nums",
};

export function SketchChips({
  view,
  liveEstimate,
  livePerimeterM,
  liveHeight,
  strokeCount,
  activeTool,
}: SketchChipsProps) {
  const isPlan = view === "plan";
  const hasData = isPlan ? liveEstimate : liveHeight;

  return (
    <>
      {/* Top-right — context-aware primary metric */}
      <div
        data-testid="sketch-area-chip"
        style={{
          ...chipBase,
          position: "fixed",
          top: 16,
          right: 16,
          textAlign: "right",
          borderColor: hasData
            ? "color-mix(in srgb, var(--gs-primary) 40%, transparent)"
            : undefined,
        }}
      >
        <div style={labelStyle}>
          {isPlan ? "Boundary Estimate" : "Vertical Height"}
        </div>
        {isPlan ? (
          liveEstimate ? (
            <>
              <div style={valueStyle}>{liveEstimate.areaM2} m²</div>
              <div style={metaStyle}>
                {livePerimeterM != null && `${livePerimeterM}m perimeter · `}
                {formatCostBracket(liveEstimate.costLow, liveEstimate.costHigh)}
              </div>
            </>
          ) : (
            <div style={{ ...metaStyle, color: "var(--gs-ink-muted)" }}>
              Draw a closed boundary…
            </div>
          )
        ) : liveHeight ? (
          <>
            <div style={valueStyle}>{liveHeight.heightM} m</div>
            <div style={metaStyle}>
              Clearance: {liveHeight.groundToTopM}m to top
            </div>
          </>
        ) : (
          <div style={{ ...metaStyle, color: "var(--gs-ink-muted)" }}>
            Draw a vertical line…
          </div>
        )}
      </div>

      {/* Bottom-right — stroke count + active tool + view */}
      <div
        data-testid="sketch-meta-chip"
        style={{
          ...chipBase,
          position: "fixed",
          bottom: 16,
          right: 16,
          textAlign: "right",
        }}
      >
        <div style={labelStyle}>Sketch</div>
        <div style={metaStyle}>
          {strokeCount} stroke{strokeCount === 1 ? "" : "s"} ·{" "}
          <span style={{ color: "var(--gs-ink)", textTransform: "capitalize" }}>
            {activeTool}
          </span>{" "}
          · <span style={{ color: "var(--gs-truth-ink)" }}>{view}</span>
        </div>
      </div>
    </>
  );
}
