/**
 * Gold Standard 2026 — Nib swatch geometry (the palette's honest preview).
 *
 * The floating nib palette used four generic Unicode glyphs (◐ ─ ▮ ⠂), so
 * the operator could not tell a chisel band from a stipple run without
 * reading a tooltip. This module derives a real stroke preview for each nib
 * from the SAME `NibSpec` the shader layer consumes — colour, base width,
 * opacity, edge softness and cap all come from `nibs.ts`, so a swatch
 * cannot drift from the ink it promises.
 *
 * Pure and unit-tested: no React, no DOM. The palette renders the returned
 * path / dot run into a small SVG.
 */

import type { NibKind } from "@workstream/contracts";
import { NIBS } from "./nibs";

/** Preview box in CSS px — sized to sit in the 42px swatch column. */
export const NIB_PREVIEW_W = 26;
export const NIB_PREVIEW_H = 14;

/** How many dots a granular nib (stipple) lays along the curve. */
const DOT_COUNT = 6;

/** Edge softness at or above this renders with a feathered edge. */
const SOFT_EDGE_THRESHOLD = 0.3;

export interface NibPreviewDot {
  x: number;
  y: number;
  r: number;
}

export interface NibPreview {
  kind: NibKind;
  /** Stroke path for continuous nibs; null when the nib renders as dots. */
  path: string | null;
  /** Dot run for granular nibs; empty for continuous nibs. */
  dots: NibPreviewDot[];
  /** Rendered stroke width in px, clamped to fit the box. */
  strokeWidth: number;
  color: string;
  opacity: number;
  /** Chisel lays a flat band; the rest are round-capped. */
  linecap: "round" | "butt";
  /** Feathered edge — mirrors a nib's `edgeSoft` (graphite). */
  soft: boolean;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/** Cubic Bezier scalar at t. */
function cubic(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const mt = 1 - t;
  return (
    mt * mt * mt * p0 +
    3 * mt * mt * t * p1 +
    3 * mt * t * t * p2 +
    t * t * t * p3
  );
}

/**
 * The shared swatch curve: a shallow S rising left-to-right, inset far
 * enough that a wide nib cannot clip the box edge. Wide nibs therefore
 * read flatter than thin ones, which is exactly how a marker behaves
 * against a technical pen.
 */
function curveControls(strokeWidth: number) {
  const inset = strokeWidth / 2 + 1;
  const x0 = inset;
  const x1 = NIB_PREVIEW_W - inset;
  const y0 = NIB_PREVIEW_H - inset;
  const y1 = inset;
  const mx = (x0 + x1) / 2;
  return { xs: [x0, mx, mx, x1] as const, ys: [y0, y0, y1, y1] as const };
}

export function nibPreview(kind: NibKind): NibPreview {
  const spec = NIBS[kind];
  const strokeWidth = Math.min(spec.baseWidthPx, NIB_PREVIEW_H - 2);
  const { xs, ys } = curveControls(strokeWidth);
  const granular = spec.mapping.pressureDensity;

  const dots: NibPreviewDot[] = [];
  if (granular) {
    const r = Math.max(1, strokeWidth / 2);
    for (let i = 0; i < DOT_COUNT; i++) {
      const t = i / (DOT_COUNT - 1);
      dots.push({
        x: round2(cubic(xs[0], xs[1], xs[2], xs[3], t)),
        y: round2(cubic(ys[0], ys[1], ys[2], ys[3], t)),
        r: round2(r),
      });
    }
  }

  const path = granular
    ? null
    : `M ${round2(xs[0])} ${round2(ys[0])} C ${round2(xs[1])} ${round2(ys[0])} ` +
      `${round2(xs[2])} ${round2(ys[3])} ${round2(xs[3])} ${round2(ys[3])}`;

  return {
    kind,
    path,
    dots,
    strokeWidth: round2(strokeWidth),
    color: spec.color,
    opacity: spec.opacity,
    linecap: spec.kind === "chisel-marker" ? "butt" : "round",
    soft: spec.edgeSoft >= SOFT_EDGE_THRESHOLD,
  };
}
