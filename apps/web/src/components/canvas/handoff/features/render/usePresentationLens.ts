"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type RenderFidelity = "draft" | "presentation";

const IDLE_MS = 600;

/**
 * Internal presentation lens — draft while interacting, presentation after idle.
 * Not a user toggle (checklist 9). Client view / Fit sheet force presentation.
 */
export function usePresentationLens(opts: {
  forcePresentation: boolean;
}): {
  fidelity: RenderFidelity;
  markInteracting: () => void;
} {
  const [idle, setIdle] = useState(true);
  const timerRef = useRef<number | null>(null);
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotionRef.current = mq.matches;
    const onChange = () => {
      reducedMotionRef.current = mq.matches;
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const markInteracting = useCallback(() => {
    setIdle(false);
    if (timerRef.current != null) window.clearTimeout(timerRef.current);
    const delay = reducedMotionRef.current ? 0 : IDLE_MS;
    timerRef.current = window.setTimeout(() => {
      setIdle(true);
      timerRef.current = null;
    }, delay);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
    };
  }, []);

  const fidelity: RenderFidelity =
    opts.forcePresentation || idle ? "presentation" : "draft";

  return { fidelity, markInteracting };
}
