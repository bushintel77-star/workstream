"use client";

import type { CSSProperties, ReactNode } from "react";

/**
 * Gold Standard 2026 — Glass Card primitive (Studio Paper).
 *
 * Binding: docs/GOLD-STANDARD-2026.md §2 ("All UI must be floating cards")
 *
 * Studio Paper depth law: the card is a SINGLE frosted layer — white frost,
 * blur, hairline, and a neutral shadow tier. Depth comes from light
 * (gradient + shadow), not darkness; the drawing still reads beneath the
 * frost. Compact chrome: small radii, hairline borders, content supplies
 * its own tight spacing.
 *
 * This replaces the neumorphic --hc-neu-* dock plastic and the frost-paper
 * patterns. Cards float over the drawing in the DOM chrome overlay
 * (Layer 3) — they never render inside the R3F <Canvas>.
 *
 * The container is pointer-events:none by default (so the canvas receives
 * drawing events); the card itself opts back in with pointer-events:auto.
 *
 * Header/footer slots — Tier 3 §1 of docs/UI-ELEMENT-STANDARDS.md. When
 * supplied, they pin to the top and bottom of the card body in a single
 * `flexDirection: "column"` shell, so callers stop hand-rolling the
 * `display: flex / justify-content: space-between` pattern for card
 * chrome. Omitting both slots leaves the inner children rendering
 * exactly as before — pixel-stable for every existing consumer.
 */

export interface GlassCardProps {
  /**
   * Body slot — the scrollable/expandable region between the header
   * and footer. Optional: a header-only or footer-only card is a
   * valid composition (e.g., a divider-style card with title + close).
   */
  children?: ReactNode;
  /** Position of the card within the overlay. */
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center" | CSSProperties;
  /** Optional className for consumer overrides. */
  className?: string;
  /** Inline style override (merged with position). */
  style?: CSSProperties;
  /**
   * Optional header slot — pinned to the top of the card with the
   * `--gs-glass-edge` 12px padding baked in. Renders a top hairline so
   * the header reads as a distinct band from the body when `bodyPadding`
   * is set.
   */
  header?: ReactNode;
  /**
   * Optional footer slot — pinned to the bottom of the card with the
   * same 12px padding. Renders a top hairline so the footer reads as a
   * distinct band from the body. Use for action rows, disclaimers, or
   * status chips that should not scroll with the body.
   */
  footer?: ReactNode;
  /**
   * When `true`, the body section becomes the scrollable region and the
   * header/footer pin in place. Default `false` (the whole card scrolls
   * if a consumer sets `overflow: auto` on the outer style).
   */
  scrollBody?: boolean;
}

const positionMap: Record<string, CSSProperties> = {
  "top-left": { top: 12, left: 12 },
  "top-right": { top: 12, right: 12 },
  "bottom-left": { bottom: 12, left: 12 },
  "bottom-right": { bottom: 12, right: 12 },
  center: { top: "50%", left: "50%", transform: "translate(-50%, -50%)" },
};

const headerFooterShell: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "var(--gs-space-4)",
  padding: "10px 12px",
  flex: "0 0 auto",
};

export function GlassCard({
  children,
  position,
  className,
  style,
  header,
  footer,
  scrollBody = false,
}: GlassCardProps) {
  const posStyle =
    typeof position === "string" ? positionMap[position] : position;

  // No slots → original render path, pixel-stable.
  if (!header && !footer) {
    return (
      <div
        className={className}
        style={{
          position: "absolute",
          pointerEvents: "auto",
          // Studio Paper depth law: frost panel + blur + neutral shadow tier —
          // the card floats above the drawing on light, not darkness.
          background: "var(--gs-glass-veil)",
          backdropFilter: "blur(var(--gs-blur))",
          WebkitBackdropFilter: "blur(var(--gs-blur))",
          borderRadius: "var(--gs-radius-panel)",
          border: "1px solid color-mix(in srgb, var(--gs-line) 55%, transparent)",
          boxShadow: "var(--gs-shadow-2)",
          ...posStyle,
          ...style,
        }}
        data-gs-glass-card
      >
        {children}
      </div>
    );
  }

  // Slot layout: header pinned at top, body in the middle (scrollable
  // when `scrollBody`), footer pinned at the bottom. Consumer still owns
  // the outer position/sizing via `position` + `style` — the shell only
  // supplies the column flex and the hairline dividers.
  const shellStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
  };
  const bodyStyle: CSSProperties = scrollBody
    ? { flex: "1 1 auto", minHeight: 0, overflowY: "auto" }
    : { flex: "0 0 auto" };

  return (
    <div
      className={className}
      style={{
        position: "absolute",
        pointerEvents: "auto",
        background: "var(--gs-glass-veil)",
        backdropFilter: "blur(var(--gs-blur))",
        WebkitBackdropFilter: "blur(var(--gs-blur))",
        borderRadius: "var(--gs-radius-panel)",
        border: "1px solid color-mix(in srgb, var(--gs-line) 55%, transparent)",
        boxShadow: "var(--gs-shadow-2)",
        ...posStyle,
        ...style,
      }}
      data-gs-glass-card
    >
      <div style={shellStyle}>
        {header ? (
          <div
            data-gs-glass-header
            style={{
              ...headerFooterShell,
              borderBottom: "1px solid color-mix(in srgb, var(--gs-line) 35%, transparent)",
            }}
          >
            {header}
          </div>
        ) : null}
        <div data-gs-glass-body style={bodyStyle}>
          {children}
        </div>
        {footer ? (
          <div
            data-gs-glass-footer
            style={{
              ...headerFooterShell,
              borderTop: "1px solid color-mix(in srgb, var(--gs-line) 35%, transparent)",
            }}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}