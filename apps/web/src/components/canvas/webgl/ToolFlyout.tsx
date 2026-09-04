"use client";

/**
 * Landscape Canvas v2 — Tool Flyout (handoff §5.3 "blooming").
 *
 * The second-tier column that blooms beside the ribbon when the active tool
 * has a flyout. Positioned to the ribbon's inner edge, vertically centred on
 * the active tool's tile (the arrow rests on the tile's centre line).
 *
 * Honesty contract (§0.1, never ship a dead control): every control here backs
 * real store state. Currently wired:
 *   - DRAW (pen/line/spline)        → nib picker (activeNib) + target plane
 *   - PLANT (tree/bed)               → asset palette (buildAssetPalette/armedSymbolId)
 *   - GRADE/BUILD/MEASURE           → target plane + parameter surface
 *
 * Tools that have no real parameter state render no flyout (a tool is only
 * given a flyout when this component has something genuine to show).
 */

import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { useStudioStore, type ToolId, type FalloffPreset } from "./studioStore";
import { behaviourOf } from "./chromeContract";
import { NIBS, NIB_ORDER } from "./nibs";
import { buildAssetPalette } from "./assetPalette";
import { MaterialPalette } from "./MaterialPalette";
import { NumericSlider } from "./NumericSlider";
import styles from "./ToolFlyout.module.css";

export interface ToolFlyoutProps {
  /** The active tool (the flyout only renders when it has content). */
  tool: ToolId;
  /** Handedness — the flyout blooms on the ribbon's inner (hand) edge. */
  handedness: "LEFT" | "RIGHT";
}

/** The tool set that genuinely supports a flyout with real state today. */
export const FLYOUT_TOOLS: ReadonlySet<ToolId> = new Set<ToolId>([
  "pen",
  "line",
  "spline",
  "tree",
  "bed",
]);

function FlyoutHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className={styles.header}>
      <span className={styles.headerTitle}>{title}</span>
      {hint ? <span className={styles.headerHint}>{hint}</span> : null}
    </div>
  );
}

function NibPicker() {
  const activeNib = useStudioStore((s) => s.activeNib);
  const setActiveNib = useStudioStore((s) => s.setActiveNib);
  const brushWidthOverride = useStudioStore((s) => s.brushWidthOverride);
  const setBrushWidthOverride = useStudioStore((s) => s.setBrushWidthOverride);
  const strokeSmoothing = useStudioStore((s) => s.strokeSmoothing);
  const setStrokeSmoothing = useStudioStore((s) => s.setStrokeSmoothing);
  const eraserActive = useStudioStore((s) => s.eraserActive);
  const toggleEraser = useStudioStore((s) => s.toggleEraser);
  const cameraPreset = useStudioStore((s) => s.cameraPreset);
  const activeSpec = NIBS[activeNib];
  const currentWidth = brushWidthOverride ?? activeSpec.baseWidthPx;
  // Phase L.6 — weight control converts mm to screen px in 3D per the chrome
  // contract. In 3D the unit is screen px (mm-at-scale is meaningless without
  // a sheet scale); the contract note says so beneath the slider.
  const weightBehaviour = behaviourOf("weightControl", cameraPreset);
  const weightConverted = weightBehaviour.kind === "convert";
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
      {/* Phase I — stroke-matching eraser toggle. */}
      <button
        className={`${styles.eraserBtn} ${eraserActive ? styles.eraserBtnActive : ""}`}
        onClick={toggleEraser}
        title={
          eraserActive
            ? "Eraser active — click a stroke to delete it (scales to the stroke's width)"
            : "Stroke-matching eraser — click a stroke to delete it"
        }
        data-testid="eraser-toggle"
        data-active={eraserActive}
      >
        ERASE
      </button>
    </div>
  );
}

/** Phase I — visual texture preview for a nib. Renders an SVG stroke
 *  that approximates the nib's texture (width, color, edge softness). */
function BrushTexturePreview({ spec }: { spec: typeof NIBS[keyof typeof NIBS] }) {
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

function AssetGrid() {
  const armedSymbolId = useStudioStore((s) => s.armedSymbolId);
  const setArmedSymbolId = useStudioStore((s) => s.setArmedSymbolId);
  const palette = useRef(buildAssetPalette()).current;
  return (
    <div className={styles.section}>
      <FlyoutHeader title="Assets" hint="⇧A" />
      <div className={styles.assetGrid}>
        {palette.map((entry) => {
          const active = armedSymbolId === entry.symbolId;
          return (
            <button
              key={entry.symbolId}
              className={`${styles.asset} ${active ? styles.assetActive : ""}`}
              data-symbol-id={entry.symbolId}
              data-active={active}
              onClick={() => setArmedSymbolId(entry.symbolId)}
              title={entry.botanicalName ?? entry.label}
            >
              <span className={styles.assetGlyph}>{entry.glyph}</span>
              <span className={styles.assetName}>{entry.label}</span>
              {entry.spreadM ? (
                <span className={styles.assetMeta}>{entry.spreadM.toFixed(1)}m</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PlanePicker() {
  const activePlaneId = useStudioStore((s) => s.activePlaneId);
  const setActivePlaneId = useStudioStore((s) => s.setActivePlaneId);
  const planes = useRef([
    { id: "massing" as const, label: "MAS", z: "+4.00" },
    { id: "planting" as const, label: "PLT", z: "+1.50" },
    { id: "ground" as const, label: "GRD", z: "0.00" },
  ]).current;
  return (
    <div className={styles.section}>
      <FlyoutHeader title="Target plane" />
      <div className={styles.planeGrid}>
        {planes.map((plane) => {
          const active = activePlaneId === plane.id;
          return (
            <button
              key={plane.id}
              className={`${styles.plane} ${active ? styles.planeActive : ""}`}
              data-plane-id={plane.id}
              data-active={active}
              onClick={() => setActivePlaneId(plane.id)}
            >
              <span className={styles.planeName}>{plane.label}</span>
              <span className={styles.planeZ}>{plane.z}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Falloff preset picker (turn 14c) — NARROW / BALANCED / WIDE.
 *  Controls the angle-opacity falloff curve on canvas strokes.
 *  NARROW for working (steeper fade), WIDE for presenting a fly-through. */
function FalloffPicker() {
  const falloffPreset = useStudioStore((s) => s.falloffPreset);
  const setFalloffPreset = useStudioStore((s) => s.setFalloffPreset);
  const presets = useRef<{ id: FalloffPreset; label: string; hint: string }[]>([
    { id: "NARROW", label: "NARROW", hint: "for working" },
    { id: "BALANCED", label: "BALANCED", hint: "general use" },
    { id: "WIDE", label: "WIDE", hint: "for fly-through" },
  ]).current;
  return (
    <div className={styles.section}>
      <FlyoutHeader title="Falloff" hint="14c" />
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
    </div>
  );
}

/** The content column for a given tool — null when the tool has no flyout. */
function FlyoutContent({ tool }: { tool: ToolId }) {
  switch (tool) {
    case "pen":
    case "line":
    case "spline":
      return (
        <>
          <NibPicker />
          <MaterialPalette />
          <PlanePicker />
          <FalloffPicker />
        </>
      );
    case "tree":
    case "bed":
      return <AssetGrid />;
    default:
      return null;
  }
}

/** Viewport margin the flyout must never cross — keeps it fully reachable
 *  even when the active tile sits near the top or bottom of a tall ribbon
 *  (e.g. SECTION, HISTORY). */
const EDGE_MARGIN_PX = 20;

export function ToolFlyout({ tool, handedness }: ToolFlyoutProps) {
  const content = FlyoutContent({ tool });
  const panelRef = useRef<HTMLDivElement>(null);
  const [topPx, setTopPx] = useState<number | null>(null);

  // §5.3: vertically centred on the active tile, arrow tip on the tile's
  // centre line — not the ribbon or viewport centre. Measure the active
  // tile's own position (it can sit anywhere across a 13-tool ribbon) and
  // the flyout's own rendered height, then place its centre on the tile's.
  useLayoutEffect(() => {
    const tile = document.querySelector<HTMLElement>(
      `[data-testid="tool-ribbon"] [data-tool-id="${tool}"][data-active="true"]`,
    );
    const panel = panelRef.current;
    if (!tile || !panel) {
      setTopPx(null);
      return;
    }
    const tileCenter = tile.getBoundingClientRect().top + tile.getBoundingClientRect().height / 2;
    const halfHeight = panel.getBoundingClientRect().height / 2;
    const min = EDGE_MARGIN_PX + halfHeight;
    const max = window.innerHeight - EDGE_MARGIN_PX - halfHeight;
    setTopPx(Math.min(Math.max(tileCenter, min), max));
  }, [tool, content]);

  if (!content) return null;
  // Ribbon sits hand-opposite (right-handed → left edge). So for a
  // right-handed operator the flyout blooms to the RIGHT of the ribbon; for a
  // left-handed operator (ribbon on the right edge) it blooms to the LEFT.
  const onLeft = handedness === "LEFT";
  const origin = onLeft ? "right center" : "left center";
  return (
    <div
      ref={panelRef}
      className={`${styles.flyout} ${onLeft ? styles.flyoutLeft : styles.flyoutRight}`}
      style={
        {
          "--flyout-origin": origin,
          // Falls back to the CSS module's `top: 50%` only for the one
          // frame before the tile has been measured.
          ...(topPx != null ? { top: topPx } : {}),
        } as CSSProperties
      }
      data-testid="tool-flyout"
      data-tool-id={tool}
    >
      <span className={`${styles.arrow} ${onLeft ? styles.arrowLeft : styles.arrowRight}`} />
      {content}
    </div>
  );
}
