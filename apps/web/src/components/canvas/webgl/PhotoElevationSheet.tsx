"use client";

/**
 * Gold Standard 2026 — Photo Elevation Sheet (the print artifact).
 *
 * The capstone's terminal deliverable: the pinned photo with the operator's
 * plane-space trace overlaid on a true-metre grid, a ground line, and the
 * calibration honesty stamp. Uncalibrated sheets carry an explicit
 * "indicative" note — fabricated precision is against the law here.
 *
 * The sheet renders the photo at 1 px = 1 cm (100 px per metre) in its SVG
 * viewBox, with ticks every metre — a working-drawing sheet, not a mockup.
 */

import { useMemo } from "react";
import { useStudioStore } from "./studioStore";
import { GlassCard } from "./GlassCard";
import { photoPlaneFromElevation } from "./photoTraceMath";

const PX_PER_M = 100;
const PAD_PX = 40;

export function PhotoElevationSheet({
  elevationId,
  onClose,
}: {
  elevationId: string;
  onClose: () => void;
}) {
  const elevation = useStudioStore((s) =>
    s.photoElevations.find((e) => e.id === elevationId) ?? null,
  );
  const plane = useMemo(
    () => (elevation ? photoPlaneFromElevation(elevation) : null),
    [elevation],
  );

  if (!elevation || !plane) {
    return (
      <GlassCard
        style={{ position: "absolute", top: 40, left: "50%", transform: "translateX(-50%)", width: "min(420px, 92vw)", padding: "12px 14px" }}
      >
        <p style={{ margin: 0, fontSize: "var(--gs-font-lg)", color: "var(--gs-ink-secondary)" }}>
          This photo elevation is no longer on the board.
        </p>
        <button type="button" onClick={onClose} style={{ marginTop: 8 }}>
          Close
        </button>
      </GlassCard>
    );
  }

  const widthM = plane.widthM;
  const heightM = plane.heightM;
  const vbW = widthM * PX_PER_M + PAD_PX * 2;
  const vbH = heightM * PX_PER_M + PAD_PX * 2;
  const ticks: number[] = [];
  for (let m = 0; m <= Math.floor(widthM); m++) {
    ticks.push(m);
  }

  return (
    <GlassCard
      style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "min(880px, 94vw)", maxHeight: "92vh", overflow: "auto", padding: "12px 14px" }}
    >
      <div data-testid="photo-elevation-sheet" style={{ color: "var(--gs-ink)", fontFamily: "var(--font-ui)" }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: "var(--gs-space-4)",
            flexWrap: "wrap",
            marginBottom: 8,
          }}
        >
          <span style={{ fontFamily: "var(--font-tech)", fontSize: "var(--gs-font-sm)", fontWeight: 600, letterSpacing: "0.06em" }}>
            PHOTO ELEVATION
          </span>
          <span style={{ fontSize: "var(--gs-font-lg)" }}>{elevation.name}</span>
          <span style={{ fontSize: "var(--gs-font-xs)", color: "var(--gs-ink-secondary)", fontVariantNumeric: "tabular-nums" }}>
            {widthM.toFixed(1)} m × {heightM.toFixed(1)} m · look {Math.round(elevation.azimuth_deg)}°
          </span>
          <span
            data-testid="photo-sheet-stamp"
            style={{
              fontSize: "var(--gs-font-xs)",
              color: elevation.calibration ? "var(--gs-ink-secondary)" : "var(--gs-ink-muted)",
            }}
          >
            {elevation.calibration
              ? `Calibrated against ${elevation.calibration.label}`
              : "Uncalibrated — indicative, photo scale only"}
          </span>
          <span
            data-testid="photo-sheet-boundary-stamp"
            style={{
              fontSize: "var(--gs-font-xs)",
              color: elevation.boundary_snap
                ? "var(--gs-ink-secondary)"
                : "var(--gs-ink-muted)",
            }}
          >
            {elevation.boundary_snap
              ? `Position reconciled to the title boundary (edge ${elevation.boundary_snap.edge_index + 1})`
              : "Position not verified against the title boundary — locational-indicative"}
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              marginLeft: "auto",
              fontFamily: "var(--font-ui)",
              fontSize: "var(--gs-font-sm)",
              padding: "3px 10px",
              borderRadius: "var(--gs-radius-pill)",
              border: "1px solid var(--gs-line)",
              background: "transparent",
              color: "var(--gs-ink-secondary)",
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>

        <svg
          viewBox={`0 0 ${vbW} ${vbH}`}
          role="img"
          aria-label={`Photo elevation sheet for ${elevation.name}`}
          style={{ width: "100%", height: "auto", display: "block", borderRadius: "var(--gs-radius-md)", border: "1px solid var(--gs-line)", background: "var(--gs-panel)" }}
        >
          {/* The photo at true metre scale (1 px = 1 cm on the sheet grid). */}
          <image
            href={elevation.uri}
            x={PAD_PX}
            y={PAD_PX}
            width={widthM * PX_PER_M}
            height={heightM * PX_PER_M}
            preserveAspectRatio="none"
          />
          {/* Metre grid — every metre a hairline tick, every 5th a labelled callout. */}
          {ticks.map((m) => (
            <g key={m}>
              <line
                x1={PAD_PX + m * PX_PER_M}
                y1={vbH - PAD_PX}
                x2={PAD_PX + m * PX_PER_M}
                y2={vbH - PAD_PX + (m % 5 === 0 ? 8 : 4)}
                stroke="#59636B"
                strokeWidth={m % 5 === 0 ? 1.2 : 0.6}
              />
              {m % 5 === 0 && (
                <text
                  x={PAD_PX + m * PX_PER_M}
                  y={vbH - PAD_PX + 18}
                  fontSize={9}
                  fill="#3A414B"
                  textAnchor="middle"
                  fontFamily="Space Grotesk, monospace"
                >
                  {m} m
                </text>
              )}
            </g>
          ))}
          {/* Ground line — the plane foot. */}
          <line
            x1={PAD_PX}
            y1={vbH - PAD_PX}
            x2={vbW - PAD_PX}
            y2={vbH - PAD_PX}
            stroke="#0030CF"
            strokeWidth={1.4}
          />
          {/* Operator trace — plane-space metres mapped 1:1 onto the sheet. */}
          {elevation.strokes.map((stroke) => {
            if (stroke.points.length < 2) return null;
            const d = stroke.points
              .map((p, i) => {
                const x = PAD_PX + (p.x_m + widthM / 2) * PX_PER_M;
                const y = vbH - PAD_PX - p.y_m * PX_PER_M;
                return `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
              })
              .join(" ");
            return (
              <path
                key={stroke.id}
                d={d}
                fill="none"
                stroke={stroke.color}
                strokeWidth={Math.max(1, stroke.width_px)}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            );
          })}
        </svg>

        <p style={{ margin: "6px 0 0", fontSize: "var(--gs-font-xs)", color: "var(--gs-ink-muted)" }}>
          Photo elevation sheet — {elevation.strokes.length} trace strokes.
          {elevation.calibration
            ? " Traced in true metres against the calibrated plane."
            : " Treat dimensions as indicative until calibrated."}
        </p>
      </div>
    </GlassCard>
  );
}
