"use client";

import {
  useLayoutEffect,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import {
  boardPctToClientOffset,
  type BoardCamera,
} from "./geometry/cameraPointer";
import type { PctPoint } from "./geometry/types";

/** DOM contract for the camera-chrome detector e2e. */
export const CAMERA_CHROME_ATTR = "data-camera-chrome";

export type CameraChromePlace =
  | { kind: "dock" }
  | {
      kind: "project";
      pct: PctPoint;
      cam: BoardCamera;
      /** Extra CSS transform after positioning at projected point. */
      transform?: string;
    };

/**
 * Resolve the chrome portal mount.
 *
 * Prefer `[data-testid=camera-chrome-root]` — a dedicated sibling of
 * `.zoomWorld` inside the board. Portaling into an *ancestor* of the call
 * site (e.g. `studio-board` itself) lets React reconcile by moving the
 * child DOM without preserving our stamped wrapper, which breaks gate B.
 */
function useCameraChromeHost(anchorRef?: RefObject<HTMLElement | null>) {
  const [host, setHost] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    let cancelled = false;
    const resolve = () => {
      const board =
        (anchorRef?.current?.closest(
          '[data-testid="studio-board"]',
        ) as HTMLElement | null) ??
        (document.querySelector(
          '[data-testid="studio-board"]',
        ) as HTMLElement | null);
      if (!board) return null;
      const dedicated = board.querySelector(
        '[data-testid="camera-chrome-root"]',
      ) as HTMLElement | null;
      return dedicated ?? board;
    };
    const sync = () => {
      if (cancelled) return;
      const next = resolve();
      setHost((prev) => (prev === next ? prev : next));
    };
    sync();
    const raf = requestAnimationFrame(sync);
    const poll = window.setInterval(sync, 50);
    const stop = window.setTimeout(() => clearInterval(poll), 2000);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      clearInterval(poll);
      clearTimeout(stop);
    };
  }, [anchorRef]);

  return host;
}

/**
 * Mandatory viewport chrome API (gate B).
 *
 * All frosted / dock / HUD UI that is not plan geometry MUST render through
 * this component. It portals to `[data-testid=camera-chrome-root]` (sibling
 * of `.zoomWorld`, outside the camera) and stamps `data-camera-chrome="1"`
 * for the detector e2e.
 *
 * Do not mount chrome as a raw child of `.zoomWorld`. Do not use
 * `scale(1/--studio-zoom)` as a substitute — that still leaks pan/rotate.
 */
export function CameraChrome({
  children,
  place = { kind: "dock" },
  anchorRef,
  className,
  style,
  testId,
  zIndex = 45,
  /**
   * Inner hit wrapper. Use `"none"` for masked scrims where only painted
   * SVG fill should receive events (hole passes through to the board).
   */
  contentPointerEvents = "auto",
}: {
  children: ReactNode;
  place?: CameraChromePlace;
  anchorRef?: RefObject<HTMLElement | null>;
  className?: string;
  style?: CSSProperties;
  testId?: string;
  zIndex?: number;
  contentPointerEvents?: "auto" | "none";
}) {
  const host = useCameraChromeHost(anchorRef);

  if (!host) return null;

  const projected =
    place.kind === "project"
      ? boardPctToClientOffset(place.pct, place.cam)
      : null;

  const shellStyle: CSSProperties =
    place.kind === "project" && projected
      ? {
          position: "absolute",
          left: projected.x,
          top: projected.y,
          zIndex,
          pointerEvents: "none",
          transform: place.transform ?? "translate(-50%, -50%)",
          ...style,
        }
      : {
          position: "absolute",
          inset: 0,
          zIndex,
          pointerEvents: "none",
          ...style,
        };

  const stamp = {
    [CAMERA_CHROME_ATTR]: "1",
    "data-testid": testId ?? "camera-chrome-shell",
  } as const;

  return createPortal(
    <div
      {...stamp}
      ref={(node) => {
        if (!node) return;
        node.setAttribute(CAMERA_CHROME_ATTR, "1");
        if (!testId) node.setAttribute("data-testid", "camera-chrome-shell");
      }}
      className={className}
      style={shellStyle}
    >
      <div style={{ pointerEvents: contentPointerEvents }}>{children}</div>
    </div>,
    host,
  );
}

/**
 * @deprecated Use {@link CameraChrome}. Kept as a thin alias so call sites
 * migrate without behavior change — still stamps data-camera-chrome.
 */
export function BoardChromePortal({
  children,
  anchorRef,
}: {
  children: ReactNode;
  anchorRef?: RefObject<HTMLElement | null>;
}) {
  return <CameraChrome anchorRef={anchorRef}>{children}</CameraChrome>;
}

/** Build a BoardCamera from live plan camera props + layout size. */
export function boardCameraFromPlan(args: {
  boardW: number;
  boardH: number;
  planZoom: number;
  planRotateDeg: number;
  planPanX: number;
  planPanY: number;
  planFocusX: number;
  planFocusY: number;
}): BoardCamera {
  return {
    boardW: Math.max(1, args.boardW),
    boardH: Math.max(1, args.boardH),
    zoom: args.planZoom,
    rotateDeg: args.planRotateDeg,
    panX: args.planPanX,
    panY: args.planPanY,
    focusX: args.planFocusX,
    focusY: args.planFocusY,
  };
}
