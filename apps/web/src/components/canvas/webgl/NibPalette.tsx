"use client";

/**
 * Gold Standard 2026 — Floating Nib Palette (expressive stylus Sketch).
 *
 * The Limner Sketch nib swapper: a lightweight floating pill docked directly
 * alongside the persistent left tool rail, mounted ONLY while Sketch mode is
 * armed (and while no photo-trace session owns the chrome). It carries:
 *
 *   - the four nibs as minimal line-weight GLYPHS (no dropdowns);
 *   - a sun-aware hatching toggle — when on, hatch fills snap their parallel
 *     lines to the site's INVERSE sun angle (resolved by the solar layer);
 *   - a hatch-fill action that fills the most recent closed shape;
 *   - a live pressure/tilt readout polled from the store's transient
 *     telemetry scratch (zero per-move re-renders).
 *
 * Chrome follows the Studio Paper law: one frosted layer, hairline, neutral
 * shadow tier — the drawing reads through the pill.
 *
 * Binding: docs/GOLD-STANDARD-2026.md §2 (all UI = floating cards)
 */

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useStudioStore } from "./studioStore";
import { NIB_ORDER, NIBS } from "./nibs";
import { isClosedRing, sunHatchAngleDeg } from "./hatchSun";
import type { CanvasStroke } from "@workstream/contracts";

const chipBase: CSSProperties = {
  width: 30,
  height: 30,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "var(--gs-radius-pill)",
  border: "1px solid transparent",
  background: "transparent",
  color: "var(--gs-ink-secondary)",
  cursor: "pointer",
  fontSize: 14,
  lineHeight: 1,
  transition:
    "background 0.15s, color 0.15s, transform 0.15s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.15s cubic-bezier(0.16, 1, 0.3, 1)",
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
        left: 58,
        top: 152,
        display: "flex",
        alignItems: "center",
        gap: "var(--gs-space-2)",
        padding: 4,
        borderRadius: "var(--gs-radius-pill)",
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
          <button
            type="button"
            key={kind}
            data-testid={`nib-${kind}`}
            aria-label={`${nib.label} nib`}
            aria-pressed={active}
            title={`${nib.label} — ${nib.purpose}`}
            onClick={() => setActiveNib(kind)}
            style={{
              ...chipBase,
              background: active ? "var(--gs-chip-active)" : "transparent",
              color: active ? "var(--gs-chip-active-ink)" : "var(--gs-ink-secondary)",
            }}
            onMouseEnter={(e) => {
              if (!active) e.currentTarget.style.color = "var(--gs-ink)";
              e.currentTarget.style.transform = "translateY(-1px)";
              e.currentTarget.style.boxShadow = "var(--gs-shadow-1)";
            }}
            onMouseLeave={(e) => {
              if (!active) e.currentTarget.style.color = "var(--gs-ink-secondary)";
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <span aria-hidden>{nib.glyph}</span>
          </button>
        );
      })}

      <span aria-hidden style={{ width: 1, height: 16, background: "var(--gs-line)" }} />

      {/* Sun-aware hatching toggle — snaps hatch fills to the inverse sun angle. */}
      <button
        type="button"
        data-testid="nib-sun-snap"
        aria-label="Sun-aware hatching"
        aria-pressed={sunHatchSnap}
        title={sunTitle}
        onClick={() => setSunHatchSnap(!sunHatchSnap)}
        style={{
          ...chipBase,
          background: sunHatchSnap ? "var(--gs-primary-veil)" : "transparent",
          color: sunHatchSnap ? "var(--gs-primary-ink)" : "var(--gs-ink-secondary)",
        }}
        onMouseEnter={(e) => {
          if (!sunHatchSnap) e.currentTarget.style.color = "var(--gs-ink)";
          e.currentTarget.style.transform = "translateY(-1px)";
          e.currentTarget.style.boxShadow = "var(--gs-shadow-1)";
        }}
        onMouseLeave={(e) => {
          if (!sunHatchSnap) e.currentTarget.style.color = "var(--gs-ink-secondary)";
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = "none";
        }}
      >
        <span aria-hidden>☼</span>
      </button>

      {/* Hatch-fill the last closed shape (sun-snapped when the toggle is on). */}
      <button
        type="button"
        data-testid="nib-hatch-fill"
        aria-label="Hatch fill last closed shape"
        title={fillTitle}
        disabled={!fillTarget}
        onClick={() => {
          if (fillTarget) hatchFillStroke(fillTarget.id);
        }}
        style={{
          ...chipBase,
          opacity: fillTarget ? 1 : 0.45,
          cursor: fillTarget ? "pointer" : "not-allowed",
          color: fillTarget ? "var(--gs-ink-secondary)" : "var(--gs-ink-muted)",
        }}
        onMouseEnter={(e) => {
          if (!fillTarget) return;
          e.currentTarget.style.color = "var(--gs-ink)";
          e.currentTarget.style.transform = "translateY(-1px)";
          e.currentTarget.style.boxShadow = "var(--gs-shadow-1)";
        }}
        onMouseLeave={(e) => {
          if (!fillTarget) return;
          e.currentTarget.style.color = "var(--gs-ink-secondary)";
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = "none";
        }}
      >
        <span aria-hidden>▦</span>
      </button>

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
          fontSize: 9.5,
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
