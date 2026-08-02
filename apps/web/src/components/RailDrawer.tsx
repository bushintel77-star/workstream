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
import css from "./rail-drawer.module.css";

/**
 * RailDrawer — home page right-edge slide-out panel.
 *
 * Best-practice drawer pattern:
 * - Handle is a <button> with aria-expanded + aria-controls
 * - Click handle to toggle open/closed (primary interaction)
 * - Hover peeks open as progressive enhancement
 * - Escape key closes
 * - Focus moves into panel on open, returns to handle on close
 * - Focus trap within panel while open
 * - Body scroll locked while open
 * - Click outside (scrim) closes
 * - Reduced motion respected
 *
 * Same DNA as the canvas FrameDrawer: slimline handle, graceful ease.
 */

const HOVER_DELAY_MS = 250;  // pause before opening on hover — prevents accidental triggers
const LINGER_MS = 1200;      // pause before retracting on mouse leave — lets user move to panel
const ANIM_MS = 450;         // slide animation duration — slow and deliberate

export function RailDrawer({
  label,
  accent = "blue",
  children,
  width = 420,
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
  const [animating, setAnimating] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const lingerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reactId = useId();
  const panelId = `rail-panel-${reactId}`;

  // --- Timers ---

  const clearLinger = useCallback(() => {
    if (lingerRef.current) {
      clearTimeout(lingerRef.current);
      lingerRef.current = null;
    }
  }, []);

  const scheduleRetract = useCallback(() => {
    clearLinger();
    lingerRef.current = setTimeout(() => {
      setOpen(false);
    }, LINGER_MS);
  }, [clearLinger]);

  // --- Hover peek (progressive enhancement — doesn't override click-open) ---

  useEffect(() => {
    if (open) return; // already open via click, hover doesn't matter
    if (hovered) {
      clearLinger();
      setOpen(true);
      // Hover-open auto-retracts after linger on mouse leave
    } else {
      // mouse left — if it was opened by hover (not click), retract
      // We can't distinguish, so we schedule retract; if user clicks to
      // pin it open, the click handler cancels the linger.
      scheduleRetract();
    }
    return () => clearLinger();
  }, [hovered, open, clearLinger, scheduleRetract]);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearLinger();
  }, [clearLinger]);

  // --- Animation state ---

  useEffect(() => {
    setAnimating(true);
    const t = setTimeout(() => setAnimating(false), ANIM_MS + 50);
    return () => clearTimeout(t);
  }, [open]);

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
    // Focus the panel container (not the first tabbable — let the user tab in)
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

  // --- Click handle to toggle ---

  const toggleOpen = useCallback(() => {
    clearLinger();
    setOpen((v) => !v);
  }, [clearLinger]);

  // --- Click outside (scrim) to close ---

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      const drawer = drawerRef.current;
      if (!drawer) return;
      if (!drawer.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // --- Render ---

  const panelStyle: CSSProperties = { width };
  const transform = open
    ? "translateX(0)"
    : "translateX(calc(100% - 2px))";

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
        ref={drawerRef}
        className={`${css.drawer} ${css[accent]}`}
        data-open={open ? "1" : "0"}
        style={{
          ...panelStyle,
          transform,
          transition: `transform ${ANIM_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Handle — button with aria-expanded + aria-controls */}
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
          inert={!open && !animating ? true : undefined}
        >
          {children}
        </div>
      </div>
    </>
  );
}
