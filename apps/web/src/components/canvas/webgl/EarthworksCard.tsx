"use client";

/**
 * Gold Standard 2026 — Earthworks Card (cut/fill readout panel).
 *
 * The HUD half of the earthworks instrument (EarthworksLayer renders the
 * masses + zone patchwork). Per-pad cut/fill rows and totals in the Stitch
 * telemetry idiom, plus a derived spoil line (×1.6 swell — the same factor
 * StudioEstimateReport applies to excavate m³ → loose spoil).
 *
 * Reads earthworksView + sketchStrokes + features from the store
 * (DOM-subscribed) and recomputes the SAME padCutFill integral the layer
 * renders — the volumes on screen always match the zone colours on the
 * terrain, for extruded ink and elevated Area regions alike.
 *
 * Real-metre convention: pad heights and diffs divide by VERTICAL_SCALE and
 * are labelled, matching the SliceProfileCard "×3 vert / Δ real" pattern.
 *
 * Binding: docs/GOLD-STANDARD-2026.md §3 Phase 2 (Vertical Truth consumers)
 */

import { useMemo } from "react";
import { useStudioStore } from "./studioStore";
import type { HeightmapPoint } from "./coordTransform";
import { createElevationSampler, VERTICAL_SCALE } from "./terrainMath";
import { padStrokes, padCutFill, CUT_FILL_CELL_M } from "./cutFill";
import { InstrumentCard } from "./InstrumentCard";

/** Volume swell factor for excavated material (matches domain estimates). */
const SPOIL_SWELL = 1.6;

export interface EarthworksCardProps {
  scaleM: number;
  boardAspect: number;
  heightmapPoints: HeightmapPoint[];
}

const labelStyle: React.CSSProperties = {
  fontSize: "var(--gs-font-xs)",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--la-ink-secondary)",
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
  color: "var(--la-ink)",
};

function fmtM3(v: number): string {
  return v >= 100 ? v.toFixed(0) : v.toFixed(1);
}

export function EarthworksCard({
  scaleM,
  boardAspect,
  heightmapPoints,
}: EarthworksCardProps) {
  const earthworksView = useStudioStore((s) => s.earthworksView);
  const strokes = useStudioStore((s) => s.sketchStrokes);
  const features = useStudioStore((s) => s.features);

  const sampler = useMemo(
    () => createElevationSampler(heightmapPoints, scaleM, boardAspect),
    [heightmapPoints, scaleM, boardAspect],
  );

  const pads = useMemo(
    () => padStrokes(strokes, scaleM, boardAspect, features),
    [strokes, scaleM, boardAspect, features],
  );

  // Per-pad analyses + totals — the same integral EarthworksLayer renders.
  const summary = useMemo(() => {
    if (!sampler) return null;
    const perPad = pads.map((pad) => ({
      id: pad.id,
      topRealM: pad.heightM / VERTICAL_SCALE,
      result: padCutFill(sampler, pad.worldXZ, pad.heightM, CUT_FILL_CELL_M),
    }));
    return {
      perPad,
      totalCutM3: perPad.reduce((s, p) => s + p.result.cutM3, 0),
      totalFillM3: perPad.reduce((s, p) => s + p.result.fillM3, 0),
    };
  }, [sampler, pads]);

  if (!earthworksView || !sampler || !summary || pads.length === 0) return null;

  const netM3 = summary.totalFillM3 - summary.totalCutM3;

  return (
    <InstrumentCard label="Earth" value={pads.length + " pads"}>
    <div style={{ width: 252 }}>
      <div
        data-testid="earthworks-card"
        style={{ fontFamily: "var(--font-ui)", color: "var(--la-ink)" }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 5,
          }}
        >
          <span style={labelStyle}>Earthworks · Cut/Fill</span>
          <span
            style={{
              fontFamily: "var(--font-tech)",
              fontSize: "var(--gs-font-xs)",
              color: "var(--la-ink-secondary)",
            }}
          >
            ×{VERTICAL_SCALE.toFixed(0)} vert
          </span>
        </div>

        {summary.perPad.map((p, i) => (
          <div key={p.id} style={rowStyle}>
            <span style={{ fontSize: "var(--gs-font-xs)", color: "var(--la-ink-secondary)" }}>
              Pad {i + 1} · {p.result.areaM2.toFixed(0)} m² · top +
              {p.topRealM.toFixed(2)}m
            </span>
            <span style={{ fontSize: "var(--gs-font-xs)", fontFamily: "var(--font-tech)" }}>
              <span style={{ color: "var(--la-error)" }}>
                −{fmtM3(p.result.cutM3)}
              </span>{" "}
              /{" "}
              <span style={{ color: "var(--la-accent)" }}>
                +{fmtM3(p.result.fillM3)}
              </span>{" "}
              m³
            </span>
          </div>
        ))}

        <div style={rowStyle}>
          <span style={labelStyle}>Cut / Fill total</span>
          <span style={{ ...valueStyle, fontSize: "var(--gs-font-sub)" }}>
            <span style={{ color: "var(--la-error)" }}>
              {fmtM3(summary.totalCutM3)}
            </span>{" "}
            /{" "}
            <span style={{ color: "var(--la-accent)" }}>
              {fmtM3(summary.totalFillM3)}
            </span>{" "}
            m³
          </span>
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>Net (fill − cut)</span>
          <span
            style={{
              ...valueStyle,
              color: netM3 >= 0 ? "var(--la-accent)" : "var(--la-error)",
            }}
          >
            {netM3 >= 0 ? "+" : ""}
            {fmtM3(netM3)} m³ {netM3 >= 0 ? "import" : "export"}
          </span>
        </div>

        <div
          style={{
            fontFamily: "var(--font-tech)",
            fontSize: "var(--gs-font-xs)",
            color: "var(--la-ink-secondary)",
            marginTop: 4,
          }}
        >
          ≈ {fmtM3(summary.totalCutM3 * SPOIL_SWELL)} m³ loose spoil (×
          {SPOIL_SWELL} swell)
        </div>
      </div>
    </div>
    </InstrumentCard>
  );
}
