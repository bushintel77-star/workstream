"use client";

import { useRef, useState } from "react";
import { clientToBoardPct } from "../../geometry/cameraPointer";
import { snapClockRotationDeg } from "../../geometry/snap";
import { BY_TYPE, type StudioItem } from "../../studioCatalog";
import { ProtractorArc } from "./ProtractorArc";
import css from "./cadPlan.module.css";

type Props = {
  item: StudioItem;
  boardW: number;
  boardH: number;
  planZoom?: number;
  planPanX?: number;
  planPanY?: number;
  planFocusX?: number;
  planFocusY?: number;
  planRotateDeg?: number;
  onTransform: (
    id: string,
    patch: Partial<Pick<StudioItem, "rot" | "scale">>,
  ) => void;
};

/**
 * Rotate (clock-face 30° snap) + resize handles for the selected symbol.
 * Shift = 15° half-hours · Alt = free angle.
 */
export function SelectionHandles({
  item,
  boardW,
  boardH,
  planZoom = 1,
  planPanX = 0,
  planPanY = 0,
  planFocusX = 50,
  planFocusY = 50,
  planRotateDeg = 0,
  onTransform,
}: Props) {
  const drag = useRef<
    | { kind: "rotate" }
    | { kind: "resize"; scale0: number; dist0: number }
    | null
  >(null);
  const [rotateFeedforward, setRotateFeedforward] = useState<{
    angleDeg: number;
    shiftHeld: boolean;
  } | null>(null);

  const d = BY_TYPE[item.t];
  const w = d.w * item.scale;
  const h = d.h * item.scale;
  const rotY = Math.round(h / 2) + 25;
  const rx = Math.round(w / 2) + 9;
  const ry = Math.round(h / 2) + 9;

  const toLocal = (clientX: number, clientY: number, el: HTMLElement) => {
    const root = el.closest("[data-cad-plan]") as HTMLElement | null;
    const plan = root ?? el;
    const board =
      (plan.closest('[data-testid="studio-board"]') as HTMLElement | null) ??
      plan;
    const boardRect = board.getBoundingClientRect();
    const layoutW = plan.clientWidth || boardW;
    const layoutH = plan.clientHeight || boardH;
    const pct = clientToBoardPct(clientX, clientY, boardRect, {
      boardW: layoutW,
      boardH: layoutH,
      zoom: planZoom,
      rotateDeg: planRotateDeg,
      panX: planPanX,
      panY: planPanY,
      focusX: planFocusX,
      focusY: planFocusY,
    });
    return {
      x: pct.x,
      y: pct.y,
      cw: layoutW,
      ch: layoutH,
    };
  };

  return (
    <div
      className={css.selHandles}
      style={{
        left: `${item.x}%`,
        top: `${item.y}%`,
        transform: `rotate(${item.rot}deg)`,
      }}
      data-testid="selection-handles"
    >
      {rotateFeedforward ? (
        <ProtractorArc
          angleDeg={rotateFeedforward.angleDeg}
          radiusPx={Math.max(w, h) / 2 + 30}
          itemRotationDeg={item.rot}
          shiftHeld={rotateFeedforward.shiftHeld}
        />
      ) : null}
      <div
        className={css.selStem}
        style={{
          transform: `translate(-50%, -100%) translateY(-${Math.round(h / 2)}px)`,
        }}
      />
      <button
        type="button"
        className={css.rotHandle}
        data-testid="rotate-handle"
        title="Rotate · snaps to clock hours (30°) · Shift 15° · Alt free"
        aria-label="Rotate selection"
        style={{
          transform: `translate(-50%, -50%) translateY(-${rotY}px) scale(calc(1 / var(--studio-zoom, 1)))`,
        }}
        onPointerDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
          (e.target as Element).setPointerCapture?.(e.pointerId);
          drag.current = { kind: "rotate" };
          setRotateFeedforward({
            angleDeg: item.rot,
            shiftHeld: e.shiftKey,
          });
        }}
        onPointerMove={(e) => {
          if (drag.current?.kind !== "rotate") return;
          const p = toLocal(e.clientX, e.clientY, e.currentTarget);
          const raw =
            (Math.atan2(
              ((p.y - item.y) / 100) * p.ch,
              ((p.x - item.x) / 100) * p.cw,
            ) *
              180) /
              Math.PI +
            90;
          const ang = snapClockRotationDeg(raw, {
            shift: e.shiftKey,
            alt: e.altKey,
          });
          setRotateFeedforward({ angleDeg: ang, shiftHeld: e.shiftKey });
          onTransform(item.id, { rot: ang });
        }}
        onPointerUp={() => {
          drag.current = null;
          setRotateFeedforward(null);
        }}
        onPointerCancel={() => {
          drag.current = null;
          setRotateFeedforward(null);
        }}
      >
        ◌
      </button>
      <button
        type="button"
        className={css.resHandle}
        title="Drag to resize"
        style={{
          transform: `translate(-50%, -50%) translate(${rx}px, ${ry}px) scale(calc(1 / var(--studio-zoom, 1)))`,
        }}
        onPointerDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
          (e.target as Element).setPointerCapture?.(e.pointerId);
          const p = toLocal(e.clientX, e.clientY, e.currentTarget);
          const dist0 = Math.hypot(
            ((p.x - item.x) / 100) * p.cw,
            ((p.y - item.y) / 100) * p.ch,
          );
          drag.current = {
            kind: "resize",
            scale0: item.scale,
            dist0: Math.max(8, dist0),
          };
        }}
        onPointerMove={(e) => {
          if (drag.current?.kind !== "resize") return;
          const p = toLocal(e.clientX, e.clientY, e.currentTarget);
          const dist = Math.hypot(
            ((p.x - item.x) / 100) * p.cw,
            ((p.y - item.y) / 100) * p.ch,
          );
          const ns = drag.current.scale0 * (dist / drag.current.dist0);
          onTransform(item.id, { scale: ns });
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
      />
    </div>
  );
}
