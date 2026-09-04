"use client";

/**
 * Tier-1 widget standard — Widget A: Brush & Pen.
 *
 * The draw tool's flyout content, extracted verbatim from ToolFlyout.tsx
 * (2026-09-04) and then brought up to the widget standard:
 *   - nib grid (SVG stroke previews + purpose titles),
 *   - W width (NumericSlider, tap-to-type),
 *   - SM smoothing (the stroke-assist dial),
 *   - OP opacity (new — per-brush opacity, stamped on new strokes like the
 *     width is; Trace/Procreate both expose it),
 *   - ERASE toggle + hold-to-latch (hold the key ~450ms to latch eraser
 *     mode without releasing to click),
 *   - Falloff as the collapsed 4th section (it is a present/working mode,
 *     not an every-stroke dial — it no longer earns scroll depth).
 *
 * Anchoring is NOT this widget's concern: the host panel anchors to the
 * active draw tile via useFlyoutAnchor.
 */

import { useRef, type CSSProperties } from "react";
import { useStudioStore, type FalloffPreset } from "./studioStore";
import { behaviourOf } from "./chromeContract";
import { NIBS, NIB_ORDER } from "./nibs";
import { NumericSlider } from "./NumericSlider";
import styles from "./ToolFlyout.module.css";

/** Hold duration that latches the eraser (distinct from a click-toggle). */
const ERASE_LATCH_MS = 450;

export function FlyoutHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className={styles.header}>
      <span className={styles.headerTitle}>{title}</span>
      {hint ? <span className={styles.headerHint}>{hint}</span> : null}
    </div>
  );
}

export function BrushWidget() {
  const activeNib = useStudioStore((s) => s.activeNib);
  const setActiveNib = useStudioStore((s) => s.setActiveNib);
  const brushWidthOverride = useStudioStore((s) => s.brushWidthOverride);
  const setBrushWidthOverride = useStudioStore((s) => s.setBrushWidthOverride);
  const brushOpacity = useStudioStore((s) => s.brushOpacity);
  const setBrushOpacity = useStudioStore((s) => s.setBrushOpacity);
  const strokeSmoothing = useStudioStore((s) => s.strokeSmoothing);
  const setStrokeSmoothing = useStudioStore((s) => s.setStrokeSmoothing);
  const eraserActive = useStudioStore((s) => s.eraserActive);
  const toggleEraser = useStudioStore((s) => s.toggleEraser);
  const setEraserActive = useStudioStore((s) => s.setEraserActive);
  const cameraPreset = useStudioStore((s) => s.cameraPreset);
  const activeSpec = NIBS[activeNib];
  const currentWidth = brushWidthOverride ?? activeSpec.baseWidthPx;
  // Phase L.6 — weight control converts mm to screen px in 3D per the chrome
  // contract. In 3D the unit is screen px (mm-at-scale is meaningless without
  // a sheet scale); the contract note says so beneath the slider.
  const weightBehaviour = behaviourOf("weightControl", cameraPreset);
  const weightConverted = weightBehaviour.kind === "convert";
  const latchTimer = useRef<number | null>(null);

  const clearLatchTimer = () => {
    if (latchTimer.current != null) {
      window.clearTimeout(latchTimer.current);
      latchTimer.current = null;
    }
  };

  return (
    <div className={styles.section}>
      <FlyoutHeader title="Brush" hint="p/alt" />
      <div className={styles.nibGrid} data-testid="brush-grid">
        {NIB_ORDER.map((kind) => {
          const spec = NIBS[kind];
          const active = activeNib === kind && !eraserActive;
          return (
            <button
              key={kind}
              className={`${styles.nib} ${active ? styles.nibActive : ""}`}
              data-nib={kind}
              data-active={active}
              onClick={() => {
                setActiveNib(kind);
                if (eraserActive) toggleEraser();
              }}
              title={spec.purpose}
            >
              <BrushTexturePreview spec={spec} />
              <span className={styles.nibLabel}>{spec.shortLabel}</span>
            </button>
          );
        })}
      </div>
      {/* Phase I/K — brush width slider with numeric entry. Controls the
          active nib's base width. The NumericSlider provides tap-to-type
          entry (spec §5.3: "every numeric parameter needs tap-to-type entry"). */}
      <NumericSlider
        label="W"
        min={0.5}
        max={20}
        step={0.5}
        value={currentWidth}
        onChange={setBrushWidthOverride}
        unit="px"
        title={`Brush width: ${currentWidth.toFixed(1)}px${weightConverted ? " (screen px — mm-at-scale meaningless in 3D)" : ""}`}
        testId="brush-width"
      />
      {weightConverted && (
        <div className={styles.weightConvertNote} data-testid="weight-convert-note">
          screen px — mm-at-scale meaningless in 3D
        </div>
      )}
      {/* Tier-1 — per-brush opacity (0.05–1). Stamped on new strokes at
          commit like the width is; null (the slider at the nib's own base)
          is represented by the dial showing the armed nib's opacity. */}
      <NumericSlider
        label="OP"
        min={5}
        max={100}
        step={5}
        value={Math.round((brushOpacity ?? activeSpec.opacity) * 100)}
        onChange={(v) => setBrushOpacity(v / 100)}
        unit="%"
        decimals={0}
        title={`Opacity: ${Math.round((brushOpacity ?? activeSpec.opacity) * 100)}% — new strokes draw at this ink density`}
        testId="brush-opacity"
      />
      {/* Gap-analysis Phase 1 — stroke stabilizer (Trace's "smooth curves"):
          the pull-chain damps hand wobble after the snap resolves the draw
          point. 0% is raw passthrough. Hold-to-straighten (hold the pen
          still ≥400ms before lift on a line-intending stroke) is on by
          default and independent of this dial (studioStore.holdToStraighten). */}
      <NumericSlider
        label="SM"
        min={0}
        max={100}
        step={5}
        value={Math.round(strokeSmoothing * 100)}
        onChange={(v) => setStrokeSmoothing(v / 100)}
        unit="%"
        decimals={0}
        title={`Smoothing: ${Math.round(strokeSmoothing * 100)}% — damps wobble; hold the pen still before lift to straighten`}
        testId="stroke-smoothing"
      />
      {/* Phase I — stroke-matching eraser toggle, extended with hold-to-latch:
          press and hold ~450ms latches eraser mode without the second tap
          the toggle needs. Click still toggles. */}
      <button
        className={`${styles.eraserBtn} ${eraserActive ? styles.eraserBtnActive : ""}`}
        onClick={toggleEraser}
        onPointerDown={() => {
          clearLatchTimer();
          latchTimer.current = window.setTimeout(() => {
            latchTimer.current = null;
            if (!eraserActive) setEraserActive(true);
          }, ERASE_LATCH_MS);
        }}
        onPointerUp={clearLatchTimer}
        onPointerLeave={clearLatchTimer}
        title={
          eraserActive
            ? "Eraser active — click a stroke to delete it (scales to the stroke's width)"
            : "Stroke-matching eraser — click to toggle, hold to latch"
        }
        data-testid="eraser-toggle"
        data-active={eraserActive}
      >
        ERASE
      </button>
      <FalloffSection />
    </div>
  );
}

/** Falloff preset picker (turn 14c) — NARROW / BALANCED / WIDE, collapsed by
 *  default (§2.2: a present/working mode, not an every-stroke dial). A native
 *  disclosure keeps it keyboard-reachable with zero JS state. */
function FalloffSection() {
  const falloffPreset = useStudioStore((s) => s.falloffPreset);
  const setFalloffPreset = useStudioStore((s) => s.setFalloffPreset);
  const presets = useRef<{ id: FalloffPreset; label: string; hint: string }[]>([
    { id: "NARROW", label: "NARROW", hint: "for working" },
    { id: "BALANCED", label: "BALANCED", hint: "general use" },
    { id: "WIDE", label: "WIDE", hint: "for fly-through" },
  ]).current;
  return (
    <details className={styles.disclosure} data-testid="falloff-disclosure">
      <summary className={styles.disclosureSummary}>
        <span className={styles.disclosureTitle}>Falloff</span>
        <span className={styles.disclosureValue}>{falloffPreset}</span>
      </summary>
      <div className={styles.falloffRow} data-testid="falloff-picker">
        {presets.map((p) => {
          const active = falloffPreset === p.id;
          return (
            <button
              key={p.id}
              className={`${styles.falloffBtn} ${active ? styles.falloffBtnActive : ""}`}
              data-falloff-preset={p.id}
              data-active={active}
              onClick={() => setFalloffPreset(p.id)}
              title={`${p.label} — ${p.hint}`}
            >
              {p.label}
            </button>
          );
        })}
      </div>
    </details>
  );
}

/** Phase I — visual texture preview for a nib. Renders an SVG stroke
 *  that approximates the nib's texture (width, color, edge softness). */
export function BrushTexturePreview({ spec }: { spec: typeof NIBS[keyof typeof NIBS] }) {
  const w = 28;
  const h = 14;
  const strokeWidth = Math.min(6, Math.max(1, spec.baseWidthPx * 0.6));
  const opacity = spec.opacity;
  // React's `style` prop takes an object, not a CSS string. This was a
  // template literal cast through `as React.CSSProperties`, which silenced
  // the compiler and threw at render — opening the DRAW flyout for any soft
  // nib (edgeSoft > 0: ink-03, chisel-marker) crashed the whole studio into
  // its error boundary. The cast was the only thing hiding it.
  const blur: CSSProperties | undefined =
    spec.edgeSoft > 0 ? { filter: `blur(${spec.edgeSoft * 1.5}px)` } : undefined;
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className={styles.nibPreview}
      aria-hidden="true"
    >
      {spec.kind === "stipple" ? (
        <>
          <circle cx={6} cy={4} r={1.2} fill={spec.color} opacity={opacity} />
          <circle cx={12} cy={9} r={0.8} fill={spec.color} opacity={opacity * 0.8} />
          <circle cx={18} cy={5} r={1.5} fill={spec.color} opacity={opacity} />
          <circle cx={22} cy={10} r={1} fill={spec.color} opacity={opacity * 0.9} />
        </>
      ) : (
        <path
          d={`M 2 ${h / 2} Q ${w / 2} ${h / 2 - 3}, ${w - 2} ${h / 2}`}
          fill="none"
          stroke={spec.color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          opacity={opacity}
          style={blur}
        />
      )}
    </svg>
  );
}
