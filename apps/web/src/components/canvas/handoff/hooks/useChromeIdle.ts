"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const EVENTS = [
  "pointerdown",
  "pointermove",
  "keydown",
  "touchstart",
  "wheel",
  "scroll",
  "mousedown",
  "resize",
] as const;

/**
 * True after `timeout` ms of no pointer/keyboard/touch activity.
 * Resets immediately on any activity so chrome reappears.
 * Set `disabled` to keep chrome fully visible (e.g. while a modal/sheet is open).
 */
export function useChromeIdle({
  timeout = 6000,
  disabled = false,
}: {
  timeout?: number;
  disabled?: boolean;
} = {}) {
  const [idle, setIdle] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAt = useRef<number>(Date.now());

  // Use functional updates so we only re-render when the value actually flips.
  const startIdleTimer = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(
      () => setIdle((wasIdle) => (wasIdle ? wasIdle : true)),
      timeout,
    );
  }, [timeout]);

  const markActive = useCallback(() => {
    lastAt.current = Date.now();
    setIdle((wasIdle) => (wasIdle ? false : wasIdle));
    startIdleTimer();
  }, [startIdleTimer]);

  useEffect(() => {
    if (disabled) {
      setIdle(false);
      if (timer.current) clearTimeout(timer.current);
      return;
    }

    // Start the first idle timer on mount / enable.
    startIdleTimer();

    EVENTS.forEach((e) =>
      document.addEventListener(e, markActive, {
        passive: true,
        capture: true,
      } as AddEventListenerOptions),
    );

    return () => {
      if (timer.current) clearTimeout(timer.current);
      EVENTS.forEach((e) =>
        document.removeEventListener(e, markActive, {
          capture: true,
        } as EventListenerOptions),
      );
    };
  }, [disabled, markActive, startIdleTimer]);

  return idle;
}
