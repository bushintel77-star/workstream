"use client";

/**
 * Spatial Sketching — Canvas Cards Rail (Phase B).
 *
 * Spec canonical screen 16b (Sketch): "canvases-as-cards rail" — cards
 * 74×46, radius 9, gap 7 (§4 Geometry). Replaces the depth rail's user-canvas
 * chip block when the studio is in Sketch mode. The depth rail (DepthRail.tsx)
 * renders in all other modes.
 *
 * Card anatomy (Phase B "at minimum" + inline rename):
 * - Live thumbnail (inline SVG from board-% strokes, canvasThumbnail.ts)
 * - Name (canvas.label or Z shorthand)
 * - Eye toggle (view-state visibility — §14c: "a faded canvas keeps a 1px
 *   edge and its list row; invisible is a view state, not a disappearance")
 * - Delete on hover (removeSketchCanvas — strokes fall back to ground)
 * - Single click → select (setActiveCanvasId)
 * - Double click → re-arm placement gizmo (setActiveCanvasId + setAdjustingCanvasId
 *   together, so the gizmos' divergence guard sees both ids equal)
 * - Double click on label → inline rename (updateSketchCanvas)
 * - Season tag cycle (preserved from the old chip block)
 *
 * Global transparency toggle at the rail header drives inactiveCanvasOpacity
 * (fades all non-active canvases — the Mental Canvas "Transparency Toggle").
 */

import { useMemo, useState } from "react";
import type { CanvasMode } from "../../../lib/canvas-mode";
import { useStudioStore } from "./studioStore";
import { canvasThumbnailSvg } from "./canvasThumbnail";
import styles from "./CanvasCardsRail.module.css";

const SEASON_TAGS = ["ALL", "SUMMER", "WINTER"] as const;
type SeasonTag = (typeof SEASON_TAGS)[number];

function nextSeasonTag(current: SeasonTag): SeasonTag {
  const idx = SEASON_TAGS.indexOf(current);
  return SEASON_TAGS[(idx + 1) % SEASON_TAGS.length]!;
}

function seasonTagLabel(tag: SeasonTag): string {
  switch (tag) {
    case "SUMMER": return "SUM";
    case "WINTER": return "WIN";
    case "ALL":
    default: return "ALL";
  }
}

function zLabel(z: number): string {
  if (z === 0) return "GRD";
  return z.toFixed(1).replace(/\.0$/, "");
}

export interface CanvasCardsRailProps {
  /** The active studio mode — only renders when mode === "sketch". */
  mode: CanvasMode;
  /** Handedness mirrors the rail to the hand-opposite edge. */
  handedness: "LEFT" | "RIGHT";
  /** Height (m) to offer as the default for a fresh flat plane. */
  defaultHeightM: number;
  /** Opens the placement flyout (owned by FloatingChrome). */
  onAddClick: () => void;
}

export function CanvasCardsRail({
  mode,
  handedness,
  onAddClick,
}: CanvasCardsRailProps) {
  const canvases = useStudioStore((s) => s.sketchCanvases);
  const activeCanvasId = useStudioStore((s) => s.activeCanvasId);
  const sketchStrokes = useStudioStore((s) => s.sketchStrokes);
  const hiddenCanvasIds = useStudioStore((s) => s.hiddenCanvasIds);
  const inactiveCanvasOpacity = useStudioStore((s) => s.inactiveCanvasOpacity);
  const setActiveCanvasId = useStudioStore((s) => s.setActiveCanvasId);
  const setAdjustingCanvasId = useStudioStore((s) => s.setAdjustingCanvasId);
  const updateSketchCanvas = useStudioStore((s) => s.updateSketchCanvas);
  const removeSketchCanvas = useStudioStore((s) => s.removeSketchCanvas);
  const toggleCanvasVisibility = useStudioStore((s) => s.toggleCanvasVisibility);
  const setInactiveCanvasOpacity = useStudioStore((s) => s.setInactiveCanvasOpacity);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const isLeft = handedness === "LEFT";
  const railSide = isLeft ? styles.railLeft : styles.railRight;

  const sortedCanvases = useMemo(
    () => [...canvases].sort((a, b) => b.position[1] - a.position[1]),
    [canvases],
  );

  if (mode !== "sketch") return null;

  function startRename(id: string, currentLabel: string | undefined) {
    setRenamingId(id);
    setRenameValue(currentLabel ?? "");
  }

  function commitRename() {
    if (renamingId) {
      const trimmed = renameValue.trim();
      if (trimmed) {
        updateSketchCanvas(renamingId, { label: trimmed });
      }
    }
    setRenamingId(null);
    setRenameValue("");
  }

  function handleRenameKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitRename();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setRenamingId(null);
      setRenameValue("");
    }
  }

  return (
    <div className={`${styles.rail} ${railSide}`}>
      <div className={styles.railHeader}>PLANES</div>

      {/* Transparency toggle — fades all inactive canvases */}
      <div className={styles.transparencyRow}>
        <span className={styles.transparencyLabel}>FADE</span>
        <input
          type="range"
          className={styles.transparencySlider}
          min={0.15}
          max={1}
          step={0.05}
          value={inactiveCanvasOpacity}
          onChange={(e) => setInactiveCanvasOpacity(parseFloat(e.target.value))}
          title="Fade inactive canvases"
          data-testid="canvas-transparency-slider"
        />
      </div>

      {sortedCanvases.map((canvas) => {
        const isActive = canvas.id === activeCanvasId;
        const isHidden = hiddenCanvasIds.includes(canvas.id);
        const isRenaming = renamingId === canvas.id;
        const currentTag = (canvas.season_tag ?? "ALL") as SeasonTag;
        const thumbSvg = canvasThumbnailSvg(sketchStrokes, canvas.id);
        const label = canvas.label ?? zLabel(canvas.position[1]);

        return (
          <div key={canvas.id} className={styles.cardGroup}>
            <div
              className={`${styles.card} ${isActive ? styles.cardActive : ""} ${isHidden ? styles.cardHidden : ""}`}
              onClick={() => setActiveCanvasId(canvas.id)}
              onDoubleClick={() => {
                // Re-arm the placement gizmo: set both ids together so the
                // gizmos' divergence guard (activeCanvasId === adjustingCanvasId)
                // sees them equal and stays armed.
                setActiveCanvasId(canvas.id);
                setAdjustingCanvasId(canvas.id);
              }}
              title={`${label} — click to select, double-click to adjust`}
              data-testid="canvas-card"
              data-canvas-id={canvas.id}
              data-active={isActive ? "true" : "false"}
              data-hidden={isHidden ? "true" : "false"}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter") setActiveCanvasId(canvas.id);
              }}
            >
              {/* Thumbnail (inline SVG from board-% strokes) */}
              <div
                className={styles.thumb}
                dangerouslySetInnerHTML={{ __html: thumbSvg }}
              />

              {/* Eye toggle — view-state visibility (§14c) */}
              <button
                className={`${styles.eyeBtn} ${isHidden ? styles.eyeBtnHidden : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleCanvasVisibility(canvas.id);
                }}
                title={isHidden ? "Show canvas" : "Hide canvas"}
                data-testid="canvas-eye-toggle"
                aria-label={isHidden ? "Show canvas" : "Hide canvas"}
              >
                {isHidden ? "\u25CB" : "\u25CF"}
              </button>

              {/* Delete button — removeSketchCanvas (strokes → ground) */}
              <button
                className={styles.deleteBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  removeSketchCanvas(canvas.id);
                }}
                title="Delete canvas (strokes move to ground)"
                data-testid="canvas-delete-btn"
                aria-label="Delete canvas"
              >
                {"\u00D7"}
              </button>

              {/* Name label or inline rename input */}
              {isRenaming ? (
                <input
                  className={styles.nameInput}
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={handleRenameKeyDown}
                  onClick={(e) => e.stopPropagation()}
                  onDoubleClick={(e) => e.stopPropagation()}
                  autoFocus
                  maxLength={80}
                  placeholder="Name"
                  data-testid="canvas-rename-input"
                />
              ) : (
                <span
                  className={styles.name}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    startRename(canvas.id, canvas.label);
                  }}
                  title="Double-click to rename"
                >
                  {label}
                </span>
              )}
            </div>

            {/* Season tag cycle (preserved from the old chip block) */}
            <button
              className={`${styles.seasonTag} ${currentTag === "SUMMER"
                ? styles.seasonTagSummer
                : currentTag === "WINTER"
                  ? styles.seasonTagWinter
                  : styles.seasonTagAll
                }`}
              onClick={(e) => {
                e.stopPropagation();
                updateSketchCanvas(canvas.id, {
                  ...canvas,
                  season_tag: nextSeasonTag(currentTag),
                });
              }}
              title={`Season: ${canvas.season_tag ?? "ALL"} — click to cycle`}
            >
              {seasonTagLabel(currentTag)}
            </button>
          </div>
        );
      })}

      {/* Ground plane — the implicit default (activeCanvasId = null) */}
      <button
        className={`${styles.groundCell} ${activeCanvasId === null ? styles.groundCellActive : ""}`}
        onClick={() => setActiveCanvasId(null)}
        title="Ground plane"
        data-testid="canvas-ground-card"
      >
        GRD
      </button>

      {/* Add-canvas button — opens the placement flyout */}
      <button
        className={styles.addCell}
        onClick={onAddClick}
        title="Place a new sketch plane"
        data-testid="canvas-add-card"
      >
        +
      </button>
    </div>
  );
}
