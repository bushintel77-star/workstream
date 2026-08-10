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
import {
  constrainedShapeEnd,
  shapePoints,
  snapShapePoint,
  type ShapeSnapKind,
} from "./sketchShapes";
import snapVisualCss from "../../geometry/snapVisual.module.css";
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
    kind?: "shape";
    shapeTool?: "line" | "rect" | "circle";
    shapeStart?: PctPoint;
    shapeEnd?: PctPoint;
  } | null>(null);
  const [size, setSize] = useState({ w: 960, h: 640 });
  /**
   * Shape-tool magnetic feedback — CAD-style vertex lock / grid snap, using
   * the same snap engine + visual language as CadPlanBoard (geometry/snap.ts,
   * geometry/snapVisual.module.css). Null while pen/eraser are active, or
   * while Shift overrides ambient snap for an explicit angle/square drag.
   */
  const [shapeSnap, setShapeSnap] = useState<{
    x: number;
    y: number;
    kind: ShapeSnapKind;
  } | null>(null);

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

  /**
   * Candidate snap targets for shape drafting: every existing stroke's
   * endpoints (shape corners, or the first/last point of a freehand line).
   * Deliberately excludes interior ink points — snapping a new line/rect/
   * circle onto the middle of someone's pen scribble would be noise, not
   * precision.
   */
  const shapeAnchors = (): PctPoint[] => {
    const anchors: PctPoint[] = [];
    for (const s of strokes) {
      if (s.shapeStart && s.shapeEnd) {
        anchors.push(s.shapeStart, s.shapeEnd);
        continue;
      }
      const first = s.points[0];
      const last = s.points[s.points.length - 1];
      if (first) anchors.push(first);
      if (last && last !== first) anchors.push(last);
    }
    return anchors;
  };

  /** Esc cancels an in-progress stroke or shape without committing. */
  const cancelActive = () => {
    if (drawing.current || shaping.current) {
      drawing.current = null;
      shaping.current = null;
      setLive(null);
      setShapeSnap(null);
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

  const ink = PEN_COLOUR_VALUE(penColour);
  const all: SketchStroke[] = live
    ? [
      ...strokes,
      {
        id: "__live",
        points: live.points,
        widthPx: live.widthPx,
        kind: live.kind,
        shapeTool: live.shapeTool,
        shapeStart: live.shapeStart,
        shapeEnd: live.shapeEnd,
        color: ink,
      },
    ]
    : strokes;

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
          // Ambient CAD-style snap on the start corner too — unless Shift is
          // already held, in which case the explicit angle/square constraint
          // (applied on move) takes priority over passive magnetism.
          let start = p;
          if (!e.shiftKey) {
            const snapped = snapShapePoint(p, shapeAnchors(), size.w, size.h);
            start = snapped.point;
            setShapeSnap({ x: start.x, y: start.y, kind: snapped.kind });
          } else {
            setShapeSnap(null);
          }
          shaping.current = { pointerId: e.pointerId, start, end: start };
          setLive({
            points: shapePoints(tool, start, start),
            widthPx: sketchWidthForPointer(e.pointerType, null, tip),
            kind: "shape",
            shapeTool: tool,
            shapeStart: start,
            shapeEnd: start,
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
          const shapeTool = tool as "line" | "rect" | "circle";
          const raw = toPct(e.currentTarget, e.clientX, e.clientY);
          // Shift = explicit angle/square constraint, always wins over the
          // ambient vertex/grid snap (matches the start-point priority).
          let end = raw;
          if (!e.shiftKey) {
            const anchors = shapeAnchors();
            const snapped = snapShapePoint(raw, anchors, size.w, size.h);
            end = snapped.point;
            setShapeSnap({ x: end.x, y: end.y, kind: snapped.kind });
          } else {
            setShapeSnap(null);
          }
          const finalEnd = constrainedShapeEnd(shapeTool, shape.start, end, e.shiftKey);
          shape.end = finalEnd;
          setLive({
            points: shapePoints(shapeTool, shape.start, finalEnd, false),
            widthPx: sketchWidthForPointer(e.pointerType, null, tip),
            kind: "shape",
            shapeTool,
            shapeStart: shape.start,
            shapeEnd: finalEnd,
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
        // Shape commit — shape.end already carries the final (snapped and/or
        // Shift-constrained) point from the last pointermove.
        const shape = shaping.current;
        if (shape && shape.pointerId === e.pointerId) {
          shaping.current = null;
          setLive(null);
          setShapeSnap(null);
          if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
          }
          const shapeTool = tool as "line" | "rect" | "circle";
          const pts = shapePoints(shapeTool, shape.start, shape.end, false);
          if (pts.length >= 2 && onCommit) {
            idn.current += 1;
            onCommit({
              id: `sk${Date.now()}_${idn.current}`,
              points: pts,
              widthPx: sketchWidthForPointer(e.pointerType, null, tip),
              color: ink,
              kind: "shape",
              shapeTool,
              shapeStart: shape.start,
              shapeEnd: shape.end,
            });
          }
          return;
        }
        finishDrawing(e, true);
      }}
      onPointerCancel={(e) => {
        shaping.current = null;
        setShapeSnap(null);
        finishDrawing(e, false);
      }}
      onLostPointerCapture={(e) => {
        shaping.current = null;
        setShapeSnap(null);
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
          const opacity = s.id === "__live" ? 0.55 : 0.88;
          const strokeColour = s.color ?? ink;

          // Shape-tool strokes (line/rect/circle) render as crisp,
          // non-scaling SVG primitives — a deliberate visual break from
          // organic freehand ink, matching the CAD board's construction
          // lines. `vector-effect="non-scaling-stroke"` keeps the line a
          // true 1:1 hairline regardless of board resize / DPR.
          if (s.kind === "shape" && s.shapeStart && s.shapeEnd) {
            const x1 = s.shapeStart.x * scaleX;
            const y1 = s.shapeStart.y * scaleY;
            const x2 = s.shapeEnd.x * scaleX;
            const y2 = s.shapeEnd.y * scaleY;
            const strokeWidth = s.widthPx ?? 2;
            if (s.shapeTool === "line") {
              return (
                <line
                  key={s.id}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={strokeColour}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                  opacity={opacity}
                  style={{ pointerEvents: "none" }}
                />
              );
            }
            const rx1 = Math.min(x1, x2);
            const ry1 = Math.min(y1, y2);
            const rx2 = Math.max(x1, x2);
            const ry2 = Math.max(y1, y2);
            if (s.shapeTool === "rect") {
              return (
                <rect
                  key={s.id}
                  x={rx1}
                  y={ry1}
                  width={rx2 - rx1}
                  height={ry2 - ry1}
                  fill="none"
                  stroke={strokeColour}
                  strokeWidth={strokeWidth}
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                  opacity={opacity}
                  style={{ pointerEvents: "none" }}
                />
              );
            }
            return (
              <ellipse
                key={s.id}
                cx={(rx1 + rx2) / 2}
                cy={(ry1 + ry2) / 2}
                rx={(rx2 - rx1) / 2}
                ry={(ry2 - ry1) / 2}
                fill="none"
                stroke={strokeColour}
                strokeWidth={strokeWidth}
                vectorEffect="non-scaling-stroke"
                opacity={opacity}
                style={{ pointerEvents: "none" }}
              />
            );
          }

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
              fill={strokeColour}
              opacity={opacity}
              style={{ pointerEvents: "none" }}
            />
          );
        })}
      </svg>
      {shapeSnap ? (
        <>
          <div
            className={`${snapVisualCss.snapPulse} ${snapVisualCss.snapPulseLocked}`}
            data-testid="sketch-snap-pulse"
            data-snap={shapeSnap.kind}
            style={{ left: `${shapeSnap.x}%`, top: `${shapeSnap.y}%` }}
          />
          <div
            className={snapVisualCss.crosshairV}
            data-testid="sketch-snap-crosshair-v"
            style={{ left: `${shapeSnap.x}%` }}
          />
          <div
            className={snapVisualCss.crosshairH}
            data-testid="sketch-snap-crosshair-h"
            style={{ top: `${shapeSnap.y}%` }}
          />
          <div
            className={snapVisualCss.snapGlyph}
            data-testid="sketch-snap-glyph"
            data-snap={shapeSnap.kind}
            style={{ left: `${shapeSnap.x}%`, top: `${shapeSnap.y}%` }}
            title={
              shapeSnap.kind === "vertex"
                ? "Snapped to endpoint"
                : "Snapped to grid"
            }
            aria-hidden
          >
            {shapeSnap.kind === "vertex" ? "●" : "□"}
          </div>
        </>
      ) : null}
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
