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
 *                   but the active state is warm `--ws-active`
 *                   instead of charcoal.
 *   • chip-preset — preset toggle chip (sun-date presets, canvas
 *                   layers, Plan/3D segmented): xs font, chip radius,
 *                   hairline `--ws-line` 45%, charcoal active. No
 *                   hover-lightup (static toggles, not nav tabs).
 *   • ghost       — pill button with hairline border, transparent bg.
 *                   Used for secondary chrome actions (e.g. "Close",
 *                   the InspectorCard un-stitch pill via overrides).
 *   • ghost-line  — secondary action with the strong hairline
 *                   (`--ws-line-strong` 60%), chip radius, 5px 8px.
 *                   Used by the sketch "Convert to CAD features" and
 *                   SketchCadReviewCard's Reject.
 *   • icon        — `all: "unset"` then re-apply a square footprint
 *                   (`22×22` by default). Used for the × close
 *                   affordance and other icon-only chrome.
 *   • primary     — tinted CTA chip: 45% `--ws-active` hairline over
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
 *                   tabular-nums, `--ws-shadow-1`. The per-chip dynamic
 *                   state arrives as consumer style overrides.
 *   • swatch      — StudioToolRail's 42px icon column. Active goes
 *                   charcoal; disabled mutes to 55% + not-allowed;
 *                   hover lifts 1px with `--ws-shadow-1`.
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
  | "swatch";
export type ButtonSize = "xs" | "sm" | "md";

/**
 * Common chip shell — matches the prior `chipBase` in
 * PerimeterTabStrip.tsx byte-for-byte (the chrome chip recipe).
 */
const chipBase: CSSProperties = {
  fontFamily: "var(--font-ui)",
  fontSize: "var(--ws-text-xs)",
  letterSpacing: "0.04em",
  padding: "3px 9px",
  borderRadius: "var(--ws-radius-pill)",
  border: "1px solid transparent",
  whiteSpace: "nowrap",
  display: "inline-flex",
  alignItems: "center",
  gap: "var(--ws-space-2)",
  cursor: "pointer",
  background: "transparent",
  color: "var(--ws-ink-secondary)",
  transition: "background 0.15s, color 0.15s",
};

/**
 * Tighter chip — same recipe as `chipBase` but with `--ws-text-xs`
 * and 3px 8px padding. Used by InspectorCard's gizmo toggle pills
 * (Move / Rotate) where two chips share a Field row.
 */
const chipBaseXs: CSSProperties = {
  fontFamily: "var(--font-ui)",
  fontSize: "var(--ws-text-xs)",
  letterSpacing: "0.04em",
  padding: "3px 8px",
  borderRadius: "var(--ws-radius-pill)",
  border: "1px solid color-mix(in srgb, var(--ws-line) 55%, transparent)",
  background: "transparent",
  color: "var(--ws-ink-secondary)",
  cursor: "pointer",
};

/**
 * Tinted chip — like `chip` but uses `--ws-active` (warm) instead
 * of `--ws-active` (charcoal) for the active state. Used by
 * PhotoTraceHud's calibration workflow where the warm primary tint
 * reads as the active surface. 4 px 10 px padding (slightly more
 * generous than the chrome `chip` because calibration labels are
 * longer).
 */
const chipTintedBase: CSSProperties = {
  fontFamily: "var(--font-ui)",
  fontSize: "var(--ws-text-xs)",
  padding: "4px 10px",
  borderRadius: "var(--ws-radius-pill)",
  border:
    "1px solid color-mix(in srgb, var(--ws-line) 55%, transparent)",
  background: "transparent",
  color: "var(--ws-ink-secondary)",
  cursor: "pointer",
};

/**
 * Ghost pill — hairline border that becomes visible only on hover,
 * used for secondary chrome actions (the FitSheetCard's "Close"
 * before collapse, etc.). Padding scales with size.
 */
const ghostBase: CSSProperties = {
  fontFamily: "var(--font-ui)",
  fontSize: "var(--ws-text-xs)",
  padding: "5px 12px",
  borderRadius: "var(--ws-radius-pill)",
  border: "1px solid var(--ws-line)",
  background: "transparent",
  color: "var(--ws-ink-secondary)",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

/**
 * Icon-only button — explicit resets instead of `all: "unset"` so the
 * global `button:focus-visible` outline (globals.css) survives and icon
 * buttons stay trackable by keyboard. Re-applies a square footprint over
 * the stripped defaults. Matches FitSheetCard's × close button exactly.
 */
const iconBase: CSSProperties = {
  background: "transparent",
  border: "none",
  padding: 0,
  margin: 0,
  font: "inherit",
  cursor: "pointer",
  width: 22,
  height: 22,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "var(--ws-ink-secondary)",
  fontSize: "var(--ws-text-lg)",
  lineHeight: 1,
  borderRadius: "var(--ws-radius-pill)",
};

/**
 * Primary — tinted CTA chip: hairline `--ws-active` at 45% over a 14%
 * wash, primary ink, chip radius. The secondary-action CTA recipe used
 * by Review CAD proposals / Open CAD drafter (and StudioCadCard's
 * btnPrimary). The `active` override flips it to the solid charcoal
 * CTA. Font-weight stays inherited (400) — the solid `cta` carries 600.
 */
const primaryBase: CSSProperties = {
  fontFamily: "var(--font-ui)",
  fontSize: "var(--ws-text-xs)",
  padding: "5px 8px",
  borderRadius: "var(--ws-radius-2)",
  border: "1px solid color-mix(in srgb, var(--ws-active) 45%, transparent)",
  background:
    "color-mix(in srgb, var(--ws-active) 14%, transparent)",
  /* Primary-ink text on the tinted wash — AA at body sizes (§4). */
  color: "var(--ws-ink)",
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
  fontSize: "var(--ws-text-xs)",
  fontWeight: 600,
  padding: "5px 8px",
  borderRadius: "var(--ws-radius-2)",
  border: "1px solid var(--ws-active)",
  background: "var(--ws-active)",
  color: "var(--ws-panel)",
  cursor: "pointer",
};

/**
 * Ghost-line — secondary action with the strong hairline (`--ws-line-strong`
 * at 60%). Used by the sketch "Convert to CAD features" button and the
 * InspectorCard un-stitch pill. Padding "5px 8px" + radius chip.
 */
const ghostLineBase: CSSProperties = {
  fontFamily: "var(--font-ui)",
  fontSize: "var(--ws-text-xs)",
  padding: "5px 8px",
  borderRadius: "var(--ws-radius-2)",
  border: "1px solid color-mix(in srgb, var(--ws-line-strong) 60%, transparent)",
  background: "transparent",
  color: "var(--ws-ink-secondary)",
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
  border: "1px solid color-mix(in srgb, var(--ws-line) 55%, transparent)",
  borderRadius: "var(--ws-radius-2)",
  background: "transparent",
  color: "var(--ws-ink-secondary)",
  fontFamily: "var(--font-tech)",
  fontSize: "var(--ws-text-sm)",
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
  color: "var(--ws-ink-secondary)",
};

/**
 * Chip-preset — preset toggle chip (sun-date presets, canvas layers,
 * Plan/3D segmented). xs font, chip radius, hairline `--ws-line` at 45%,
 * charcoal on active. No hover-lightup (presets are static toggles, not
 * nav tabs — matches the prior inline behavior).
 */
const chipPresetBase: CSSProperties = {
  fontFamily: "var(--font-ui)",
  fontSize: "var(--ws-text-xs)",
  padding: "3px 6px",
  borderRadius: "var(--ws-radius-2)",
  border: "1px solid color-mix(in srgb, var(--ws-line) 45%, transparent)",
  background: "transparent",
  color: "var(--ws-ink-secondary)",
  cursor: "pointer",
};

/**
 * Capsule — MetaChipSet's boundary-marker pill: frosted paper veil
 * + hairline + `--ws-shadow-1` + tabular-nums tech numerals. Rendered
 * inside a 3D Html overlay, so it keeps `pointerEvents: "auto"` (the
 * overlay nulls them otherwise). The per-chip dynamic state (bright /
 * expanded opacity, color, translateY, shadow) is passed by the
 * consumer as style overrides, exactly as the prior `...capsuleBase`
 * + overrides spread did.
 *
 * Paper-on-dark: these are scene-anchored map labels, not chrome
 * controls — they read as light capsules against the dark canvas, not
 * as dark glass that blends into the ground.
 */
const capsuleBase: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "var(--ws-space-2)",
  padding: "1px 8px",
  fontFamily: "var(--font-tech)",
  fontSize: "var(--ws-text-xs)",
  fontWeight: 500,
  letterSpacing: "0.01em",
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
  background: "var(--ws-panel)",
  border: "1px solid color-mix(in srgb, var(--ws-line) 60%, transparent)",
  borderRadius: "var(--ws-radius-pill)",
  boxShadow: "var(--ws-shadow-1)",
  color: "var(--ws-ink-secondary)",
  cursor: "pointer",
  pointerEvents: "auto",
  transition:
    "opacity 150ms ease, transform 150ms ease, box-shadow 150ms ease",
};

/**
 * Swatch — StudioToolRail's 42px icon column. The active/disabled
 * dependent fields (background, color, cursor, opacity) are applied
 * as overrides so the base stays the invariant shell; the hover lift
 * (translateY −1px + `--ws-shadow-1`) is wired in the component when
 * the variant is `swatch`, with the same disabled guard the prior
 * inline handlers used.
 */
const swatchBase: CSSProperties = {
  width: 42,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "var(--ws-space-1)",
  padding: "5px 0 4px",
  borderRadius: "var(--ws-radius-3)",
  border: "1px solid transparent",
  background: "transparent",
  color: "var(--ws-ink-secondary)",
  cursor: "pointer",
  transition:
    "background 0.15s, color 0.15s, transform 0.15s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.15s cubic-bezier(0.16, 1, 0.3, 1)",
};

/**
 * Asset card — removed with AssetFanOutDock (2026-08-25): the rail-docked
 * AssetLibraryPanel renders its own list rows.
 */

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
  // ghost: scale padding by size
  if (size === "md") {
    return { ...ghostBase, padding: "7px 14px" };
  }
  return ghostBase;
};

const activeOverride = (variant: ButtonVariant): CSSProperties => {
  if (variant === "chip" || variant === "chip-preset") {
    return {
      background: "var(--ws-active)",
      color: "var(--ws-active-ink)",
    };
  }
  if (variant === "chip-tinted") {
    return {
      border: "1px solid color-mix(in srgb, var(--ws-active) 50%, transparent)",
      background:
        "color-mix(in srgb, var(--ws-active) 14%, transparent)",
      /* Charcoal accent on wash — AA at body sizes. */
      color: "var(--ws-ink)",
    };
  }
  if (variant === "primary") {
    return {
      background: "var(--ws-active)",
      color: "var(--ws-panel)",
    };
  }
  if (variant === "swatch") {
    return {
      background: "var(--ws-active)",
      color: "var(--ws-active-ink)",
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
            color: "var(--ws-ink-muted)",
            cursor: "not-allowed",
            opacity: 0.55,
          }
          : variant === "cta" || variant === "ghost-line"
            ? { opacity: 0.5, cursor: "not-allowed" }
            : variant === "glyph"
              ? {
                color: "var(--ws-ink-muted)",
                cursor: "not-allowed",
              }
              : {}
        : {};
    // Hover behavior was implemented per-variant via onMouseEnter /
    // onMouseLeave that mutated `e.currentTarget`:
    //   • chip — color light-up to --ws-ink, skipped when active.
    //   • swatch — color light-up (skipped when active) + a 1px lift
    //     with --ws-shadow-1, skipped when disabled.
    // Both live here, in one place, so every chrome surface shares it.
    const hoverHandlers =
      variant === "chip" && !active
        ? {
          onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => {
            e.currentTarget.style.color = "var(--ws-ink)";
            rest.onMouseEnter?.(e);
          },
          onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => {
            e.currentTarget.style.color = "var(--ws-ink-secondary)";
            rest.onMouseLeave?.(e);
          },
        }
        : variant === "swatch"
          ? {
            onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => {
              if (rest.disabled) return;
              if (!active) e.currentTarget.style.color = "var(--ws-ink)";
              e.currentTarget.style.transform = "translateY(-1px)";
              e.currentTarget.style.boxShadow = "var(--ws-shadow-1)";
              rest.onMouseEnter?.(e);
            },
            onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => {
              if (rest.disabled) return;
              if (!active)
                e.currentTarget.style.color = "var(--ws-ink-secondary)";
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