"use client";

/**
 * Tidy HUD — cursor-anchored classifier feedback (handoff §7.3).
 *
 * Spawned by FusedSketchLayer at the pen lift (only for strokes that pass
 * the conversion gate), positioned at the [x, y] pixel coordinates of the
 * lift. It is isolated from the left vertical tool ribbon and the depth
 * rail — it lives at the gesture terminal, not the perimeter.
 *
 * The HUD shows:
 *   - The classifier's recognized kind (ditch / path / wall / bed)
 *   - A Z-plane cycle toggle (GRD → PLT → MAS) — one tap cycles
 *   - A stark white ✓ commit button
 *
 * The Z-plane toggle pre-selects the classifier's default mapping
 * (wall→MAS, bed→PLT, ditch/path→GRD) and lets the operator override
 * before commit. Cycling writes `tidyPreviewZ` to the store, and
 * TidyPreviewLayer lifts the stroke's ghost to that Z in the 3D scene —
 * the operator sees exactly what they'll get ("the drawing is the
 * product"), before commit.
 *
 * On commit (✓), the HUD dispatches the single stroke with the selected
 * Z-height via `convertStrokesToCadFeaturesWithPlanes` (which converts
 * ONLY this stroke — ink already converted earlier is never duplicated),
 * then self-destructs. ESC dismisses without committing.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useStudioStore } from "./studioStore";
import { recognizeStroke } from "@workstream/domain";
import { FIXED_PLANE_LABELS, kindPlane, planeZ, type FixedPlaneId } from "./planeStack";
import styles from "./TidyHud.module.css";

const PLANE_CYCLE: FixedPlaneId[] = ["ground", "planting", "massing"];

export interface TidyHudProps {
  /** Pixel x of the pen-lift terminal point. */
  x: number;
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
  const setTidyPreviewZ = useStudioStore((s) => s.setTidyPreviewZ);
  const strokes = useStudioStore((s) => s.sketchStrokes);

  // Classify the triggering stroke
  const stroke = strokes.find((s) => s.id === strokeId);
  const recognition = stroke ? recognizeStroke(stroke) : null;

  // Default Z-plane from the classifier mapping
  const defaultPlane: FixedPlaneId = recognition
    ? kindPlane(recognition.kind)
    : "ground";

  const [selectedPlane, setSelectedPlane] = useState<FixedPlaneId>(defaultPlane);
  /** Set once the operator cycles — after that, their choice is theirs. */
  const touchedRef = useRef(false);

  // The stroke may not be in the store yet on the first render; adopt the
  // classifier default when it arrives, unless the operator already cycled.
  useEffect(() => {
    if (!touchedRef.current) setSelectedPlane(defaultPlane);
  }, [defaultPlane]);

  // The live preview lift — the ghost in the 3D scene tracks the toggle.
  useEffect(() => {
    setTidyPreviewZ(planeZ(selectedPlane));
    return () => setTidyPreviewZ(null);
  }, [selectedPlane, setTidyPreviewZ]);

  // Cycle GRD → PLT → MAS
  const cyclePlane = useCallback(() => {
    touchedRef.current = true;
    setSelectedPlane((prev) => {
      const idx = PLANE_CYCLE.indexOf(prev);
      return PLANE_CYCLE[(idx + 1) % PLANE_CYCLE.length]!;
    });
  }, []);

  // Commit: convert this one stroke with the selected Z-height
  const commit = useCallback(() => {
    const z = planeZ(selectedPlane);
    const overrides = new Map<string, number>();
    overrides.set(strokeId, z);
    convertWithPlanes(overrides);
    onDismiss();
  }, [strokeId, selectedPlane, convertWithPlanes, onDismiss]);

  // ESC dismisses without committing. stopPropagation so the global
  // Esc (clear selection) doesn't also fire for the same keypress.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onDismiss();
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
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
