"use client";

/**
 * Gold Standard 2026 — Atmospheric Vignette Overlay (Cinematic & Polish Pass).
 *
 * A DOM-layer vignette that matches the WebGL post-processing Vignette effect
 * (offset=0.32, darkness=0.65). This ensures atmospheric cohesion across the
 * plan↔3D transition:
 *
 *   - Plan view (blend≈0): the DOM vignette rests at a quiet 0.25 strength —
 *     depth from light, never darkness; the paper plane stays paper.
 *
 *   - 3D view (blend=1): the DOM vignette fades to ~30% strength. The
 *     post-processing Vignette effect now carries the full atmospheric weight
 *     (perspective depth + fog + the 3D vignette frame), so the DOM layer
 *     becomes a subtle reinforcement rather than a double-up.
 *
 *   - Between: the opacity lerps smoothly with viewBlendTarget — no pop.
 *
 * The vignette sits in the DOM chrome overlay (Layer 3), behind the GlassCards
 * but above the canvas. It is pointer-events:none so it never blocks input.
 *
 * The radial gradient parameters are derived from the post-processing Vignette
 * shader: `smoothstep(offset, offset + darkness, dist)`. With offset=0.32 and
 * darkness=0.65, the transparent core extends to ~32% and full darkness reaches
 * ~97% of the screen radius. The CSS radial-gradient approximates this curve.
 */

import { memo } from "react";
import { useStudioStore } from "./studioStore";

/** The vignette gradient — matches the 3D post-processing Vignette parameters.
 *  Neutral ink tone per the shadow tiers; token-only (consumes --gs-ink-strong,
 *  not a literal RGB triple). */
const VIGNETTE_GRADIENT =
  "radial-gradient(120% 90% at 50% 50%, transparent 32%, color-mix(in srgb, var(--gs-ink-strong) 22%, transparent) 100%)";

/**
 * A subtle inner glow at the vignette edge that gives GlassCards a consistent
 * "floating in atmosphere" read regardless of what's behind them.
 */
const VIGNETTE_INNER_GLOW =
  "radial-gradient(100% 100% at 50% 50%, color-mix(in srgb, var(--gs-shadow) 8%, transparent) 60%, transparent 80%)";

export const VignetteOverlay = memo(function VignetteOverlay() {
  const viewBlendTarget = useStudioStore((s) => s.viewBlendTarget);

  // Plan view: quiet DOM vignette (opacity 0.25 — depth from light, never
  // darkness; the paper plane stays paper, debt D9). 3D view: subtle
  // reinforcement (opacity 0.3) — the post-processing Vignette carries the
  // atmospheric weight in 3D.
  const vignetteOpacity = 0.25 + viewBlendTarget * 0.05;

  return (
    <div
      data-testid="atmospheric-vignette"
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: "var(--cf-z-spatial)", // above canvas, below chrome — uses the SDS z-token rather than a raw number
        opacity: vignetteOpacity,
        transition: "opacity 0.3s ease",
        background: `${VIGNETTE_INNER_GLOW}, ${VIGNETTE_GRADIENT}`,
      }}
    />
  );
});
