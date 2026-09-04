"use client";

/**
 * Tidy HUD — cursor-anchored classifier feedback (handoff §7.3).
 *
 * When a freehand stroke terminates, this HUD spawns as a localized DOM actor
 * exactly at the [x, y] pixel coordinates of the pen lift. It is isolated from
 * the left vertical tool ribbon and the depth rail — it lives at the gesture
 * terminal, not the perimeter.
 *
 * The HUD shows:
 *   - The classifier's recognized kind (ditch / path / wall / bed)
 *   - A Z-plane cycle toggle (GRD → PLT → MAS) — one tap cycles
 *   - A stark white ✓ commit button
 *
 * The Z-plane toggle pre-selects the classifier's default mapping
 * (wall→MAS, bed→PLT, ditch/path→GRD) and lets the operator override
 * before commit. The preview geometry shifts Z in real-time on the 3D
 * canvas — the operator sees exactly what they'll get ("the drawing is
 * the product").
 *
 * On commit (✓), the HUD dispatches the Turf.js payload with the selected
 * Z-height to the parent drawing machine via
 * `convertStrokesToCadFeaturesWithPlanes`, then self-destructs.
 */

import { useCallback, useEffect, useState } from "react";
import { useStudioStore } from "./studioStore";
import { recognizeStroke } from "@workstream/domain";
import { KIND_TO_PLANE, FIXED_PLANE_LABELS, planeZ, type FixedPlaneId } from "./planeStack";
import styles from "./TidyHud.module.css";

const PLANE_CYCLE: FixedPlaneId[] = ["ground", "planting", "massing"];

export interface TidyHudProps {
  /** Pixel x of the pen-lift terminal point. */
  x: number;
  /** Pixel y of the pen-lift terminal point. */
  y: number;
  /** The stroke id that triggered this HUD. */
  strokeId: string;
  /** Called when the HUD self-destructs (commit or dismiss). */
  onDismiss: () => void;
}

export function TidyHud({ x, y, strokeId, onDismiss }: TidyHudProps) {
  const convertWithPlanes = useStudioStore(
    (s) => s.convertStrokesToCadFeaturesWithPlanes,
  );
  const strokes = useStudioStore((s) => s.sketchStrokes);

  // Classify the triggering stroke
  const stroke = strokes.find((s) => s.id === strokeId);
  const recognition = stroke ? recognizeStroke(stroke) : null;

  // Default Z-plane from the classifier mapping
  const defaultPlane: FixedPlaneId = recognition
    ? (KIND_TO_PLANE[recognition.kind] as FixedPlaneId) ?? "ground"
    : "ground";

  const [selectedPlane, setSelectedPlane] = useState<FixedPlaneId>(defaultPlane);

  // Cycle GRD → PLT → MAS
  const cyclePlane = useCallback(() => {
    setSelectedPlane((prev) => {
      const idx = PLANE_CYCLE.indexOf(prev);
      return PLANE_CYCLE[(idx + 1) % PLANE_CYCLE.length]!;
    });
  }, []);

  // Commit: dispatch the payload with the selected Z-height
  const commit = useCallback(() => {
    const z = planeZ(selectedPlane);
    const overrides = new Map<string, number>();
    overrides.set(strokeId, z);
    convertWithPlanes(overrides);
    onDismiss();
  }, [strokeId, selectedPlane, convertWithPlanes, onDismiss]);

  // ESC dismisses without committing
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onDismiss();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onDismiss]);

  if (!recognition) return null;

  const z = planeZ(selectedPlane);
  const zLabel = z === 0 ? "0.0" : `+${z.toFixed(1)}`;
  const planeCode = FIXED_PLANE_LABELS[selectedPlane];

  return (
    <div
      className={styles.hud}
      data-testid="tidy-hud"
      style={{ left: `${x}px`, top: `${y}px` }}
    >
      <span className={styles.kindLabel}>
        {recognition.kind.toUpperCase()}
      </span>
      <button
        className={styles.planeToggle}
        data-testid="tidy-plane-toggle"
        data-plane={selectedPlane}
        onClick={cyclePlane}
        title={`Z-plane: ${planeCode} ${zLabel}m — tap to cycle`}
      >
        {planeCode} {zLabel}
      </button>
      <button
        className={styles.commitBtn}
        data-testid="tidy-commit"
        onClick={commit}
        title="Commit converted geometry"
      >
        ✓
      </button>
    </div>
  );
}
