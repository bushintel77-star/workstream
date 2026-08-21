"use client";

/**
 * Gold Standard 2026 — Tier 3 #2: <Button> primitive.
 *
 * The audit found 62 raw `<button>` across 22 files in canvas chrome;
 * this primitive captures the four recurring shapes that account for
 * the chrome-tier surface (chip / ghost / icon / primary) without
 * touching the long tail of file-specific behaviour (asset cards,
 * stitch records, scrubbers, etc.). Per the standards doc the goal
 * is "start with chrome-tier chips, snapshot pixel-stable to the
 * current visual" — every variant here renders byte-identical to the
 * prior inline styles for PerimeterTabStrip's tabs and FitSheetCard's
 * × close button.
 *
 * Variants:
 *   • chip   — PerimeterTabStrip mode/meta tab. pill, transparent
 *              border, charcoal active, hover-lightup only when
 *              inactive. Letter-spacing 0.04em.
 *   • ghost  — pill button with hairline border, transparent bg.
 *              Used for secondary chrome actions (e.g. "Close").
 *   • icon   — `all: "unset"` then re-apply a square footprint
 *              (`22×22` by default). Used for the × close affordance
 *              and other icon-only chrome.
 *   • primary — pill button with the primary ink background. Used
 *              sparingly (CTA-grade).
 *
 * Sizes:
 *   • sm (default) — 3px 9px padding for chips, square for icons
 *   • md            — 5px 12px padding for primary/ghost actions
 *
 * Forwarded props:
 *   • Every native <button> prop (`type`, `disabled`, `form`, …) plus
 *     `aria-pressed`, `aria-expanded`, `aria-label`, `data-*` (the
 *     @types/react@19 widening). `ref` is forwarded so consumers can
 *     keep imperative focus / measurement.
 */

import type {
  ButtonHTMLAttributes,
  CSSProperties,
  ReactNode,
} from "react";
import { forwardRef } from "react";

export type ButtonVariant =
  | "chip"
  | "chip-tinted"
  | "ghost"
  | "icon"
  | "primary";
export type ButtonSize = "xs" | "sm" | "md";

/**
 * Common chip shell — matches the prior `chipBase` in
 * PerimeterTabStrip.tsx byte-for-byte (the chrome chip recipe).
 */
const chipBase: CSSProperties = {
  fontFamily: "var(--font-ui)",
  fontSize: "var(--gs-font-sm)",
  letterSpacing: "0.04em",
  padding: "3px 9px",
  borderRadius: "var(--gs-radius-pill)",
  border: "1px solid transparent",
  whiteSpace: "nowrap",
  display: "inline-flex",
  alignItems: "center",
  gap: "var(--gs-space-2)",
  cursor: "pointer",
  background: "transparent",
  color: "var(--gs-ink-secondary)",
  transition: "background 0.15s, color 0.15s",
};

/**
 * Tighter chip — same recipe as `chipBase` but with `--gs-font-xs`
 * and 3px 8px padding. Used by InspectorCard's gizmo toggle pills
 * (Move / Rotate) where two chips share a Field row.
 */
const chipBaseXs: CSSProperties = {
  fontFamily: "var(--font-ui)",
  fontSize: "var(--gs-font-xs)",
  letterSpacing: "0.04em",
  padding: "3px 8px",
  borderRadius: "var(--gs-radius-pill)",
  border: "1px solid color-mix(in srgb, var(--gs-line) 55%, transparent)",
  background: "transparent",
  color: "var(--gs-ink-secondary)",
  cursor: "pointer",
};

/**
 * Tinted chip — like `chip` but uses `--gs-primary` (warm) instead
 * of `--gs-chip-active` (charcoal) for the active state. Used by
 * PhotoTraceHud's calibration workflow where the warm primary tint
 * reads as the active surface. 4 px 10 px padding (slightly more
 * generous than the chrome `chip` because calibration labels are
 * longer).
 */
const chipTintedBase: CSSProperties = {
  fontFamily: "var(--font-ui)",
  fontSize: "var(--gs-font-sm)",
  padding: "4px 10px",
  borderRadius: "var(--gs-radius-pill)",
  border:
    "1px solid color-mix(in srgb, var(--gs-line) 55%, transparent)",
  background: "transparent",
  color: "var(--gs-ink-secondary)",
  cursor: "pointer",
};

/**
 * Ghost pill — hairline border that becomes visible only on hover,
 * used for secondary chrome actions (the FitSheetCard's "Close"
 * before collapse, etc.). Padding scales with size.
 */
const ghostBase: CSSProperties = {
  fontFamily: "var(--font-ui)",
  fontSize: "var(--gs-font-sm)",
  padding: "5px 12px",
  borderRadius: "var(--gs-radius-pill)",
  border: "1px solid var(--gs-line)",
  background: "transparent",
  color: "var(--gs-ink-secondary)",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

/**
 * Icon-only button — `all: "unset"` then re-apply a square footprint
 * so the underlying button doesn't carry the browser-default border /
 * font / background. Matches FitSheetCard's × close button exactly.
 */
const iconBase: CSSProperties = {
  all: "unset",
  cursor: "pointer",
  width: 22,
  height: 22,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "var(--gs-ink-secondary)",
  fontSize: "var(--gs-font-h3)",
  lineHeight: 1,
  borderRadius: "var(--gs-radius-pill)",
};

/**
 * Primary CTA — charcoal pill, accent-tinted background. Rare, so
 * we don't sweat hover affordance beyond the `--gs-fast` curve.
 */
const primaryBase: CSSProperties = {
  fontFamily: "var(--font-ui)",
  fontSize: "var(--gs-font-sm)",
  fontWeight: 600,
  padding: "5px 12px",
  borderRadius: "var(--gs-radius-pill)",
  border: "1px solid color-mix(in srgb, var(--gs-primary) 45%, transparent)",
  background:
    "color-mix(in srgb, var(--gs-primary) 14%, transparent)",
  color: "var(--gs-primary)",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

export type ButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "type"
> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /**
   * Pressed / active state. Suppresses the chip variant's hover-lightup
   * (matches the prior PerimeterTabStrip.tsx onMouseEnter guard:
   * `if (!active) …`). Defaults to `false`.
   */
  active?: boolean;
  /**
   * Children — typically the visible label. For `variant="icon"` this
   * is usually a single glyph (e.g. `×` or `⟳`).
   */
  children?: ReactNode;
  /**
   * Allow `data-*` attributes. `@types/react@19` no longer widens them
   * through `ButtonHTMLAttributes`; the chrome chip and meta-tab tests
   * both rely on `data-testid`.
   */
  [key: `data-${string}`]: string | number | undefined;
};

const baseFor = (
  variant: ButtonVariant,
  size: ButtonSize,
): CSSProperties => {
  if (variant === "chip") return size === "xs" ? chipBaseXs : chipBase;
  if (variant === "chip-tinted") return chipTintedBase;
  if (variant === "icon") return iconBase;
  if (variant === "primary") return primaryBase;
  // ghost: scale padding by size
  if (size === "md") {
    return { ...ghostBase, padding: "7px 14px" };
  }
  return ghostBase;
};

const activeOverride = (variant: ButtonVariant): CSSProperties => {
  if (variant === "chip") {
    return {
      background: "var(--gs-chip-active)",
      color: "var(--gs-chip-active-ink)",
    };
  }
  if (variant === "chip-tinted") {
    return {
      border: "1px solid color-mix(in srgb, var(--gs-primary) 50%, transparent)",
      background:
        "color-mix(in srgb, var(--gs-primary) 14%, transparent)",
      color: "var(--gs-primary)",
    };
  }
  if (variant === "primary") {
    return {
      background: "var(--gs-primary)",
      color: "var(--gs-panel)",
    };
  }
  return {};
};

/**
 * <Button> — chrome-tier button primitive.
 *
 * Pixel-stable contract:
 *   • variant="chip" with active=true → identical CSS to the prior
 *     PerimeterTabStrip mode-tab / meta-tab `chipBase + active override`.
 *   • variant="icon" → identical CSS to the prior FitSheetCard × close
 *     button (`all: "unset"` + 22×22 + pill).
 *   • variant="ghost" with size="sm" → 5px 12px pill with hairline border
 *     (matches the PhotoElevationSheet "Close" inline button).
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { variant = "chip", size = "sm", active = false, style, children, ...rest },
    ref,
  ) {
    const base = baseFor(variant, size);
    const overrides = active ? activeOverride(variant) : {};
    // For the chip variant the hover-lightup behavior was implemented
    // via onMouseEnter / onMouseLeave that mutated `e.currentTarget.style.color`
    // (and skipped when active). That logic lives here, in one place,
    // so all chrome chips share it.
    const hoverHandlers =
      variant === "chip" && !active
        ? {
            onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => {
              e.currentTarget.style.color = "var(--gs-ink)";
              rest.onMouseEnter?.(e);
            },
            onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => {
              e.currentTarget.style.color = "var(--gs-ink-secondary)";
              rest.onMouseLeave?.(e);
            },
          }
        : {};

    return (
      <button
        ref={ref}
        type="button"
        {...rest}
        {...hoverHandlers}
        style={{ ...base, ...overrides, ...style }}
      >
        {children}
      </button>
    );
  },
);