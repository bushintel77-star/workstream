"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { CameraChrome } from "../../CameraChrome";
import css from "./rightDataLane.module.css";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Shared right-lane shell for Layers / Measures / Demo Lots / Checklist.
 * One occupant; CameraChrome dock so gate C stays clean.
 *
 * Owns keyboard behavior for every occupant: Esc closes, Tab/Shift+Tab trap
 * focus inside the lane while it's open, and focus returns to whatever
 * opened it on close — one implementation instead of each panel re-solving
 * this (or, previously, none of them solving it at all).
 */
export function RightDataLane({
  children,
  testId = "right-data-lane",
  onClose,
}: {
  children: ReactNode;
  testId?: string;
  onClose?: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    // Defer past React StrictMode's dev-only double-invoke (mount → cleanup
    // → remount all happen synchronously in the same commit) so the focus
    // call lands after that churn settles, not in the middle of it.
    const raf = requestAnimationFrame(() => {
      const root = rootRef.current;
      const firstFocusable = root?.querySelector<HTMLElement>(FOCUSABLE);
      (firstFocusable ?? root)?.focus({ preventScroll: true });
    });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose?.();
        return;
      }
      const root = rootRef.current;
      if (e.key !== "Tab" || !root) return;
      const focusable = Array.from(
        root.querySelectorAll<HTMLElement>(FOCUSABLE),
      );
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKeyDown, true);
      restoreFocusRef.current?.focus?.({ preventScroll: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <CameraChrome place={{ kind: "dock" }} zIndex={52} testId={`${testId}-chrome`}>
      <div
        ref={rootRef}
        className={css.slot}
        data-testid={testId}
        data-camera-chrome-card="1"
        tabIndex={-1}
      >
        {children}
      </div>
    </CameraChrome>
  );
}
