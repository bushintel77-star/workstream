"use client";

import { useRef, useState } from "react";
import {
  clientToBoardPct,
  type BoardCamera,
} from "../../geometry/cameraPointer";
import { snapClockRotationDeg } from "../../geometry/snap";
import { BY_TYPE, type StudioItem } from "../../studioCatalog";
import { CameraChrome } from "../../CameraChrome";
import { ProtractorArc } from "./ProtractorArc";
import css from "./cadPlan.module.css";

type Props = {
  item: StudioItem;
  /**
   * Live board camera — matches the .zoomWorld transform. Handles portal
   * out of `.zoomWorld` so they never inherit its pan / rotate / zoom,
   * yet the pointer→pct math must still invert the world (see `toLocal`).
   */
  cam: BoardCamera;
  onTransform: (
    id: string,
    patch: Partial<Pick<StudioItem, "rot" | "scale">>,
  ) => void;
};

/**
 * Rotate (clock-face 30° snap) + resize handles for the selected symbol.
 * Shift = 15° half-hours · Alt = free angle.
 *
 * Portaled outside `.zoomWorld` via `CameraChrome` so the handles stay
 * constant-size regardless of camera zoom — no CSS counter-scale trick.
 */
export function SelectionHandles({ item, cam, onTransform }: Props) {
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

  const toLocal = (clientX: number, clientY: number) => {
    const board = document.querySelector(
      '[data-testid="studio-board"]',
    ) as HTMLElement | null;
    const boardRect = board?.getBoundingClientRect() ?? { left: 0, top: 0 };
    const pct = clientToBoardPct(clientX, clientY, boardRect, cam);
    return {
      x: pct.x,
      y: pct.y,
      cw: cam.boardW,
      ch: cam.boardH,
    };
  };

  return (
    <CameraChrome
      place={{
        kind: "project",
        pct: { x: item.x, y: item.y },
        cam,
        transform: `translate(-50%, -50%) rotate(${item.rot}deg)`,
      }}
    >
      <div className={css.selHandles} data-testid="selection-handles">
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
            transform: `translate(-50%, -50%) translateY(-${rotY}px)`,
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
            const p = toLocal(e.clientX, e.clientY);
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
            transform: `translate(-50%, -50%) translate(${rx}px, ${ry}px)`,
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            (e.target as Element).setPointerCapture?.(e.pointerId);
            const p = toLocal(e.clientX, e.clientY);
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
            const p = toLocal(e.clientX, e.clientY);
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
    </CameraChrome>
  );
}
