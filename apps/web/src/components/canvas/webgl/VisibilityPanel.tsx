"use client";

/**
 * Phase J — Visibility Panel (per-bookmark canvas visibility keyframing).
 *
 * A dropdown panel that blooms above the viewpoint filmstrip when the
 * visibility button is clicked. Shows a matrix: rows = canvases, columns =
 * viewpoints. Each cell is an eye toggle (visible/hidden) that drives
 * `toggleViewpointVisibility(viewpointId, canvasId)` in the store.
 *
 * During walk playback, the FlythroughRig reads `viewpointVisibility` to
 * hide canvases not listed for the active viewpoint — this panel is the
 * editor for those keyframes.
 *
 * The panel is pure DOM chrome — it lives in the WebGL chrome overlay,
 * never inside the R3F <Canvas>.
 */

import { useStudioStore } from "./studioStore";
import styles from "./VisibilityPanel.module.css";

export interface VisibilityPanelProps {
  /** Whether the panel is open (controlled by the filmstrip's visibility button). */
  open: boolean;
  /** Called when the panel requests to close (backdrop click or close button). */
  onClose: () => void;
}

export function VisibilityPanel({ open, onClose }: VisibilityPanelProps) {
  const bookmarks = useStudioStore((s) => s.cameraBookmarks);
  const canvases = useStudioStore((s) => s.sketchCanvases);
  const viewpointVisibility = useStudioStore((s) => s.viewpointVisibility);
  const toggleViewpointVisibility = useStudioStore(
    (s) => s.toggleViewpointVisibility,
  );

  if (!open) return null;

  // No viewpoints or no canvases — nothing to keyframe.
  if (bookmarks.length === 0 || canvases.length === 0) {
    return (
      <div className={styles.panel} data-testid="visibility-panel">
        <div className={styles.header}>
          <span className={styles.title}>Visibility</span>
          <button
            className={styles.closeBtn}
            onClick={onClose}
            title="Close visibility panel"
            data-testid="visibility-panel-close"
          >
            x
          </button>
        </div>
        <div className={styles.empty}>
          {bookmarks.length === 0
            ? "Capture viewpoints first to keyframe canvas visibility."
            : "Add sketch canvases first to keyframe their visibility."}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Backdrop — click to close. pointer-events: auto only on the
          backdrop, so the panel itself still receives clicks. */}
      <div
        className={styles.backdrop}
        onClick={onClose}
        data-testid="visibility-panel-backdrop"
      />

      <div className={styles.panel} data-testid="visibility-panel">
        <div className={styles.header}>
          <span className={styles.title}>Visibility</span>
          <span className={styles.hint}>
            Toggle which canvases are visible at each viewpoint during the walk.
          </span>
          <button
            className={styles.closeBtn}
            onClick={onClose}
            title="Close visibility panel"
            data-testid="visibility-panel-close"
          >
            x
          </button>
        </div>

        {/* Matrix: rows = canvases, columns = viewpoints. */}
        <div className={styles.matrix} data-testid="visibility-matrix">
          {/* Header row — viewpoint numbers. */}
          <div className={styles.matrixHeader}>
            <div className={styles.matrixCorner} />
            {bookmarks.map((vp, i) => (
              <div
                key={vp.id}
                className={styles.matrixColHeader}
                title={`Viewpoint ${i + 1}`}
              >
                {i + 1}
              </div>
            ))}
          </div>

          {/* Body rows — one per canvas. */}
          {canvases.map((canvas) => {
            const label = canvas.label ?? `Z${canvas.position[1].toFixed(1)}`;
            return (
              <div key={canvas.id} className={styles.matrixRow}>
                <div className={styles.matrixRowLabel} title={label}>
                  {label}
                </div>
                {bookmarks.map((vp) => {
                  const visibleList = viewpointVisibility[vp.id] ?? [];
                  // When a viewpoint has no keyframe entry, all canvases are
                  // visible (the default). Once any canvas is toggled for a
                  // viewpoint, only the listed canvases are visible.
                  const hasKeyframe = vp.id in viewpointVisibility;
                  const isVisible = hasKeyframe
                    ? visibleList.includes(canvas.id)
                    : true;
                  return (
                    <button
                      key={vp.id}
                      className={`${styles.cellBtn} ${
                        isVisible ? styles.cellVisible : styles.cellHidden
                      }`}
                      onClick={() =>
                        toggleViewpointVisibility(vp.id, canvas.id)
                      }
                      title={`${label} ${isVisible ? "visible" : "hidden"} at viewpoint ${
                        bookmarks.findIndex((b) => b.id === vp.id) + 1
                      }`}
                      data-testid="visibility-cell"
                      data-canvas-id={canvas.id}
                      data-viewpoint-id={vp.id}
                      data-visible={isVisible ? "true" : "false"}
                    >
                      {isVisible ? "\u25CF" : "\u25CB"}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
