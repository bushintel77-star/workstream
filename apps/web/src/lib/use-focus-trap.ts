"use client";

import { useEffect, type RefObject } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Shared dialog focus behavior: Esc calls `onClose`, Tab/Shift+Tab trap focus
 * inside `containerRef` while `active`, focus moves into the container when
 * it becomes active, and returns to whatever was focused before on
 * deactivate.
 *
 * Lifted out of `RightDataLane` (features/surfaces/DataLaneSlot.tsx), which
 * has used this exact implementation for the 11 panels it wraps (Layers,
 * Measures, Services, Checklist, Sites, Trees, Site, Environment, Ghosts,
 * Image layers, Quote) — see e2e/right-data-lane-keyboard.spec.ts for the
 * contract this preserves. Components that render their own `role="dialog"`
 * outside that wrapper had none of this; this hook lets them opt in without
 * re-deriving it.
 */
export function useFocusTrap(
  active: boolean,
  containerRef: RefObject<HTMLElement | null>,
  onClose?: () => void,
) {
  useEffect(() => {
    if (!active) return;
    const restore =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    // Defer past React StrictMode's dev-only double-invoke (mount → cleanup
    // → remount all happen synchronously in the same commit) so the focus
    // call lands after that churn settles, not in the middle of it.
    const raf = requestAnimationFrame(() => {
      const root = containerRef.current;
      const firstFocusable = root?.querySelector<HTMLElement>(FOCUSABLE);
      (firstFocusable ?? root)?.focus({ preventScroll: true });
    });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose?.();
        return;
      }
      const root = containerRef.current;
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
      restore?.focus?.({ preventScroll: true });
    };
    // containerRef is a stable ref object; onClose identity changes are
    // intentionally ignored so the trap doesn't re-bind mid-session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
}
