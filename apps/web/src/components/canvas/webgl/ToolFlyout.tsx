"use client";

/**
 * Landscape Canvas v2 — Tool Flyout (handoff §5.3 "blooming").
 *
 * The second-tier column that blooms beside the ribbon when the active tool
 * has a flyout. Anchored to the ACTIVE TOOL'S TILE by the Tier-1 alignment
 * law (useFlyoutAnchor): vertically centred on the tile's live rect, arrow
 * on the tile's centre line, re-placed whenever the ribbon re-lays (pen-down
 * rail), the panel's own height changes, or the window moves.
 *
 * Honesty contract (§0.1, never ship a dead control): every control here backs
 * real store state. Content mapping per the Tier-1 widget standard (§2.2):
 *   - DRAW (pen/line/spline) → BrushWidget (nib, width, smoothing, opacity,
 *     eraser + collapsed falloff) — colour lives in the palette widget,
 *     anchored to the colour-well tile;
 *   - PLANT (tree/bed)       → asset palette + Target plane (the plane is a
 *     *where*, not a *what* — it sits with placement, not with the nib);
 *   - BUILD (mass)           → Target plane.
 *
 * Tools that have no real parameter state render no flyout (a tool is only
 * given a flyout when this component has something genuine to show).
 */

import { useRef, type CSSProperties } from "react";
import { useStudioStore, type ToolId } from "./studioStore";
import { buildAssetPalette } from "./assetPalette";
import { BrushWidget, FlyoutHeader } from "./BrushWidget";
import { useFlyoutAnchor } from "./useFlyoutAnchor";
import styles from "./ToolFlyout.module.css";

export interface ToolFlyoutProps {
  /** The active tool (the flyout only renders when it has content). */
  tool: ToolId;
}

/** The tool set that genuinely supports a flyout with real state today. */
export const FLYOUT_TOOLS: ReadonlySet<ToolId> = new Set<ToolId>([
  "pen",
  "line",
  "spline",
  "tree",
  "bed",
  // mass gains a flyout with the Tier-1 split: the target plane is a real
  // store-backed parameter (activePlaneId) and mass placement is exactly
  // where a "which plane does this land on" control belongs.
  "mass",
]);

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
    <div className={styles.section} data-testid="plane-picker">
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
      return <BrushWidget />;
    case "tree":
    case "bed":
      return (
        <>
          <AssetGrid />
          <PlanePicker />
        </>
      );
    case "mass":
      return <PlanePicker />;
    default:
      return null;
  }
}

export function ToolFlyout({ tool }: ToolFlyoutProps) {
  const content = FlyoutContent({ tool });
  // The content is tool-driven, so `tool` is the content key — a stable
  // primitive (the panel's ResizeObserver covers height changes within a
  // tool, e.g. the Falloff disclosure).
  const { panelRef, topPx, leftPx, rightPx, ribbonOnLeft } = useFlyoutAnchor(
    tool,
    tool,
  );

  if (!content) return null;
  // Geometry comes from the live ribbon rect (useFlyoutAnchor) — top tracks
  // the anchor tile's centre line, left/right track the ribbon's actual edge
  // at its current width. The pre-measurement frame falls back to the CSS.
  return (
    <div
      ref={panelRef}
      className={styles.flyout}
      style={
        {
          ...(topPx != null ? { top: topPx } : {}),
          ...(ribbonOnLeft
            ? { left: leftPx ?? undefined }
            : { right: rightPx ?? undefined }),
        } as CSSProperties
      }
      data-testid="tool-flyout"
      data-tool-id={tool}
    >
      <span className={`${styles.arrow} ${ribbonOnLeft ? styles.arrowLeft : styles.arrowRight}`} />
      {content}
    </div>
  );
}
