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
 *
 * Reactive flash: when a Tidy conversion commits geometry to a Z-plane, the
 * corresponding band flashes stark white for 150ms — a mechanical LED
 * confirmation on a physical hardware rack.
 */

import { useEffect, useState } from "react";
import type { CanvasMode } from "../../../lib/canvas-mode";
import { useStudioStore } from "./studioStore";
import { behaviourOf } from "./chromeContract";
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

/** Flash duration in ms — mechanical LED confirmation. */
const FLASH_MS = 150;

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
  const activePlaneId = useStudioStore((s) => s.activePlaneId);
  const setActivePlaneId = useStudioStore((s) => s.setActivePlaneId);
  const cameraPreset = useStudioStore((s) => s.cameraPreset);
  const depthRailFlash = useStudioStore((s) => s.depthRailFlash);
  const penDown = useStudioStore((s) => s.penDown);

  // Track which plane is currently flashing (150ms LED confirmation)
  const [flashPlane, setFlashPlane] = useState<string | null>(null);

  useEffect(() => {
    if (depthRailFlash.planeId && depthRailFlash.at > 0) {
      setFlashPlane(depthRailFlash.planeId);
      const timer = setTimeout(() => setFlashPlane(null), FLASH_MS);
      return () => clearTimeout(timer);
    }
  }, [depthRailFlash]);

  const isLeft = handedness === "LEFT";
  const railSide = isLeft ? styles.railLeft : styles.railRight;

  if (mode === "sketch") return null;

  // Phase L.7 — depth rail converts per the chrome contract:
  //   3D  → skewed stack (reads as space, same position)
  //   SEC → band selector MAS/PLT/GRD/SUB
  const depthBehaviour = behaviourOf("depthRail", cameraPreset);
  const depthMode =
    depthBehaviour.kind === "convert" && cameraPreset === "3d"
      ? "skewed"
      : depthBehaviour.kind === "convert" && cameraPreset === "sec"
        ? "selector"
        : "stack";

  return (
    <div
      className={`${styles.rail} ${railSide} ${penDown ? styles.railPenQuiet : ""}`}
      style={anchorStyle}
      data-depth-mode={depthMode}
      data-testid="depth-rail"
    >
      <div className={styles.railHeader}>Z</div>
      {/* Fixed plane stack (spec 1.1) — all three planes now accept drawing
          geometry via the Tidy conversion Z-plane routing. MAS and PLT are
          no longer "pending" — they receive classified strokes. */}
      <div
        className={`${styles.cell} ${styles.cellFixed} ${flashPlane === "massing" ? styles.cellFlash : ""}`}
        title="Massing Z +4.00 — walls and structural masses"
      >
        MAS
      </div>
      <div
        className={`${styles.cell} ${styles.cellFixed} ${flashPlane === "planting" ? styles.cellFlash : ""}`}
        title="Planting Z +1.50 — planting beds and softscape"
      >
        PLT
      </div>
      <button
        className={`${styles.cell} ${activeCanvasId === null && activePlaneId === "ground" ? styles.cellActive : ""} ${flashPlane === "ground" ? styles.cellFlash : ""}`}
        onClick={() => {
          setActivePlaneId("ground");
          setActiveCanvasId(null);
        }}
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
