"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Pure rAF coalescer — the last value pushed within a frame wins and is
 * delivered to `fn` once per animation frame. `schedule`/`cancel` are
 * injectable for tests; they default to the browser rAF pair.
 */
export function createRafCoalescer<T>(
  fn: (value: T) => void,
  schedule: (cb: () => void) => number = requestAnimationFrame,
  cancel: (id: number) => void = cancelAnimationFrame,
): { call: (value: T) => void; cancel: () => void } {
  let pending: T | null = null;
  let rafId: number | null = null;
  return {
    call(value: T) {
      pending = value;
      if (rafId !== null) return; // already scheduled for this frame
      rafId = schedule(() => {
        rafId = null;
        if (pending !== null) {
          const v = pending;
          pending = null;
          fn(v);
        }
      });
    },
    cancel() {
      if (rafId !== null) {
        cancel(rafId);
        rafId = null;
      }
    },
  };
}

/**
 * React hook wrapping createRafCoalescer — returns a stable caller that
 * coalesces rapid invocations into one underlying call per animation frame
 * (the last value in a frame wins).
 *
 * Hover readouts are the target: pointer events fire at several hundred Hz,
 * and each write to React state re-renders the chrome column. Wrapping the
 * write in this hook caps the chain at one React commit per frame (60fps),
 * which is the fastest the display can show anyway.
 */
export function useRafCoalesced<T>(fn: (value: T) => void): (value: T) => void {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const coalescer = useRef<ReturnType<typeof createRafCoalescer<T>> | null>(null);
  if (!coalescer.current) {
    coalescer.current = createRafCoalescer<T>((v) => fnRef.current(v));
  }
  useEffect(() => () => coalescer.current?.cancel(), []);
  return useCallback((value: T) => coalescer.current?.call(value), []);
}
