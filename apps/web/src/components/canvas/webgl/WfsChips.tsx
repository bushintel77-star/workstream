"use client";

/**
 * Landscape Canvas v2 — WFS context chips (handoff §5.4).
 *
 * Top bar: PrimaryChip (project name + AXO 22° · N↑ · 1:200) then a 1px
 * divider, then translucent pills for active overlays: GRZ10, BAL-12.5
 * (hazard colour + triangle glyph), Water Corp easement, Canopy A2–6,
 * then a dashed +N WFS overflow chip.
 *
 * Single row, never wraps — overflow into the count. Use glyph marks,
 * not emoji. Pen-down quiet state: chips → 20% opacity (§5.5).
 */

import { useStudioStore } from "./studioStore";
import styles from "./WfsChips.module.css";

/* ---- overlay chip definitions ---- */

interface OverlayChip {
  id: string;
  label: string;
  glyph?: string;
  hazard?: boolean;
}

/* ---- component ---- */

export interface WfsChipsProps {
  /** Active overlay chips (WFS layers, constraints, easements). */
  overlays?: OverlayChip[];
  /** North bearing in degrees (null = uncalibrated). */
  northBearingDeg?: number | null;
  /** Scale ratio string, e.g. "1:200". */
  scaleRatio?: string;
}

export function WfsChips({
  overlays = [],
  northBearingDeg = null,
  scaleRatio = "1:200",
}: WfsChipsProps) {
  const projectAddress = useStudioStore((s) => s.projectAddress);
  const cameraPreset = useStudioStore((s) => s.cameraPreset);
  const penDown = useStudioStore((s) => s.penDown);

  const cameraLabel =
    cameraPreset === "plan" ? "PLAN"
      : cameraPreset === "axo" ? "AXO 22°"
      : cameraPreset === "sec" ? "SEC"
      : "3D";

  const northLabel = northBearingDeg != null ? "N↑" : "N?";

  // Overflow count — chips beyond 4 go into the +N chip
  const visibleOverlays = overlays.slice(0, 4);
  const overflowCount = overlays.length - visibleOverlays.length;

  return (
    <div
      className={`${styles.chipBar} ${penDown ? styles.chipBarQuiet : ""}`}
      data-testid="wfs-chip-bar"
    >
      {/* Primary chip — project name + camera + north + scale */}
      <div className={styles.primaryChip}>
        <div className={styles.primaryAccentSquare} />
        <span className={styles.primaryName}>
          {projectAddress || "Untitled site"}
        </span>
        <span className={styles.primaryMeta}>
          {cameraLabel} · {northLabel} · {scaleRatio}
        </span>
      </div>

      {/* 1px divider */}
      {visibleOverlays.length > 0 && <div className={styles.divider} />}

      {/* Overlay pills */}
      {visibleOverlays.map((chip) => (
        <div
          key={chip.id}
          className={`${styles.overlayPill} ${chip.hazard ? styles.overlayPillHazard : ""}`}
          data-overlay-id={chip.id}
        >
          {chip.glyph && <span className={styles.overlayGlyph}>{chip.glyph}</span>}
          <span className={styles.overlayLabel}>{chip.label}</span>
        </div>
      ))}

      {/* Overflow chip — dashed +N WFS */}
      {overflowCount > 0 && (
        <div className={styles.overflowChip}>
          +{overflowCount} WFS
        </div>
      )}
    </div>
  );
}
