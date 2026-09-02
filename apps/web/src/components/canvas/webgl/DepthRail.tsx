"use client";

/**
 * Spatial Sketching — Depth Rail (Phase B).
 *
 * Spec canonical screen 16a (Drafting): "two-way depth rail" — cells 36×34
 * (§4 Geometry). Renders in all non-sketch modes (the cards rail takes over
 * in Sketch mode per 16b). Shows the fixed reference bands (MAS/PLT), the
 * ground plane (GRD), and the subsurface utility depths (SRV/SUB).
 *
 * User canvas planes are NOT shown here — they live in the CanvasCardsRail
 * (Sketch mode only). The depth rail is the honest Z reference for every
 * non-sketch mode: survey, CAD, elevation, garden, quote, present, share.
 */

import type { CanvasMode } from "../../../lib/canvas-mode";
import { useStudioStore } from "./studioStore";
import styles from "./FloatingChrome.module.css";

/** Subsurface utility depth bands (handoff §5.3). Standard Melbourne
 *  service depths — read-only reference, never arms the trench tool.
 *  Kept in sync with FloatingChrome's SUBSURFACE_DEPTHS (the non-sketch rail
 *  owns them now; the cards rail does not). */
const SUBSURFACE_DEPTHS: Array<{ id: string; label: string; depth: number }> = [
  { id: "gas", label: "GAS", depth: 0.6 },
  { id: "water", label: "H2O", depth: 0.75 },
  { id: "elec", label: "ELEC", depth: 0.9 },
  { id: "sewer", label: "SEW", depth: 1.5 },
  { id: "telco", label: "TEL", depth: 0.45 },
];

export interface DepthRailProps {
  /** The active studio mode — renders in all modes EXCEPT "sketch". */
  mode: CanvasMode;
  /** Handedness mirrors the rail to the hand-opposite edge. */
  handedness: "LEFT" | "RIGHT";
  /** Anchor dimming style (applied when anchor visibility is DIMMED/FOCUS). */
  anchorStyle?: React.CSSProperties;
}

export function DepthRail({ mode, handedness, anchorStyle }: DepthRailProps) {
  const activeCanvasId = useStudioStore((s) => s.activeCanvasId);
  const setActiveCanvasId = useStudioStore((s) => s.setActiveCanvasId);

  const isLeft = handedness === "LEFT";
  const railSide = isLeft ? styles.railLeft : styles.railRight;

  if (mode === "sketch") return null;

  return (
    <div className={`${styles.rail} ${railSide}`} style={anchorStyle}>
      <div className={styles.railHeader}>Z</div>
      {/* Fixed plane stack (spec 1.1) — planting/massing are proposed
          targets that do not accept drawing geometry yet; they render as
          honest reference bands, never as selectable draw targets. */}
      <div
        className={`${styles.cell} ${styles.cellFixed}`}
        title="Massing Z +4.00 — proposed plane (drawing support pending)"
      >
        MAS
      </div>
      <div
        className={`${styles.cell} ${styles.cellFixed}`}
        title="Planting Z +1.50 — proposed plane (drawing support pending)"
      >
        PLT
      </div>
      <button
        className={`${styles.cell} ${activeCanvasId === null ? styles.cellActive : ""}`}
        onClick={() => setActiveCanvasId(null)}
        title="Ground plane"
      >
        GRD
      </button>

      {/* Ground-line divider — separates positive planes from subsurface */}
      <div className={styles.railGroundLine} />

      {/* Survey base — imported cadastre reference, read-only (spec 6.2). */}
      <div
        className={`${styles.cell} ${styles.cellSubsurface}`}
        title="Survey base Z −0.02 — imported, read-only"
      >
        SRV
      </div>

      {/* Subsurface utility depths — redline accent (handoff §5.3).
          Read-only reference; see SUBSURFACE_DEPTHS for why these never
          arm the trench tool. */}
      <div className={styles.railSubsurfaceLabel}>SUB</div>
      {SUBSURFACE_DEPTHS.map((u) => (
        <div
          key={u.id}
          className={`${styles.cell} ${styles.cellSubsurface}`}
          title={`${u.label} — ${u.depth}m below ground (DBYD reference)`}
        >
          {u.label}
        </div>
      ))}
    </div>
  );
}
