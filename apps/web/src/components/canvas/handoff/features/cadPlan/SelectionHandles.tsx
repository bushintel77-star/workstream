"use client";

import { useRef } from "react";
import { BY_TYPE, type StudioItem } from "../../studioCatalog";
import css from "./cadPlan.module.css";

type Props = {
  item: StudioItem;
  boardW: number;
  boardH: number;
  onTransform: (
    id: string,
    patch: Partial<Pick<StudioItem, "rot" | "scale">>,
  ) => void;
};

/**
 * Rotate (5° snap) + resize handles for the selected accepted symbol.
 */
export function SelectionHandles({
  item,
  boardW,
  boardH,
  onTransform,
}: Props) {
  const drag = useRef<
    | { kind: "rotate" }
    | { kind: "resize"; scale0: number; dist0: number }
    | null
  >(null);

  const d = BY_TYPE[item.t];
  const w = d.w * item.scale;
  const h = d.h * item.scale;
  const rotY = Math.round(h / 2) + 25;
  const rx = Math.round(w / 2) + 9;
  const ry = Math.round(h / 2) + 9;

  const toLocal = (clientX: number, clientY: number, el: HTMLElement) => {
    const root = el.closest("[data-cad-plan]") as HTMLElement | null;
    const r = (root ?? el).getBoundingClientRect();
    return {
      x: ((clientX - r.left) / r.width) * 100,
      y: ((clientY - r.top) / r.height) * 100,
      cw: r.width || boardW,
      ch: r.height || boardH,
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
      <div
        className={css.selStem}
        style={{ transform: `translate(-50%, -100%) translateY(-${Math.round(h / 2)}px)` }}
      />
      <button
        type="button"
        className={css.rotHandle}
        title="Drag to rotate · snaps to 5° · hold Shift for free angle"
        style={{ transform: `translate(-50%, -50%) translateY(-${rotY}px)` }}
        onPointerDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
          (e.target as Element).setPointerCapture?.(e.pointerId);
          drag.current = { kind: "rotate" };
        }}
        onPointerMove={(e) => {
          if (drag.current?.kind !== "rotate") return;
          const p = toLocal(e.clientX, e.clientY, e.currentTarget);
          let ang =
            (Math.atan2(
              ((p.y - item.y) / 100) * p.ch,
              ((p.x - item.x) / 100) * p.cw,
            ) *
              180) /
              Math.PI +
            90;
          if (!e.shiftKey) ang = Math.round(ang / 5) * 5;
          onTransform(item.id, { rot: ang });
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
      >
        ◌
      </button>
      <button
        type="button"
        className={css.resHandle}
        title="Drag to resize"
        style={{ transform: `translate(-50%, -50%) translate(${rx}px, ${ry}px)` }}
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
