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
import { shapePoints } from "./sketchShapes";
import css from "./sketch.module.css";

type SketchTool = "pen" | "eraser" | "line" | "rect" | "circle";

/** True for tools that use drag-to-draw (start → end) rather than freehand. */
function isShapeTool(t: SketchTool): t is "line" | "rect" | "circle" {
  return t === "line" || t === "rect" || t === "circle";
}

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

/** Shape-draw state — start point fixed on pointer-down, end tracks drag. */
type ActiveShape = {
  pointerId: number;
  start: PctPoint;
  end: PctPoint;
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
  const shaping = useRef<ActiveShape | null>(null);
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

  /** Switching to a shape tool auto-arms the pen (shapes are pen-dialect). */
  useEffect(() => {
    if (isShapeTool(tool) && !active) {
      onActivate?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot arm on tool change
  }, [tool]);

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

  /** Esc cancels an in-progress stroke or shape without committing. */
  const cancelActive = () => {
    if (drawing.current || shaping.current) {
      drawing.current = null;
      shaping.current = null;
      setLive(null);
    }
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
      color: ink,
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
      tabIndex={readOnly ? -1 : 0}
      onKeyDown={(e) => {
        if (e.key === "Escape" && !readOnly) {
          e.preventDefault();
          cancelActive();
        }
      }}
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
        if (drawing.current || shaping.current) return;
        e.currentTarget.setPointerCapture(e.pointerId);

        if (isShapeTool(tool)) {
          shaping.current = { pointerId: e.pointerId, start: p, end: p };
          setLive({
            points: shapePoints(tool, p, p),
            widthPx: sketchWidthForPointer(e.pointerType, null, tip),
          });
          return;
        }

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
        // Shape tools — track end point, regenerate points.
        const shape = shaping.current;
        if (shape && shape.pointerId === e.pointerId) {
          const p = toPct(e.currentTarget, e.clientX, e.clientY);
          shape.end = p;
          setLive({
            points: shapePoints(tool as "line" | "rect" | "circle", shape.start, p, e.shiftKey),
            widthPx: sketchWidthForPointer(e.pointerType, null, tip),
          });
          return;
        }

        // Freehand pen — append points with decimation.
        const active = drawing.current;
        if (!active || active.pointerId !== e.pointerId) return;

        // Coalesced events: high-refresh pens fire many intermediate samples
        // between animation frames. Without reading them, fast strokes are
        // jagged. getCoalescedEvents returns all points since the last
        // pointermove; fall back to the single event if unavailable.
        const coalesced =
          typeof e.nativeEvent.getCoalescedEvents === "function"
            ? e.nativeEvent.getCoalescedEvents()
            : [e.nativeEvent];
        for (const ev of coalesced) {
          const p = toPct(e.currentTarget, ev.clientX, ev.clientY);
          const previous = active.points[active.points.length - 1]!;
          if (!shouldAppendSketchPoint(previous, p)) continue;
          active.points.push(p);
          if (active.pointerType === "pen" && "pressure" in ev && ev.pressure > 0) {
            active.pressureTotal += ev.pressure;
            active.pressureCount += 1;
          }
        }
        const averagePressure =
          active.pressureCount > 0
            ? active.pressureTotal / active.pressureCount
            : null;
        setLive({
          points: [...active.points],
          widthPx: sketchWidthForPointer(
            active.pointerType,
            averagePressure,
            tip,
          ),
        });
      }}
      onPointerUp={(e) => {
        // Shape commit
        const shape = shaping.current;
        if (shape && shape.pointerId === e.pointerId) {
          shaping.current = null;
          setLive(null);
          if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
          }
          const pts = shapePoints(tool as "line" | "rect" | "circle", shape.start, shape.end, e.shiftKey);
          if (pts.length >= 2 && onCommit) {
            idn.current += 1;
            onCommit({
              id: `sk${Date.now()}_${idn.current}`,
              points: pts,
              widthPx: sketchWidthForPointer(e.pointerType, null, tip),
              color: ink,
            });
          }
          return;
        }
        finishDrawing(e, true);
      }}
      onPointerCancel={(e) => {
        shaping.current = null;
        finishDrawing(e, false);
      }}
      onLostPointerCapture={(e) => {
        shaping.current = null;
        finishDrawing(e, false);
      }}
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
