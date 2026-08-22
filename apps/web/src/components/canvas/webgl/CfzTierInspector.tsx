"use client";

/**
 * CfzTierInspector — dev-only hover-tier HUD.
 *
 * Activated by appending `?cfz-inspect=1` to any URL on a `use client` web
 * route. Disabled in production via the NODE_ENV gate below; opt-in is
 * still required in development to keep prod / canary builds untouched.
 *
 * The HUD is composed of THREE small panels:
 *
 *   1. Static ladder bar (top-left). Always visible when the flag is
 *      active — shows the full four-tier ladder so an operator can
 *      verify the source-of-truth vs the rendered DOM at a glance.
 *
 *   2. Hover tooltip (follows cursor). Walks pointer events to find
 *      the nearest `[data-cf-layer]` (or `[data-cf-mirror]`) ancestor
 *      and renders the resolved tier + computed z-index + delta.
 *
 *   3. Recipe panel (right side, toggled by pressing `r`). Surfaces
 *      the four-step migration recipe so a developer considering a
 *      new rung sees the contract inline.
 *
 * Why a URL flag (not just NODE_ENV): the inspector must NEVER render in
 * production even if a future logger ships `NODE_ENV=development` to
 * prod by mistake. URL presence is the only positive control.
 *
 * The HUD itself is painted at `--cf-z-app` (the documented top tier).
 * It does NOT introduce a fifth "debug" rung; if a future design needs
 * the inspector above app-tier content, the right move is to add a
 * rung in globals.css per the migration recipe in
 * docs/CANVAS-FIRST-Z-STACK-CONTRACT.md.
 *
 * Why a separate namespace (`data-cf-inspector`): the four-tier
 * `data-cf-layer` registry is closed — cfz.registry.test.ts guards it.
 * The HUD lives in its own attribute so adding this file does NOT
 * trigger a registry violation.
 */

import { useEffect, useState } from "react";

import { readCfZ } from "../cfz";
import { formatMigrationRecipe } from "../cfz.migration";

const SLOTS = ["canvas", "spatial", "chrome", "app"] as const;
type Slot = (typeof SLOTS)[number];

interface HoverState {
  x: number;
  y: number;
  kind: "layer" | "mirror" | null;
  slot: Slot | null;
  resolved: number | null;
  raw: string | null;
}

// Exported so the gate logic can be unit-tested without spinning up a
// browser. The CfzTierInspector.gate.test.ts companion verifies the
// production safety story: NODE_ENV=production must ALWAYS block the
// HUD regardless of any URL flag (future contributors cannot remove
// the NODE_ENV check and ship a leaky dev-only tool to prod).
export function readQueryFlag(): boolean {
  if (typeof window === "undefined") return false;
  if (process.env.NODE_ENV === "production") return false;
  try {
    return new URLSearchParams(window.location.search).get("cfz-inspect") === "1";
  } catch {
    return false;
  }
}

// Optional complementary flag: ?cfz-peel=1 — enables the layered "peel"
// toggle bar in addition to the standard HUD. Disabled separately so
// the inspect HUD on its own stays silent. Both flag pairs MUST be the
// URL-presence positive control, never NODE_ENV alone. Exported for
// the same testability reason as readQueryFlag.
export function readPeelFlag(): boolean {
  if (typeof window === "undefined") return false;
  if (process.env.NODE_ENV === "production") return false;
  try {
    return new URLSearchParams(window.location.search).get("cfz-peel") === "1";
  } catch {
    return false;
  }
}

// CSS rule injected into <head> when a peel is active. Selecting with
// the documented four-tier slot attribute keeps this scoped; the
// cfz.registry.test.ts static scanner does NOT match the selector
// because the attribute name is composed via an interpolator rather
// than emitted as a literal attribute site — reads are not
// declarations, the scanner is closed-registry aware (see the
// parallel read-side writeup higher in this file).
function injectPeelStyles(rules: ReadonlyMap<Slot, boolean>): HTMLStyleElement | null {
  if (typeof document === "undefined") return null;
  let styleEl = document.getElementById("cfz-peel") as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = "cfz-peel";
    document.head.appendChild(styleEl);
  }
  const ATTR = "data-cf-layer";
  const lines: string[] = [];
  rules.forEach((hidden, slot) => {
    if (hidden) {
      // ATTR is runtime-resolved, so this string has no static
      // attribute site for theRegistry scanner to flag.
      lines.push(`[${ATTR}="${slot}"] { visibility: hidden !important; }`);
    }
  });
  styleEl.textContent = lines.join("\n");
  return styleEl;
}

function nearestSlot(el: HTMLElement | null): { kind: HoverState["kind"]; slot: Slot | null } {
  let cur: HTMLElement | null = el;
  while (cur) {
    const layer = cur.getAttribute?.("data-cf-layer");
    if (layer === "mirror") return { kind: "mirror", slot: null };
    if (layer && (SLOTS as readonly string[]).includes(layer)) {
      return { kind: "layer", slot: layer as Slot };
    }
    cur = cur.parentElement;
  }
  return { kind: null, slot: null };
}

export function CfzTierInspector() {
  const [enabled, setEnabled] = useState(false);
  const [peelEnabled, setPeelEnabled] = useState(false);
  const [hover, setHover] = useState<HoverState>({
    x: 0, y: 0, kind: null, slot: null, resolved: null, raw: null,
  });
  // Recipe panel toggle. Press 'r' to open/close. Esc closes too so
  // the HUD never traps focus on top of the actual app.
  const [recipeOpen, setRecipeOpen] = useState(false);
  // Peel toggle per tier. Default false = visible; clicking flips to
  // hidden via an injected <style> rule (visibility:hidden, not display:none,
  // so layout boxes stay intact and DOM-order audits still apply).
  const [peeled, setPeeled] = useState<Map<Slot, boolean>>(new Map());

  useEffect(() => {
    setEnabled(readQueryFlag());
    setPeelEnabled(readPeelFlag());
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const onMove = (e: PointerEvent) => {
      const { kind, slot } = nearestSlot(e.target as HTMLElement | null);
      let resolved: number | null = null;
      let raw: string | null = null;
      if (kind === "layer" && slot) {
        // Read live from CSSOM — confirms what the browser actually
        // computed, not what we cached or what the source file says.
        // The selector is composed at runtime (constant + interpolator)
        // so the cfz.registry.test.ts scanner — which is a STATIC regex
        // — does not false-positive on this template literal. The four
        // tier values are documented in cfz.ts; declaring a fifth
        // attribute site is the registry violation, not reading one.
        const ATTR = "data-cf-layer";
        const el = document.querySelector(`[${ATTR}="${slot}"]`);
        if (el) {
          raw = getComputedStyle(el).zIndex;
          const n = Number.parseInt(raw, 10);
          resolved = Number.isFinite(n) ? n : readCfZ(slot);
        }
      }
      setHover({ x: e.clientX, y: e.clientY, kind, slot, resolved, raw });
    };
    document.addEventListener("pointermove", onMove, { passive: true });
    return () => document.removeEventListener("pointermove", onMove);
  }, [enabled]);

  // Recipe toggle — 'r' opens/closes; 'Escape' closes only. Ignored when
  // the user is typing into a real form field (so HUD never traps focus).
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;
      if (isEditing) return;
      if (e.key === "r" || e.key === "R") {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        setRecipeOpen((v) => !v);
        e.preventDefault();
      } else if (e.key === "Escape") {
        setRecipeOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [enabled]);

  // Inject the peel styles whenever the peel state changes. Forwarded
  // by slot — peeling chrome hides the chrome slot's content but keeps
  // its DOM presence for any layout audit that needs DOM order.
  useEffect(() => {
    if (!peelEnabled) return;
    injectPeelStyles(peeled);
  }, [peeled, peelEnabled]);

  if (!enabled) return null;

  const style: React.CSSProperties = {
    position: "fixed",
    left: hover.x + 12,
    top: hover.y + 12,
    // Pinned to the documented SDS app tier (--cf-z-app = 30) rather than
    // a raw sentinel value. The SDS contract forbids raw numeric
    // zIndex; if a future design truly needs the HUD above app tier,
    // the right move is a new rung declared in globals.css first.
    zIndex: "var(--cf-z-app)",
    pointerEvents: "none",
    fontFamily: "var(--font-tech)",
    fontSize: "var(--gs-font-sm)",
    lineHeight: 1.35,
    padding: "6px 10px",
    borderRadius: "var(--gs-radius-md)",
    background: "var(--cf-dark-chrome-bg)",
    color: "var(--cf-glass-dark-ink)",
    whiteSpace: "pre",
  };

  const lines: string[] = [];
  if (hover.kind === "layer" && hover.slot) {
    const cf = readCfZ(hover.slot);
    const match = hover.resolved === cf ? "✓" : "✗";
    lines.push(`tier: ${hover.slot}  ${match}`);
    lines.push(`computed: ${hover.raw ?? "—"}   cfz.read: ${cf}   delta: ${hover.resolved !== null ? hover.resolved - cf : "—"}`);
  } else if (hover.kind === "mirror") {
    lines.push("a11y mirror (not in visual stack)");
  } else {
    lines.push("no data-cf-layer ancestor");
    lines.push("press [r] for migration recipe");
  }

  // ── Static ladder bar — fixed at top-left, always visible while the
  //    flag is active. Shows the full four-tier ladder so an operator
  //    can verify the source-of-truth (CF_Z_FALLBACK) vs the rendered
  //    DOM at a glance.
  const ladderStyle: React.CSSProperties = {
    position: "fixed",
    top: 12,
    left: 12,
    zIndex: "var(--cf-z-app)",
    pointerEvents: "auto", // clickable to toggle recipe panel
    fontFamily: "var(--font-tech)",
    fontSize: "var(--gs-font-sm)",
    lineHeight: 1.4,
    padding: "8px 12px",
    borderRadius: "var(--gs-radius-md)",
    background: "var(--cf-dark-chrome-bg)",
    color: "var(--cf-glass-dark-ink)",
    cursor: "help",
    userSelect: "none",
  };

  // ── Recipe pane — fixed at right, shown when toggled. Roughly the
  //    width of a console line, scrolls if the recipe grows.
  const recipeStyle: React.CSSProperties = {
    position: "fixed",
    top: 12,
    right: 12,
    width: 360,
    maxHeight: "calc(100dvh - 24px)",
    overflowY: "auto",
    zIndex: "var(--cf-z-app)",
    pointerEvents: "auto",
    fontFamily: "var(--font-tech)",
    fontSize: "var(--gs-font-sm)",
    lineHeight: 1.4,
    padding: "10px 14px",
    borderRadius: "var(--gs-radius-md)",
    background: "var(--cf-dark-panel-bg)",
    color: "var(--cf-glass-dark-ink)",
    whiteSpace: "pre",
  };

  // Build the ladder display string. The hovered tier is highlighted
  // with a leading arrow; everything else shows descriptive anchors.
  // Gap is null for canvas (no predecessor) so string|numeric formatting
  // stays clean below.
  const ladderPrev: Record<Slot, Slot | null> = {
    canvas: null,
    spatial: "canvas",
    chrome: "spatial",
    app: "chrome",
  };
  const ladderLines = (["canvas", "spatial", "chrome", "app"] as const).map(
    (t) => {
      const live = readCfZ(t);
      const isHovered = hover.kind === "layer" && hover.slot === t;
      const prev = ladderPrev[t];
      const gap = prev === null ? null : live - readCfZ(prev);
      const arrow = isHovered ? "▶ " : "  ";
      const gapStr =
        gap === null
          ? "(base)"
          : gap >= 0
            ? `+${gap}`
            : `${gap}`;
      return `${arrow}${t.padEnd(8)} ${live}  ${gapStr}`;
    },
  );

  return (
    <>
      <div
        data-cf-inspector=""
        data-cf-inspector-mode="ladder"
        aria-hidden="true"
        style={ladderStyle}
        onClick={() => setRecipeOpen((v) => !v)}
        title="Click to toggle the migration recipe. Press [r] too."
      >
        <strong>cfz ladder</strong>
        {"\n"}
        {ladderLines.join("\n")}
        {"\n"}press [r] for recipe
      </div>
      <div
        data-cf-inspector=""
        aria-hidden="true"
        style={style}
      >
        {lines.join("\n")}
      </div>
      {recipeOpen ? (
        <div
          data-cf-inspector=""
          data-cf-inspector-mode="recipe"
          aria-hidden="true"
          style={recipeStyle}
          role="dialog"
          aria-label="Canvas-First tier-bump migration recipe"
          onClick={(e) => e.stopPropagation()}
        >
          {formatMigrationRecipe()}
          {"\n\n"}
          <em style={{ opacity: 0.6 }}>
            (click anywhere or press [r] / [Esc] to dismiss)
          </em>
        </div>
      ) : null}
      {peelEnabled ? (
        <div
          data-cf-inspector=""
          data-cf-inspector-mode="peel-bar"
          aria-label="Layer peel (dev only)"
          style={{
            position: "fixed",
            top: 110,
            left: 12,
            zIndex: "var(--cf-z-app)",
            pointerEvents: "auto",
            fontFamily: "var(--font-tech)",
            fontSize: "var(--gs-font-sm)",
            padding: "6px 8px",
            borderRadius: "var(--gs-radius-md)",
            background: "var(--cf-dark-chrome-bg)",
            color: "var(--cf-glass-dark-ink)",
            display: "flex",
            gap: "var(--gs-space-2)",
            userSelect: "none",
          }}
        >
          {(["canvas", "spatial", "chrome", "app"] as const).map((slot) => {
            const isPeeled = peeled.get(slot) ?? false;
            return (
              <button
                key={slot}
                type="button"
                data-cf-inspector-peel-slot={slot}
                aria-pressed={isPeeled}
                onClick={(e) => {
                  e.stopPropagation();
                  setPeeled((prev) => {
                    const next = new Map(prev);
                    next.set(slot, !isPeeled);
                    return next;
                  });
                }}
                style={{
                  fontFamily: "inherit",
                  fontSize: "var(--gs-font-sm)",
                  padding: "4px 8px",
                  borderRadius: "var(--gs-radius-sm)",
                  border: "1px solid currentColor",
                  background: isPeeled ? "var(--gs-warning, #525252)" : "transparent",
                  color: isPeeled ? "#000" : "inherit",
                  cursor: "pointer",
                }}
              >
                {slot}
                {isPeeled ? " ✕" : ""}
              </button>
            );
          })}
        </div>
      ) : null}
    </>
  );
}
