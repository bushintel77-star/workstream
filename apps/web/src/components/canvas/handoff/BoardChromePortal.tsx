"use client";

import {
  useLayoutEffect,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

/**
 * Renders frosted / dock chrome as a child of `[data-testid=studio-board]`,
 * outside `.zoomWorld`, so pan/zoom/rotate never scale UI chrome.
 */
export function BoardChromePortal({
  children,
  anchorRef,
}: {
  children: ReactNode;
  /** Prefer resolving the board via an in-tree anchor (avoids race on first paint). */
  anchorRef?: RefObject<HTMLElement | null>;
}) {
  const [host, setHost] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    let cancelled = false;
    const resolve = () => {
      const fromAnchor = anchorRef?.current?.closest(
        '[data-testid="studio-board"]',
      ) as HTMLElement | null;
      return (
        fromAnchor ??
        (document.querySelector(
          '[data-testid="studio-board"]',
        ) as HTMLElement | null)
      );
    };
    const sync = () => {
      if (cancelled) return;
      const next = resolve();
      setHost((prev) => (prev === next ? prev : next));
    };
    sync();
    // Board may mount a tick after children that portal chrome.
    const raf = requestAnimationFrame(sync);
    const poll = window.setInterval(sync, 50);
    const stop = window.setTimeout(() => clearInterval(poll), 2000);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      clearInterval(poll);
      clearTimeout(stop);
    };
  }, [anchorRef]);

  if (!host) return null;
  return createPortal(children, host);
}
