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
 */

export interface GlassCardProps {
  children: ReactNode;
  /** Position of the card within the overlay. */
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center" | CSSProperties;
  /** Optional className for consumer overrides. */
  className?: string;
  /** Inline style override (merged with position). */
  style?: CSSProperties;
}

const positionMap: Record<string, CSSProperties> = {
  "top-left": { top: 12, left: 12 },
  "top-right": { top: 12, right: 12 },
  "bottom-left": { bottom: 12, left: 12 },
  "bottom-right": { bottom: 12, right: 12 },
  center: { top: "50%", left: "50%", transform: "translate(-50%, -50%)" },
};

export function GlassCard({
  children,
  position,
  className,
  style,
}: GlassCardProps) {
  const posStyle =
    typeof position === "string" ? positionMap[position] : position;

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
