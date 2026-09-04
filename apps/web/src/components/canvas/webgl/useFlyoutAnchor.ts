"use client";

/**
 * Tier-1 widget standard — the alignment law every ribbon flyout obeys.
 *
 * A flyout anchors to ITS OWN anchor tile: vertically centred on the tile's
 * live rect (arrow tip on the tile's centre line), blooming 10px off the
 * ribbon's actual edge, never covering the tile, never crossing the viewport
 * edges or the bottom chrome stack. The measurement is LIVE, not taken once
 * at mount:
 *
 *   - the ribbon re-lays its tiles and changes width when it recedes to the
 *     pen-down rail (88px → 56px), so both the tile's centre and the ribbon's
 *     edge move under an open panel;
 *   - the panel's own height changes when a disclosure (Falloff) expands;
 *   - the bottom chrome stack (camera dock et al) owns its own box — a tall
 *     panel is clamped above it, not over it (collision gate);
 *   - the window can resize or scroll under an open panel.
 *
 * The bloom side comes from the ribbon's MEASURED edge (hand-opposite law:
 * handedness RIGHT → ribbon on the left edge → the panel blooms right of
 * it), never from a hardcoded offset chain. A ResizeObserver on the ribbon
 * and on the panel plus window listeners re-place the panel on any change.
 */

import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { useStudioStore } from "./studioStore";

/** Viewport margin the flyout must never cross. */
const EDGE_MARGIN_PX = 20;
/** Gap between the ribbon's edge and the flyout (§5.3). */
const RIBBON_GAP_PX = 10;
/** Gap kept between the flyout's bottom edge and the bottom chrome stack. */
const BOTTOM_STACK_GAP_PX = 6;

/**
 * One column step for tiered panels: the flyout width (238px per §4) plus
 * the 10px gap. A second open widget blooms this far further from the
 * ribbon so two open panels compose into a row, never a pile.
 */
export const FLYOUT_COLUMN_STEP_PX = 248;

export interface FlyoutAnchor {
  panelRef: RefObject<HTMLDivElement | null>;
  /** Clamped `top` px in the panel's offset-parent space, or null for the
   *  one pre-measurement frame (the CSS falls back to `top: 50%` for it). */
  topPx: number | null;
  /** `left` px in offset-parent space, when the panel blooms to the RIGHT
   *  of the ribbon (ribbon on the left edge). Mutually exclusive with rightPx. */
  leftPx: number | null;
  /** `right` px in offset-parent space, when the panel blooms to the LEFT
   *  of the ribbon (ribbon on the right edge). */
  rightPx: number | null;
  /** True when the RIBBON is on the left edge (the default right-handed
   *  operator) — the panel blooms to its right and its arrow faces left. */
  ribbonOnLeft: boolean;
}

export function useFlyoutAnchor(
  anchorTileId: string,
  contentKey: unknown,
): FlyoutAnchor {
  // Hand-opposite law: a right-handed operator's ribbon sits on the LEFT
  // edge. This is only the pre-measurement guess — measure() re-derives the
  // side from the ribbon's actual rect.
  const handedness = useStudioStore((s) => s.handedness);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{
    top: number | null;
    left: number | null;
    right: number | null;
    ribbonOnLeft: boolean;
  }>({ top: null, left: null, right: null, ribbonOnLeft: handedness === "RIGHT" });

  useLayoutEffect(() => {
    const panel = panelRef.current;
    // The anchor tile carries data-active so a tile id that exists twice in
    // the DOM can never be picked up (only the live one is measurable).
    const tileSelector = `[data-testid="tool-ribbon"] [data-tool-id="${anchorTileId}"][data-active="true"]`;

    const measure = () => {
      const tile = document.querySelector<HTMLElement>(tileSelector);
      const ribbon = document.querySelector<HTMLElement>('[data-testid="tool-ribbon"]');
      if (!tile || !ribbon || !panel) {
        setPos((prev) =>
          prev.top === null && prev.left === null && prev.right === null
            ? prev
            : { ...prev, top: null, left: null, right: null },
        );
        return;
      }
      // The panel is positioned inside an offset parent that may itself be
      // offset from the viewport — convert every viewport coord through it.
      const container = panel.offsetParent as HTMLElement | null;
      const cRect = container?.getBoundingClientRect();
      const cLeft = cRect?.left ?? 0;
      const cTop = cRect?.top ?? 0;

      const tileRect = tile.getBoundingClientRect();
      const panelHeight = panel.getBoundingClientRect().height;
      const tileCenterY = tileRect.top + tileRect.height / 2;

      // Vertical clamp, in TOP space (the panel's top edge, viewport px).
      // Bounds, in priority order: the bottom chrome stack's top edge when
      // one is on screen (the stack owns its box — the collision gate
      // measures exactly this), else the viewport bottom edge; the viewport
      // top edge. A panel taller than the usable band pins to the top edge
      // rather than fighting the bounds.
      let bottomLimit = window.innerHeight - EDGE_MARGIN_PX;
      const stack = document.querySelector<HTMLElement>(
        '[data-testid="bottom-chrome-stack"]',
      );
      const dock = document.querySelector<HTMLElement>('[data-testid="camera-dock"]');
      const stackTop = Math.min(
        stack?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY,
        dock?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY,
      );
      if (Number.isFinite(stackTop)) bottomLimit = stackTop - BOTTOM_STACK_GAP_PX;

      const maxTop = bottomLimit - panelHeight;
      const topIdeal = tileCenterY - panelHeight / 2; // centred on the tile
      const clampedTop =
        maxTop < EDGE_MARGIN_PX
          ? EDGE_MARGIN_PX
          : Math.min(Math.max(topIdeal, EDGE_MARGIN_PX), maxTop);

      // Bloom side from the ribbon's MEASURED edge (left half of the
      // viewport = ribbon on the left edge).
      const ribbonRect = ribbon.getBoundingClientRect();
      const ribbonOnLeft =
        ribbonRect.left + ribbonRect.width / 2 < window.innerWidth / 2;

      setPos((prev) => {
        if (ribbonOnLeft) {
          const left = ribbonRect.right - cLeft + RIBBON_GAP_PX;
          const top = clampedTop - cTop;
          return prev.top === top && prev.left === left && prev.right === null && prev.ribbonOnLeft
            ? prev
            : { top, left, right: null, ribbonOnLeft: true };
        }
        const containerWidth = cRect?.width ?? window.innerWidth;
        const right = containerWidth - (ribbonRect.left - cLeft) + RIBBON_GAP_PX;
        const top = clampedTop - cTop;
        return prev.top === top && prev.right === right && prev.left === null && !prev.ribbonOnLeft
          ? prev
          : { top, left: null, right, ribbonOnLeft: false };
      });
    };

    measure();

    // Re-place on any geometry change: the ribbon (tile re-layout + rail
    // width change), the panel itself (disclosure expand/collapse), the
    // window (resize; capture scroll covers any scrolling ancestor).
    // `measure` re-queries the ribbon each pass for a fresh rect; the
    // observed element is the one that existed at effect time.
    const ribbonEl = document.querySelector<HTMLElement>('[data-testid="tool-ribbon"]');
    const ro = new ResizeObserver(measure);
    if (ribbonEl) ro.observe(ribbonEl);
    if (panel) ro.observe(panel);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
    // contentKey re-measures when the panel's content swaps (tool change,
    // sections mounting) — the frame the new height exists.
  }, [anchorTileId, contentKey]);

  return {
    panelRef,
    topPx: pos.top,
    leftPx: pos.left,
    rightPx: pos.right,
    ribbonOnLeft: pos.ribbonOnLeft,
  };
}
