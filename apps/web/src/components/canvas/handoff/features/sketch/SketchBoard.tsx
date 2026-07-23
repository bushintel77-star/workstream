"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { strokePointsToPathD } from "@workstream/domain";
import type { SketchStroke } from "../../studioCatalog";
import type { PctPoint } from "../../geometry";
import {
  findSketchStrokeAtPoint,
  shouldAppendSketchPoint,
  sketchWidthForPointer,
} from "./sketchInput";
import {
  SKETCH_TIP_GRADES,
  SKETCH_TIP_LABEL,
  type SketchTipGrade,
} from "./sketchCursors";
import { CameraChrome } from "../../CameraChrome";
import { MarginStrip } from "../surfaces/MarginStrip";
import marginCss from "../surfaces/marginStrip.module.css";
import css from "./sketch.module.css";

type SketchTool = "pen" | "eraser";

type Props = {
  strokes: SketchStroke[];
  darkOn: boolean;
  /** Commit a finished stroke (once per pointer-up — not per move). */
  onCommit?: (stroke: SketchStroke) => void;
  /** Whole-stroke eraser keeps the first tablet workflow predictable. */
  onErase?: (strokeId: string) => void;
  onUndoLast?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  /** Soften ink in place — stays hand-drawn, not CAD symbols. */
  onTidy?: () => void;
  /** Optional formalize: freehand → CAD ghosts on the site plan. */
  onFormalizeToCad?: () => void;
  /** True while the AI sketch→CAD pipeline is in flight. */
  formalizing?: boolean;
  /** CAD reference underlay: shows ink without intercepting plan input. */
  readOnly?: boolean;
  /**
   * Tool owns the click (docs/INTERACTION-LOGIC.md): the pad only inks while
   * the studio pen tool is armed. Inactive pad lets drags fall through to
   * the grab-pan surface; picking Pen / Eraser / a tip re-arms via onActivate.
   */
  active?: boolean;
  onActivate?: () => void;
  /**
   * Suppress the convert bar / hint chrome (e.g. Fit sheet on — the sheet is
   * a proofing lens; strokes stay visible, tools step aside).
   */
  hideChrome?: boolean;
  /** Report pen/eraser + tip so the parent owns the canvas cursor. */
  onChromeChange?: (chrome: {
    tool: SketchTool;
    tip: SketchTipGrade;
  }) => void;
};

type ActiveStroke = {
  pointerId: number;
  pointerType: string;
  points: PctPoint[];
  pressureTotal: number;
  pressureCount: number;
};

/**
 * Stripped sketch pad — finger / stylus ink only.
 * CadPlanBoard hides symbols while this mounts; site boundary stays faint.
 * Raw ink on commit — tidy / formalize are explicit, opt-in later steps.
 */
export function SketchBoard({
  strokes,
  darkOn,
  onCommit,
  onErase,
  onUndoLast,
  onRedo,
  canUndo = false,
  canRedo = false,
  onTidy,
  onFormalizeToCad,
  formalizing = false,
  readOnly = false,
  active = true,
  onActivate,
  hideChrome = false,
  onChromeChange,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const drawing = useRef<ActiveStroke | null>(null);
  const idn = useRef(0);
  const [tool, setTool] = useState<SketchTool>("pen");
  const [tip, setTip] = useState<SketchTipGrade>("medium");
  const [live, setLive] = useState<{
    points: PctPoint[];
    widthPx: number;
  } | null>(null);
  const [size, setSize] = useState({ w: 960, h: 640 });

  useEffect(() => {
    if (readOnly) return;
    onChromeChange?.({ tool, tip });
  }, [tool, tip, readOnly, onChromeChange]);

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const sync = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 1 && r.height > 1) {
        setSize({ w: Math.round(r.width), h: Math.round(r.height) });
      }
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const toPct = (el: HTMLElement, clientX: number, clientY: number): PctPoint => {
    const r = el.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100)),
      y: Math.max(0, Math.min(100, ((clientY - r.top) / r.height) * 100)),
    };
  };

  const finishDrawing = (
    event: ReactPointerEvent<HTMLDivElement>,
    commit: boolean,
  ) => {
    const active = drawing.current;
    if (!active || active.pointerId !== event.pointerId) return;
    drawing.current = null;
    setLive(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!commit || active.points.length < 2 || !onCommit) return;
    idn.current += 1;
    const averagePressure =
      active.pressureCount > 0
        ? active.pressureTotal / active.pressureCount
        : null;
    // Raw ink only — zero tidy/snap/resample on commit. Tidy stays opt-in.
    onCommit({
      id: `sk${Date.now()}_${idn.current}`,
      points: active.points,
      widthPx: sketchWidthForPointer(
        active.pointerType,
        averagePressure,
        tip,
      ),
    });
  };

  const all = live
    ? [...strokes, { id: "__live", points: live.points, widthPx: live.widthPx }]
    : strokes;
  const canAct = strokes.length > 0;
  const ink = darkOn ? "#C9C2BA" : "#1C1917";

  return (
    <div
      ref={rootRef}
      className={css.root}
      data-testid="sketch-board"
      data-sketch-pad={readOnly ? "reference" : "draw"}
      data-read-only={readOnly ? "true" : "false"}
      data-active={active ? "true" : "false"}
      data-tool={tool}
      onPointerDown={(e) => {
        if (readOnly || formalizing || !active || !e.isPrimary) return;
        if (e.pointerType === "mouse" && e.button !== 0) return;
        const p = toPct(e.currentTarget, e.clientX, e.clientY);
        if (tool === "eraser") {
          const strokeId = findSketchStrokeAtPoint(
            strokes,
            p,
            size.w,
            size.h,
          );
          if (strokeId) onErase?.(strokeId);
          return;
        }
        if (drawing.current) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        const pressure =
          e.pointerType === "pen" && e.pressure > 0 ? e.pressure : null;
        drawing.current = {
          pointerId: e.pointerId,
          pointerType: e.pointerType,
          points: [p],
          pressureTotal: pressure ?? 0,
          pressureCount: pressure == null ? 0 : 1,
        };
        setLive({
          points: [p],
          widthPx: sketchWidthForPointer(e.pointerType, pressure, tip),
        });
      }}
      onPointerMove={(e) => {
        const active = drawing.current;
        if (!active || active.pointerId !== e.pointerId) return;
        const p = toPct(e.currentTarget, e.clientX, e.clientY);
        const previous = active.points[active.points.length - 1]!;
        if (!shouldAppendSketchPoint(previous, p)) return;
        active.points = [...active.points, p];
        if (active.pointerType === "pen" && e.pressure > 0) {
          active.pressureTotal += e.pressure;
          active.pressureCount += 1;
        }
        const averagePressure =
          active.pressureCount > 0
            ? active.pressureTotal / active.pressureCount
            : null;
        setLive({
          points: active.points,
          widthPx: sketchWidthForPointer(
            active.pointerType,
            averagePressure,
            tip,
          ),
        });
      }}
      onPointerUp={(e) => finishDrawing(e, true)}
      onPointerCancel={(e) => finishDrawing(e, false)}
      onLostPointerCapture={(e) => finishDrawing(e, false)}
    >
      <svg
        className={css.svg}
        viewBox={`0 0 ${size.w} ${size.h}`}
        preserveAspectRatio="none"
      >
        {all.map((s) => {
          const d = strokePointsToPathD(
            s.points.map((p) => ({ x_pct: p.x, y_pct: p.y })),
            size.w,
            size.h,
            s.widthPx ?? (s.id === "__live" ? 1.9 : 2.1),
            { raw: true },
          );
          if (!d) return null;
          return (
            <path
              key={s.id}
              d={d}
              fill={ink}
              opacity={s.id === "__live" ? 0.55 : 0.88}
              style={{ pointerEvents: "none" }}
            />
          );
        })}
      </svg>
      {!readOnly && !hideChrome ? (
        <>
          <CameraChrome anchorRef={rootRef}>
            <div
              className={css.tray}
              data-testid="sketch-convert-bar"
              role="toolbar"
              aria-label="Sketch tools"
            >
              <button
                type="button"
                className={`${css.chip}${active && tool === "pen" ? ` ${css.chipArmed}` : ""}`}
                data-testid="sketch-pen"
                aria-pressed={active && tool === "pen"}
                disabled={formalizing}
                title="Fine-tip marker — grade tip for thicker ink"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => {
                  setTool("pen");
                  onActivate?.();
                }}
              >
                <span className={css.chipGlyph} aria-hidden>
                  ✎
                </span>
                Pen
              </button>
              <button
                type="button"
                className={`${css.chip}${active && tool === "eraser" ? ` ${css.chipArmed}` : ""}`}
                data-testid="sketch-eraser"
                aria-pressed={active && tool === "eraser"}
                disabled={formalizing}
                title="Eraser — remove whole strokes"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => {
                  setTool("eraser");
                  onActivate?.();
                }}
              >
                <span className={css.chipGlyph} aria-hidden>
                  ⌫
                </span>
                Eraser
              </button>
              {tool === "pen" ? (
                <div
                  className={css.tipGrade}
                  role="group"
                  aria-label="Pen tip grade"
                  data-testid="sketch-tip-grade"
                >
                  {SKETCH_TIP_GRADES.map((grade) => (
                    <button
                      key={grade}
                      type="button"
                      className={`${css.tip}${tip === grade ? ` ${css.tipArmed}` : ""}`}
                      data-testid={`sketch-tip-${grade}`}
                      aria-pressed={tip === grade}
                      disabled={formalizing}
                      title={`${SKETCH_TIP_LABEL[grade]} tip`}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => {
                        setTip(grade);
                        onActivate?.();
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
          <MarginStrip
            dark={darkOn}
            history={
              <>
                <button
                  type="button"
                  className={marginCss.chip}
                  data-testid="sketch-undo-stroke"
                  disabled={formalizing || (!canUndo && !canAct)}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => onUndoLast?.()}
                  title="Undo"
                >
                  Undo
                </button>
                <button
                  type="button"
                  className={marginCss.chip}
                  data-testid="sketch-redo"
                  disabled={formalizing || !canRedo}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => onRedo?.()}
                  title="Redo"
                >
                  Redo
                </button>
              </>
            }
            actions={
              canAct ? (
                <>
                  {onTidy ? (
                    <button
                      type="button"
                      className={marginCss.chip}
                      data-testid="sketch-tidy"
                      disabled={formalizing}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={onTidy}
                    >
                      Tidy
                    </button>
                  ) : null}
                  {onFormalizeToCad ? (
                    <button
                      type="button"
                      className={`${marginCss.chip} ${marginCss.chipPrimary}`}
                      data-testid="sketch-convert-cad"
                      disabled={formalizing}
                      aria-busy={formalizing}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={onFormalizeToCad}
                    >
                      {formalizing ? "Translating…" : "Formalize to CAD"}
                    </button>
                  ) : null}
                </>
              ) : null
            }
            hint={
              formalizing
                ? "Translating sketch to CAD with AI…"
                : canAct
                  ? `${strokes.length} stroke${strokes.length === 1 ? "" : "s"} · tidy stays hand-drawn · formalize when ready`
                  : "Sketch with a finger or stylus · formalize only when ready"
            }
            legal="Concept sketch for estimating — not a construction drawing."
          />
        </>
      ) : null}
    </div>
  );
}
