"use client";

import type { CSSProperties, ReactNode } from "react";

/**
 * Gold Standard 2026 — Glass Card primitive.
 *
 * Binding: docs/GOLD-STANDARD-2026.md §2 ("All UI must be floating Glass Cards")
 *
 * bg #1E2329/70 + backdrop-blur-md + rounded-2xl.
 *
 * This replaces the neumorphic --hc-neu-* dock plastic and the frost-paper
 * patterns. Glass Cards float over the drawing in the DOM chrome overlay
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
  /** Click handler. */
  onClick?: () => void;
}

const positionMap: Record<string, CSSProperties> = {
  "top-left": { top: 16, left: 16 },
  "top-right": { top: 16, right: 16 },
  "bottom-left": { bottom: 16, left: 16 },
  "bottom-right": { bottom: 16, right: 16 },
  center: { top: "50%", left: "50%", transform: "translate(-50%, -50%)" },
};

export function GlassCard({
  children,
  position,
  className,
  style,
  onClick,
}: GlassCardProps) {
  const posStyle =
    typeof position === "string" ? positionMap[position] : position;

  return (
    <div
      className={className}
      onClick={onClick}
      style={{
        position: "absolute",
        pointerEvents: "auto",
        // Gold Standard §2: Glass Card = --gs-glass at 70% + backdrop-blur-md
        background: "color-mix(in srgb, var(--gs-glass) 70%, transparent)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderRadius: "16px",
        border: "1px solid color-mix(in srgb, var(--gs-line) 50%, transparent)",
        ...posStyle,
        ...style,
      }}
      data-gs-glass-card
    >
      {children}
    </div>
  );
}
