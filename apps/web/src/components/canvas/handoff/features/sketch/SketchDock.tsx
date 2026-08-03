"use client";

import { useRef, useState, type RefObject } from "react";
import { CameraChrome } from "../../CameraChrome";
import {
  SKETCH_TIP_GRADES,
  SKETCH_TIP_LABEL,
  type SketchTipGrade,
} from "./sketchCursors";
import css from "./sketchDock.module.css";

type SketchTool = "pen" | "eraser";

type Props = {
  tool: SketchTool;
  tip: SketchTipGrade;
  formalizing?: boolean;
  /**
   * Whether the dock is the active surface. Passed by SketchBoard and currently
   * ignored — the counterpart `onActivate` fires on every tool/tip change, but
   * nothing reads `active`, so the dock always renders at full presence instead
   * of receding when it is not the active surface. Kept, not deleted — see
   * OUTSTANDING.md.
   */
  active?: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  onTool: (tool: SketchTool) => void;
  onTip: (tip: SketchTipGrade) => void;
  onActivate?: () => void;
  onOpenImageLayers?: () => void;
};

function PenIcon() {
  return (
    <svg
      className={css.icon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M18.4 2.6l3 3L6.8 21.2l-3-3L18.4 2.6z" />
      <path d="M16 5l2-2" />
    </svg>
  );
}

function EraserIcon() {
  return (
    <svg
      className={css.icon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M19.7 14.3l-9 9-6.7-6.7 9-9 6.7 6.7z" />
      <path d="M4 17h11" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg
      className={css.icon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <circle cx="8" cy="10" r="1.5" fill="currentColor" />
      <path d="M4 17l5-5 3 3 5-6 3 3" />
    </svg>
  );
}

function TipIcon() {
  return (
    <svg
      className={css.icon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2.5" fill="currentColor" />
    </svg>
  );
}

/**
 * Clean Procreate-style sketch tool dock.
 *
 * Pen, eraser, and brush tip in a single frosted pill. Nothing fixed or
 * opaque — it appears over the board and dismisses with idle chrome.
 */
export function SketchDock({
  tool,
  tip,
  formalizing = false,
  active: _active = true,
  anchorRef,
  onTool,
  onTip,
  onActivate,
  onOpenImageLayers,
}: Props) {
  const [tipOpen, setTipOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const setTool = (next: SketchTool) => {
    onTool(next);
    if (next === "eraser") {
      setTipOpen(false);
    }
    onActivate?.();
  };

  const toggleTip = () => {
    if (tool === "eraser") {
      setTool("pen");
    }
    setTipOpen((v) => !v);
    onActivate?.();
  };

  return (
    <CameraChrome anchorRef={anchorRef}>
      <div
        className={css.dock}
        data-testid="sketch-convert-bar"
        role="toolbar"
        aria-label="Sketch tools"
      >
        <button
          type="button"
          className={`${css.tool}${tool === "pen" ? ` ${css.toolActive}` : ""}`}
          data-testid="sketch-pen"
          aria-pressed={tool === "pen"}
          aria-label={tool === "pen" ? "Pen" : "Switch to pen"}
          disabled={formalizing}
          title={tool === "pen" ? "Pen — draw ink strokes" : "Switch to pen"}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setTool("pen")}
        >
          <PenIcon />
        </button>

        <button
          type="button"
          className={`${css.tool}${tool === "eraser" ? ` ${css.toolActive}` : ""}`}
          data-testid="sketch-eraser"
          aria-pressed={tool === "eraser"}
          aria-label={tool === "eraser" ? "Eraser" : "Switch to eraser"}
          disabled={formalizing}
          title={
            tool === "eraser" ? "Eraser — remove strokes" : "Switch to eraser"
          }
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setTool("eraser")}
        >
          <EraserIcon />
        </button>

        <div className={css.divider} aria-hidden />

        <button
          type="button"
          className={`${css.tool}${tipOpen ? ` ${css.toolActive}` : ""}`}
          data-testid="sketch-brush"
          aria-pressed={tipOpen}
          aria-expanded={tipOpen}
          aria-label={`Tip: ${SKETCH_TIP_LABEL[tip]}`}
          disabled={formalizing}
          title={`Tip: ${SKETCH_TIP_LABEL[tip]}`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={toggleTip}
        >
          <TipIcon />
        </button>

        <div className={css.divider} aria-hidden />

        <button
          type="button"
          className={css.tool}
          data-testid="sketch-image"
          aria-label="Image layers"
          disabled={formalizing}
          title="Image layers — upload or manage underlays"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onOpenImageLayers}
        >
          <ImageIcon />
        </button>

        {tipOpen ? (
          <div
            ref={popoverRef}
            className={css.tipPopover}
            role="group"
            aria-label="Pen tip grade"
            data-testid="sketch-tip-grade"
          >
            {SKETCH_TIP_GRADES.map((grade) => (
              <button
                key={grade}
                type="button"
                className={`${css.tip}${tip === grade ? ` ${css.tipActive}` : ""}`}
                data-testid={`sketch-tip-${grade}`}
                aria-pressed={tip === grade}
                disabled={formalizing}
                title={SKETCH_TIP_LABEL[grade]}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => {
                  onTip(grade);
                  setTipOpen(false);
                }}
              >
                <span
                  className={css.tipDot}
                  data-grade={grade}
                  aria-hidden
                />
                {SKETCH_TIP_LABEL[grade]}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </CameraChrome>
  );
}
