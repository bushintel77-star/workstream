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
import { useStudioStore, type ToolId } from "./studioStore";
import { NIBS, NIB_ORDER } from "./nibs";
import { buildAssetPalette } from "./assetPalette";
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
  return (
    <div className={styles.section}>
      <FlyoutHeader title="Nib" hint="p/alt" />
      <div className={styles.nibGrid}>
        {NIB_ORDER.map((kind) => {
          const spec = NIBS[kind];
          const active = activeNib === kind;
          return (
            <button
              key={kind}
              className={`${styles.nib} ${active ? styles.nibActive : ""}`}
              data-nib={kind}
              data-active={active}
              onClick={() => setActiveNib(kind)}
              title={spec.purpose}
            >
              <span className={styles.nibSwatch} style={{ background: spec.color }} />
              <span className={styles.nibLabel}>{spec.shortLabel}</span>
            </button>
          );
        })}
      </div>
    </div>
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

/** The content column for a given tool — null when the tool has no flyout. */
function FlyoutContent({ tool }: { tool: ToolId }) {
  switch (tool) {
    case "pen":
    case "line":
    case "spline":
      return (
        <>
          <NibPicker />
          <PlanePicker />
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
