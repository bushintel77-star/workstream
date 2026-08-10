"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { CameraChrome } from "../../CameraChrome";
import {
  SKETCH_TIP_GRADES,
  SKETCH_TIP_LABEL,
  type SketchTipGrade,
} from "./sketchCursors";
import css from "./sketchDock.module.css";

type SketchTool = "pen" | "eraser" | "line" | "rect" | "circle";

/**
 * Landscape-relevant pen colours — the semantic drawing colours operators
 * already know from the plan, plus annotation black/grey. Not a full wheel:
 * the pen is for sketching site details, not painting illustrations.
 */
const PEN_COLOURS = [
  { id: "ink", label: "Ink", value: "var(--text-primary)" },
  { id: "proposed", label: "Proposed", value: "var(--proposed-stroke)" },
  { id: "existing", label: "Existing", value: "var(--existing-stroke)" },
  { id: "planting", label: "Planting", value: "var(--planting-new-stroke)" },
  { id: "retain", label: "Retained", value: "var(--planting-retain-stroke)" },
  { id: "water", label: "Water", value: "var(--water-l-500)" },
  { id: "grey", label: "Annotation", value: "var(--gray-l-500)" },
] as const;

export type SketchPenColour = (typeof PEN_COLOURS)[number]["id"];

/** Resolve a colour id to its CSS value (for stroke fill). */
export function PEN_COLOUR_VALUE(id: SketchPenColour): string {
  return PEN_COLOURS.find((c) => c.id === id)?.value ?? PEN_COLOURS[0]!.value;
}

type Props = {
  tool: SketchTool;
  tip: SketchTipGrade;
  /** Pen ink colour — drives stroke fill. */
  penColour?: SketchPenColour;
  onPenColour?: (colour: SketchPenColour) => void;
  formalizing?: boolean;
  /**
   * Whether the pen tool is armed (see `SketchBoard`). When it is not, drags
   * fall through to grab-pan and these controls act as a re-arm affordance
   * rather than a live toolbar, so the dock recedes.
   */
  active?: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  onTool: (tool: SketchTool) => void;
  onTip: (tip: SketchTipGrade) => void;
  onActivate?: () => void;
  onOpenImageLayers?: () => void;
  /** Undo last stroke — disabled when no strokes or formalizing. */
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  /** Soften ink in place — stays hand-drawn. */
  onTidy?: () => void;
  /** Freehand → CAD ghosts. */
  onFormalizeToCad?: () => void;
  /** Stroke count — drives Tidy/Formalize visibility. */
  strokeCount?: number;
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

function UndoIcon() {
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
      <path d="M3 7v6h6" />
      <path d="M3 13a9 9 0 1 1 3 7" />
    </svg>
  );
}

function RedoIcon() {
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
      <path d="M21 7v6h-6" />
      <path d="M21 13a9 9 0 1 0-3 7" />
    </svg>
  );
}

function TidyIcon() {
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
      <path d="M4 20l4-12 4 12M6 16h4M14 20l3-10 3 10M15.5 16h3" />
    </svg>
  );
}

function FormalizeIcon() {
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
      <path d="M4 18L14 8M10 6h4v4M6 14H4v-2" />
      <path d="M16 14l4 4M20 14v4h-4" />
    </svg>
  );
}

function LineIcon() {
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
      <path d="M5 19L19 5" />
      <circle cx="5" cy="19" r="1.5" fill="currentColor" />
      <circle cx="19" cy="5" r="1.5" fill="currentColor" />
    </svg>
  );
}

function RectIcon() {
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
      <rect x="4" y="6" width="16" height="12" rx="1" />
    </svg>
  );
}

function CircleIcon() {
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
      <circle cx="12" cy="12" r="8" />
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
  penColour = "ink",
  onPenColour,
  formalizing = false,
  active = true,
  anchorRef,
  onTool,
  onTip,
  onActivate,
  onOpenImageLayers,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  onTidy,
  onFormalizeToCad,
  strokeCount = 0,
}: Props) {
  const [tipOpen, setTipOpen] = useState(false);
  const [colourOpen, setColourOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const colourPopoverRef = useRef<HTMLDivElement | null>(null);

  const setTool = (next: SketchTool) => {
    onTool(next);
    setTipOpen(false);
    setColourOpen(false);
    onActivate?.();
  };

  const toggleTip = () => {
    if (tool === "eraser") {
      setTool("pen");
    }
    setColourOpen(false);
    setTipOpen((v) => !v);
    onActivate?.();
  };

  const toggleColour = () => {
    if (tool === "eraser") {
      setTool("pen");
    }
    setTipOpen(false);
    setColourOpen((v) => !v);
    onActivate?.();
  };

  const currentColour = PEN_COLOURS.find((c) => c.id === penColour) ?? PEN_COLOURS[0]!;

  // Outside-click: close whichever popover is open. Both popovers stop
  // propagation on their own pointer-down, so a click that reaches the
  // document is by definition outside.
  useEffect(() => {
    if (!tipOpen && !colourOpen) return;
    const onDown = () => {
      setTipOpen(false);
      setColourOpen(false);
    };
    document.addEventListener("pointerdown", onDown, { once: true });
    return () => document.removeEventListener("pointerdown", onDown);
  }, [tipOpen, colourOpen]);

  return (
    <CameraChrome anchorRef={anchorRef}>
      <div
        className={css.dock}
        data-testid="sketch-convert-bar"
        data-active={active ? "1" : "0"}
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
          className={`${css.tool}${tool === "line" ? ` ${css.toolActive}` : ""}`}
          data-testid="sketch-line"
          aria-pressed={tool === "line"}
          aria-label={tool === "line" ? "Line" : "Switch to line"}
          disabled={formalizing}
          title="Line — drag to draw a straight line"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setTool("line")}
        >
          <LineIcon />
        </button>

        <button
          type="button"
          className={`${css.tool}${tool === "rect" ? ` ${css.toolActive}` : ""}`}
          data-testid="sketch-rect"
          aria-pressed={tool === "rect"}
          aria-label={tool === "rect" ? "Rectangle" : "Switch to rectangle"}
          disabled={formalizing}
          title="Rectangle — drag to draw a rectangle"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setTool("rect")}
        >
          <RectIcon />
        </button>

        <button
          type="button"
          className={`${css.tool}${tool === "circle" ? ` ${css.toolActive}` : ""}`}
          data-testid="sketch-circle"
          aria-pressed={tool === "circle"}
          aria-label={tool === "circle" ? "Circle" : "Switch to circle"}
          disabled={formalizing}
          title="Circle — drag to draw an ellipse"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setTool("circle")}
        >
          <CircleIcon />
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

        <button
          type="button"
          className={`${css.tool}${colourOpen ? ` ${css.toolActive}` : ""}`}
          data-testid="sketch-colour"
          aria-pressed={colourOpen}
          aria-expanded={colourOpen}
          aria-label={`Colour: ${currentColour.label}`}
          disabled={formalizing}
          title={`Colour: ${currentColour.label}`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={toggleColour}
        >
          <span
            className={css.colourSwatch}
            style={{ background: currentColour.value }}
            aria-hidden
          />
        </button>

        {colourOpen ? (
          <div
            ref={colourPopoverRef}
            className={css.colourPopover}
            role="group"
            aria-label="Pen colour"
            data-testid="sketch-colour-picker"
            onPointerDown={(e) => e.stopPropagation()}
          >
            {PEN_COLOURS.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`${css.colourChip}${penColour === c.id ? ` ${css.colourChipActive}` : ""}`}
                data-testid={`sketch-colour-${c.id}`}
                aria-label={c.label}
                aria-pressed={penColour === c.id}
                title={c.label}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => {
                  onPenColour?.(c.id);
                  setColourOpen(false);
                  onActivate?.();
                }}
              >
                <span
                  className={css.colourDot}
                  style={{ background: c.value }}
                  aria-hidden
                />
              </button>
            ))}
          </div>
        ) : null}

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

        {onUndo || onRedo ? (
          <>
            <div className={css.divider} aria-hidden />
            <button
              type="button"
              className={css.tool}
              data-testid="sketch-undo-stroke"
              aria-label="Undo"
              disabled={formalizing || (!canUndo && strokeCount === 0)}
              title="Undo last stroke"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => onUndo?.()}
            >
              <UndoIcon />
            </button>
            <button
              type="button"
              className={css.tool}
              data-testid="sketch-redo"
              aria-label="Redo"
              disabled={formalizing || !canRedo}
              title="Redo"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => onRedo?.()}
            >
              <RedoIcon />
            </button>
          </>
        ) : null}

        {strokeCount > 0 && (onTidy || onFormalizeToCad) ? (
          <>
            <div className={css.divider} aria-hidden />
            {onTidy ? (
              <button
                type="button"
                className={css.tool}
                data-testid="sketch-tidy"
                aria-label="Tidy"
                disabled={formalizing}
                title="Tidy — soften ink, stays hand-drawn"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={onTidy}
              >
                <TidyIcon />
              </button>
            ) : null}
            {onFormalizeToCad ? (
              <button
                type="button"
                className={`${css.tool}${formalizing ? ` ${css.toolActive}` : ""}`}
                data-testid="sketch-convert-cad"
                aria-label="Formalize to CAD"
                disabled={formalizing}
                aria-busy={formalizing}
                title={
                  formalizing
                    ? "Translating sketch to CAD with AI…"
                    : "Formalize to CAD — translate freehand to CAD ghosts"
                }
                onPointerDown={(e) => e.stopPropagation()}
                onClick={onFormalizeToCad}
              >
                <FormalizeIcon />
              </button>
            ) : null}
          </>
        ) : null}

        {tipOpen ? (
          <div
            ref={popoverRef}
            className={css.tipPopover}
            role="group"
            aria-label="Pen tip grade"
            data-testid="sketch-tip-grade"
            onPointerDown={(e) => e.stopPropagation()}
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
