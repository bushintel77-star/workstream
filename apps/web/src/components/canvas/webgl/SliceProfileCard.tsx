"use client";

/**
 * Gold Standard 2026 — Slice Profile Card (Vertical Truth DOM panel).
 *
 * A bottom-right Glass Card that renders a live 2D elevation profile along the
 * current section cut. As the operator drags the ElevationSliceLine in the 3D
 * scene, this panel redraws — the "section view" of the topography.
 *
 * Reads slice state from the studio store (DOM-subscribed — not per-frame) and
 * samples the SHARED terrainMath sampler, so the profile exactly matches the
 * TerrainMesh surface and the draped ink.
 *
 * Chart: X = distance along the cut (metres), Y = elevation (metres, ×3 vertical
 * exaggeration labeled — same VERTICAL_SCALE as the mesh). Surface polyline +
 * datum line + min/max readouts.
 *
 * Binding: docs/GOLD-STANDARD-2026.md §3 Phase 2 (Vertical Truth)
 */

import { useMemo } from "react";
import { GlassCard } from "./GlassCard";
import { useStudioStore } from "./studioStore";
import type { HeightmapPoint } from "./coordTransform";
import { createElevationSampler, VERTICAL_SCALE } from "./terrainMath";

/** Number of samples along the profile (chart resolution). */
const PROFILE_SAMPLES = 80;

export interface SliceProfileCardProps {
  scaleM: number;
  boardAspect: number;
  heightmapPoints: HeightmapPoint[];
}

export function SliceProfileCard({
  scaleM,
  boardAspect,
  heightmapPoints,
}: SliceProfileCardProps) {
  const sliceActive = useStudioStore((s) => s.sliceActive);
  const sliceAxis = useStudioStore((s) => s.sliceAxis);
  const slicePosM = useStudioStore((s) => s.slicePosM);

  const sampler = useMemo(
    () => createElevationSampler(heightmapPoints, scaleM, boardAspect),
    [heightmapPoints, scaleM, boardAspect],
  );

  // Sample the profile along the cut.
  const profile = useMemo(() => {
    if (!sampler) return null;
    const halfX = scaleM / 2;
    const halfZ = (scaleM * boardAspect) / 2;
    const pts: Array<{ dist: number; elev: number }> = [];
    const cutLen = sliceAxis === "z" ? scaleM : scaleM * boardAspect;
    for (let i = 0; i < PROFILE_SAMPLES; i++) {
      const t = i / (PROFILE_SAMPLES - 1);
      let x: number, z: number;
      if (sliceAxis === "z") {
        x = -halfX + t * scaleM;
        z = slicePosM;
      } else {
        x = slicePosM;
        z = -halfZ + t * scaleM * boardAspect;
      }
      pts.push({ dist: t * cutLen, elev: sampler(x, z) });
    }
    return pts;
  }, [sampler, sliceAxis, slicePosM, scaleM, boardAspect]);

  if (!sliceActive || !sampler || !profile) return null;

  // Chart geometry.
  const elevs = profile.map((p) => p.elev);
  const minE = Math.min(...elevs);
  const maxE = Math.max(...elevs);
  // Pad the Y range so a flat-ish profile still has breathing room.
  const ePad = Math.max(0.1, (maxE - minE) * 0.15);
  const yMin = minE - ePad;
  const yMax = maxE + ePad;
  const cutLen = sliceAxis === "z" ? scaleM : scaleM * boardAspect;

  // SVG layout.
  const W = 320;
  const H = 130;
  const padL = 38;
  const padR = 12;
  const padT = 14;
  const padB = 22;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const sx = (dist: number) => padL + (dist / cutLen) * plotW;
  const sy = (elev: number) =>
    padT + plotH - ((elev - yMin) / (yMax - yMin || 1)) * plotH;

  const surfacePath = profile
    .map((p, i) => `${i === 0 ? "M" : "L"}${sx(p.dist).toFixed(1)},${sy(p.elev).toFixed(1)}`)
    .join(" ");
  const datumY = sy(0);

  const axisLabel = sliceAxis === "z" ? "E↔W" : "N↔S";

  return (
    <GlassCard
      // Relative — this card is a child of the WebGLStudioPreview bottom-right
      // instrument stack column, not an independently positioned card.
      position={{ position: "relative" }}
      style={{ width: W + 16, padding: "12px 14px" }}
    >
      <div style={{ fontFamily: "var(--font-ui)", color: "var(--gs-ink)" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 6,
          }}
        >
          <span
            style={{
              fontSize: 11,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--gs-ink-secondary)",
            }}
          >
            Section · {axisLabel}
          </span>
          <span
            style={{
              fontFamily: "var(--font-tech)",
              fontSize: 11,
              color: "var(--gs-truth, #0030CF)",
            }}
          >
            ×{VERTICAL_SCALE.toFixed(0)} vert
          </span>
        </div>
        <svg width={W} height={H} style={{ display: "block" }}>
          {/* Datum line (elevation 0) */}
          <line
            x1={padL}
            y1={datumY}
            x2={W - padR}
            y2={datumY}
            stroke="var(--gs-line)"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
          {/* Y-axis tick labels (min/max) */}
          <text x={padL - 6} y={padT + 4} textAnchor="end" fontSize={9} fill="var(--gs-ink-secondary)" fontFamily="var(--font-tech)">
            {yMax.toFixed(1)}
          </text>
          <text x={padL - 6} y={padT + plotH + 3} textAnchor="end" fontSize={9} fill="var(--gs-ink-secondary)" fontFamily="var(--font-tech)">
            {yMin.toFixed(1)}
          </text>
          {/* Surface profile */}
          <path
            d={surfacePath}
            fill="none"
            stroke="var(--gs-truth, #0030CF)"
            strokeWidth={2}
            strokeLinejoin="round"
          />
          {/* X-axis labels (distance) */}
          <text x={padL} y={H - 6} textAnchor="start" fontSize={9} fill="var(--gs-ink-secondary)" fontFamily="var(--font-tech)">
            0m
          </text>
          <text x={W - padR} y={H - 6} textAnchor="end" fontSize={9} fill="var(--gs-ink-secondary)" fontFamily="var(--font-tech)">
            {cutLen.toFixed(0)}m
          </text>
        </svg>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 4,
            fontFamily: "var(--font-tech)",
            fontSize: 11,
            color: "var(--gs-ink-secondary)",
          }}
        >
          <span>
            Δ {((maxE - minE) / VERTICAL_SCALE).toFixed(2)}m real
          </span>
          <span>
            @ {(sliceAxis === "z" ? slicePosM : slicePosM).toFixed(1)}m
          </span>
        </div>
      </div>
    </GlassCard>
  );
}
