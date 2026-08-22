/**
 * Gold Standard 2026 — cross-component annotation reservations.
 *
 * The callout solver in `annotationLayout.ts` can only avoid rects it is
 * handed. Families that live inside `AnnotationLayer` are handed over directly,
 * but the dimension ring is a separate component drawing separate drei <Html>
 * chips, so before this registry existed a `D-##` callout would happily land on
 * a `B7 · 48.20 m` chip.
 *
 * Producers publish their occupied screen rects during their own `useFrame`;
 * the consumer reads whatever is currently published. Ordering is deliberately
 * NOT guaranteed: R3F runs `useFrame` callbacks in mount order, and any
 * non-zero `renderPriority` hands the render loop to the caller, so buying a
 * strict producer-before-consumer order would mean owning rendering. A rect
 * that is at most one frame stale is imperceptible for collision avoidance.
 *
 * Expiry is by wall clock rather than by frame count so the registry self-heals:
 * when a producer unmounts (dims toggled off) its rects simply age out, with no
 * teardown coupling between components.
 */

import type { AnnotationRect } from "./annotationLayout";

export type AnnotationFamily = "dimensionChip";

/** How long a published rect stays valid. ~7 frames at 60fps. */
export const RESERVATION_MAX_AGE_MS = 120;

interface FamilyEntry {
  at: number;
  rects: AnnotationRect[];
}

const published = new Map<AnnotationFamily, FamilyEntry>();

function clockNow(): number {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}

export function publishAnnotationRects(
  family: AnnotationFamily,
  rects: AnnotationRect[],
  now: number = clockNow(),
): void {
  published.set(family, { at: now, rects });
}

/** Every rect published recently enough to still describe the screen. */
export function readAnnotationRects(
  now: number = clockNow(),
  maxAgeMs: number = RESERVATION_MAX_AGE_MS,
): AnnotationRect[] {
  const out: AnnotationRect[] = [];
  for (const entry of published.values()) {
    if (now - entry.at > maxAgeMs) continue;
    out.push(...entry.rects);
  }
  return out;
}

export function clearAnnotationRects(family?: AnnotationFamily): void {
  if (family) published.delete(family);
  else published.clear();
}
