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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStudioStore } from "./studioStore";
import { recognizeStroke } from "@workstream/domain";
import { FIXED_PLANE_LABELS, kindPlane, planeZ, type FixedPlaneId } from "./planeStack";
import { reconcileWallFootprint, wallFromStandingStroke } from "./wallSeam";
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
  const canvases = useStudioStore((s) => s.sketchCanvases);
  const boardScale = useStudioStore((s) => s.boardScale);
  const siteBoundary = useStudioStore((s) => s.siteBoundary);

  // Classify the triggering stroke
  const stroke = strokes.find((s) => s.id === strokeId);
  const recognition = stroke ? recognizeStroke(stroke) : null;

  // Phase 4 seam — standing-canvas wall preset (D1/D2). A wall is a wall by
  // GEOMETRY, not classification, so this runs before the recognizer and
  // replaces the plane cycle with the massing preset: plane locked, drawn
  // height readout, reconciliation chip.
  const wall = useMemo(() => {
    if (!stroke || !boardScale) return null;
    const canvas = stroke.canvas_id
      ? canvases.find((c) => c.id === stroke.canvas_id)
      : undefined;
    if (!canvas) return null;
    const w = wallFromStandingStroke(
      stroke,
      canvas,
      boardScale.scaleM,
      boardScale.boardAspect,
    );
    if (!w) return null;
    return {
      ...w,
      reconciliation: reconcileWallFootprint(w.footprintPct, siteBoundary),
    };
  }, [stroke, canvases, boardScale, siteBoundary]);

  // Default Z-plane from the classifier mapping
  const defaultPlane: FixedPlaneId = wall
    ? "massing"
    : recognition
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

  if (!recognition && !wall) return null;

  const z = planeZ(selectedPlane);
  const zLabel = z === 0 ? "0.0" : `+${z.toFixed(1)}`;
  const planeCode = FIXED_PLANE_LABELS[selectedPlane];

  // Phase 4 seam — the wall preset HUD: plane locked to massing, the drawn
  // height as a live numeral, and the D1 reconciliation chip. No plane
  // cycle: a wall's plane is not an operator choice, it is its geometry.
  if (wall) {
    return (
      <div
        className={styles.hud}
        data-testid="tidy-hud"
        style={{ left: `${x}px`, top: `${y}px` }}
      >
        <span className={styles.kindLabel}>WALL</span>
        <span
          className={styles.planeToggle}
          data-testid="tidy-wall-preset"
          data-plane="massing"
          title="Wall preset — massing plane +4.0 m, drawn height carried to the feature"
        >
          MAS +4.0 · {wall.drawnHeightM.toFixed(1)} m drawn
        </span>
        <span
          className={styles.reconciliationChip}
          data-testid="tidy-wall-reconciliation"
          data-reconciliation={wall.reconciliation.kind}
          title={
            wall.reconciliation.kind === "crosses"
              ? "The footprint crosses the title boundary — it lands where drawn, flagged"
              : wall.reconciliation.kind === "contained"
                ? "Footprint contained in the title boundary"
                : "No title boundary on this project — locational-indicative"
          }
        >
          {wall.reconciliation.kind === "crosses"
            ? "⚠ crosses title"
            : wall.reconciliation.kind === "contained"
              ? "✓ in title"
              : "indicative"}
        </span>
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

  return (
    <div
      className={styles.hud}
      data-testid="tidy-hud"
      style={{ left: `${x}px`, top: `${y}px` }}
    >
      <span className={styles.kindLabel}>
        {(recognition?.kind ?? "ink").toUpperCase()}
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
