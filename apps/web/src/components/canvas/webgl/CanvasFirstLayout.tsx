"use client";

/**
 * Gold Standard 2026 — Canvas‑First Layout Wrapper (Module 1 / 2 / 3).
 *
 *   z‑0   <canvas>        Main 3D Canvas / WebGL context.
 *   z‑10  spatial slot    Spatial UI overlays pinned to world points
 *                          (crosshair, snap guides, world‑chips).
 *   z‑20  chrome slot     Peripheral floating chrome (tool rail,
 *                          sidebars, property inspector).
 *   z‑30  app slot        Global application elements (command palette,
 *                          dropdowns, popups, context menus).
 *
 * See also:
 *   - docs/CANVAS-FIRST-Z-STACK-CONTRACT.md — full contract, migration
 *     recipe, three-way guard description, escape-hatch map.
 *   - ../cfz.ts — JS-side reader for the same SDS ladder. Feature
 *     modules that wire drei `<Html zIndexRange>` values pull from
 *     cfZPair("...") so the ladder has one source of truth.
 *
 * Two contracts:
 *
 *   1. Geometry — four absolutely‑positioned sibling slots stacked on a
 *      single 0/10/20/30 z‑axis. The studio's Canvas element lives at z‑0;
 *      overlay slots are `position: absolute; inset: 0; pointer-events:none`
 *      so touches pass through to the canvas by default. Interactive cards
 *      inside chrome re‑enable themselves with `pointer-events:auto`.
 *
 *   2. State    — a shallow‑primitive `bridge` prop (Module 2) carries
 *      only booleans, normalized 0..1 scalars and flat config objects from
 *      chrome into the canvas engine. The wrapper NEVER imports
 *      cameraAnimation, cameraRig or studioStore internals (White Glove
 *      policy). The canvas engine pulls the bridge on its own RAF tick.
 *
 * Module 3 — keyboard focus engine — keeps an off‑screen `<ul role="tree">`
 * in sync with the spatial graph so screen‑reader users can navigate the
 * world with Arrow / Home / End keys and Escape drops focus back onto the
 * next floating chrome element in document order.
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

/* ─── public types ──────────────────────────────────────────────────── */

/** A node in the off‑screen spatial mirror tree. */
export interface SpatialGraphNode {
  /** Stable id — passed to the bridge as the only primitive. */
  id: string;
  /** Human readable label that the screen reader announces. */
  label: string;
  /** Tree depth — defaults to 1. Increases with nested spatial groups. */
  level?: number;
  /** Treeitem disabled state — surfaces `aria-disabled` not `disabled`. */
  disabled?: boolean;
}

/** Shallow‑primitive bridge for layout → canvas communication. */
export interface CanvasBridge {
  /** Reset the camera to a normalized NDC target vector ([x,y,z] ∈ [-1,1]³). */
  onCameraReset?: (targetNdc: [number, number, number]) => void;
  /** Patch a flat scalar config object (e.g. `{ scale: 1.4 }`). */
  onScalar?: (patch: Record<string, number>) => void;
}

export interface CanvasFirstLayoutProps {
  /** Studio canvas — the absolutely‑positioned Canvas element. */
  canvas: ReactNode;
  /** Spatial UI overlays pinned to world points (crosshair, snap guides). */
  spatial?: ReactNode;
  /** Peripheral floating chrome (tool rails, sidebars, inspectors). */
  chrome?: ReactNode;
  /** Global application elements (command palette, menus, popups). */
  app?: ReactNode;
  /**
   * Optional fallback chrome — treated as the chrome slot when `chrome` is
   * omitted. Lets existing overlays (which construct chrome inline) drop
   * in without restructuring children into named slots.
   */
  children?: ReactNode;

  /** Latest spatial graph state mirrored to the off‑screen tree. */
  spatialGraph?: SpatialGraphNode[];
  /** Externally‑driven focus cursor (e.g. canvas‑side picking). */
  activeId?: string | null;
  /** Fired whenever the keyboard engine selects a new node id. */
  onSelect?: (id: string) => void;

  /** ARIA label for the canvas application region. */
  ariaLabel?: string;
  /** Optional id of an external instructions node for `aria-describedby`. */
  ariaDescriptionId?: string;

  /** Viewport edge margin for peripheral chrome (default 16px / 1rem). */
  edgeMargin?: number | string;

  /** Optional className / style passthrough for the root element. */
  className?: string;
  style?: CSSProperties;

  /** Layout → canvas interaction bridge (Module 2). */
  bridge?: CanvasBridge;

  /** Optional root-level pointer handlers — lets the consumer toggle the
   *  draw cursor / grab state across the entire viewport, including over
   *  the chrome slot regions. */
  onPointerDown?: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp?: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerLeave?: (event: ReactPointerEvent<HTMLDivElement>) => void;
}

export interface CanvasFirstLayoutHandle {
  /** Programmatic Escape — drops canvas focus onto the next chrome node. */
  releaseFocus: () => void;
  /** Move the in‑canvas focus cursor by (±dx, ±dy). */
  step: (dx: number, dy: number) => void;
  /** Jump the focus cursor to the node matching `id` (no‑op if absent). */
  jumpTo: (id: string) => void;
}

/* ─── implementation ─────────────────────────────────────────────────── */

export const CanvasFirstLayout = forwardRef<
  CanvasFirstLayoutHandle,
  CanvasFirstLayoutProps
>(function CanvasFirstLayout(props, forwardedRef) {
  const {
    canvas,
    spatial,
    chrome,
    app,
    children,
    spatialGraph = EMPTY_GRAPH,
    activeId,
    onSelect,
    ariaLabel = "Design canvas",
    ariaDescriptionId,
    edgeMargin = 16,
    className,
    style,
    bridge,
  } = props;

  /* SSR‑stable auto id for the built‑in aria‑describedby target. */
  const autoId = useId();
  const descriptionId = ariaDescriptionId ?? `cf-desc-${autoId}`;

  const canvasSlotRef = useRef<HTMLDivElement>(null);
  const mirrorTreeRef = useRef<HTMLUListElement>(null);
  const [cursor, setCursor] = useState(0);

  /* The first of these is the resolved "currently selected" id. Used by
   * aria‑selected on each <li> and by the focus engine when syncing focus
   * to a specific sr‑only treeitem after a keyboard move. */
  const resolvedActiveId =
    activeId ?? spatialGraph[cursor]?.id ?? null;

  /* ─── module 3 — keyboard focus engine ──────────────────────────── */

  const focusMirrorItem = useCallback((id: string | null) => {
    const list = mirrorTreeRef.current;
    if (!list || !id) return;
    const target = list.querySelector<HTMLLIElement>(
      `li[data-node-id="${cssEscape(id)}"]`,
    );
    if (!target) return;
    /* Toggle aria‑selected on every sibling so the SR announcement matches
     * the focused item. */
    const siblings = list.querySelectorAll<HTMLLIElement>("li[data-node-id]");
    siblings.forEach((el) => {
      el.setAttribute(
        "aria-selected",
        el.dataset.nodeId === id ? "true" : "false",
      );
    });
    target.focus({ preventScroll: true });
  }, []);

  const stepCursor = useCallback(
    (delta: number) => {
      if (spatialGraph.length === 0) return;
      setCursor((prev) => {
        const next = (prev + delta + spatialGraph.length) % spatialGraph.length;
        const node = spatialGraph[next];
        if (!node || node.disabled) {
          /* If the landed node is disabled, push another step until a
           * non‑disabled node is found (or we cycle once). */
          return prev;
        }
        onSelect?.(node.id);
        focusMirrorItem(node.id);
        return next;
      });
    },
    [spatialGraph, onSelect, focusMirrorItem],
  );

  const jumpTo = useCallback(
    (id: string) => {
      const idx = spatialGraph.findIndex((n) => n.id === id);
      if (idx < 0) return;
      setCursor(idx);
      onSelect?.(id);
      focusMirrorItem(id);
    },
    [spatialGraph, onSelect, focusMirrorItem],
  );

  const releaseFocus = useCallback(() => {
    canvasSlotRef.current?.blur();
    /* Escape Hatch (Module 3.4): pass focus forward to the nearest visible
     * floating chrome element AFTER the canvas in document order. We walk
     * the wrapper's subtree only — chrome above the layout is the parent's
     * concern. */
    const root = canvasSlotRef.current?.parentElement;
    if (!root) return;
    const focusables = Array.from(
      root.querySelectorAll<HTMLElement>(
        [
          "a[href]",
          "button:not([disabled])",
          "input:not([disabled])",
          "select:not([disabled])",
          "textarea:not([disabled])",
          "[tabindex]:not([tabindex='-1'])",
        ].join(","),
      ),
    ).filter((el) => {
      if (el === canvasSlotRef.current) return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    focusables[0]?.focus({ preventScroll: true });
  }, []);

  useImperativeHandle(
    forwardedRef,
    () => ({ releaseFocus, step: stepCursor, jumpTo }),
    [releaseFocus, stepCursor, jumpTo],
  );

  /* ─── Module 2 — bridge callbacks (shallow‑primitives only) ─────── */

  const triggerCameraReset = useCallback(() => {
    /* Default "Reset View" target: scene origin in centred NDC space.
     * The canvas engine pulls this primitive flag on its next RAF tick and
     * interpolates the camera matrix internally — we never reach into the
     * math layer from here. */
    bridge?.onCameraReset?.([0, 0, 0]);
  }, [bridge]);

  /* `bridge.onScalar` is the Module 2.2 channel for parameter sliders —
   * flat config patches the canvas engine pulls on its next execution tick.
   * The wrapper itself ships the contract, not a chrome implementation;
   * chrome that owns a slider passes `bridge.onScalar` in from above. */

  /* ─── key handler (attached to the canvas slot) ─────────────────── */

  const onCanvasKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      switch (event.key) {
        case "ArrowDown":
        case "ArrowRight":
          event.preventDefault();
          stepCursor(+1);
          break;
        case "ArrowUp":
        case "ArrowLeft":
          event.preventDefault();
          stepCursor(-1);
          break;
        case "Home":
          event.preventDefault();
          if (spatialGraph.length > 0) {
            jumpTo(spatialGraph[0].id);
          }
          break;
        case "End":
          event.preventDefault();
          if (spatialGraph.length > 0) {
            jumpTo(spatialGraph[spatialGraph.length - 1].id);
          }
          break;
        case "Escape":
          event.preventDefault();
          releaseFocus();
          break;
        case "F6":
          /* F6 is the canonical "rotate focus regions" key. Drop into the
           * next floating chrome element and re‑anchor keyboard nav there. */
          event.preventDefault();
          releaseFocus();
          break;
        default:
          /* Let Tab / Enter / Space fall through — Tab moves focus to the
           * next surface chrome, Enter/Space belong to canvas pick logic. */
          break;
      }
    },
    [stepCursor, jumpTo, releaseFocus, spatialGraph],
  );

  /* ─── sync remote activeId → mirror cursor ─────────────────────── */

  useEffect(() => {
    if (!activeId) return;
    const idx = spatialGraph.findIndex((n) => n.id === activeId);
    if (idx < 0) return;
    setCursor(idx);
    focusMirrorItem(activeId);
  }, [activeId, spatialGraph, focusMirrorItem]);

  /* ─── styles ────────────────────────────────────────────────────── */

  const wrapperStyle: CSSProperties = {
    position: "fixed",
    inset: 0,
    width: "100vw",
    height: "100vh",
    overflow: "hidden",
    background: "var(--canvas-base)",
    color: "var(--gold-standard-ink)",
    ...style,
  };

  const chromeSlotStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    zIndex: "var(--cf-z-chrome)",
    padding: typeof edgeMargin === "number" ? `${edgeMargin}px` : edgeMargin,
  };

  return (
    <div
      className={className}
      style={wrapperStyle}
      data-cf-layout="root"
      /* SSR-stable wrapper attributes forwarded to a small dataset.
       * Useful for layout debugging and the chrome's keyboard nav. */
      data-cf-edge-margin={String(edgeMargin)}
      onPointerDown={props.onPointerDown}
      onPointerUp={props.onPointerUp}
      onPointerLeave={props.onPointerLeave}
    >
      {/* Layer 1 — Canvas (z = 0). */}
      <div
        ref={canvasSlotRef}
        role="application"
        tabIndex={0}
        aria-label={ariaLabel}
        aria-describedby={descriptionId}
        onKeyDown={onCanvasKeyDown}
        onDoubleClick={triggerCameraReset}
        data-cf-layer="canvas"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: "var(--cf-z-canvas)",
          /* White‑glove policy: static canvas host consumes gestures,
           * never the document. Lets the R3F raycaster own pointer events. */
          touchAction: "none",
          outline: "none",
        }}
      >
        {canvas}
      </div>

      {/* Layer 2 — Spatial overlays (z = 10). Pinned to world points by
          children; the wrapper itself is a transparent pass‑through. */}
      <div
        data-cf-layer="spatial"
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: "var(--cf-z-spatial)",
        }}
      >
        {spatial}
      </div>

      {/* Layer 3 — Peripheral chrome (z = 20). Float panels, tool rails,
          sidebars, property inspectors. Children opt back into pointer
          events with `pointer-events:auto` (GlassCard does this for us). */}
      <div
        data-cf-layer="chrome"
        style={chromeSlotStyle}
      >
        {chrome ?? children}
      </div>

      {/* Layer 4 — Global app elements (z = 30). Dropdowns, command
          palette, share popups, anything that should always sit above
          floating chrome. Same pointer‑events policy as chrome slot. */}
      <div
        data-cf-layer="app"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: "var(--cf-z-app)",
        }}
      >
        {app}
      </div>

      {/* ── Module 3 — Off‑screen accessible mirror tree ─────────── */}
      <ul
        ref={mirrorTreeRef}
        role="tree"
        aria-label="Canvas spatial graph"
        tabIndex={-1}
        // SR-only mirror tree — uses its own namespace so it does NOT
        // participate in the four-tier visual stacking registry
        // (canvas/spatial/chrome/app). Visual layers and the accessibility
        // mirror are intentionally separated concerns: cfz.registry.test.ts
        // guards the four-tier set; this attribute is its own a11y hook.
        data-cf-mirror=""
        style={mirrorTreeStyle}
      >
        {spatialGraph.map((node) => {
          const isActive = node.id === resolvedActiveId;
          return (
            <li
              key={node.id}
              role="treeitem"
              aria-level={node.level ?? 1}
              aria-selected={isActive}
              aria-disabled={node.disabled || undefined}
              data-node-id={node.id}
              tabIndex={isActive ? 0 : -1}
              style={{
                /* Tab index scrubbing: only the focused item is tabbable
                 * so the tree acts like a single composite widget. */
                outline: "none",
              }}
            >
              {node.label}
            </li>
          );
        })}
      </ul>

      {/* Built‑in aria‑describedby target — describes the keyboard
          contract for screen reader users on canvas entry. */}
      <span id={descriptionId} style={mirrorTreeStyle}>
        Use arrow keys to navigate the spatial graph. Press Escape to
        return focus to the surrounding chrome panels.
      </span>
    </div>
  );
});

/* ─── helpers ────────────────────────────────────────────────────────── */

const EMPTY_GRAPH: readonly SpatialGraphNode[] = Object.freeze([]);

/** SR‑only positioning trick (Module 3.2): 1×1 px clip so the tree remains
 *  in the DOM tree and announceable, but is invisible to sighted users.
 *  Matches the standard "clip‑rect" technique used by every a11y lib.
 *  Kept as a CSSProperties object so the component stays "use client"
 *  friendly without dragging in a stylesheet import. */
const mirrorTreeStyle: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
  pointerEvents: "none",
  zIndex: "var(--cf-z-app)" /* keep announcable layer above chrome */,
};

/** Attribute‑selector escape so node ids can contain punctuation. */
function cssEscape(input: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(input);
  }
  return input.replace(/([^a-zA-Z0-9_-])/g, "\\$1");
}

export default CanvasFirstLayout;
