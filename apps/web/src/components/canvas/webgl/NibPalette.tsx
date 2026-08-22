"use client";

/**
 * Gold Standard 2026 — Floating Nib Palette (expressive stylus Sketch).
 *
 * The Limner Sketch nib swapper: a lightweight floating pill docked directly
 * alongside the persistent left tool rail, mounted ONLY while Sketch mode is
 * armed (and while no photo-trace session owns the chrome). It carries:
 *
 *   - the four nibs as REAL stroke swatches (`nibPreview.ts`) — each one
 *     drawn from the same NibSpec the shader consumes, so the palette shows
 *     the ink it is about to lay down rather than a generic Unicode glyph;
 *   - a sun-aware hatching toggle — when on, hatch fills snap their parallel
 *     lines to the site's INVERSE sun angle (resolved by the solar layer);
 *   - a hatch-fill action that fills the most recent closed shape;
 *   - a live pressure/tilt readout polled from the store's transient
 *     telemetry scratch (zero per-move re-renders).
 *
 * Every control is the shared `Button` primitive's `swatch` variant — the
 * same 42px icon-over-label column the tool rail uses, so hover lift, active
 * state and the disabled guard live in one place. The nib swatches override
 * the variant's charcoal active fill with a light primary veil: a dark fill
 * would swallow the graphite and ink previews it is meant to show.
 *
 * Chrome follows the Studio Paper law: one frosted layer, hairline, neutral
 * shadow tier — the drawing reads through the pill.
 *
 * Binding: docs/GOLD-STANDARD-2026.md §2 (all UI = floating cards)
 */

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useStudioStore } from "./studioStore";
import { NIB_ORDER, NIBS } from "./nibs";
import { NIB_PREVIEW_H, NIB_PREVIEW_W, nibPreview } from "./nibPreview";
import { isClosedRing, sunHatchAngleDeg } from "./hatchSun";
import { Button } from "./Button";
import type { CanvasStroke, NibKind } from "@workstream/contracts";

/** Swatch label — matches the tool rail's text contract (never wraps). */
const labelStyle: CSSProperties = {
  fontFamily: "var(--font-ui)",
  fontSize: "var(--gs-font-xs)",
  letterSpacing: "0.04em",
  lineHeight: 1,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  maxWidth: "100%",
};

/** Glyph slot for the two action swatches (sun snap / hatch fill). */
const glyphStyle: CSSProperties = {
  fontSize: "var(--gs-font-sub)",
  lineHeight: 1,
  height: NIB_PREVIEW_H,
  display: "flex",
  alignItems: "center",
};

/**
 * Active nib treatment. Deliberately NOT the swatch variant's charcoal
 * fill — the swatch's whole job is to show the nib's real ink, and
 * graphite (#3B3B3B) on charcoal is invisible.
 */
const nibActiveStyle: CSSProperties = {
  background: "var(--gs-primary-veil)",
  border: "1px solid color-mix(in srgb, var(--gs-primary) 45%, transparent)",
  color: "var(--gs-primary-ink)",
};

/** The most recent closed ring in the ink array (the hatch-fill target). */
function lastClosedStroke(strokes: readonly CanvasStroke[]): CanvasStroke | null {
  for (let i = strokes.length - 1; i >= 0; i--) {
    const s = strokes[i]!;
    const pts = s.points ?? [];
    if (isClosedRing(pts.map((p) => ({ x: p.x_pct, y: p.y_pct })))) return s;
  }
  return null;
}

/** One nib's ink, drawn from its own spec (colour, width, cap, softness). */
function NibSwatchInk({ kind }: { kind: NibKind }) {
  const preview = nibPreview(kind);
  const filterId = `nib-soft-${kind}`;
  return (
    <svg
      aria-hidden
      width={NIB_PREVIEW_W}
      height={NIB_PREVIEW_H}
      viewBox={`0 0 ${NIB_PREVIEW_W} ${NIB_PREVIEW_H}`}
      style={{ display: "block" }}
    >
      {preview.soft ? (
        <defs>
          <filter id={filterId} x="-25%" y="-50%" width="150%" height="200%">
            <feGaussianBlur stdDeviation="0.5" />
          </filter>
        </defs>
      ) : null}
      {preview.path ? (
        <path
          d={preview.path}
          fill="none"
          stroke={preview.color}
          strokeWidth={preview.strokeWidth}
          strokeOpacity={preview.opacity}
          strokeLinecap={preview.linecap}
          filter={preview.soft ? `url(#${filterId})` : undefined}
        />
      ) : null}
      {preview.dots.map((dot, i) => (
        <circle
          key={i}
          cx={dot.x}
          cy={dot.y}
          r={dot.r}
          fill={preview.color}
          fillOpacity={preview.opacity}
        />
      ))}
    </svg>
  );
}

export function NibPalette() {
  const sketchMode = useStudioStore((s) => s.sketchMode);
  const photoTraceSession = useStudioStore((s) => s.photoTraceSession);
  const activeNib = useStudioStore((s) => s.activeNib);
  const setActiveNib = useStudioStore((s) => s.setActiveNib);
  const sunHatchSnap = useStudioStore((s) => s.sunHatchSnap);
  const setSunHatchSnap = useStudioStore((s) => s.setSunHatchSnap);
  const sunAzimuthDeg = useStudioStore((s) => s.sunAzimuthDeg);
  const hatchFillStroke = useStudioStore((s) => s.hatchFillStroke);
  const strokes = useStudioStore((s) => s.sketchStrokes);

  const fillTarget = useMemo(() => lastClosedStroke(strokes), [strokes]);

  // Live pressure/tilt readout — polls the transient scratch on a slow
  // interval; the store mutates it per pointer-move WITHOUT set() (zero
  // DOM re-renders), so 200 ms polling is cheap and stable.
  const [live, setLive] = useState(() => ({
    ...useStudioStore.getState().liveTelemetry,
  }));
  useEffect(() => {
    const id = window.setInterval(() => {
      const t = useStudioStore.getState().liveTelemetry;
      setLive({ ...t });
    }, 200);
    return () => window.clearInterval(id);
  }, []);

  if (!sketchMode || photoTraceSession) return null;

  const sunTitle =
    sunAzimuthDeg != null
      ? `Sun-aware hatching: on — hatch fills snap to the inverse sun angle ${Math.round(sunHatchAngleDeg(sunAzimuthDeg))}° (sun ${Math.round(sunAzimuthDeg)}° from north)`
      : "Sun-aware hatching: no sun azimuth on this project — hatch falls back to 45°";
  const fillTitle = fillTarget
    ? `Hatch-fill the last closed shape at ${sunHatchSnap && sunAzimuthDeg != null ? Math.round(sunHatchAngleDeg(sunAzimuthDeg)) : 45}°`
    : "Draw a closed shape first — hatch fills it with parallel lines";

  return (
    <div
      data-testid="nib-palette"
      role="toolbar"
      aria-label="Sketch nibs"
      style={{
        position: "absolute",
        // The tool rail is left 8 + 56 wide, so it ends at 64. At 58 the
        // first nib swatch sat under the rail's right edge.
        left: 72,
        top: 152,
        display: "flex",
        alignItems: "center",
        gap: "var(--gs-space-2)",
        padding: 4,
        borderRadius: "var(--gs-radius-xl)",
        background: "var(--gs-glass-veil)",
        backdropFilter: "blur(var(--gs-blur))",
        WebkitBackdropFilter: "blur(var(--gs-blur))",
        border: "1px solid color-mix(in srgb, var(--gs-line) 55%, transparent)",
        boxShadow: "var(--gs-shadow-2)",
        pointerEvents: "auto",
        zIndex: "var(--cf-z-chrome)",
      }}
    >
      {NIB_ORDER.map((kind) => {
        const nib = NIBS[kind];
        const active = activeNib === kind;
        return (
          <Button
            key={kind}
            variant="swatch"
            data-testid={`nib-${kind}`}
            aria-label={`${nib.label} nib`}
            aria-pressed={active}
            title={`${nib.label} — ${nib.purpose}`}
            active={active}
            onClick={() => setActiveNib(kind)}
            style={active ? nibActiveStyle : undefined}
          >
            <NibSwatchInk kind={kind} />
            <span aria-hidden style={labelStyle}>
              {nib.shortLabel}
            </span>
          </Button>
        );
      })}

      <span aria-hidden style={{ width: 1, height: 28, background: "var(--gs-line)" }} />

      {/* Sun-aware hatching toggle — snaps hatch fills to the inverse sun angle. */}
      <Button
        variant="swatch"
        data-testid="nib-sun-snap"
        aria-label="Sun-aware hatching"
        aria-pressed={sunHatchSnap}
        title={sunTitle}
        active={sunHatchSnap}
        onClick={() => setSunHatchSnap(!sunHatchSnap)}
      >
        <span aria-hidden style={glyphStyle}>
          ☼
        </span>
        <span aria-hidden style={labelStyle}>
          Sun
        </span>
      </Button>

      {/* Hatch-fill the last closed shape (sun-snapped when the toggle is on). */}
      <Button
        variant="swatch"
        data-testid="nib-hatch-fill"
        aria-label="Hatch fill last closed shape"
        title={fillTitle}
        disabled={!fillTarget}
        onClick={() => {
          if (fillTarget) hatchFillStroke(fillTarget.id);
        }}
      >
        <span aria-hidden style={glyphStyle}>
          ▦
        </span>
        <span aria-hidden style={labelStyle}>
          Fill
        </span>
      </Button>

      {/* Live stylus telemetry readout — pressure + tilt magnitude. */}
      <div
        data-testid="nib-telemetry"
        aria-hidden
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: "var(--gs-space-1)",
          padding: "0 6px",
          fontFamily: "var(--font-tech)",
          fontSize: "var(--gs-font-micro)",
          lineHeight: 1.25,
          color: "var(--gs-ink-muted)",
          whiteSpace: "nowrap",
        }}
      >
        <span>P {live.pressure.toFixed(2)}</span>
        <span>T {Math.round(Math.hypot(live.tiltX, live.tiltY))}°</span>
      </div>
    </div>
  );
}
