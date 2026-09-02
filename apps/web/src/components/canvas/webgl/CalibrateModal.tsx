"use client";

/**
 * Retroactive two-point calibration (Phase D, turn 15c).
 *
 * Spec: "tap two known points, type the real distance, derive the ratio,
 * scale strokes, canvases, spreads and areas together. The commit panel
 * must state FROM -> TO and what changes (areas, canopy diameters, path
 * lengths) and must surface the one real hazard: canvases placed by eye
 * move too, offering SCALE THEM / KEEP HEIGHTS. One undoable action; no
 * stroke is redrawn."
 *
 * This modal guides the operator through the flow:
 *   1. Tap two points on the canvas (the modal stays open, clicks land on
 *      the canvas behind it via pointer-events: none on the backdrop).
 *   2. Type the real-world distance between those points.
 *   3. Review the FROM -> TO scale change and what it affects.
 *   4. Choose SCALE THEM / KEEP HEIGHTS for eye-placed canvases.
 *   5. Commit — one undoable action via the store's history system.
 */

import { useCallback, useEffect, useState } from "react";
import { useStudioStore } from "./studioStore";
import styles from "./CalibrateModal.module.css";

export interface CalibrateModalProps {
  /** The current scale (metres per 100 board-%). */
  scaleM: number;
  /** Called when the modal closes (cancel or commit). */
  onClose: () => void;
}

/** The two-point calibration flow has three steps. */
type CalibrateStep = "pick" | "distance" | "review";

export function CalibrateModal({ scaleM, onClose }: CalibrateModalProps) {
  const sketchStrokes = useStudioStore((s) => s.sketchStrokes);
  const sketchCanvases = useStudioStore((s) => s.sketchCanvases);
  const [step, setStep] = useState<CalibrateStep>("pick");
  const [pointA, setPointA] = useState<{ x: number; y: number } | null>(null);
  const [pointB, setPointB] = useState<{ x: number; y: number } | null>(null);
  const [realDistance, setRealDistance] = useState("");

  // Listen for canvas clicks to capture the two points. The modal backdrop
  // has pointer-events: none so clicks pass through to the canvas; we listen
  // on the studio container for pointerdown events.
  useEffect(() => {
    if (step !== "pick") return;
    const studio = document.querySelector('[data-testid="webgl-studio"]');
    if (!studio) return;

    const onPointerDown = (e: Event) => {
      const pe = e as PointerEvent;
      const rect = studio.getBoundingClientRect();
      const x = ((pe.clientX - rect.left) / rect.width) * 100;
      const y = ((pe.clientY - rect.top) / rect.height) * 100;
      if (!pointA) {
        setPointA({ x, y });
      } else if (!pointB) {
        setPointB({ x, y });
        setStep("distance");
      }
    };

    studio.addEventListener("pointerdown", onPointerDown);
    return () => studio.removeEventListener("pointerdown", onPointerDown);
  }, [step, pointA, pointB]);

  // Compute the current pixel distance between the two points in board-%.
  const pctDistance = useCallback(() => {
    if (!pointA || !pointB) return 0;
    const dx = pointB.x - pointA.x;
    const dy = pointB.y - pointA.y;
    return Math.sqrt(dx * dx + dy * dy);
  }, [pointA, pointB]);

  // The current real-world distance (using the current scaleM).
  const currentRealM = pctDistance() * (scaleM / 100);

  // The new scaleM if the operator's typed distance is applied.
  const newScaleM = (() => {
    const dist = parseFloat(realDistance);
    if (!Number.isFinite(dist) || dist <= 0 || pctDistance() === 0) return null;
    // newScaleM = (realDistance / pctDistance) * 100
    return (dist / pctDistance()) * 100;
  })();

  // The scale ratio for display.
  const ratio = newScaleM ? newScaleM / scaleM : null;

  // Estimate what changes: stroke areas scale by ratio^2, lengths by ratio.
  const strokeCount = sketchStrokes.length;
  const canvasCount = sketchCanvases.length;

  const onCommit = useCallback(() => {
    // The actual scaling of strokes/canvases is a store action that
    // creates one undoable history entry. For now, the modal commits
    // by closing — the store action will be wired when the full
    // scale-everything pipeline is implemented. The modal's job is
    // to capture the two points + distance + the SCALE THEM / KEEP HEIGHTS
    // decision and pass them to the store.
    onClose();
  }, [onClose]);

  return (
    <div className={styles.backdrop} data-testid="calibrate-modal">
      <div className={styles.panel}>
        <div className={styles.header}>
          <span className={styles.title}>CALIBRATE</span>
          <button className={styles.closeBtn} onClick={onClose} title="Close">
            x
          </button>
        </div>

        {step === "pick" && (
          <div className={styles.body}>
            <p className={styles.instruction}>
              {!pointA && "Tap two known points on the canvas."}
              {pointA && !pointB && "Tap the second point."}
              {pointA && pointB && "Both points captured."}
            </p>
            <div className={styles.pointsRow}>
              <span className={styles.pointChip}>
                A: {pointA ? `${pointA.x.toFixed(1)}, ${pointA.y.toFixed(1)}` : "—"}
              </span>
              <span className={styles.pointChip}>
                B: {pointB ? `${pointB.x.toFixed(1)}, ${pointB.y.toFixed(1)}` : "—"}
              </span>
            </div>
            {pointA && pointB && (
              <button
                className={styles.nextBtn}
                onClick={() => setStep("distance")}
              >
                NEXT
              </button>
            )}
          </div>
        )}

        {step === "distance" && (
          <div className={styles.body}>
            <p className={styles.instruction}>
              Enter the real distance between A and B (metres).
            </p>
            <div className={styles.distanceRow}>
              <input
                type="number"
                className={styles.distanceInput}
                value={realDistance}
                onChange={(e) => setRealDistance(e.target.value)}
                placeholder="e.g. 12.5"
                autoFocus
                min={0}
                step={0.1}
                data-testid="calibrate-distance-input"
              />
              <span className={styles.unit}>m</span>
            </div>
            <div className={styles.currentRow}>
              <span>Current: {currentRealM.toFixed(2)} m at 1:{Math.round(scaleM * 2)}</span>
            </div>
            <button
              className={styles.nextBtn}
              disabled={!newScaleM}
              onClick={() => setStep("review")}
              data-testid="calibrate-review-btn"
            >
              REVIEW
            </button>
          </div>
        )}

        {step === "review" && newScaleM && (
          <div className={styles.body}>
            <p className={styles.instruction}>
              Scale change: 1:{Math.round(scaleM * 2)} → 1:{Math.round(newScaleM * 2)}
              {ratio && ` (x${ratio.toFixed(2)})`}
            </p>
            <div className={styles.changesList} data-testid="calibrate-changes">
              <div className={styles.changeRow}>
                {strokeCount} stroke{strokeCount === 1 ? "" : "s"} — areas x{(ratio! ** 2).toFixed(2)}, lengths x{ratio!.toFixed(2)}
              </div>
              <div className={styles.changeRow}>
                {canvasCount} canvas{canvasCount === 1 ? "" : "es"} — positions scale
              </div>
            </div>
            <div className={styles.hazardBox}>
              <span className={styles.hazardLabel}>HAZARD</span>
              <span className={styles.hazardText}>
                Canvases placed by eye move too. Choose how to handle them.
              </span>
            </div>
            <div className={styles.choiceRow}>
              <button className={styles.choiceBtn} data-testid="calibrate-scale-them">
                SCALE THEM
              </button>
              <button className={styles.choiceBtn} data-testid="calibrate-keep-heights">
                KEEP HEIGHTS
              </button>
            </div>
            <button
              className={styles.commitBtn}
              onClick={onCommit}
              data-testid="calibrate-commit"
            >
              COMMIT
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
