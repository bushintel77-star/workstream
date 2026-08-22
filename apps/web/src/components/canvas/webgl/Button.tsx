"use client";

/**
 * Gold Standard 2026 — Tier 3 #2: <Button> primitive.
 *
 * The audit found 62 raw `<button>` across 22 files in canvas chrome;
 * this primitive captures the recurring shapes that account for the
 * chrome-tier surface (chip / ghost / icon / primary / capsule /
 * swatch / asset-card) without touching the long tail of file-specific
 * behaviour (stitch records, scrubbers, etc.). Per the standards doc
 * the goal is "start with chrome-tier chips, snapshot pixel-stable to
 * the current visual" — every variant here renders byte-identical to
 * the prior inline styles it replaced.
 *
 * Variants:
 *   • chip        — PerimeterTabStrip mode/meta tab. pill, transparent
 *                   border, charcoal active, hover-lightup only when
 *                   inactive. Letter-spacing 0.04em.
 *   • chip-tinted — PhotoTraceHud calibration chip: same pill recipe
 *                   but the active state is warm `--gs-primary`
 *                   instead of charcoal.
 *   • chip-preset — preset toggle chip (sun-date presets, canvas
 *                   layers, Plan/3D segmented): xs font, chip radius,
 *                   hairline `--gs-line` 45%, charcoal active. No
 *                   hover-lightup (static toggles, not nav tabs).
 *   • ghost       — pill button with hairline border, transparent bg.
 *                   Used for secondary chrome actions (e.g. "Close",
 *                   the InspectorCard un-stitch pill via overrides).
 *   • ghost-line  — secondary action with the strong hairline
 *                   (`--gs-line-strong` 60%), chip radius, 5px 8px.
 *                   Used by the sketch "Convert to CAD features" and
 *                   SketchCadReviewCard's Reject.
 *   • icon        — `all: "unset"` then re-apply a square footprint
 *                   (`22×22` by default). Used for the × close
 *                   affordance and other icon-only chrome.
 *   • primary     — tinted CTA chip: 45% `--gs-primary` hairline over
 *                   a 14% wash, primary ink, chip radius. The
 *                   secondary-action CTA (Review CAD proposals /
 *                   Open CAD drafter). `active` flips it solid.
 *   • cta         — solid primary CTA: 1px solid primary, primary ink
 *                   on panel, weight 600. The dominant "go do this"
 *                   action (Import site truth / Tidy → CAD proposals).
 *                   Disabled dims to 50% + not-allowed.
 *   • glyph       — tech-font icon tool (zoom / undo / redo row):
 *                   hairline chip, lg tech numerals, flex 1. Disabled
 *                   tools go muted + not-allowed (no opacity fade).
 *   • text        — bare text button (border none / transparent /
 *                   pointer). Dismiss × links, selection-clear,
 *                   controls-hint dismiss; per-site font/size/color
 *                   arrive as style overrides.
 *   • capsule     — MetaChipSet boundary-marker pill: panel-frost veil,
 *                   tabular-nums, `--gs-shadow-1`. The per-chip dynamic
 *                   state arrives as consumer style overrides.
 *   • swatch      — StudioToolRail's 42px icon column. Active goes
 *                   charcoal; disabled mutes to 55% + not-allowed;
 *                   hover lifts 1px with `--gs-shadow-1`.
 *   • asset-card  — AssetFanOutDock's discovery card: glass veil +
 *                   blur + radius-xl; the active card takes the gold
 *                   treatment (border, wash, glow, 108px wide).
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
  | "chip-preset"
  | "chip-tinted"
  | "ghost"
  | "ghost-line"
  | "icon"
  | "primary"
  | "cta"
  | "glyph"
  | "text"
  | "capsule"
  | "swatch"
  | "asset-card";
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
 * Primary — tinted CTA chip: hairline `--gs-primary` at 45% over a 14%
 * wash, primary ink, chip radius. The secondary-action CTA recipe used
 * by Review CAD proposals / Open CAD drafter (and StudioCadCard's
 * btnPrimary). The `active` override flips it to the solid charcoal
 * CTA. Font-weight stays inherited (400) — the solid `cta` carries 600.
 */
const primaryBase: CSSProperties = {
  fontFamily: "var(--font-ui)",
  fontSize: "var(--gs-font-sm)",
  padding: "5px 8px",
  borderRadius: "var(--gs-radius-chip)",
  border: "1px solid color-mix(in srgb, var(--gs-primary) 45%, transparent)",
  background:
    "color-mix(in srgb, var(--gs-primary) 14%, transparent)",
  color: "var(--gs-primary)",
  cursor: "pointer",
};

/**
 * CTA — solid primary CTA (border 1px solid primary, primary ink on
 * panel). The dominant "go do this now" action in canvas chrome
 * (Import site truth / Tidy → CAD proposals / SketchCad Accept).
 * Padding "5px 8px" + radius chip; the Reload-canvas fallback and
 * Import variants override padding/minHeight at the callsite.
 */
const ctaBase: CSSProperties = {
  fontFamily: "var(--font-ui)",
  fontSize: "var(--gs-font-sm)",
  fontWeight: 600,
  padding: "5px 8px",
  borderRadius: "var(--gs-radius-chip)",
  border: "1px solid var(--gs-primary)",
  background: "var(--gs-primary)",
  color: "var(--gs-panel)",
  cursor: "pointer",
};

/**
 * Ghost-line — secondary action with the strong hairline (`--gs-line-strong`
 * at 60%). Used by the sketch "Convert to CAD features" button and the
 * InspectorCard un-stitch pill. Padding "5px 8px" + radius chip.
 */
const ghostLineBase: CSSProperties = {
  fontFamily: "var(--font-ui)",
  fontSize: "var(--gs-font-sm)",
  padding: "5px 8px",
  borderRadius: "var(--gs-radius-chip)",
  border: "1px solid color-mix(in srgb, var(--gs-line-strong) 60%, transparent)",
  background: "transparent",
  color: "var(--gs-ink-secondary)",
  cursor: "pointer",
};

/**
 * Glyph — tech-font icon tool button (zoom / undo / redo row). Hairline
 * chip shell with the tech numerals at lg. Disabled tools go muted +
 * not-allowed (no opacity fade — the row reads the disabled state from
 * ink + cursor alone).
 */
const glyphBase: CSSProperties = {
  flex: 1,
  padding: "2px 0",
  border: "1px solid color-mix(in srgb, var(--gs-line) 55%, transparent)",
  borderRadius: "var(--gs-radius-chip)",
  background: "transparent",
  color: "var(--gs-ink-secondary)",
  fontFamily: "var(--font-tech)",
  fontSize: "var(--gs-font-lg)",
  cursor: "pointer",
};

/**
 * Text — bare text button (border none / transparent / pointer). Used by
 * dismiss × links, selection-clear, controls-hint dismiss. Per-site font,
 * size and color arrive as style overrides (the shell is the shared
 * "no chrome, just an action" contract).
 */
const textBase: CSSProperties = {
  border: "none",
  background: "transparent",
  cursor: "pointer",
  padding: 0,
  fontFamily: "var(--font-ui)",
  color: "var(--gs-ink-secondary)",
};

/**
 * Chip-preset — preset toggle chip (sun-date presets, canvas layers,
 * Plan/3D segmented). xs font, chip radius, hairline `--gs-line` at 45%,
 * charcoal on active. No hover-lightup (presets are static toggles, not
 * nav tabs — matches the prior inline behavior).
 */
const chipPresetBase: CSSProperties = {
  fontFamily: "var(--font-ui)",
  fontSize: "var(--gs-font-xs)",
  padding: "3px 8px",
  borderRadius: "var(--gs-radius-chip)",
  border: "1px solid color-mix(in srgb, var(--gs-line) 45%, transparent)",
  background: "transparent",
  color: "var(--gs-ink-secondary)",
  cursor: "pointer",
};

/**
 * Capsule — MetaChipSet's boundary-marker pill: `--gs-panel-frost`
 * veil + hairline + `--gs-shadow-1` + tabular-nums tech numerals.
 * Rendered inside a 3D Html overlay, so it keeps `pointerEvents:
 * "auto"` (the overlay nulls them otherwise). The per-chip dynamic
 * state (bright / expanded opacity, color, translateY, shadow) is
 * passed by the consumer as style overrides, exactly as the prior
 * `...capsuleBase` + overrides spread did.
 */
const capsuleBase: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "var(--gs-space-2)",
  padding: "1px 8px",
  fontFamily: "var(--font-tech)",
  fontSize: "var(--gs-font-xs)",
  fontWeight: 500,
  letterSpacing: "0.01em",
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
  background: "var(--gs-panel-frost)",
  border: "1px solid color-mix(in srgb, var(--gs-line) 60%, transparent)",
  borderRadius: "var(--gs-radius-pill)",
  boxShadow: "var(--gs-shadow-1)",
  color: "var(--gs-ink-muted)",
  cursor: "pointer",
  pointerEvents: "auto",
  transition:
    "opacity 150ms ease, transform 150ms ease, box-shadow 150ms ease",
};

/**
 * Swatch — StudioToolRail's 42px icon column. The active/disabled
 * dependent fields (background, color, cursor, opacity) are applied
 * as overrides so the base stays the invariant shell; the hover lift
 * (translateY −1px + `--gs-shadow-1`) is wired in the component when
 * the variant is `swatch`, with the same disabled guard the prior
 * inline handlers used.
 */
const swatchBase: CSSProperties = {
  width: 42,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "var(--gs-space-1)",
  padding: "5px 0 4px",
  borderRadius: "var(--gs-radius-lg)",
  border: "1px solid transparent",
  background: "transparent",
  color: "var(--gs-ink-secondary)",
  cursor: "pointer",
  transition:
    "background 0.15s, color 0.15s, transform 0.15s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.15s cubic-bezier(0.16, 1, 0.3, 1)",
};

/**
 * Asset card — AssetFanOutDock's discovery card: glass veil, blur,
 * radius-xl, hairline. The active state (gold border, gold wash,
 * glow shadow, 108px width) is the `active` override; the inactive
 * shell (92px) is the base. The gold accent bar / Place CTA children
 * stay with the consumer.
 */
const assetCardBase: CSSProperties = {
  position: "relative",
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: "var(--gs-space-2)",
  padding: "5px 8px",
  borderRadius: "var(--gs-radius-lg)",
  border: "1px solid var(--gs-line)",
  background: "color-mix(in srgb, var(--gs-glass) 38%, transparent)",
  backdropFilter: "blur(var(--gs-blur))",
  WebkitBackdropFilter: "blur(var(--gs-blur))",
  cursor: "pointer",
  transition: "transform 0.2s ease, box-shadow 0.2s ease",
  pointerEvents: "auto",
  width: 68,
  minHeight: 48,
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
  if (variant === "cta") return ctaBase;
  if (variant === "ghost-line") return ghostLineBase;
  if (variant === "glyph") return glyphBase;
  if (variant === "text") return textBase;
  if (variant === "chip-preset") return chipPresetBase;
  if (variant === "capsule") return capsuleBase;
  if (variant === "swatch") return swatchBase;
  if (variant === "asset-card") return assetCardBase;
  // ghost: scale padding by size
  if (size === "md") {
    return { ...ghostBase, padding: "7px 14px" };
  }
  return ghostBase;
};

const activeOverride = (variant: ButtonVariant): CSSProperties => {
  if (variant === "chip" || variant === "chip-preset") {
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
  if (variant === "swatch") {
    return {
      background: "var(--gs-chip-active)",
      color: "var(--gs-chip-active-ink)",
    };
  }
  if (variant === "asset-card") {
    return {
      width: 80,
      minHeight: 56,
      border:
        "1px solid color-mix(in srgb, var(--gs-primary) 50%, transparent)",
      background:
        "color-mix(in srgb, var(--gs-primary) 6%, var(--gs-glass))",
      boxShadow:
        "0 0 12px color-mix(in srgb, var(--gs-primary) 10%, transparent)",
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
    // Disabled-state styling per variant (only when not active):
    //   • swatch     — muted ink, not-allowed, 55% opacity (tool rail).
    //   • cta        — 50% opacity + not-allowed (sketch actions dim
    //                  while disabled; Import overrides with a wait
    //                  cursor + full opacity at the callsite).
    //   • ghost-line — same dim + not-allowed as cta.
    //   • glyph      — muted ink + not-allowed, no opacity fade (the
    //                  zoom/undo/redo row reads disabled from ink only).
    const disabledOverrides =
      !active && rest.disabled
        ? variant === "swatch"
          ? {
              color: "var(--gs-ink-muted)",
              cursor: "not-allowed",
              opacity: 0.55,
            }
          : variant === "cta" || variant === "ghost-line"
            ? { opacity: 0.5, cursor: "not-allowed" }
            : variant === "glyph"
              ? {
                  color: "var(--gs-ink-muted)",
                  cursor: "not-allowed",
                }
              : {}
        : {};
    // Hover behavior was implemented per-variant via onMouseEnter /
    // onMouseLeave that mutated `e.currentTarget`:
    //   • chip — color light-up to --gs-ink, skipped when active.
    //   • swatch — color light-up (skipped when active) + a 1px lift
    //     with --gs-shadow-1, skipped when disabled.
    // Both live here, in one place, so every chrome surface shares it.
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
        : variant === "swatch"
          ? {
              onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => {
                if (rest.disabled) return;
                if (!active) e.currentTarget.style.color = "var(--gs-ink)";
                e.currentTarget.style.transform = "translateY(-1px)";
                e.currentTarget.style.boxShadow = "var(--gs-shadow-1)";
                rest.onMouseEnter?.(e);
              },
              onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => {
                if (rest.disabled) return;
                if (!active)
                  e.currentTarget.style.color = "var(--gs-ink-secondary)";
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "none";
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
        style={{ ...base, ...overrides, ...disabledOverrides, ...style }}
      >
        {children}
      </button>
    );
  },
);