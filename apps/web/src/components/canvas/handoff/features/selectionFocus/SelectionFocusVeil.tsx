"use client";

import { useEffect, useId, useState } from "react";
import { CameraChrome } from "../../CameraChrome";
import {
  boardPctToClientOffset,
  type BoardCamera,
} from "../../geometry/cameraPointer";
import type { PctPoint } from "../../geometry/types";
import css from "./selectionFocusVeil.module.css";

/** Soft spotlight hole — clears glyph + half-orbit moons (~96px radius). */
const HOLE_R_PX = 132;

type Props = {
  /** Selection centre in board % — drives the undimmed hole. */
  focusPct: PctPoint;
  cam: BoardCamera;
  night: boolean;
  onDismiss: () => void;
};

/**
 * One scrim behind the selection orbit (surface 2).
 * CameraChrome dock — never under zoom-world (gate C).
 * Hole lets the subject + plan hits through; dimmed area click clears selection.
 */
export function SelectionFocusVeil({
  focusPct,
  cam,
  night,
  onDismiss,
}: Props) {
  const maskId = useId().replace(/:/g, "");
  const [shown, setShown] = useState(false);
  const projected = boardPctToClientOffset(focusPct, cam);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setShown(true);
      return;
    }
    const raf = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <CameraChrome
      place={{ kind: "dock" }}
      testId="selection-focus-veil-chrome"
      zIndex={48}
      contentPointerEvents="none"
    >
      <svg
        className={`${css.veil}${shown ? ` ${css.veilShown}` : ""}${night ? ` ${css.veilNight}` : ""}`}
        data-testid="selection-focus-veil"
        width="100%"
        height="100%"
        aria-label="Clear selection"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onDismiss();
          }
        }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.preventDefault();
          e.stopPropagation();
          const svg = e.currentTarget;
          svg.style.pointerEvents = "none";
          const under = document.elementFromPoint(e.clientX, e.clientY);
          svg.style.pointerEvents = "";
          const item = under?.closest(
            '[data-testid="studio-item"]',
          ) as HTMLElement | null;
          if (item) {
            item.dispatchEvent(
              new PointerEvent("pointerdown", {
                bubbles: true,
                cancelable: true,
                clientX: e.clientX,
                clientY: e.clientY,
                pointerId: e.pointerId,
                pointerType: e.pointerType || "mouse",
              }),
            );
            return;
          }
          onDismiss();
        }}
      >
        <defs>
          <mask
            id={`focus-veil-${maskId}`}
            maskUnits="userSpaceOnUse"
          >
            <rect width="100%" height="100%" fill="#fff" />
            <circle
              cx={projected.x}
              cy={projected.y}
              r={HOLE_R_PX}
              fill="#000"
            />
          </mask>
        </defs>
        <rect
          className={css.wash}
          width="100%"
          height="100%"
          mask={`url(#focus-veil-${maskId})`}
          style={{ pointerEvents: "fill" }}
        />
      </svg>
    </CameraChrome>
  );
}
