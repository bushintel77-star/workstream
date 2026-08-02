"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import css from "./bottom-dock.module.css";

/**
 * BottomDock — mobile bottom-edge slide-up card.
 * Same DNA as the desktop RailDrawer and canvas FrameDrawer:
 * slimline handle, tap to slide, linger then retract, graceful 280ms ease.
 *
 * UX:
 * - Closed: a 2px line + label sits at the bottom edge, always visible.
 * - Tap the handle: the card slides up (280ms ease).
 * - Tap outside or tap handle again: retracts.
 */

const ANIM_MS = 280;

export function BottomDock({
  label,
  accent = "blue",
  children,
  defaultOpen = false,
}: {
  label: string;
  accent?: "blue" | "red" | "green" | "yellow";
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const ref = useRef<HTMLDivElement>(null);

  // Tap outside to close
  useEffect(() => {
    if (!open) return;
    function handleOutside(e: TouchEvent | MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("touchstart", handleOutside);
    document.addEventListener("mousedown", handleOutside);
    return () => {
      document.removeEventListener("touchstart", handleOutside);
      document.removeEventListener("mousedown", handleOutside);
    };
  }, [open]);

  const transform: CSSProperties["transform"] = open
    ? "translateY(0)"
    : "translateY(calc(100% - 2px))";

  return (
    <div
      ref={ref}
      className={`${css.dock} ${css[accent]}`}
      data-open={open ? "1" : "0"}
      style={{
        transform,
        transition: `transform ${ANIM_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
      }}
    >
      {/* Slimline handle — always visible at the bottom edge */}
      <button
        type="button"
        className={css.handle}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? `Close ${label}` : `Open ${label}`}
      >
        <span className={css.handleLine} />
        <span className={css.handleLabel}>{label}</span>
      </button>

      {/* Card content — slides up */}
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
