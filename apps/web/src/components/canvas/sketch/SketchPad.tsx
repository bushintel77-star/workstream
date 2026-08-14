"use client";

/**
 * Sketch Pad — canvas-first, minimal-chrome sketching over a site photo.
 *
 * The viewport is 100% the uploaded aerial with a dark vignette so vector
 * strokes pop. A frosted-glass icon sidebar (left edge) + corner metadata
 * chips are the only chrome. Strokes render as SVG via perfect-freehand.
 *
 * Gestures:
 *   - Draw tool: pointer drag → freehand stroke → auto-close if near origin
 *   - Node tool: tap → drops a pin node
 *   - Long-press on a stroke → highlight red → swipe to delete
 *   - Cmd+Z / Cmd+Shift+Z → undo / redo
 *
 * Reuses: freehandPath (perfect-freehand), CanvasStroke schema, polygonAreaM2.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { CanvasStroke } from "@workstream/contracts";
import { freehandPath } from "@/lib/freehandPath";
import { SketchSidebar } from "./SketchSidebar";
import { SketchChips } from "./SketchChips";
import {
  useSketchHistory,
  pointerToPct,
  makeStroke,
  shouldSnapClose,
  strokeAreaAndCost,
  strokeHeightM,
  strokePerimeterM,
  strokeToPctPoints,
  type SketchTool,
  type SketchView,
  type PctPoint,
} from "./sketchHelpers";

export interface SketchPadProps {
  aerialUri: string | null;
  scaleM: number;
  boardAspect: number;
  initialStrokes: CanvasStroke[];
  projectTitle: string;
}

export function SketchPad({
  aerialUri,
  scaleM,
  boardAspect,
  initialStrokes,
  projectTitle,
}: SketchPadProps) {
  const { strokes, setStrokes, undo, redo, canUndo, canRedo } =
    useSketchHistory(initialStrokes);

  const [activeTool, setActiveTool] = useState<SketchTool>("draw");
  const [gridOn, setGridOn] = useState(true); // dot grid on by default — the sketchbook foundation
  const [view, setView] = useState<SketchView>("plan"); // plan (aerial) ↔ elevation (profile)

  // Live drawing state
  const svgRef = useRef<SVGSVGElement>(null);
  const livePointsRef = useRef<PctPoint[]>([]);
  const [liveStroke, setLiveStroke] = useState<CanvasStroke | null>(null);

  // Gesture deletion state
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressStartRef = useRef<{ x: number; y: number } | null>(null);

  const getRect = useCallback(() => svgRef.current?.getBoundingClientRect() ?? null, []);

  // ---- Pointer drawing (draw tool) ----
  const onPointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (activeTool !== "draw") return;
      const rect = getRect();
      if (!rect) return;
      (e.target as Element).setPointerCapture(e.pointerId);
      const pt = pointerToPct(e, rect);
      livePointsRef.current = [pt];
      setLiveStroke(makeStroke([pt]));
      pressStartRef.current = { x: e.clientX, y: e.clientY };

      // Gesture deletion: start a long-press timer (for tapping existing strokes)
      // — only if this isn't a drag. We'll cancel it on move.
      // (Handled separately via stroke-level pointer events below.)
    },
    [activeTool, getRect],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (activeTool !== "draw" || !liveStroke) return;
      const rect = getRect();
      if (!rect) return;
      const pt = pointerToPct(e, rect);
      const pts = livePointsRef.current;
      // Throttle: skip points too close to the last (≤0.3% apart)
      const last = pts[pts.length - 1];
      if (last && Math.hypot(pt.x - last.x, pt.y - last.y) < 0.3) return;
      pts.push(pt);
      setLiveStroke(makeStroke(pts));
    },
    [activeTool, liveStroke, getRect],
  );

  const finishStroke = useCallback(() => {
    const pts = livePointsRef.current;
    if (pts.length >= 2) {
      // Auto-close: if the last point is near the first, snap it closed.
      const closed = shouldSnapClose(pts);
      const finalPts = closed && pts.length >= 4 ? [...pts, pts[0]!] : pts;
      const stroke = makeStroke(finalPts);
      setStrokes([...strokes, stroke]);
    }
    livePointsRef.current = [];
    setLiveStroke(null);
  }, [strokes, setStrokes]);

  const onPointerUp = useCallback(() => {
    if (activeTool === "draw") finishStroke();
  }, [activeTool, finishStroke]);

  // ---- Node tool: tap to drop a pin ----
  const onSvgClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (activeTool !== "node") return;
      const rect = getRect();
      if (!rect) return;
      const pt = pointerToPct(e, rect);
      // A node is a tiny circle stroke (2-point micro-stroke)
      const node = makeStroke([pt, { x: pt.x + 0.1, y: pt.y }], {
        width_px: 5,
        kind: "shape",
        shape_tool: "circle",
        shape_start: { x_pct: pt.x, y_pct: pt.y },
        shape_end: { x_pct: pt.x, y_pct: pt.y },
      });
      setStrokes([...strokes, node]);
    },
    [activeTool, strokes, setStrokes, getRect],
  );

  // ---- Gesture deletion: long-press → highlight → swipe ----
  const onStrokePointerDown = useCallback(
    (e: React.PointerEvent, strokeId: string) => {
      pressStartRef.current = { x: e.clientX, y: e.clientY };
      longPressTimer.current = setTimeout(() => {
        setHighlightId(strokeId);
      }, 500);
    },
    [],
  );

  const onStrokePointerMove = useCallback(
    (e: React.PointerEvent) => {
      // Cancel long-press if this turns into a drag (not a hold)
      if (longPressTimer.current && pressStartRef.current) {
        const dx = Math.abs(e.clientX - pressStartRef.current.x);
        const dy = Math.abs(e.clientY - pressStartRef.current.y);
        if (dx > 5 || dy > 5) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }
      }
      // Swipe-to-delete: if highlighted and swiped >50px horizontally, delete
      if (highlightId && pressStartRef.current) {
        const dx = e.clientX - pressStartRef.current.x;
        if (Math.abs(dx) > 50) {
          setStrokes(strokes.filter((s) => s.id !== highlightId));
          setHighlightId(null);
        }
      }
    },
    [highlightId, strokes, setStrokes],
  );

  const onStrokePointerUp = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    // Keep highlight after pointer up so the user can see what's selected;
    // it clears on the next draw action.
  }, []);

  // ---- Keyboard: Cmd+Z / Cmd+Shift+Z ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  // Clear highlight when tool changes
  useEffect(() => setHighlightId(null), [activeTool]);

  // ---- Live metrics for the chip (context-aware by view) ----
  const livePts = liveStroke ? strokeToPctPoints(liveStroke) : [];
  const liveEstimate =
    view === "plan" && livePts.length >= 3
      ? strokeAreaAndCost(livePts, scaleM, boardAspect)
      : null;
  const livePerimeterM =
    view === "plan" && livePts.length >= 3
      ? strokePerimeterM(livePts, scaleM, boardAspect)
      : null;
  const liveHeight =
    view === "elevation" && livePts.length >= 2
      ? strokeHeightM(livePts, scaleM)
      : null;

  return (
    <main
      aria-label={`Sketch pad — ${projectTitle}`}
      style={{ position: "fixed", inset: 0, overflow: "hidden", background: "var(--gs-canvas)" }}
    >
      {/* Aerial photo — edge-to-edge */}
      {aerialUri && (
        <img
          src={aerialUri}
          alt="Site aerial"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            userSelect: "none",
            pointerEvents: "none",
          }}
        />
      )}

      {/* Dark vignette — slightly darkens the photo edges so bright strokes pop.
          Midground layer: photo sits behind this, strokes are in front. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(120% 90% at 50% 50%, transparent 45%, rgba(6,8,10,0.6) 100%)",
        }}
      />

      {/* Faint dot grid — "bullet journal" style. Sits at the very back of the
          visual hierarchy. In Plan mode the dots map flat onto the ground
          plane (footprint scale). In Elevation mode the grid "stands up" — the
          dots tighten vertically so they read as height contours against the
          house, giving the user vertical scale for fences, canopies, retaining
          walls. Plus a ground datum line at ~80% (the RL 0.00 reference). */}
      {gridOn && (
        <>
          <div
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              backgroundImage:
                "radial-gradient(circle, var(--gs-ink-secondary) 0.5px, transparent 1px)",
              backgroundSize: view === "plan" ? "24px 24px" : "24px 18px",
              opacity: view === "plan" ? 0.18 : 0.14,
            }}
          />
          {/* Elevation ground datum — a subtle horizontal line at RL 0.00 */}
          {view === "elevation" && (
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: "80%",
                height: 1,
                pointerEvents: "none",
                background:
                  "color-mix(in srgb, var(--gs-truth) 35%, transparent)",
              }}
            />
          )}
        </>
      )}

      {/* SVG drawing surface — viewBox 0 0 100 100 = board-% space */}
      <svg
        ref={svgRef}
        data-testid="sketch-surface"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          touchAction: "none",
          cursor: activeTool === "draw" ? "crosshair" : "default",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={onSvgClick}
      >
        {/* Committed strokes */}
        {strokes.map((s) => {
          const pts = strokeToPctPoints(s);
          const d = freehandPath(pts);
          const isHighlighted = s.id === highlightId;
          const color = isHighlighted
            ? "var(--gs-conflict)"
            : s.color ?? "var(--gs-primary)";
          // Node shapes render as dots, not freehand paths
          if (s.kind === "shape" && s.shape_tool === "circle" && s.shape_start) {
            return (
              <circle
                key={s.id}
                cx={s.shape_start.x_pct}
                cy={s.shape_start.y_pct}
                r={0.4}
                fill={isHighlighted ? "var(--gs-conflict)" : "var(--gs-primary)"}
                style={{ pointerEvents: "auto", cursor: "pointer" }}
                onPointerDown={(e) => onStrokePointerDown(e, s.id)}
                onPointerMove={onStrokePointerMove}
                onPointerUp={onStrokePointerUp}
              />
            );
          }
          if (!d) return null;
          return (
            <path
              key={s.id}
              d={d}
              fill={color}
              stroke="none"
              opacity={isHighlighted ? 0.9 : 0.82}
              style={{ pointerEvents: "auto", cursor: "pointer" }}
              onPointerDown={(e) => onStrokePointerDown(e, s.id)}
              onPointerMove={onStrokePointerMove}
              onPointerUp={onStrokePointerUp}
            />
          );
        })}

        {/* Live stroke (lower opacity while drawing) */}
        {liveStroke &&
          (() => {
            const d = freehandPath(strokeToPctPoints(liveStroke));
            return d ? (
              <path d={d} fill={liveStroke.color ?? "var(--gs-primary)"} opacity={0.55} />
            ) : null;
          })()}
      </svg>

      {/* Chrome — left sidebar + corner chips (the only UI) */}
      <SketchSidebar
        activeTool={activeTool}
        onTool={setActiveTool}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        gridOn={gridOn}
        onToggleGrid={() => setGridOn((g) => !g)}
        view={view}
        onView={setView}
      />
      <SketchChips
        view={view}
        liveEstimate={liveEstimate}
        livePerimeterM={livePerimeterM}
        liveHeight={liveHeight}
        strokeCount={strokes.length}
        activeTool={activeTool}
      />
    </main>
  );
}
