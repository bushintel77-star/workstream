"use client";

/**
 * Gold Standard 2026 — Drainage Flow Card (DOM telemetry panel).
 *
 * The HUD half of the drainage instrument (DrainageFlowLayer renders the
 * streams/ponds in the scene). Glass telemetry rows in the Stitch phase-2.2
 * "Hydrological Pulse" idiom: muted label / Space Grotesk value / hairline
 * divider, a ponding list, hydraulic circuit telemetry (Σ GPM + max kPa —
 * the previously-computed-and-discarded Hazen-Williams results), and a
 * free-draining/ponding status chip.
 *
 * Reads drainageView from the store (DOM-subscribed) and recomputes the SAME
 * flowField derivation the layer renders — pure functions, so the numbers on
 * screen always match the streams on the terrain.
 *
 * Binding: docs/GOLD-STANDARD-2026.md §3 Phase 2 (Vertical Truth consumers)
 */

import { useMemo } from "react";
import type { HydraulicResult } from "@workstream/domain";
import { useStudioStore } from "./studioStore";
import type { HeightmapPoint } from "./coordTransform";
import { createElevationSampler, VERTICAL_SCALE } from "./terrainMath";
import { InstrumentCard } from "./InstrumentCard";
import {
  buildStudioFlowGrid,
  traceStreamNetwork,
  findPondingPoints,
} from "./flowField";

export interface DrainageFlowCardProps {
  scaleM: number;
  boardAspect: number;
  heightmapPoints: HeightmapPoint[];
  /** Hazen-Williams results per irrigation run (canvasBridges live data). */
  hydraulicResults: HydraulicResult[];
}

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
  borderBottom: "1px solid var(--gs-line)",
  paddingBottom: 3,
  marginBottom: 3,
};

const valueStyle: React.CSSProperties = {
  fontFamily: "var(--font-tech)",
  fontSize: "var(--gs-font-lg)",
  fontWeight: 500,
  color: "var(--gs-ink)",
};

export function DrainageFlowCard({
  scaleM,
  boardAspect,
  heightmapPoints,
  hydraulicResults,
}: DrainageFlowCardProps) {
  const drainageView = useStudioStore((s) => s.drainageView);

  const sampler = useMemo(
    () => createElevationSampler(heightmapPoints, scaleM, boardAspect),
    [heightmapPoints, scaleM, boardAspect],
  );

  const flow = useMemo(() => {
    if (!sampler) return null;
    const grid = buildStudioFlowGrid(sampler, scaleM, boardAspect);
    return {
      streams: traceStreamNetwork(grid),
      ponds: findPondingPoints(grid),
      maxFallPct: grid.maxSlopePct,
    };
  }, [sampler, scaleM, boardAspect]);

  // Hydraulic circuit telemetry — only valid runs carry usable figures.
  const telemetry = useMemo(() => {
    const valid = hydraulicResults.filter((r) => r.valid);
    if (valid.length === 0) return null;
    return {
      totalGpm: valid.reduce((sum, r) => sum + r.gpm, 0),
      maxKpa: valid.reduce((max, r) => Math.max(max, r.pressureDropKpa), 0),
    };
  }, [hydraulicResults]);

  if (!drainageView || !flow) return null;

  const { streams, ponds, maxFallPct } = flow;
  const topPonds = ponds.slice(0, 3);

  return (
    <InstrumentCard label="Flow" value={(flow?.maxFallPct ?? 0) > 0 ? (flow?.maxFallPct ?? 0).toFixed(0) + "%" : "—"}>
    <div style={{ width: 252 }}>
      <div
        data-testid="drainage-flow-card"
        style={{ fontFamily: "var(--font-ui)", color: "var(--gs-ink)" }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 5,
          }}
        >
          <span style={labelStyle}>Drainage · Overland Flow</span>
          <span
            style={{
              fontFamily: "var(--font-tech)",
              fontSize: "var(--gs-font-xs)",
              color: "var(--gs-ink-secondary)",
            }}
          >
            ×{VERTICAL_SCALE.toFixed(0)} vert
          </span>
        </div>

        <div style={rowStyle}>
          <span style={labelStyle}>Stream paths</span>
          <span style={valueStyle}>{streams.length}</span>
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>Max fall</span>
          <span style={valueStyle}>{maxFallPct.toFixed(1)}%</span>
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>Ponding points</span>
          <span
            style={{
              ...valueStyle,
              color: ponds.length > 0 ? "var(--gs-conflict)" : "var(--gs-ink)",
            }}
          >
            {ponds.length}
          </span>
        </div>

        {topPonds.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            {topPonds.map((p, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontFamily: "var(--font-tech)",
                  fontSize: "var(--gs-font-xs)",
                  color: "var(--gs-ink-secondary)",
                  lineHeight: 1.7,
                }}
              >
                <span>
                  x{p.x >= 0 ? "+" : ""}
                  {p.x.toFixed(1)}m z{p.z >= 0 ? "+" : ""}
                  {p.z.toFixed(1)}m
                </span>
                <span>
                  {p.catchmentM2 >= 1000
                    ? `${(p.catchmentM2 / 1000).toFixed(1)}k m²`
                    : `${p.catchmentM2.toFixed(0)} m²`}{" "}
                  · −{p.depthM.toFixed(2)}m
                </span>
              </div>
            ))}
          </div>
        )}

        {telemetry && (
          <>
            <div style={rowStyle}>
              <span style={labelStyle}>Flow rate</span>
              <span style={{ ...valueStyle, color: "var(--gs-ink-truth)" }}>
                {telemetry.totalGpm.toFixed(1)} GPM
              </span>
            </div>
            <div style={rowStyle}>
              <span style={labelStyle}>Pressure drop</span>
              <span style={{ ...valueStyle, color: "var(--gs-ink-truth)" }}>
                {telemetry.maxKpa.toFixed(1)} kPa
              </span>
            </div>
            <p
              style={{
                margin: 0,
                fontSize: "var(--gs-font-xs)",
                lineHeight: 1.4,
                color: "var(--gs-ink-secondary)",
              }}
            >
              Indicative model: 25 mm PVC, Hazen-Williams C=150 and
              emitter-derived demand. Confirm supply and pipe schedule on site.
            </p>
          </>
        )}

        {/* Status chip — the Stitch "Catchment Verified" idiom */}
        <div
          style={{
            marginTop: 4,
            padding: "6px 10px",
            borderRadius: "var(--gs-radius-lg)",
            fontSize: "var(--gs-font-xs)",
            fontFamily: "var(--font-ui)",
            fontWeight: 600,
            color:
              ponds.length > 0
                ? "var(--gs-ink-conflict)"
                : "var(--gs-ink-truth)",
            background:
              ponds.length > 0
                ? "color-mix(in srgb, var(--gs-conflict) 14%, transparent)"
                : "color-mix(in srgb, var(--gs-truth) 12%, transparent)",
            border: `1px solid ${
              ponds.length > 0
                ? "color-mix(in srgb, var(--gs-conflict) 35%, transparent)"
                : "color-mix(in srgb, var(--gs-truth) 30%, transparent)"
            }`,
          }}
        >
          {ponds.length > 0
            ? `⚠ ${ponds.length} ponding point${ponds.length > 1 ? "s" : ""} — drainage review`
            : "Free-draining to boundary"}
        </div>
      </div>
    </div>
    </InstrumentCard>
  );
}
