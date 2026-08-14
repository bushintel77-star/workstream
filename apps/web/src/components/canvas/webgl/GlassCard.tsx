"use client";

import type { CSSProperties, ReactNode } from "react";

/**
 * Gold Standard 2026 — Glass Card primitive.
 *
 * Binding: docs/GOLD-STANDARD-2026.md §2 ("All UI must be floating Glass Cards")
 *
 * Canvas-first density law: the glass is a SINGLE semi-opaque layer — the
 * drawing reads through every card (one layer of canvas at all times), so
 * cards float on the drawing instead of paneling over it. Compact chrome:
 * small radii, hairline borders, content supplies its own tight spacing.
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
        // Canvas-first: ~38% glass — the drawing reads through the card,
        // keeping "one layer of canvas" always present under the chrome.
        background: "color-mix(in srgb, var(--gs-glass) 38%, transparent)",
        backdropFilter: "blur(var(--gs-blur))",
        WebkitBackdropFilter: "blur(var(--gs-blur))",
        borderRadius: 12,
        border: "1px solid color-mix(in srgb, var(--gs-line) 35%, transparent)",
        ...posStyle,
        ...style,
      }}
      data-gs-glass-card
    >
      {children}
    </div>
  );
}
