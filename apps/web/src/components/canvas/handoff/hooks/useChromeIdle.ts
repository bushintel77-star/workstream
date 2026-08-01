"use client";

import { useEffect, useRef, useState } from "react";

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

  useEffect(() => {
    if (disabled) {
      setIdle(false);
      if (timer.current) clearTimeout(timer.current);
      return;
    }

    const markActive = () => {
      lastAt.current = Date.now();
      setIdle(false);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setIdle(true), timeout);
    };

    // Start the first idle timer on mount.
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setIdle(true), timeout);

    EVENTS.forEach((e) => document.addEventListener(e, markActive, {
      passive: true,
      capture: true,
    } as AddEventListenerOptions));

    return () => {
      if (timer.current) clearTimeout(timer.current);
      EVENTS.forEach((e) => document.removeEventListener(e, markActive, {
        capture: true,
      } as EventListenerOptions));
    };
  }, [timeout, disabled]);

  return idle;
}
