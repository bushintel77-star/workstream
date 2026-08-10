"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { freehandPath } from "@/lib/freehandPath";
import type { SketchStroke } from "../../studioCatalog";
import type { PctPoint } from "../../geometry";
import {
  findSketchStrokeAtPoint,
  shouldAppendSketchPoint,
  sketchWidthForPointer,
} from "./sketchInput";
import {
  type SketchTipGrade,
} from "./sketchCursors";
import { SketchDock, type SketchPenColour, PEN_COLOUR_VALUE } from "./SketchDock";
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
  /** Open the image-layers right panel (upload / manage underlays). */
  onOpenImageLayers?: () => void;
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
  darkOn: _darkOn,
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
  onOpenImageLayers,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const drawing = useRef<ActiveStroke | null>(null);
  const idn = useRef(0);
  const [tool, setTool] = useState<SketchTool>("pen");
  const [tip, setTip] = useState<SketchTipGrade>("medium");
  const [penColour, setPenColour] = useState<SketchPenColour>("ink");
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
  const ink = PEN_COLOUR_VALUE(penColour);

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
          const scaleX = size.w / 100;
          const scaleY = size.h / 100;
          const points = s.points.map((p) => ({
            x: p.x * scaleX,
            y: p.y * scaleY,
          }));
          const d = freehandPath(points, {
            size: (s.widthPx ?? (s.id === "__live" ? 1.9 : 2.1)) * scaleX * 0.5,
            thinning: 0.7,
            smoothing: 0.7,
            streamline: 0.5,
          });
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
        <SketchDock
          tool={tool}
          tip={tip}
          penColour={penColour}
          onPenColour={setPenColour}
          active={active}
          formalizing={formalizing}
          anchorRef={rootRef}
          onTool={setTool}
          onTip={setTip}
          onActivate={onActivate}
          onOpenImageLayers={onOpenImageLayers}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={() => onUndoLast?.()}
          onRedo={onRedo}
          onTidy={onTidy}
          onFormalizeToCad={onFormalizeToCad}
          strokeCount={strokes.length}
        />
      ) : null}
    </div>
  );
}
