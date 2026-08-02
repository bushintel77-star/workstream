"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import css from "./rail-drawer.module.css";

/**
 * RailDrawer — home page right-edge slide-out card.
 * Mirrors the canvas FrameDrawer UX: slimline handle, hover to slide,
 * linger then retract, graceful 280ms ease.
 *
 * Same DNA, different surface — uses home tokens, no CameraChrome.
 */

const LINGER_MS = 600;
const IDLE_RETRACT_MS = 4000;
const ANIM_MS = 280;

export function RailDrawer({
  label,
  accent = "blue",
  children,
  width = 320,
  defaultOpen = false,
}: {
  label: string;
  accent?: "blue" | "red" | "green" | "yellow";
  children: ReactNode;
  width?: number;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [hovered, setHovered] = useState(false);
  const lingerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => {
    if (hovered) {
      clearLinger();
      setOpen(true);
      scheduleIdle();
    } else {
      scheduleRetract();
    }
    return () => {
      clearLinger();
    };
  }, [hovered, clearLinger, scheduleRetract, scheduleIdle]);

  useEffect(() => {
    return () => {
      clearLinger();
      clearIdle();
    };
  }, [clearLinger, clearIdle]);

  const handleInteraction = useCallback(() => {
    scheduleIdle();
  }, [scheduleIdle]);

  const panelStyle: CSSProperties = { width };
  const transform = open
    ? "translateX(0)"
    : "translateX(calc(100% - 2px))";

  return (
    <div
      className={`${css.drawer} ${css[accent]}`}
      data-open={open ? "1" : "0"}
      style={{
        ...panelStyle,
        transform,
        transition: `transform ${ANIM_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setHovered(false);
        }
      }}
      onPointerDown={handleInteraction}
      onWheel={handleInteraction}
    >
      {/* Slimline handle — the only visible part when closed */}
      <div className={css.handle} aria-hidden>
        <span className={css.handleLine} />
        <span className={css.handleLabel}>{label}</span>
      </div>

      {/* Card content — slides out */}
      <div
        className={css.panel}
        role="region"
        aria-label={label}
      >
        {children}
      </div>
    </div>
  );
}
