"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { CameraChrome, CAMERA_CHROME_ATTR } from "../../CameraChrome";
import css from "./frameDrawer.module.css";

/**
 * FrameDrawer — premium hover-to-reveal drawer that lives in the gallery frame
 * edge, not on the canvas.
 *
 * UX:
 * - Closed: a slimline handle (2px line) sits in the frame edge, barely visible.
 * - Hover (or focus) the handle: the drawer slides out gracefully (280ms
 *   cubic-bezier(0.22, 1, 0.36, 1)).
 * - Mouse leaves: the drawer lingers for 600ms, then retracts.
 * - Focus inside or mouse re-enters: the linger timer cancels — stays open.
 * - While idle (no interaction for 4s): retracts automatically.
 *
 * Binding: docs/STUDIO-STYLING-AND-UX.md §0 — "Chrome is frost glass that
 * appears when needed, never a fixed opaque slab parked on the plan."
 */

export type FrameEdge = "left" | "right" | "top" | "bottom";

const LINGER_MS = 600;
const IDLE_RETRACT_MS = 4000;
const ANIM_MS = 280;

export function FrameDrawer({
  edge,
  children,
  testId,
  zIndex = 30,
  /** Label for the handle affordance (sr-only). */
  label,
  /** Width/height of the extended drawer panel (px). */
  size = 280,
  /** Disable the drawer (renders nothing). */
  disabled = false,
}: {
  edge: FrameEdge;
  children: ReactNode;
  testId?: string;
  zIndex?: number;
  label: string;
  size?: number;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const lingerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interactedAt = useRef(0);

  const clearLinger = useCallback(() => {
    if (lingerRef.current) {
      clearTimeout(lingerRef.current);
      lingerRef.current = null;
    }
  }, []);

  const clearIdle = useCallback(() => {
    if (idleRef.current) {
      clearTimeout(idleRef.current);
      idleRef.current = null;
    }
  }, []);

  const scheduleRetract = useCallback(() => {
    clearLinger();
    lingerRef.current = setTimeout(() => {
      setOpen(false);
    }, LINGER_MS);
  }, [clearLinger]);

  const scheduleIdle = useCallback(() => {
    clearIdle();
    idleRef.current = setTimeout(() => {
      setOpen(false);
    }, IDLE_RETRACT_MS);
  }, [clearIdle]);

  // Open on hover, cancel retract.
  useEffect(() => {
    if (hovered) {
      clearLinger();
      setOpen(true);
      interactedAt.current = Date.now();
      scheduleIdle();
    } else {
      scheduleRetract();
    }
    return () => {
      clearLinger();
    };
  }, [hovered, clearLinger, scheduleRetract, scheduleIdle]);

  // Clean up timers on unmount.
  useEffect(() => {
    return () => {
      clearLinger();
      clearIdle();
    };
  }, [clearLinger, clearIdle]);

  // Reset idle timer on any interaction inside the drawer.
  const handleInteraction = useCallback(() => {
    interactedAt.current = Date.now();
    scheduleIdle();
  }, [scheduleIdle]);

  if (disabled) return null;

  const isHorizontal = edge === "top" || edge === "bottom";
  const panelStyle: CSSProperties = isHorizontal
    ? { height: size }
    : { width: size };

  // Transform for slide animation.
  const transform = open
    ? "translate(0, 0)"
    : edge === "left"
      ? "translateX(calc(-100% + 2px))"
      : edge === "right"
        ? "translateX(calc(100% - 2px))"
        : edge === "top"
          ? "translateY(calc(-100% + 2px))"
          : "translateY(calc(100% - 2px))";

  return (
    <CameraChrome
      place={{ kind: "frame" }}
      testId={testId}
      zIndex={zIndex}
      contentPointerEvents="none"
    >
      <div
        className={`${css.drawer} ${css[edge]}`}
        data-open={open ? "1" : "0"}
        style={{
          ...panelStyle,
          transform,
          transition: `transform ${ANIM_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => {
          setHovered(true);
          handleInteraction();
        }}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setHovered(false);
          }
        }}
        onPointerDown={handleInteraction}
        onWheel={handleInteraction}
        {...{ [CAMERA_CHROME_ATTR]: "1" }}
      >
        {/* Slimline handle — the only visible part when closed */}
        <div className={css.handle} aria-hidden>
          <span className={css.handleLine} />
        </div>

        {/* Drawer content — the panel that slides out */}
        <div
          className={css.panel}
          style={{ pointerEvents: "auto" }}
          role="region"
          aria-label={label}
        >
          {children}
        </div>
      </div>
    </CameraChrome>
  );
}
