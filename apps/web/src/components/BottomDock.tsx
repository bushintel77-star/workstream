"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import css from "./bottom-dock.module.css";

/**
 * BottomDock — mobile bottom-edge slide-up panel.
 *
 * Best-practice drawer pattern (mobile):
 * - Handle is a <button> with aria-expanded + aria-controls
 * - Tap handle to toggle open/closed
 * - Escape key closes
 * - Focus moves into panel on open, returns to handle on close
 * - Focus trap within panel while open
 * - Body scroll locked while open
 * - Scrim (tap to close)
 * - 44px minimum tap target on handle
 * - Reduced motion respected
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
  const dockRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const reactId = useId();
  const panelId = `dock-panel-${reactId}`;

  // --- Escape to close ---

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // --- Body scroll lock ---

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // --- Focus management: move focus into panel on open ---

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => {
      panelRef.current?.focus();
    }, ANIM_MS);
    return () => clearTimeout(t);
  }, [open]);

  // --- Focus return: move focus back to handle on close ---

  useEffect(() => {
    if (open) return;
    if (previouslyFocused.current) {
      previouslyFocused.current.focus();
      previouslyFocused.current = null;
    }
  }, [open]);

  // --- Focus trap ---

  const handlePanelKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const tabbables = panel.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (tabbables.length === 0) return;
      const first = tabbables[0];
      const last = tabbables[tabbables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [],
  );

  // --- Toggle ---

  const toggleOpen = useCallback(() => {
    setOpen((v) => !v);
  }, []);

  // --- Render ---

  const transform: CSSProperties["transform"] = open
    ? "translateY(0)"
    : "translateY(calc(100% - 2px))";

  return (
    <>
      {/* Scrim — dimmed background when open */}
      {open ? (
        <div
          className={css.scrim}
          onClick={() => setOpen(false)}
          aria-hidden
          style={{ animation: `fadeIn ${ANIM_MS}ms ease` }}
        />
      ) : null}

      <div
        ref={dockRef}
        className={`${css.dock} ${css[accent]}`}
        data-open={open ? "1" : "0"}
        style={{
          transform,
          transition: `transform ${ANIM_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
        }}
      >
        {/* Handle — 44px tap target button */}
        <button
          ref={handleRef}
          type="button"
          className={css.handle}
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={open ? `Close ${label}` : `Open ${label}`}
          onClick={toggleOpen}
        >
          <span className={css.handleLine} aria-hidden />
          <span className={css.handleLabel}>{label}</span>
        </button>

        {/* Panel content — focusable region with focus trap */}
        <div
          ref={panelRef}
          id={panelId}
          className={css.panel}
          role="region"
          aria-label={label}
          tabIndex={-1}
          onKeyDown={handlePanelKeyDown}
          inert={!open ? true : undefined}
        >
          {children}
        </div>
      </div>
    </>
  );
}
